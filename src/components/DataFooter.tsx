import { useData } from "../data/useData";

export default function DataFooter() {
  const status = useData();
  const content = (() => {
    if (status.state === "loading") return "loading data…";
    if (status.state === "error") return `data error: ${status.error.message}`;
    const { usage } = status.data;
    return `${usage.format} · ${usage.regulation} · refreshed ${usage.refreshedAt} · source: ${usage.source}`;
  })();
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-muted)]">
      <div className="mx-auto max-w-6xl px-4 py-2 flex flex-wrap gap-2 justify-between">
        <span>{content}</span>
        <span>
          <a
            href="https://github.com/shembree89/pokedash"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-accent)]"
          >
            github.com/shembree89/pokedash
          </a>
        </span>
      </div>
    </footer>
  );
}
