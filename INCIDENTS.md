# Incident Log & Fixes

A running record of every non-trivial issue encountered while building and deploying the imagen-async stack, and exactly how each was resolved.

---

## 1. Missing `psql` Client

**Symptom**
```
Error: You must install at least one postgresql-client-<version> package
```
`/usr/bin/psql` existed but was only the Debian `pg_wrapper` shim — no actual client binary was installed.

**Fix**
```bash
sudo apt-get install -y postgresql-client
```

**Alternative (no install required)**
```bash
docker exec -it imagen-postgres psql -U postgres -d imagen -c "SELECT * FROM jobs;"
```

---

## 2. API Crashed on Startup — `ensure_bucket_exists()` at Module Level

**Symptom**
```
botocore.exceptions.EndpointConnectionError: Could not connect to the endpoint URL: "http://minio:9000/images"
ERROR: Application startup failed. Exiting.
```

**Root Cause**
`ensure_bucket_exists()` was called at module import time (top-level code in `api/routes/upload.py`). When uvicorn imported the module on startup it immediately tried to connect to MinIO. If MinIO wasn't fully accepting S3 connections at that exact moment the exception propagated and crashed the process.

The same risk existed for `init_db()` which was also called at module level in `api/main.py`.

**Fix**
Move both calls into a FastAPI lifespan handler so they run after the process is fully up:

```python
# api/main.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ensure_bucket_exists()
    yield

app = FastAPI(lifespan=lifespan)
```

Remove the top-level `ensure_bucket_exists()` call from `upload.py`.

---

## 3. Port 8000 Already in Use

**Symptom**
```
Error response from daemon: failed to bind host port 0.0.0.0:8000/tcp: address already in use
```

**Root Cause**
A uvicorn process was already running on the host from a previous local dev session.

**Fix**
```bash
ss -tlnp sport = :8000          # find the PID
kill <pid>
```

---

## 4. Hardcoded `localhost` — Services Unreachable in Docker / Kubernetes

**Symptom**
Containers could not reach Redis, MinIO, or Postgres because all connection strings were hardcoded to `localhost`.

**Root Cause**
`api/queue.py`, `api/routes/upload.py`, and `worker/main.py` all used hardcoded `localhost` endpoints. Inside Docker/Kubernetes, services are reached by their service name, not `localhost`.

**Fix**
Replace every hardcoded host with an environment variable and a localhost default:

```python
# api/queue.py
redis_client = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"), ...)

# api/routes/upload.py
s3_client = boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT", "http://localhost:9000"), ...)

# worker/main.py — same pattern for both redis and s3
```

Set the correct values in `docker-compose.yaml` and `k8s/*.yaml`:
```yaml
REDIS_HOST: redis
S3_ENDPOINT: http://minio:9000
DATABASE_URL: postgresql://postgres:postgres@postgres:5432/imagen
```

---

## 5. MinIO `network_mode: host` Broke Container Networking

**Symptom**
MinIO was reachable from the host but not from other containers (api, worker).

**Root Cause**
`docker-compose.yaml` had `network_mode: host` on the MinIO service. Host-networked containers aren't on the Docker bridge network so other bridge containers can't reach them by service name.

**Fix**
Remove `network_mode: host` and add explicit port mappings:
```yaml
minio:
  ports:
    - "9000:9000"
    - "9001:9001"
```

---

## 6. Kubernetes — No `depends_on`, initContainers Required

**Symptom**
The API pod crashed in Kubernetes with the same MinIO connection error as issue #2, even though MinIO was running.

**Root Cause**
Kubernetes has no equivalent of Docker Compose's `depends_on: condition: service_healthy`. Pods start in scheduler order regardless of whether their dependencies are ready.

**Fix**
Add `initContainers` to the API and worker deployments. Each initContainer polls a dependency until it accepts connections before the main container starts:

```yaml
initContainers:
  - name: wait-for-postgres
    image: busybox:latest
    command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting; sleep 2; done']
  - name: wait-for-minio
    image: busybox:latest
    command: ['sh', '-c', 'until wget -q --spider http://minio:9000/minio/health/live; do echo waiting; sleep 2; done']
```

---

## 7. Kubernetes — `LoadBalancer` EXTERNAL-IP Stuck `<pending>`

**Symptom**
```
kubectl get service api
NAME   TYPE           CLUSTER-IP   EXTERNAL-IP   PORT(S)
api    LoadBalancer   10.x.x.x     <pending>      8000:32027/TCP
```

**Root Cause**
Running on minikube locally — no cloud load balancer controller to fulfill the `LoadBalancer` service type.

**Workarounds**

*Quick (temporary):*
```bash
kubectl port-forward service/api 8000:8000 --address 0.0.0.0 &
```

