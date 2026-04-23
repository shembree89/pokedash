import type { DexEntry, DexMega, MetaTeamMember, Nature, SpSpread, StatKey } from "../data/types";
import { emptySpread } from "./sp-converter";

export type Role =
  | "fast-physical"
  | "fast-special"
  | "slow-physical"
  | "slow-special"
  | "assault-vest"
  | "phys-wall"
  | "spec-wall"
  | "bulky-support"
  | "tailwind-support";

export const ROLE_LABEL: Record<Role, string> = {
  "fast-physical": "Fast physical",
  "fast-special": "Fast special",
  "slow-physical": "TR physical",
  "slow-special": "TR special",
  "assault-vest": "AV bulky",
  "phys-wall": "Physical wall",
  "spec-wall": "Special wall",
  "bulky-support": "Support",
  "tailwind-support": "Speed support",
};

const SUPPORT_MOVES = new Set([
  "Fake Out", "Follow Me", "Rage Powder", "Helping Hand",
  "Wide Guard", "Quick Guard", "Ally Switch", "After You",
  "Taunt", "Encore", "Disable", "Imprison", "Endeavor",
  "Thunder Wave", "Will-O-Wisp", "Spore", "Sleep Powder", "Stun Spore",
  "Glare", "Hypnosis", "Yawn", "Confuse Ray",
  "Tailwind", "Trick Room", "Light Screen", "Reflect", "Aurora Veil",
  "Haze", "Simple Beam", "Skill Swap", "Trick", "Switcheroo", "Magic Coat",
  "Recover", "Roost", "Synthesis", "Moonlight", "Wish", "Heal Pulse", "Pollen Puff",
  "Whirlwind", "Roar", "Dragon Tail", "Teleport", "Parting Shot",
  "Protect", "Detect", "Spiky Shield", "Baneful Bunker",
]);

const SPECIAL_BIAS_ITEMS = new Set(["Choice Specs", "Wise Glasses"]);
const PHYSICAL_BIAS_ITEMS = new Set(["Choice Band", "Muscle Band"]);

function activeMega(entry: DexEntry, item?: string, mega?: boolean): DexMega | undefined {
  if (!mega || !entry.megas || entry.megas.length === 0) return undefined;
  if (!item) return entry.megas[0];
  const lower = item.toLowerCase();
  return entry.megas.find((m) => m.requiredItem.toLowerCase() === lower) ?? entry.megas[0];
}

export function roleBaseStats(entry: DexEntry, member: Pick<MetaTeamMember, "item" | "mega">): Record<StatKey, number> {
  const mega = activeMega(entry, member.item, member.mega);
  return mega?.baseStats ?? entry.baseStats;
}

interface InferInput {
  item?: string;
  moves?: string[];
  mega?: boolean;
  ability?: string;
}

export function inferRole(
  member: InferInput,
  entry: DexEntry,
  teamMoves?: string[],
): Role {
  const base = roleBaseStats(entry, member);
  const moves = (member.moves ?? []).filter(Boolean);
  const item = member.item?.trim();

  const supportMoveCount = moves.reduce((n, m) => n + (SUPPORT_MOVES.has(m) ? 1 : 0), 0);
  const attackingMoveCount = moves.length - supportMoveCount;
  const isSupport = supportMoveCount >= 2 && attackingMoveCount <= 1;

  const selfTrickRoom = moves.includes("Trick Room");
  const teamTrickRoom = (teamMoves ?? []).includes("Trick Room");
  const hasTailwind = moves.includes("Tailwind");

  let physical = base.atk >= base.spa;
  if (item && SPECIAL_BIAS_ITEMS.has(item)) physical = false;
  if (item && PHYSICAL_BIAS_ITEMS.has(item)) physical = true;

  if (item === "Assault Vest") return "assault-vest";
  if (item === "Eviolite") return physical ? "phys-wall" : "spec-wall";
  if (item === "Rocky Helmet" && isSupport) return "phys-wall";

  if (selfTrickRoom) return "bulky-support";
  if (isSupport && hasTailwind) return "tailwind-support";
  if (isSupport) return "bulky-support";

  if (teamTrickRoom) return physical ? "slow-physical" : "slow-special";
  return physical ? "fast-physical" : "fast-special";
}

// Champions SP budget: total ≤ 66, per-stat ≤ 32.
// Natures below never reduce a stat the role actively uses.
export function spreadForRole(
  role: Role,
  base: Record<StatKey, number>,
): { spread: SpSpread; nature: Nature } {
  const s = emptySpread();
  switch (role) {
    case "fast-physical":
      s.hp = 2; s.atk = 32; s.spe = 32;
      return { spread: s, nature: "Jolly" };
    case "fast-special":
      s.hp = 2; s.spa = 32; s.spe = 32;
      return { spread: s, nature: "Timid" };
    case "slow-physical":
      s.hp = 32; s.atk = 32; s.def = 2;
      return { spread: s, nature: "Brave" };
    case "slow-special":
      s.hp = 32; s.spa = 32; s.spd = 2;
      return { spread: s, nature: "Quiet" };
    case "assault-vest": {
      const physical = base.atk >= base.spa;
      s.hp = 32;
      s.spd = 2;
      if (physical) { s.atk = 32; return { spread: s, nature: "Adamant" }; }
      s.spa = 32;
      return { spread: s, nature: "Modest" };
    }
    case "phys-wall":
      s.hp = 32; s.def = 32; s.spd = 2;
      return { spread: s, nature: "Bold" };
    case "spec-wall":
      s.hp = 32; s.spd = 32; s.def = 2;
      return { spread: s, nature: "Calm" };
    case "bulky-support":
      s.hp = 32; s.def = 16; s.spd = 16; s.spe = 2;
      return { spread: s, nature: "Calm" };
    case "tailwind-support":
      s.hp = 16; s.def = 16; s.spd = 16; s.spe = 18;
      return { spread: s, nature: "Timid" };
  }
}

export function inferSpread(
  member: InferInput,
  entry: DexEntry,
  teamMoves?: string[],
): { role: Role; spread: SpSpread; nature: Nature } {
  const role = inferRole(member, entry, teamMoves);
  const base = roleBaseStats(entry, member);
  const { spread, nature } = spreadForRole(role, base);
  return { role, spread, nature };
}
