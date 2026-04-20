import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Collection from "./routes/Collection";
import TopPokemon from "./routes/TopPokemon";
import TopTeams from "./routes/TopTeams";
import DataFooter from "./components/DataFooter";

const tabs = [
  { to: "/collection", label: "Collection" },
  { to: "/top-pokemon", label: "Top Pokemon" },
  { to: "/top-teams", label: "Top Teams" },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[var(--color-accent)]">pokedash</span>
            <span className="text-xs text-[var(--color-muted)]">VGC · Pokemon Champions · Reg M-A</span>
          </div>
          <nav className="flex gap-1 ml-auto">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium"
                      : "text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]"
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/top-pokemon" replace />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/top-pokemon" element={<TopPokemon />} />
          <Route path="/top-teams" element={<TopTeams />} />
        </Routes>
      </main>
      <DataFooter />
    </div>
  );
}
