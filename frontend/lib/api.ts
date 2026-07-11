import { ControlMode, Job } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MINIO = process.env.NEXT_PUBLIC_MINIO_URL ?? "http://localhost:9000";

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  const data = await res.json();
  return data.image_url as string;
}

export async function createJob(
  imageUrl: string,
  instruction: string,
  controlMode: ControlMode
): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      instruction,
      control_mode: controlMode,
    }),
  });
  if (!res.ok) throw new Error(`Job creation failed: ${res.statusText}`);
  return res.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Job fetch failed: ${res.statusText}`);
  return res.json();
}

export function resolveResultUrl(resultUrl: string): string {
  return `${MINIO}/images/${resultUrl}`;
}
