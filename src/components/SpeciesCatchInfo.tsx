import { useMemo, useState } from "react";
import type { EvoNode } from "../lib/pokeapi-catch";
import type { SpeciesLocations } from "../data/types";
import { useCatchInfo } from "../data/useCatchInfo";
import { useData } from "../data/useData";
import AddPokemonWizard from "./AddPokemonWizard";
import type { MonFormDraft } from "./MonFormFields";

function EvoBranch({ node, depth }: { node: EvoNode; depth: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        {depth > 0 && <span className="text-[var(--color-muted)] text-xs">→</span>}
        <span className="font-medium text-sm">{node.species}</span>
        {node.triggers.length > 0 && (
          <span className="text-[11px] text-[var(--color-muted)]">
            {node.triggers.map((t) => t.summary).join(" · ")}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="ml-4 flex flex-col gap-1">
          {node.children.map((c) => (
            <EvoBranch key={c.species} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function flattenChain(node: EvoNode, out: string[] = []): string[] {
  out.push(node.species);
  for (const c of node.children) flattenChain(c, out);
  return out;
}

function LocationsForSpecies({
  species,
  entry,
}: {
  species: string;
  entry: SpeciesLocations | undefined;
}) {
  if (!entry || entry.groups.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold">{species}</div>
        <div className="text-xs text-[var(--color-muted)]">
          No Gen 8+ locations listed on pokemondb.net.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-semibold">{species}</div>
      <div className="flex flex-col gap-1.5">
        {entry.groups.map((g, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex flex-wrap gap-1">
              {g.games.map((game) => (
                <span
                  key={game}
                  className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide bg-[var(--color-surface-hi)] border border-[var(--color-border)] rounded text-[var(--color-muted)]"
                >
                  {game}
                </span>
              ))}
            </div>
            <div className="text-xs text-[var(--color-fg)]">
              {g.locations.map((l) => l.name).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpeciesCatchInfo({
  species,
  prefill,
}: {
  species: string;
  prefill?: MonFormDraft;
}) {
  const catchStatus = useCatchInfo(species);
  const dataStatus = useData();
  const [wizardOpen, setWizardOpen] = useState(false);

  const chainSpecies = useMemo(() => {
    if (catchStatus.state !== "ready") return [species];
    return flattenChain(catchStatus.data.chain);
  }, [catchStatus, species]);

  const locationsFile = dataStatus.state === "ready" ? dataStatus.data.locations : null;

  if (catchStatus.state === "loading") {
    return <div className="text-xs text-[var(--color-muted)]">Loading…</div>;
  }
  if (catchStatus.state === "missing") {
    return (
      <div className="text-xs text-[var(--color-muted)]">
        PokeAPI has no species data for {species}.
      </div>
    );
  }
  if (catchStatus.state === "error") {
    return (
      <div className="text-xs text-red-400">
        Couldn't load evolution info: {catchStatus.error.message}
      </div>
    );
  }
  if (catchStatus.state === "idle") return null;

  const { chain } = catchStatus.data;
  const hasEvo = chain.children.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWizardOpen(true);
          }}
          className="px-3 min-h-9 rounded text-xs bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium hover:opacity-90"
        >
          + Add {species} to collection
        </button>
      </div>

      {wizardOpen && (
        <AddPokemonWizard
          initialSpecies={species}
          initialDraft={prefill}
          onClose={() => setWizardOpen(false)}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Evolution
        </div>
        {hasEvo ? (
          <EvoBranch node={chain} depth={0} />
        ) : (
          <div className="text-xs text-[var(--color-muted)]">Doesn't evolve.</div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          Where to catch (Sword/Shield and newer)
        </div>
        {!locationsFile ? (
          <div className="text-xs text-[var(--color-muted)]">
            Location data not loaded yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chainSpecies.map((s) => (
              <LocationsForSpecies
                key={s}
                species={s}
                entry={locationsFile.species[s]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
