export type ControlMode = "canny" | "openpose" | "depth";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Job {
  job_id: string;
  status: JobStatus;
  result_url?: string;
}

export type AppPhase = "idle" | "uploading" | "submitting" | "polling" | "done";
