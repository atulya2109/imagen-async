# imagen-async

Asynchronous image-generation pipeline: a **FastAPI** service accepts uploads and job requests, **Redis** queues work and tracks job status, and a **Python worker** consumes jobs (intended for ControlNet / GPU workloads). Object storage uses **MinIO** (S3-compatible). **PostgreSQL** is available via Docker Compose for future persistence; job state today lives in Redis.

## Architecture

```
Client ──► FastAPI ──► MinIO (uploads)
              │
              └──► Redis (queue + status) ◄── BRPOP ── Worker
```

A diagram you can open in [Excalidraw](https://excalidraw.com) is in [`docs/imagen-async-architecture.excalidraw`](docs/imagen-async-architecture.excalidraw).

## Requirements

- Python **3.11+**
- [uv](https://docs.astral.sh/uv/) (recommended) or another PEP 517 installer
- **Docker** (for Postgres, Redis, MinIO)

## Setup

```bash
git clone https://github.com/atulya2109/imagen-async.git
cd imagen-async
uv sync
```

Start infrastructure:

```bash
docker compose up -d
```

Create the MinIO bucket if needed (the upload route attempts to create bucket `images` on startup).

## Run the API

```bash
uv run uvicorn api.main:app --reload
```

- Health: `GET http://127.0.0.1:8000/health`

## Run the worker

In another terminal:

```bash
uv run python -m worker.main
```

The worker blocks on `BRPOP jobs`, updates `job:{id}:status` to `processing`, then `completed` or `failed`. `process_job()` is currently a placeholder (replace with your inference pipeline).

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Multipart file upload; returns `{ "image_url": "uploads/<uuid>.jpg" }` |
| `POST` | `/jobs` | Body: `image_url`, `instruction`, `control_mode`; returns `job_id`, `status` |
| `GET` | `/jobs/{job_id}` | Returns current `status` from Redis |

Example job body:

```json
{
  "image_url": "uploads/your-key.jpg",
  "instruction": "your editing instruction",
  "control_mode": "canny"
}
```

## Configuration (defaults)

The code assumes local development endpoints:

- Redis: `localhost:6379`
- MinIO / S3 API: `http://localhost:9000` (credentials `minioadmin` / `minioadmin`, bucket `images`)
- Postgres: `localhost:5432` (from Compose; SQLAlchemy models exist under `api/models.py` but routes use Redis for queue/status)

Adjust these in `api/queue.py`, `api/routes/upload.py`, and `worker/main.py` for other environments.

## Project layout

```
imagen-async/
├── api/
│   ├── main.py           # FastAPI app
│   ├── models.py         # SQLAlchemy Job model (Postgres)
│   ├── queue.py          # Redis queue + status helpers
│   └── routes/
│       ├── upload.py     # S3 upload to MinIO
│       └── jobs.py       # Create job, get status
├── worker/
│   └── main.py           # Redis consumer
├── docker-compose.yaml   # postgres, redis, minio
└── docs/                 # architecture diagram (Excalidraw)
```

## License

Add a `LICENSE` file if you plan to publish this repository publicly.
