"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function InstructionInput({ value, onChange, disabled }: Props) {
  return (
    <textarea
      rows={3}
      placeholder="Describe what you want to generate…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100
        placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none
        disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}
