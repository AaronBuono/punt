"use client";
import { lamportsToSol } from "@/lib/solana";
import {
  CircleDot,
  Flag,
  Wallet2,
  Percent,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
} from "lucide-react";

export interface MarketLike {
  resolved: boolean;
  winningSide: number; // 255 for unset, 0 yes, 1 no
  labelYes?: string | null;
  labelNo?: string | null;
  feesAccrued: number; // lamports
  feeBps: number; // ex: 200
  hostFeeBps: number; // ex: 200
  poolYes: number;
  poolNo: number;
  authority?: string;
}

export function PollStatCards({ market }: { market: MarketLike }) {
  const resultLabel = market.winningSide === 255
    ? '—'
    : market.winningSide === 0
      ? (market.labelYes || 'YES')
      : (market.labelNo || 'NO');
  const totalLamports = (market.poolYes || 0) + (market.poolNo || 0);
  const hasVolume = totalLamports > 0;
  const yesPct = hasVolume ? Math.round((market.poolYes / totalLamports) * 100) : 50;
  const noPct = hasVolume ? 100 - yesPct : 50;
  const yesLabel = market.labelYes || 'YES';
  const noLabel = market.labelNo || 'NO';
  const authorityShort = market.authority ? `${market.authority.slice(0, 4)}…${market.authority.slice(-4)}` : '—';
  const formatFee = (bps: number) => parseFloat((bps / 100).toFixed(2)).toString();

  const cards = [
    {
      icon: <CircleDot className={`w-4 h-4 ${market.resolved ? 'text-zinc-400' : 'text-[color:var(--accent)]'}`} />,
      label: 'Status',
      value: market.resolved ? 'Closed' : 'Live',
    },
    {
      icon: <Flag className="w-4 h-4 text-white/70" />,
      label: 'Result',
      value: resultLabel,
    },
    {
      icon: <BarChart3 className="w-4 h-4 text-sky-300" />,
      label: 'Total Volume',
      value: `${lamportsToSol(totalLamports).toFixed(3)} SOL`,
    },
    {
      icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
      label: `${yesLabel} Pool`,
      value: `${lamportsToSol(market.poolYes).toFixed(3)} SOL (${yesPct}%)`,
    },
    {
      icon: <TrendingDown className="w-4 h-4 text-[color:var(--accent)]" />,
      label: `${noLabel} Pool`,
      value: `${lamportsToSol(market.poolNo).toFixed(3)} SOL (${noPct}%)`,
    },
    {
      icon: <Wallet2 className="w-4 h-4 text-amber-300" />,
      label: 'Fees Ready',
      value: `${lamportsToSol(market.feesAccrued).toFixed(3)} SOL`,
    },
    {
      icon: <Percent className="w-4 h-4 text-white/70" />,
      label: 'Streamer Fee',
      value: `${formatFee(market.feeBps)}%`,
    },
    {
      icon: <Percent className="w-4 h-4 text-[color:var(--accent)]" />,
      label: 'Platform Fee',
      value: `${formatFee(market.hostFeeBps)}%`,
    },
    {
      icon: <Shield className="w-4 h-4 text-white/60" />,
      label: 'Authority',
      value: authorityShort,
    },
  ];

  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] mt-2">
      {cards.map(({ icon, label, value }) => (
        <li key={label} className="bg-white/5 rounded-md p-3 flex items-center gap-2 border border-white/10">
          {icon}
          <div className="flex flex-col">
            <span className="text-dim">{label}</span>
            <span className="text-xs font-semibold text-white/90">{value}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PollStatCards;
