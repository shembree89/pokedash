import type { EffectiveMon } from "./threat";
import type { Nature, OwnedPokemon, SpSpread, StatKey } from "../data/types";
import { spreadToEvs } from "./sp-converter";
import { STAT_KEYS } from "../data/types";

export type GameType = "Singles" | "Doubles";
export type Weather = "Sun" | "Rain" | "Sand" | "Snow" | "Hail" | "Harsh Sunshine" | "Heavy Rain" | "Strong Winds" | null;
export type Terrain = "Electric" | "Grassy" | "Misty" | "Psychic" | null;

export interface SideState {
  isTailwind?: boolean;
  isHelpingHand?: boolean;
  isLightScreen?: boolean;
  isReflect?: boolean;
  isAuroraVeil?: boolean;
  isFriendGuard?: boolean;
  isProtected?: boolean;
}

export interface MatchField {
  gameType?: GameType;
  weather?: Weather;
  terrain?: Terrain;
  isGravity?: boolean;
  isTrickRoom?: boolean;
  attackerSide?: SideState;
  defenderSide?: SideState;
}

export interface CalcInput {
  attacker: EffectiveMon;
  defender: EffectiveMon;
  move: string;
  attackerItem?: string;
  defenderItem?: string;
  attackerAbility?: string;
  defenderAbility?: string;
  attackerBoosts?: Partial<Record<StatKey, number>>;
  defenderBoosts?: Partial<Record<StatKey, number>>;
  field?: MatchField;
}

export interface CalcResult {
  desc: string;
  damage: readonly number[];
  damageMin: number;
  damageMax: number;
  defenderHP: number;
  pctMin: number;
  pctMax: number;
  koChanceText: string;
  koChance: number;
}

const STAT_MAP: Record<StatKey, string> = {
  hp: "hp",
  atk: "atk",
  def: "def",
  spa: "spa",
  spd: "spd",
  spe: "spe",
};

function toCalcSpecies(name: string): string {
  const megaXY = name.match(/^Mega (.+?) ([XY])$/);
  if (megaXY) return `${megaXY[1]}-Mega-${megaXY[2]}`;
  const mega = name.match(/^Mega (.+)$/);
  if (mega) return `${mega[1]}-Mega`;
  return name;
}

function toEvs(spread: SpSpread | undefined): Record<string, number> {
  if (!spread) return {};
  const evs = spreadToEvs(spread);
  const out: Record<string, number> = {};
  for (const k of STAT_KEYS) out[STAT_MAP[k]] = evs[k] ?? 0;
  return out;
}

function nature(mon: EffectiveMon): Nature {
  return mon.nature ?? "Hardy";
}

type CalcModule = typeof import("@smogon/calc");
let calcModulePromise: Promise<CalcModule> | null = null;
function loadCalc(): Promise<CalcModule> {
  calcModulePromise ??= import("@smogon/calc");
  return calcModulePromise;
}

export async function calcDamage(input: CalcInput): Promise<CalcResult | null> {
  try {
    const { Generations, Pokemon, Move, Field, calculate, toID } = await loadCalc();
    const gen = Generations.get(9);

    const atkSpecies = toCalcSpecies(input.attacker.species);
    const defSpecies = toCalcSpecies(input.defender.species);
    if (!gen.species.get(toID(atkSpecies))) return null;
    if (!gen.species.get(toID(defSpecies))) return null;

    const atk = new Pokemon(gen, atkSpecies, {
      level: 50,
      nature: nature(input.attacker),
      evs: toEvs(input.attacker.spSpread),
      item: input.attackerItem,
      ability: input.attackerAbility ?? input.attacker.ability,
      boosts: input.attackerBoosts,
    });
    const def = new Pokemon(gen, defSpecies, {
      level: 50,
      nature: nature(input.defender),
      evs: toEvs(input.defender.spSpread),
      item: input.defenderItem,
      ability: input.defenderAbility ?? input.defender.ability,
      boosts: input.defenderBoosts,
    });

    const move = new Move(gen, input.move);
    const f = input.field ?? {};
    const field = new Field({
      gameType: f.gameType ?? "Doubles",
      weather: f.weather ?? undefined,
      terrain: f.terrain ?? undefined,
      isGravity: f.isGravity,
      attackerSide: f.attackerSide,
      defenderSide: f.defenderSide,
    });

    const result = calculate(gen, atk, def, move, field);

    const range = result.range();
    const damageArr = Array.isArray(result.damage) ? (result.damage as number[]) : [Number(result.damage)];
    const defHP = def.maxHP();
    const ko = result.kochance();
    return {
      desc: result.desc(),
      damage: damageArr,
      damageMin: range[0],
      damageMax: range[1],
      defenderHP: defHP,
      pctMin: Math.round((range[0] / defHP) * 1000) / 10,
      pctMax: Math.round((range[1] / defHP) * 1000) / 10,
      koChanceText: ko.text ?? "",
      koChance: ko.chance ?? 0,
    };
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[calc] failed:", input.attacker.species, "→", input.defender.species, input.move, err);
    }
    return null;
  }
}

export function prewarmCalc(): Promise<void> {
  return loadCalc().then(() => undefined);
}

export function ownedToEffective(
  mon: Pick<OwnedPokemon, "species" | "nature" | "spSpread" | "item" | "ability" | "mega">,
  resolved: EffectiveMon,
): EffectiveMon {
  return {
    ...resolved,
    nature: mon.nature ?? resolved.nature,
    spSpread: mon.spSpread ?? resolved.spSpread,
    ability: mon.ability ?? resolved.ability,
  };
}
