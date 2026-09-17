import { LevelBadge, levelBorder } from "./LevelBadge";
import { DOMAIN_LABELS } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import type { Domain, Level } from "@/lib/types";

/** 영역 카드. 이 제품의 주인공. 세 장이 나란히 서서 수준이 다르다는 걸 보여준다. */
export function DomainCard({
  domain,
  level,
  reason,
  children,
  emphasize = false,
}: {
  domain: Domain;
  level: Level;
  reason?: string;
  children?: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-card p-6 ${levelBorder(level)} ${
        emphasize && level === "guide" ? "shadow-[0_0_0_3px_var(--guide-bg)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-muted">{DOMAIN_LABELS[domain]}</span>
        <span className="text-xs text-faint">{PERSONAS[domain].name}</span>
      </div>
      <div>
        <LevelBadge level={level} size="lg" />
      </div>
      {reason && <p className="text-[13px] leading-relaxed text-muted">{reason}</p>}
      {children}
    </div>
  );
}
