import * as React from "react";

type LoadingShimmerTextProps = {
  text: string;
  className?: string;
};

export function LoadingShimmerText({ text, className }: LoadingShimmerTextProps) {
  return (
    <span className={`relative inline-block ${className ?? ""}`} aria-live="polite">
      <span className="relative z-10">{text}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 shimmer-text animate-shimmer-sweep"
      >
        {text}
      </span>
    </span>
  );
}