*Permanent option A — systemd service:*
```ini
# /etc/systemd/system/kubectl-api-forward.service
[Unit]
Description=kubectl port-forward api
After=network.target

[Service]
ExecStart=/usr/bin/kubectl port-forward service/api 8000:8000 --address 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now kubectl-api-forward
```

*Permanent option B — MetalLB:*
```bash
minikube addons enable metallb
minikube addons configure metallb   # assign a free LAN IP range
```

---

## 8. GPU in Kubernetes — Full Saga

Getting the RTX 4070 into the worker pod required working through several compounding layers of the minikube docker-driver architecture.

### 8.1 Pipeline Hardcoded `.to("cuda")`

**Symptom**
```
RuntimeError: Found no NVIDIA driver on your system.
```

**Root Cause**
All three pipeline files hardcoded `"cuda"` and `torch.float16`. The pod had no GPU.

**Fix (partial — GPU still not wired in)**
Would require updating pipelines to `torch.cuda.is_available()` fallback. Ultimately resolved by getting real GPU access instead.

---

### 8.2 minikube Not Started With `--gpus=all`

**Symptom**
```bash
minikube ssh "nvidia-smi"   # → command not found
```
No `nvidia.com/gpu` resource on the node.

**Root Cause**
minikube was started without `--gpus=all` so the NVIDIA device plugin had nothing to register.

**Fix**
```bash
minikube stop
minikube start --driver=docker --gpus=all
```

---

### 8.3 nvidia-container-toolkit Not Installed Inside minikube

**Symptom**
Device plugin error:
```
If this is a GPU node, did you configure the NVIDIA Container Toolkit?
```

**Root Cause**
`nvidia-container-toolkit` was installed on the host Docker daemon but the minikube node (a Docker container itself) had its own inner Docker daemon that knew nothing about it.

**Fix**
```bash
minikube ssh "sudo apt-get update -qq && sudo apt-get install -y nvidia-container-toolkit"
minikube ssh "sudo nvidia-ctk runtime configure --runtime=containerd && sudo systemctl restart containerd"
```

---

### 8.4 containerd v2 Plugin Name Mismatch

**Symptom**
```
Failed to create pod sandbox: no runtime for "nvidia" is configured
```
Even after configuring nvidia-ctk for containerd.

**Root Cause**
minikube's containerd was v2.2.1. The `nvidia-ctk runtime configure` command wrote config for the old plugin key `io.containerd.grpc.v1.cri`. containerd v2 uses the new key `io.containerd.cri.v1.runtime`. kubelet was querying the old plugin which never had the nvidia runtime registered.

**Fix**
Rewrite the containerd drop-in config with the v2 plugin key:
```bash
minikube ssh "sudo tee /etc/containerd/conf.d/99-nvidia.toml > /dev/null << 'EOF'
version = 3
[plugins]
  [plugins.\"io.containerd.cri.v1.runtime\"]
    [plugins.\"io.containerd.cri.v1.runtime\".containerd]
      [plugins.\"io.containerd.cri.v1.runtime\".containerd.runtimes]
        [plugins.\"io.containerd.cri.v1.runtime\".containerd.runtimes.nvidia]
          runtime_type = \"io.containerd.runc.v2\"
          [plugins.\"io.containerd.cri.v1.runtime\".containerd.runtimes.nvidia.options]
            BinaryName = \"/usr/bin/nvidia-container-runtime\"
            SystemdCgroup = true
EOF
sudo systemctl restart containerd"
```

*However this alone was not sufficient — see 8.5.*

---

### 8.5 kubelet Uses cri-dockerd, Not containerd

**Symptom**
All containerd configuration had no effect.

**Root Cause**
```bash
minikube ssh "cat /var/lib/kubelet/config.yaml | grep containerRuntime"
# containerRuntimeEndpoint: unix:///var/run/cri-dockerd.sock
```
kubelet was using `cri-dockerd` (Docker via CRI), not containerd. All containerd changes were irrelevant.

**Root stack:**
```
kubelet → cri-dockerd → inner Docker daemon (inside minikube container) → GPU
```

**Fix direction**
Configure the **inner** Docker daemon inside minikube, not containerd.

---

### 8.6 Inner Docker Daemon Had No NVIDIA Runtime

**Symptom**
```bash
docker exec minikube docker info | grep "Default Runtime"
# Default Runtime: runc
```

**Root Cause**
minikube runs its own Docker-in-Docker daemon. Only the host Docker had the nvidia runtime configured. The inner daemon was unaware.

