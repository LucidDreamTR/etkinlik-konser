import * as React from "react";

type LoadingShimmerTextProps = {
  text: string;
  className?: string;
};

export function LoadingShimmerText({ text, className }: LoadingShimmerTextProps) {
  return (
    <span className={className ?? ""} aria-live="polite">
      <span className="shimmer-text">{text}</span>
    </span>
  );
}
