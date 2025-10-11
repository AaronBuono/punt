"use client";
import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConnection } from "@/lib/solana";

export function WalletBalance() {
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
  const conn = await getConnection();
  const lamports = await conn.getBalance(publicKey, { commitment: "processed" });
      setBalance(lamports / 1_000_000_000);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener("refresh-balance", handler);
    return () => window.removeEventListener("refresh-balance", handler);
  }, [fetchBalance]);

  const displayBalance = loading ? "…" : `${balance?.toFixed(3) ?? "--"} SOL`;

  return (
    <button
      type="button"
      onClick={fetchBalance}
      className="group flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/15 transition disabled:opacity-60"
      title={publicKey ? "Click to refresh" : "Connect wallet to view balance"}
      disabled={!publicKey || loading}
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Balance</span>
      <span className="text-sm font-semibold text-white/90 group-disabled:text-white/60">{displayBalance}</span>
    </button>
  );
}
