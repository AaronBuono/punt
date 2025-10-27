"use client";

import { useCallback, useMemo, useState } from "react";

type Props = {
  label?: string;
  signature: string;
};

function shortHash(signature: string) {
  if (signature.length <= 18) {
    return signature;
  }
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}

/** Show the latest transaction hash without overwhelming the viewer. */
export function TransactionHashRow({ label = "Last tx", signature }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const display = useMemo(() => (expanded ? signature : shortHash(signature)), [expanded, signature]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.warn("[transaction-hash] copy failed", err);
    }
  }, [signature]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-emerald-300/90">
      <span className="uppercase tracking-[0.22em] text-emerald-200/70">{label}</span>
      <code className="font-mono text-[11px] text-emerald-100" aria-live="polite">
        {display}
      </code>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
          aria-label="Copy transaction hash"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="rounded border border-emerald-400/40 bg-transparent px-2 py-0.5 text-[10px] font-semibold text-emerald-100 transition hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
          aria-label={expanded ? "Collapse transaction hash" : "Expand transaction hash"}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
    </div>
  );
}
