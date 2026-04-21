import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:brightness-110 font-medium",
  secondary:
    "bg-[var(--color-surface-hi)] text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]",
  danger:
    "bg-red-900/60 text-red-100 border border-red-800 hover:bg-red-800",
  ghost:
    "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
};

export default function Button({
  variant = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={`px-3 min-h-10 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    />
  );
}
