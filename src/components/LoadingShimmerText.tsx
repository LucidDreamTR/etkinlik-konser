import * as React from "react";

type LoadingShimmerTextProps = {
  text: string;
  className?: string;
};

export function LoadingShimmerText({ text, className }: LoadingShimmerTextProps) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className ?? ""}`} aria-live="polite">
      <span className="relative z-10">{text}</span>
      <span
        aria-hidden="true"
        className="shimmer-sweep pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70 mix-blend-screen"
      />
    </span>
  );
}
