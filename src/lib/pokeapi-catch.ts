const POKEAPI = "https://pokeapi.co/api/v2";

const NAME_OVERRIDE: Record<string, string> = {
  Basculegion: "basculegion-male",
  Maushold: "maushold-family-of-three",
  Aegislash: "aegislash-shield",
  Palafin: "palafin-zero",
};

export interface EvoTrigger {
  summary: string;
  trigger?: string;
  level?: number;
  item?: string;
  heldItem?: string;
  timeOfDay?: string;
  minHappiness?: number;
  minAffection?: number;
  location?: string;
  knownMove?: string;
  knownMoveType?: string;
  gender?: "male" | "female";
  needsOverworldRain?: boolean;
  turnUpsideDown?: boolean;
  tradeSpecies?: string;
}

export interface EvoNode {
  species: string;
  triggers: EvoTrigger[];
  children: EvoNode[];
}

export interface CatchInfo {
  species: string;
  chain: EvoNode;
}

function apiName(species: string): string {
  if (NAME_OVERRIDE[species]) return NAME_OVERRIDE[species];
  return species.toLowerCase();
}

function prettify(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

interface SpeciesApi {
  name: string;
  evolution_chain: { url: string } | null;
}

interface EvolutionDetailApi {
  trigger: { name: string } | null;
  min_level: number | null;
  item: { name: string } | null;
  held_item: { name: string } | null;
  min_happiness: number | null;
  min_affection: number | null;
  time_of_day: string;
  location: { name: string } | null;
  known_move: { name: string } | null;
  known_move_type: { name: string } | null;
  gender: number | null;
  needs_overworld_rain: boolean;
  turn_upside_down: boolean;
  trade_species: { name: string } | null;
}

interface EvolutionChainApi {
  chain: EvolutionLinkApi;
}

interface EvolutionLinkApi {
  species: { name: string };
  evolution_details: EvolutionDetailApi[];
  evolves_to: EvolutionLinkApi[];
}

function summarizeTrigger(d: EvolutionDetailApi): string {
  const parts: string[] = [];
  if (d.trigger?.name === "level-up") {
    if (d.min_level != null) parts.push(`Level ${d.min_level}`);
    else parts.push("Level up");
  } else if (d.trigger?.name === "use-item" && d.item) {
    parts.push(`Use ${prettify(d.item.name)}`);
  } else if (d.trigger?.name === "trade") {
    parts.push(d.trade_species ? `Trade for ${prettify(d.trade_species.name)}` : "Trade");
  } else if (d.trigger?.name === "shed") {
    parts.push("Level up with empty party slot + Pokeball");
  } else if (d.trigger) {
    parts.push(prettify(d.trigger.name));
  }
  if (d.held_item) parts.push(`holding ${prettify(d.held_item.name)}`);
  if (d.min_happiness != null) parts.push(`Happiness ${d.min_happiness}+`);
  if (d.min_affection != null) parts.push(`Affection ${d.min_affection}+`);
  if (d.time_of_day) parts.push(`(${d.time_of_day})`);
  if (d.location) parts.push(`at ${prettify(d.location.name)}`);
  if (d.known_move) parts.push(`knowing ${prettify(d.known_move.name)}`);
  if (d.known_move_type) parts.push(`knowing ${prettify(d.known_move_type.name)} move`);
  if (d.gender === 1) parts.push("(female)");
  if (d.gender === 2) parts.push("(male)");
  if (d.needs_overworld_rain) parts.push("during rain");
  if (d.turn_upside_down) parts.push("console upside-down");
  return parts.length ? parts.join(" ") : "Evolve";
}

function mapTrigger(d: EvolutionDetailApi): EvoTrigger {
  return {
    summary: summarizeTrigger(d),
    trigger: d.trigger?.name,
    level: d.min_level ?? undefined,
    item: d.item?.name,
    heldItem: d.held_item?.name,
    timeOfDay: d.time_of_day || undefined,
    minHappiness: d.min_happiness ?? undefined,
    minAffection: d.min_affection ?? undefined,
    location: d.location?.name,
    knownMove: d.known_move?.name,
    knownMoveType: d.known_move_type?.name,
    gender: d.gender === 1 ? "female" : d.gender === 2 ? "male" : undefined,
    needsOverworldRain: d.needs_overworld_rain || undefined,
    turnUpsideDown: d.turn_upside_down || undefined,
    tradeSpecies: d.trade_species?.name,
  };
}

function mapLink(link: EvolutionLinkApi): EvoNode {
  return {
    species: prettify(link.species.name),
    triggers: link.evolution_details.map(mapTrigger),
    children: link.evolves_to.map(mapLink),
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

async function fetchSpeciesWithFallback(species: string): Promise<SpeciesApi | null> {
  const primary = apiName(species);
  const primaryHit = await fetchJson<SpeciesApi>(`${POKEAPI}/pokemon-species/${primary}`);
  if (primaryHit) return primaryHit;
  // Regional/form variants (ninetales-alola, rotom-wash, floette-eternal)
  // have no pokemon-species entry — fall back to the base species.
  const base = primary.split("-")[0];
  if (base === primary) return null;
  return fetchJson<SpeciesApi>(`${POKEAPI}/pokemon-species/${base}`);
}

export async function fetchCatchInfo(species: string): Promise<CatchInfo | null> {
  const sp = await fetchSpeciesWithFallback(species);
  if (!sp || !sp.evolution_chain) return null;
  const chain = await fetchJson<EvolutionChainApi>(sp.evolution_chain.url);
  if (!chain) return null;
  return { species, chain: mapLink(chain.chain) };
}
