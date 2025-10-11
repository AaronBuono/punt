"use client";
import { lamportsToSol } from "@/lib/solana";

type PollSummaryBarProps = {
  poolYes: number;
  poolNo: number;
  labelYes?: string | null;
  labelNo?: string | null;
  variant?: "studio" | "viewer";
};

export function PollSummaryBar({
  poolYes,
  poolNo,
  labelYes,
  labelNo,
  variant = "studio",
}: PollSummaryBarProps) {
  const total = (poolYes || 0) + (poolNo || 0);
  const hasVolume = total > 0;
  const yesPct = hasVolume ? Math.round((poolYes / total) * 100) : 50;
  const noPct = hasVolume ? 100 - yesPct : 50;

  const yesLabel = labelYes || "YES";
  const noLabel = labelNo || "NO";

  return (
    <div className="space-y-2">
      <div className="progress-track">
        <div
          className="progress-segment"
          style={{ width: `${yesPct}%`, background: "linear-gradient(90deg,#14532d,#15803d,#16a34a)" }}
        />
        <div
          className="progress-segment"
          style={{ width: `${noPct}%`, background: "linear-gradient(90deg,#7f1d1d,#b91c1c,#dc2626)" }}
        />
      </div>
      {variant === "studio" ? (
        <div className="flex justify-between text-[10px] text-dim">
          <span>
            {yesLabel} • {lamportsToSol(poolYes)} SOL ({yesPct}%)
          </span>
          <span>
            {noLabel} • {lamportsToSol(poolNo)} SOL ({noPct}%)
          </span>
        </div>
      ) : (
        <div className="flex justify-between text-[11px] font-semibold text-white/80">
          <span>{yesLabel} • {yesPct}%</span>
          <span>{noLabel} • {noPct}%</span>
        </div>
      )}
    </div>
  );
}

export default PollSummaryBar;
