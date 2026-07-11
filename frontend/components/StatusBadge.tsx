"use client";

import { JobStatus } from "@/lib/types";

const CONFIG: Record<
  JobStatus,
  { label: string; color: string; ping?: boolean }
> = {
  queued: { label: "Queued", color: "bg-yellow-500/20 text-yellow-300" },
  processing: {
    label: "Processing",
    color: "bg-blue-500/20 text-blue-300",
    ping: true,
  },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-300" },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-300" },
};

interface Props {
  status: JobStatus;
}

export function StatusBadge({ status }: Props) {
  const { label, color, ping } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${color}`}
    >
      {ping && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
        </span>
      )}
      {label}
    </span>
  );
}
