import type { PropsWithChildren } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: PropsWithChildren) {
  return <div className="px-4 py-3 border-b border-[var(--color-border)]">{children}</div>;
}

export function CardBody({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}
