import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Collection from "./routes/Collection";
import TopPokemon from "./routes/TopPokemon";
import TopTeams from "./routes/TopTeams";
import TeamBuilder from "./routes/TeamBuilder";
import Wishlist from "./routes/Wishlist";
import DataFooter from "./components/DataFooter";

const tabs = [
  { to: "/collection", label: "Collection" },
  { to: "/top-pokemon", label: "Top Mons" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/top-teams", label: "Top Teams" },
  { to: "/team-builder", label: "Builder" },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-20">
        <div className="mx-auto max-w-6xl px-3 pt-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-bold text-[var(--color-accent)]">pokedash</span>
            <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">
              VGC · Champions · Reg M-A
            </span>
          </div>
        </div>
        <nav className="mx-auto max-w-6xl px-3 pb-2 flex gap-1 overflow-x-auto -mb-px">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-2 rounded-t text-sm transition-colors min-h-11 flex items-center ${
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
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-3 py-4 sm:px-4 sm:py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/top-pokemon" replace />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/top-pokemon" element={<TopPokemon />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/top-teams" element={<TopTeams />} />
          <Route path="/team-builder" element={<TeamBuilder />} />
        </Routes>
      </main>
      <DataFooter />
    </div>
  );
}
