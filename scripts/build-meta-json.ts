import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PIKALYTICS_FORMAT_SLUG,
  fetchFormatIndex,
  fetchMon,
  sleep,
  type FeaturedTeamEntry,
  type MonReport,
} from "./pikalytics.ts";

const OUTPUT_DIR = "public/data";
const TOP_N = 50;
const REQUEST_DELAY_MS = 400;

interface UsageEntry { rank: number; species: string; usage: number }

interface MetaUsagePair { name: string; usage: number }

interface MetaDistribution {
  species: string;
  usage: number;
  moves: MetaUsagePair[];
  items: MetaUsagePair[];
  abilities: MetaUsagePair[];
  teammates: { species: string; usage: number }[];
}

interface SynthesizedSet {
  name: string;
  usage: number;
  ability?: string;
  item?: string;
  moves: string[];
  mega?: boolean;
}

interface TeamMember {
  species: string;
  ability?: string;
  item?: string;
  moves?: string[];
  mega?: boolean;
}

interface MetaTeamOut {
  id: string;
  name?: string;
  player?: string;
  placement?: string;
  tournament?: string;
  date?: string;
  pokemon: TeamMember[];
}

function pickTop<T>(arr: T[], pred: (x: T) => number, n: number): T[] {
  return [...arr].sort((a, b) => pred(b) - pred(a)).slice(0, n);
}

function synthesizeSet(report: MonReport): SynthesizedSet | null {
  const ability = report.abilities[0]?.name;
  const item = report.items[0]?.name;
  const moves = pickTop(report.moves, (m) => m.usage, 4).map((m) => m.name);
  if (!ability && !item && moves.length === 0) return null;
  return {
    name: "Most common",
    usage: report.abilities[0]?.usage ?? 1,
    ability,
    item,
    moves,
  };
}

function teamId(players: FeaturedTeamEntry, pokemon: string[]): string {
  const key = `${players.player}::${players.event}::${pokemon.slice().sort().join(",")}`;
  return Buffer.from(key).toString("base64url").slice(0, 16);
}

function collectTeams(reports: MonReport[]): MetaTeamOut[] {
  // Aggregate member sets by team key.
  type Agg = {
    team: MetaTeamOut;
    memberSets: Map<string, TeamMember>;
  };
  const map = new Map<string, Agg>();
  for (const r of reports) {
    for (const ft of r.featuredTeams) {
      if (!ft.player || !ft.event || ft.pokemon.length === 0) continue;
      const id = teamId(ft, ft.pokemon);
      let agg = map.get(id);
      if (!agg) {
        const members = new Map<string, TeamMember>();
        for (const p of ft.pokemon) members.set(p, { species: p });
        agg = {
          team: {
            id,
            player: ft.player,
            tournament: ft.event,
            placement: ft.record ? `Record ${ft.record}` : undefined,
            pokemon: ft.pokemon.map((p) => members.get(p)!),
          },
          memberSets: members,
        };
        map.set(id, agg);
      }
      const set = ft.setFor;
      if (set && set.species) {
        const existing = agg.memberSets.get(set.species);
        if (existing) {
          existing.ability = existing.ability ?? set.ability;
          existing.item = existing.item ?? set.item;
          existing.moves = existing.moves ?? (set.moves.length ? set.moves : undefined);
        } else {
          // Team featured mon not in the pokemon list — skip
        }
      }
    }
  }
  return [...map.values()].map((a) => a.team);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const limit = args.has("--top-20") ? 20 : TOP_N;

  console.log(`[data] fetching index for format="${PIKALYTICS_FORMAT_SLUG}" (top ${limit})`);
  const index = await fetchFormatIndex();
  const usageEntries: UsageEntry[] = index.entries.slice(0, limit).map((e) => ({
    rank: e.rank,
    species: e.species,
    usage: e.usage,
  }));
  console.log(`[data] index ok, ${usageEntries.length} entries, dataDate=${index.dataDate ?? "?"}`);

  const reports: MonReport[] = [];
  for (const [i, entry] of usageEntries.entries()) {
    process.stdout.write(`\r[data] fetching ${i + 1}/${usageEntries.length} ${entry.species}     `);
    try {
      const report = await fetchMon(entry.species);
      report.usage = entry.usage;
      reports.push(report);
    } catch (e) {
      console.warn(`\n[data] ${entry.species} failed:`, (e as Error).message);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  process.stdout.write("\n");

  const sets: Record<string, SynthesizedSet[]> = {};
  const distributions: Record<string, MetaDistribution> = {};
  for (const r of reports) {
    const syn = synthesizeSet(r);
    if (syn) sets[r.species] = [syn];
    distributions[r.species] = {
      species: r.species,
      usage: r.usage,
      moves: r.moves,
      items: r.items,
      abilities: r.abilities,
      teammates: r.teammates,
    };
  }

  const teams = collectTeams(reports);

  const refreshedAt = new Date().toISOString().slice(0, 10);
  const source = `pikalytics.com/ai/pokedex/${PIKALYTICS_FORMAT_SLUG} (data date ${index.dataDate ?? "unknown"})`;
  const regulation = "Reg M-A";
  const format = "VGC";

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, "meta-usage.json"),
    JSON.stringify(
      { format, regulation, refreshedAt, source, sampleSize: 0, pokemon: usageEntries },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    join(OUTPUT_DIR, "meta-sets.json"),
    JSON.stringify({ format, regulation, refreshedAt, source, sets, distributions }, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    join(OUTPUT_DIR, "meta-teams.json"),
    JSON.stringify({ format, regulation, refreshedAt, source, teams }, null, 2) + "\n",
    "utf8",
  );

  console.log(
    `[data] wrote meta-usage (${usageEntries.length}) meta-sets (${Object.keys(sets).length}) meta-teams (${teams.length})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
