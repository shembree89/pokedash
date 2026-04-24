export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];

export const STAT_LABEL: Record<StatKey, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export type Nature =
  | "Hardy" | "Lonely" | "Brave" | "Adamant" | "Naughty"
  | "Bold" | "Docile" | "Relaxed" | "Impish" | "Lax"
  | "Timid" | "Hasty" | "Serious" | "Jolly" | "Naive"
  | "Modest" | "Mild" | "Quiet" | "Bashful" | "Rash"
  | "Calm" | "Gentle" | "Sassy" | "Careful" | "Quirky";

export type SpSpread = Record<StatKey, number>;

export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export interface DexMega {
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: Record<StatKey, number>;
  ability: string;
  requiredItem: string;
}

export interface DexEntry {
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: Record<StatKey, number>;
  abilities: string[];
  megas?: DexMega[];
}

export interface Pokedex {
  refreshedAt: string;
  source: string;
  pokemon: Record<string, DexEntry>;
}

export interface UsageEntry {
  species: string;
  rank: number;
  usage: number;
}

export interface MetaUsage {
  format: string;
  regulation: string;
  refreshedAt: string;
  source: string;
  sampleSize?: number;
  pokemon: UsageEntry[];
}

export interface MetaSet {
  name?: string;
  usage: number;
  ability?: string;
  item?: string;
  nature?: Nature;
  moves: string[];
  spSpread?: SpSpread;
  mega?: boolean;
}

export interface MetaUsagePair {
  name: string;
  usage: number;
}

export interface MetaTeammate {
  species: string;
  usage: number;
}

export interface MetaDistribution {
  species: string;
  usage: number;
  moves: MetaUsagePair[];
  items: MetaUsagePair[];
  abilities: MetaUsagePair[];
  teammates: MetaTeammate[];
}

export interface MetaSets {
  format: string;
  regulation: string;
  refreshedAt: string;
  source: string;
  sets: Record<string, MetaSet[]>;
  distributions?: Record<string, MetaDistribution>;
}

export interface MetaTeamMember {
  species: string;
  ability?: string;
  item?: string;
  nature?: Nature;
  moves?: string[];
  spSpread?: Partial<SpSpread>;
  mega?: boolean;
}

export interface MetaTeam {
  id: string;
  name?: string;
  player?: string;
  placement?: string;
  tournament?: string;
  date?: string;
  pokemon: MetaTeamMember[];
}

export interface MetaTeams {
  format: string;
  regulation: string;
  refreshedAt: string;
  source: string;
  teams: MetaTeam[];
}

export interface LocationLink {
  name: string;
  path?: string;
}

export interface GameLocationGroup {
  games: string[];
  locations: LocationLink[];
}

export interface SpeciesLocations {
  species: string;
  groups: GameLocationGroup[];
}

export interface LocationsFile {
  refreshedAt: string;
  source: string;
  species: Record<string, SpeciesLocations>;
}

export type MoveCategory = "Physical" | "Special" | "Status";

export interface MoveMeta {
  name: string;
  type: PokemonType;
  category: MoveCategory;
  basePower: number;
  accuracy: number | true;
  priority: number;
  target: string;
  shortDesc: string;
  flags: string[];
  pp?: number;
}

export interface MovesFile {
  source: string;
  refreshedAt: string;
  count: number;
  moves: MoveMeta[];
}

export interface OwnedPokemon {
  id: string;
  species: string;
  nickname?: string;
  ability: string;
  item: string;
  nature: Nature;
  moves: string[];
  spSpread: SpSpread;
  mega?: boolean;
  notes?: string;
  createdAt: string;
}

export interface SavedTeam {
  id: string;
  name: string;
  ownedIds: string[];
  createdAt: string;
  updatedAt: string;
}
