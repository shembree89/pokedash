import type { Nature, OwnedPokemon, SpSpread, StatKey } from "../data/types";
import { emptySpread } from "./sp-converter";

const STAT_NAME_TO_KEY: Record<string, StatKey> = {
  hp: "hp",
  atk: "atk",
  attack: "atk",
  def: "def",
  defense: "def",
  spa: "spa",
  "sp.atk": "spa",
  spatk: "spa",
  "special attack": "spa",
  spd: "spd",
  "sp.def": "spd",
  spdef: "spd",
  "special defense": "spd",
  spe: "spe",
  speed: "spe",
};

const NATURES: Nature[] = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

export interface ParsedSet {
  species: string;
  nickname?: string;
  item?: string;
  ability?: string;
  nature?: Nature;
  moves: string[];
  spSpread: SpSpread;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function parsePokepaste(text: string): ParsedSet[] {
  const blocks = text
    .split(/\r?\n\r?\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const sets: ParsedSet[] = [];
  for (const block of blocks) {
    const parsed = parseOneSet(block);
    if (parsed) sets.push(parsed);
  }
  return sets;
}

function parseOneSet(block: string): ParsedSet | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const header = lines[0];
  const match = header.match(/^(.*?)(?:\s*@\s*(.+))?$/);
  if (!match) return null;
  let speciesPart = match[1].trim();
  const item = match[2]?.trim();
  let nickname: string | undefined;
  const nickMatch = speciesPart.match(/^(.+?)\s*\((.+)\)$/);
  if (nickMatch) {
    nickname = nickMatch[1].trim();
    speciesPart = nickMatch[2].trim();
  }
  speciesPart = speciesPart.replace(/\s*\(M\)|\s*\(F\)$/i, "");
  const species = speciesPart;
  const moves: string[] = [];
  const spread = emptySpread();
  let nature: Nature | undefined;
  let ability: string | undefined;
  for (const line of lines.slice(1)) {
    if (line.startsWith("- ")) {
      const move = line.slice(2).split(" / ")[0].trim();
      if (move) moves.push(move);
    } else if (/^Ability:\s*/i.test(line)) {
      ability = line.replace(/^Ability:\s*/i, "").trim();
    } else if (/^(EVs|SPs):/i.test(line)) {
      const body = line.replace(/^(EVs|SPs):\s*/i, "");
      const isSp = /^SPs:/i.test(line);
      for (const chunk of body.split("/")) {
        const cm = chunk.trim().match(/^(\d+)\s+(.+)$/);
        if (!cm) continue;
        const value = parseInt(cm[1], 10);
        const keyRaw = cm[2].toLowerCase();
        const key = STAT_NAME_TO_KEY[keyRaw] ?? STAT_NAME_TO_KEY[keyRaw.replace(/\./g, "")];
        if (!key) continue;
        spread[key] = isSp ? value : Math.round(value / 8);
      }
    } else if (/Nature$/.test(line)) {
      const name = line.replace(/\s+Nature$/, "").trim();
      if ((NATURES as string[]).includes(name)) nature = name as Nature;
    }
  }
  return { species, nickname, item, ability, nature, moves, spSpread: spread };
}

export function toOwnedPokemon(set: ParsedSet): OwnedPokemon {
  return {
    id: randomId(),
    species: set.species,
    nickname: set.nickname,
    ability: set.ability ?? "",
    item: set.item ?? "",
    nature: set.nature ?? "Hardy",
    moves: set.moves,
    spSpread: set.spSpread,
    createdAt: new Date().toISOString(),
  };
}

export function ownedToPokepaste(mon: OwnedPokemon): string {
  const lines: string[] = [];
  const head = mon.nickname
    ? `${mon.nickname} (${mon.species})`
    : mon.species;
  lines.push(mon.item ? `${head} @ ${mon.item}` : head);
  if (mon.ability) lines.push(`Ability: ${mon.ability}`);
  const spEntries = (["hp", "atk", "def", "spa", "spd", "spe"] as const)
    .filter((k) => (mon.spSpread[k] ?? 0) > 0)
    .map((k) => `${mon.spSpread[k]} ${k.toUpperCase()}`);
  if (spEntries.length > 0) lines.push(`SPs: ${spEntries.join(" / ")}`);
  if (mon.nature) lines.push(`${mon.nature} Nature`);
  for (const m of mon.moves.filter(Boolean)) lines.push(`- ${m}`);
  return lines.join("\n");
}

export function teamToPokepaste(mons: OwnedPokemon[]): string {
  return mons.map(ownedToPokepaste).join("\n\n");
}
