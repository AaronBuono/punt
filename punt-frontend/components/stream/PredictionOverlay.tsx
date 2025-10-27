"use client";
import { motion } from "framer-motion";

const OVERLAY_ALERT_RED = "#B91C1C";

type PredictionOverlayProps = {
  title: string;
  yesPct: number;
  noPct?: number;
  betsCount?: number;
  secondsLeft?: number;
  labelYes?: string;
  labelNo?: string;
};

export function PredictionOverlay({
  title,
  yesPct,
  noPct,
  betsCount,
  secondsLeft,
  labelYes,
  labelNo,
}: PredictionOverlayProps) {
  const baseYes = typeof yesPct === "number" ? yesPct : 50;
  const baseNo = typeof noPct === "number" ? noPct : 100 - baseYes;
  const clampedYes = Math.min(100, Math.max(0, baseYes));
  const clampedNo = Math.min(100, Math.max(0, baseNo));
  const normalizedYes = typeof labelYes === "string" ? labelYes.trim() : "";
  const normalizedNo = typeof labelNo === "string" ? labelNo.trim() : "";
  const yesLabel = normalizedYes || "YES";
  const noLabel = normalizedNo || "NO";

  return (
    <motion.div
      initial={{ x: 12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="pointer-events-none absolute top-2 right-2 sm:top-4 sm:right-4 z-0 w-[min(220px,28vw)] max-w-[260px]"
    >
      <div className="relative flex flex-col rounded-2xl border border-white/8 bg-black/20 backdrop-blur-xl shadow-md text-white/90 overflow-hidden">
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-semibold text-white/75">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: OVERLAY_ALERT_RED }} />
            Live Prediction
          </span>
          {typeof secondsLeft === "number" && (
            <span className="ml-auto text-white/60">{secondsLeft}s</span>
          )}
        </div>

        <div className="px-4 pb-2 text-sm font-semibold leading-relaxed text-white line-clamp-3">
          {title}
        </div>

        <div className="px-4 pb-3 space-y-2.5">
          <div className="progress-track h-[8px] rounded-full bg-white/8 overflow-hidden">
            <div
              className="progress-segment"
              style={{
                width: `${clampedYes}%`,
                background: "linear-gradient(90deg,rgba(34,197,94,0.92),rgba(34,197,94,0.4))",
              }}
            />
            <div
              className="progress-segment"
              style={{
                width: `${clampedNo}%`,
                background: "linear-gradient(90deg,rgba(185,28,28,0.9),rgba(239,68,68,0.55))",
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5 text-[12px] font-semibold tracking-wide">
            <span className="flex items-center justify-between">
              <span className="text-white/70">{yesLabel}</span>
              <span className="text-emerald-300/90">{clampedYes.toFixed(1)}%</span>
            </span>
            <span className="flex items-center justify-between">
              <span className="text-white/70">{noLabel}</span>
              <span className="text-[#B91C1C]">{clampedNo.toFixed(1)}%</span>
            </span>
          </div>

          {typeof betsCount === "number" && (
            <div className="text-[11px] text-white/55">
              {betsCount.toLocaleString()} {betsCount === 1 ? "bet" : "bets"}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default PredictionOverlay;
