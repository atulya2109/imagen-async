"use client";

import { AppPhase } from "@/lib/types";

interface Props {
  phase: AppPhase;
  disabled?: boolean;
  onClick: () => void;
}

const LABELS: Record<AppPhase, string> = {
  idle: "Generate",
  uploading: "Uploading…",
  submitting: "Submitting…",
  polling: "Processing…",
  done: "Generate Again",
};

const LOADING: AppPhase[] = ["uploading", "submitting", "polling"];

export function SubmitButton({ phase, disabled, onClick }: Props) {
  const isLoading = LOADING.includes(phase);

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500
        disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold
        text-white transition-colors"
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {LABELS[phase]}
    </button>
  );
}
