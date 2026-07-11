"use client";

import { useState, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import { ImagePreview } from "@/components/ImagePreview";
import { ControlModeSelector } from "@/components/ControlModeSelector";
import { InstructionInput } from "@/components/InstructionInput";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";
import { ResultPanel } from "@/components/ResultPanel";
import { useJobPoller } from "@/hooks/useJobPoller";
import { uploadImage, createJob } from "@/lib/api";
import { AppPhase, ControlMode, Job } from "@/lib/types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [controlMode, setControlMode] = useState<ControlMode>("canny");
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setImageUrl(null);
    setJob(null);
    setJobId(null);
    setSubmitError(null);
    setPhase("idle");
  }, []);

  const handleJobUpdate = useCallback((updated: Job) => {
    setJob(updated);
    if (updated.status === "completed" || updated.status === "failed") {
      setPhase("done");
    }
  }, []);

  useJobPoller(phase === "polling" ? jobId : null, handleJobUpdate);

  const handleSubmit = useCallback(async () => {
    if (!file || !instruction.trim()) return;

    setSubmitError(null);

    try {
      let s3Key = imageUrl;
      if (!s3Key) {
        setPhase("uploading");
        s3Key = await uploadImage(file);
        setImageUrl(s3Key);
      }

      setPhase("submitting");
      const newJob = await createJob(s3Key, instruction, controlMode);
      setJob(newJob);
      setJobId(newJob.job_id);
      setPhase("polling");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }, [file, imageUrl, instruction, controlMode]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setImageUrl(null);
    setInstruction("");
    setControlMode("canny");
    setPhase("idle");
    setJobId(null);
    setJob(null);
    setSubmitError(null);
  }, []);

  const busy = phase === "uploading" || phase === "submitting" || phase === "polling";
  const canSubmit = !!file && !!instruction.trim() && !busy;

  return (
    <main className="min-h-screen flex items-start justify-center pt-16 px-4 pb-16">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">imagen-async</h1>
          <p className="text-sm text-zinc-500 mt-1">
            ControlNet-guided image generation
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          {previewUrl ? (
            <div className="space-y-2">
              <ImagePreview src={previewUrl} />
              {!busy && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setImageUrl(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Change image
                </button>
              )}
            </div>
          ) : (
            <DropZone onFile={handleFile} disabled={busy} />
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Prompt
            </label>
            <InstructionInput
              value={instruction}
              onChange={setInstruction}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Control mode
            </label>
            <ControlModeSelector
              value={controlMode}
              onChange={setControlMode}
              disabled={busy}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <SubmitButton
            phase={phase}
            disabled={!canSubmit && phase !== "done"}
            onClick={phase === "done" ? handleReset : handleSubmit}
          />
        </div>

        {job && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500 font-mono">
                {job.job_id.slice(0, 8)}&hellip;
              </span>
              <StatusBadge status={job.status} />
            </div>

            {job.status === "failed" && (
              <p className="text-sm text-red-400">
                Job failed. Please try again.
              </p>
            )}

            {job.status === "completed" && job.result_url && (
              <ResultPanel resultUrl={job.result_url} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
