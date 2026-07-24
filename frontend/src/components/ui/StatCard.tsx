import type { LucideIcon } from "lucide-react";

type StatTone = "default" | "green" | "amber" | "red";

const TONE_TEXT: Record<StatTone, string> = {
  default: "text-ink",
  green: "text-status-green",
  amber: "text-status-amber",
  red: "text-status-red",
};

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: StatTone;
}

export function StatCard({ label, value, sub, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="border border-rule bg-paper-raised p-5">
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </p>
        {Icon && <Icon className="size-4 text-ink-faint" strokeWidth={2} />}
      </div>
      <p
        className={`mt-3 font-display text-3xl font-medium tabular-nums tracking-tight ${TONE_TEXT[tone]}`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}
