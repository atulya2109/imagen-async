"use client";

import { useEffect, useRef } from "react";
import { getJob } from "@/lib/api";
import { Job } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed"]);

export function useJobPoller(
  jobId: string | null,
  onUpdate: (job: Job) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!jobId) return;

    let stopped = false;

    async function poll() {
      if (stopped) return;
      try {
        const job = await getJob(jobId!);
        onUpdateRef.current(job);
        if (TERMINAL.has(job.status)) stopped = true;
      } catch {
        // swallow transient errors; keep polling
      }
    }

    poll();
    const id = setInterval(() => {
      if (stopped) {
        clearInterval(id);
        return;
      }
      poll();
    }, 2000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [jobId]);
}
