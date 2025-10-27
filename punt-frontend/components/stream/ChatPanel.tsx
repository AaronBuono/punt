"use client";
import useSWR from "swr";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface ChatMessage { id: string; ts: number; authority: string; user?: string; text: string; type: 'user' | 'system' }
interface ChatResponse { messages: ChatMessage[] }

const fetcher = (url: string) => fetch(url).then(r=>r.json());
// Hide legacy automated chat announcements while keeping them stored server-side.
const SUPPRESSED_SYSTEM_PHRASES = ["bet placed", "additional bet", "winnings claimed", "winnings auto-claimed", "host fee"];

// Deterministic color for usernames (based on simple hash)
function nameColor(name: string) {
  if (!name) return "#ef4444"; // fallback red
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 65%)`;
}

/**
 * Track viewer scroll position so new chat messages do not force-scroll them away from the stream.
 */
export function ChatPanel({ authority }: { authority: string }) {
  const { publicKey } = useWallet();
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const initialPaintRef = useRef(true);
  const [following, setFollowing] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const { data, mutate } = useSWR<ChatResponse>(`/api/chat?authority=${authority}`, fetcher, { refreshInterval: 2500 });
  const allMessages = data?.messages || [];
  const messages = useMemo(() => {
    if (!allMessages.length) return allMessages;
    return allMessages.filter(m => {
      if (m.type !== 'system') return true;
      const lower = m.text.toLowerCase();
      return !SUPPRESSED_SYSTEM_PHRASES.some(phrase => lower.includes(phrase));
    });
  }, [allMessages]);

  const isAtBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.clientHeight - el.scrollTop <= 100;
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const nearBottom = isAtBottom();
      setFollowing(nearBottom);
      if (nearBottom) {
        setPendingCount(0);
      }
    };
    // run once so UI reflects initial state
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isAtBottom]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (initialPaintRef.current) {
      initialPaintRef.current = false;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      });
      setPendingCount(0);
      setFollowing(true);
      return;
    }
    if (isAtBottom() || following) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setPendingCount(0);
      setFollowing(true);
    } else {
      setPendingCount(count => count + 1);
    }
  }, [messages.length, following, isAtBottom]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ authority, text, user: publicKey?.toBase58() }) });
    await mutate();
  }, [input, authority, publicKey, mutate]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="panel p-4 flex flex-col h-full max-h-[480px] relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="card-header">Chat</h2>
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-[11px]">
        {messages.map(m => {
          const display = m.user ? m.user.slice(0,4)+'…'+m.user.slice(-4) : 'anon';
          const color = m.user ? nameColor(m.user) : '#ef4444';
          return (
            <div key={m.id} className={`leading-snug group ${m.type === 'system' ? 'text-[10px] text-white/60 italic' : ''}`}>
              {m.type === 'system' ? (
                <div className="px-2 py-1 rounded bg-white/5 border border-white/10 inline-block">
                  <span>• {m.text}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="font-semibold" style={{ color }}>{display}</span>
                  <span className="text-white/90 break-words">{m.text}</span>
                </div>
              )}
            </div>
          );
        })}
        {!messages.length && <p className="text-dim text-[10px]">No messages yet.</p>}
      </div>
      {!following && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => {
            const el = scrollerRef.current;
            if (!el) return;
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
            setFollowing(true);
            setPendingCount(0);
          }}
          className="absolute bottom-4 right-4 rounded-full bg-black/70 px-4 py-2 text-[11px] font-semibold text-white shadow-lg border border-white/15 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-live="polite"
        >
          {pendingCount} new {pendingCount === 1 ? 'message' : 'messages'} — Jump to latest
        </button>
      )}
      <div className="pt-3 flex gap-2">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={publicKey ? 'Message' : 'Connect wallet to chat'}
          disabled={!publicKey}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-2 text-[11px] focus:outline-none focus:ring-2 focus:[--tw-ring-color:color-mix(in_oklab,var(--accent)_40%,transparent)] disabled:opacity-40"
        />
  <button onClick={send} disabled={!publicKey || !input.trim()} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] border-transparent disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}
