import { levelLabel } from "@/lib/policy";
import type { Level } from "@/lib/types";

// 이 제품에서 가장 눈에 띄어야 하는 요소. 안내=파랑, 질문=주황, 침묵=회색.
const TONE: Record<Level, { pill: string; dot: string; line: string }> = {
  guide: { pill: "bg-guide-bg text-guide-fg", dot: "bg-guide-dot", line: "border-guide-line" },
  ask: { pill: "bg-ask-bg text-ask-fg", dot: "bg-ask-dot", line: "border-ask-line" },
  silent: { pill: "bg-silent-bg text-silent-fg", dot: "bg-silent-dot", line: "border-silent-line" },
};

export function levelBorder(level: Level): string {
  return TONE[level].line;
}

export function LevelBadge({
  level,
  size = "md",
}: {
  level: Level;
  size?: "sm" | "md" | "lg";
}) {
  const t = TONE[level];
  const sz =
    size === "lg"
      ? "gap-2.5 px-4 py-2 text-[22px]"
      : size === "sm"
        ? "gap-1.5 px-2 py-0.5 text-xs"
        : "gap-2 px-3 py-1 text-sm";
  const dot = size === "lg" ? "h-2.5 w-2.5" : size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <span className={`inline-flex items-center rounded-full font-black leading-none ${t.pill} ${sz}`}>
      <span className={`rounded-full ${t.dot} ${dot}`} />
      {levelLabel(level)}
    </span>
  );
}
