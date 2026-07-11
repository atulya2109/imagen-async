"use client";

import Image from "next/image";

interface Props {
  src: string;
  alt?: string;
}

export function ImagePreview({ src, alt = "Preview" }: Props) {
  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-zinc-700">
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}
