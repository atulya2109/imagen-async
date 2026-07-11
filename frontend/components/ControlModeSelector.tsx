"use client";

import { ControlMode } from "@/lib/types";

const MODES: { value: ControlMode; label: string; description: string }[] = [
  { value: "canny", label: "Canny", description: "Edge detection" },
  { value: "openpose", label: "OpenPose", description: "Pose estimation" },
  { value: "depth", label: "Depth", description: "Depth mapping" },
];

interface Props {
  value: ControlMode;
  onChange: (mode: ControlMode) => void;
  disabled?: boolean;
}

export function ControlModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(mode.value)}
          className={`flex flex-col items-center py-3 px-2 rounded-lg border transition-colors text-sm
            ${
              value === mode.value
                ? "border-indigo-500 bg-indigo-950/50 text-indigo-300"
                : "border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-indigo-600 hover:text-indigo-400"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span className="font-semibold">{mode.label}</span>
          <span className="text-xs opacity-70 mt-0.5">{mode.description}</span>
        </button>
      ))}
    </div>
  );
}
