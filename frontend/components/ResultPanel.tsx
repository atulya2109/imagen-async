"use client";

import Image from "next/image";
import { resolveResultUrl } from "@/lib/api";

interface Props {
  resultUrl: string;
}

export function ResultPanel({ resultUrl }: Props) {
  const fullUrl = resolveResultUrl(resultUrl);
  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">Result</h2>
      <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-zinc-700">
        <Image
          src={fullUrl}
          alt="Generated result"
          fill
          className="object-contain"
        />
      </div>
      <a
        href={fullUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download image
      </a>
    </div>
  );
}
