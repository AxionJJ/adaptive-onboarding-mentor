import { levelLabel } from "@/lib/policy";
import type { Level } from "@/lib/types";

// 세 배지가 한눈에 다르게 보여야 한다. 안내=파랑, 질문=주황, 침묵=회색.
const STYLE: Record<Level, string> = {
  guide: "bg-blue-100 text-blue-800 ring-blue-300",
  ask: "bg-amber-100 text-amber-800 ring-amber-300",
  silent: "bg-zinc-200 text-zinc-600 ring-zinc-300",
};

export function LevelBadge({ level, size = "md" }: { level: Level; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg" ? "px-3 py-1 text-base" : size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm";
  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ring-1 ring-inset ${STYLE[level]} ${sz}`}
    >
      {levelLabel(level)}
    </span>
  );
}
