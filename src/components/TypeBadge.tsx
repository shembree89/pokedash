import type { PokemonType } from "../data/types";

const TYPE_COLOR: Record<PokemonType, string> = {
  Normal: "#9099a1",
  Fire: "#ff6b3d",
  Water: "#3d9eff",
  Electric: "#f7c948",
  Grass: "#4fb76a",
  Ice: "#7cd1d6",
  Fighting: "#c0392b",
  Poison: "#a45bbf",
  Ground: "#d1a64a",
  Flying: "#8fa7e8",
  Psychic: "#ef5fa3",
  Bug: "#8fb83f",
  Rock: "#a89858",
  Ghost: "#6461a6",
  Dragon: "#6e57e5",
  Dark: "#524c47",
  Steel: "#8d9ea8",
  Fairy: "#ef8ebf",
};

export default function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
      style={{ background: TYPE_COLOR[type] }}
    >
      {type}
    </span>
  );
}
