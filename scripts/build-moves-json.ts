import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Dex } from "@pkmn/dex";
import { Generations } from "@pkmn/data";

const OUTPUT_DIR = "public/data";
const GEN = 9;

interface MoveMeta {
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  basePower: number;
  accuracy: number | true;
  priority: number;
  target: string;
  shortDesc: string;
  flags: string[];
  pp?: number;
}

const FLAG_KEYS = [
  "contact",
  "protect",
  "sound",
  "punch",
  "bite",
  "slicing",
  "wind",
  "bullet",
  "pulse",
  "powder",
  "dance",
  "heal",
  "mirror",
] as const;

function flagList(flags: Record<string, number | undefined>): string[] {
  return FLAG_KEYS.filter((k) => flags[k]);
}

async function main() {
  const gens = new Generations(Dex);
  const gen = gens.get(GEN);

  const moves: MoveMeta[] = [];
  for (const m of gen.moves) {
    if (m.isNonstandard && m.isNonstandard !== "Unobtainable") continue;
    if (m.isMax || m.isZ) continue;
    moves.push({
      name: m.name,
      type: m.type,
      category: m.category as MoveMeta["category"],
      basePower: m.basePower,
      accuracy: m.accuracy === true ? true : Number(m.accuracy),
      priority: m.priority,
      target: m.target,
      shortDesc: m.shortDesc ?? m.desc ?? "",
      flags: flagList(m.flags as Record<string, number | undefined>),
      pp: m.pp,
    });
  }
  moves.sort((a, b) => a.name.localeCompare(b.name));

  const refreshedAt = new Date().toISOString().slice(0, 10);
  const payload = {
    source: `@pkmn/data gen ${GEN}`,
    refreshedAt,
    count: moves.length,
    moves,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, "moves.json"),
    JSON.stringify(payload, null, 2) + "\n",
    "utf8",
  );
  console.log(`[moves] wrote ${moves.length} moves to ${OUTPUT_DIR}/moves.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
