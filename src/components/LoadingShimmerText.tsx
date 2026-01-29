import * as React from "react";

type LoadingShimmerTextProps = {
  text: string;
  className?: string;
};

export function LoadingShimmerText({ text, className }: LoadingShimmerTextProps) {
  return (
    <span className={`relative inline-flex items-center overflow-hidden ${className ?? ""}`} aria-live="polite">
      <span className="relative z-10">{text}</span>
      <span
        aria-hidden="true"
        className="shimmer-sweep pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"
      />
    </span>
  );
}