**Attempted Fix**
```bash
docker exec minikube bash -c 'cat > /etc/docker/daemon.json << EOF
{
  "default-runtime": "nvidia",
  "runtimes": {
    "nvidia": {
      "path": "/usr/bin/nvidia-container-runtime",
      "runtimeArgs": []
    }
  }
}
EOF
systemctl restart docker'
```

*Partially successful — inner daemon now used nvidia runtime but NVML library still missing — see 8.7.*

---

### 8.7 NVML Library Not Inside minikube Container

**Symptom**
```
nvidia-container-cli: initialization error: load library failed:
libnvidia-ml.so.1: cannot open shared object file: no such file or directory
```

**Root Cause**
The minikube container (Docker-in-Docker) had the GPU device nodes (`/dev/nvidia0` etc.) because the container is privileged, but the NVIDIA driver shared libraries (`libnvidia-ml.so.1`) were only on the host filesystem — not mounted into the minikube container.

**Attempted Fix**
`docker cp /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 minikube:/lib/x86_64-linux-gnu/` — appeared to succeed but files never appeared, because the minikube container's `/tmp` and other paths were shadowed by `tmpfs` mounts, and the overlay filesystem rejected writes via `docker cp` on the `overlayfs` storage driver.

---

### 8.8 Resolution — Delete and Recreate minikube With `--gpus=all`

**Root Cause (final)**
All previous minikube restarts reused the existing container or started without GPU flags, so the nvidia runtime never injected the driver libraries into the minikube container at creation time.

**Fix**
```bash
minikube delete
minikube start --driver=docker --gpus=all
```

When minikube creates the container fresh with `--gpus=all`, Docker's nvidia runtime (now the host default) properly injects both the GPU device nodes **and** the driver libraries at container creation time. minikube also automatically enabled the `nvidia-device-plugin` addon:

```
Enabled addons: storage-provisioner, nvidia-device-plugin, default-storageclass
```

After that:
```bash
kubectl describe node minikube | grep nvidia.com/gpu
# nvidia.com/gpu: 1   ✓
```

---

## 9. GPU Scheduling Deadlock on Rolling Update

### What Happened

After the fresh minikube start, a `kubectl rollout restart deployment/worker` was issued. The worker deployment used the default `RollingUpdate` strategy, which tries to bring up a new pod *before* terminating the old one.

The cluster has a single GPU (`nvidia.com/gpu: 1`). The sequence was:

```
Old worker pod    → holding the GPU (Running)
New worker pod    → Pending, waiting for nvidia.com/gpu
                    → DEADLOCK: GPU never freed because old pod won't
                      terminate until new pod is Ready
```

**Symptom**
```
Warning  FailedScheduling  0/1 nodes are available:
  1 Insufficient nvidia.com/gpu.
  No preemption victims found for incoming pod.
```

The rollout stalled indefinitely.

### Why It Happens

Kubernetes `RollingUpdate` maintains availability by keeping the old pod alive until the replacement is healthy. For most resources this is fine. For **exclusive GPU resources** it creates a deadlock:

- The scheduler cannot place the new pod without a free GPU.
- The GPU won't be freed until the old pod is terminated.
- The old pod won't be terminated until the new pod is running.
- The new pod can never run → infinite wait.

### Fix — Manual Pod Deletion (Immediate)

Force the old pod to terminate, freeing the GPU so the pending pod can be scheduled:

```bash
kubectl delete pod <old-worker-pod-name>
```

### Fix — `strategy: Recreate` (Permanent)

Change the worker deployment strategy so Kubernetes always terminates the existing pod *before* creating the replacement. This guarantees the GPU is always free when the new pod is scheduled:

```yaml
# k8s/worker.yaml
spec:
  replicas: 1
  strategy:
    type: Recreate   # terminate old pod first, then create new one
  template:
    ...
```

**Trade-off:** There will be a brief downtime window during rollouts (old pod dies, new pod starts). For a GPU worker processing async jobs from a queue this is acceptable — jobs simply stay queued until the new pod is ready.

**Applied to:** `k8s/worker.yaml`

---

## Key Lessons

| Layer | Lesson |
|---|---|
| Python | Never make network calls at module import time. Use FastAPI lifespan or startup events. |
| Docker Compose | Remove `network_mode: host` from services that need to communicate with other containers. |
| Kubernetes | There is no `depends_on` — use `initContainers` to gate on dependency readiness. |
| Kubernetes | `LoadBalancer` needs a controller (MetalLB or cloud provider) — use `port-forward` or NodePort for local dev. |
| minikube + GPU | Always start with `minikube start --driver=docker --gpus=all`. Libraries are injected at container creation time — not patchable after the fact. |
| GPU scheduling | Single-GPU workloads must use `strategy: Recreate`. `RollingUpdate` causes permanent deadlock. |
