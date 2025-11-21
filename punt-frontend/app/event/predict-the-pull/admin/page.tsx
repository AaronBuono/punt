"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import useSWR from "swr";

interface EventPoll {
  id: string;
  question: string;
  status: string;
  outcome: string | null;
  totalPot: number;
  cardWinner: string | null;
  createdAt: string;
  settledAt: string | null;
  bets: EventBet[];
}

interface EventBet {
  id: string;
  wallet: string;
  handle: string;
  choice: string;
  stake: number;
  payout: number | null;
  isCardWinner: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminPage() {
  const { addToast } = useToast();
  
  const ADMIN_PASSWORD = "ILoveGambling67";
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [newQuestion, setNewQuestion] = useState("Will this pack contain an Ultra Rare or better?");
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch active poll
  const { data: pollData, mutate } = useSWR<{ poll: EventPoll | null }>(
    isAuthenticated ? "/api/event/poll" : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  const poll = pollData?.poll;

  // Load authentication from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("event_admin_auth");
    if (saved === "granted") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = () => {
    if (!passwordInput.trim()) {
      addToast({ type: "error", message: "Please enter password" });
      return;
    }
    if (passwordInput.trim() === ADMIN_PASSWORD) {
      localStorage.setItem("event_admin_auth", "granted");
      setIsAuthenticated(true);
      addToast({ type: "success", message: "Authenticated!" });
    } else {
      addToast({ type: "error", message: "Incorrect password" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("event_admin_auth");
    setPasswordInput("");
    setIsAuthenticated(false);
  };

  const createPoll = async () => {
    if (!newQuestion.trim()) {
      addToast({ type: "error", message: "Question is required" });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/event/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: newQuestion.trim(),
          adminSecret: ADMIN_PASSWORD,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create poll");
      }

      addToast({ type: "success", message: "Poll created!" });
      mutate();
    } catch (error) {
      console.error("Failed to create poll:", error);
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to create poll",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const freezePoll = async () => {
    if (!poll) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/event/poll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          action: "freeze",
          adminSecret: ADMIN_PASSWORD,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to freeze poll");
      }

      addToast({ type: "success", message: "Poll frozen!" });
      mutate();
    } catch (error) {
      console.error("Failed to freeze poll:", error);
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to freeze poll",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const settlePoll = async (outcome: "ULTRA_RARE" | "NO_ULTRA_RARE") => {
    if (!poll) return;

    if (!confirm(`Settle poll with outcome: ${outcome}? This cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/event/poll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          action: "settle",
          outcome,
          adminSecret: ADMIN_PASSWORD,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to settle poll");
      }

      addToast({ type: "success", message: "Poll settled!" });
      mutate();
    } catch (error) {
      console.error("Failed to settle poll:", error);
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to settle poll",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Auth screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">
              Admin Access
            </h1>

            <div className="space-y-4">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAuth();
                }}
              />

              <button
                onClick={handleAuth}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-white transition"
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-3 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Event Admin</h1>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 text-sm transition whitespace-nowrap"
          >
            Logout
          </button>
        </div>

        {/* Create Poll Section */}
        {(!poll || poll.status === "settled") && (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
              {poll?.status === "settled" ? "Create Next Poll" : "Create New Poll"}
            </h2>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-white/70 text-xs sm:text-sm mb-2">Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm sm:text-base placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={200}
                  placeholder="Will this pack contain an Ultra Rare or better?"
                />
              </div>

              <button
                onClick={createPoll}
                disabled={isCreating || !newQuestion.trim()}
                className="w-full py-2.5 sm:py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm sm:text-base transition"
              >
                {isCreating ? "Creating..." : "Create Poll"}
              </button>
            </div>
          </div>
        )}

        {/* Active Poll Section */}
        {poll && (
          <div className="space-y-4 sm:space-y-6">
            {/* Poll Status Card */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                    {poll.status === "settled" ? "Previous Poll" : "Current Poll"}
                  </h2>
                  <p className="text-white/70 text-sm sm:text-base break-words">{poll.question}</p>
                </div>
                <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  poll.status === "active" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                  poll.status === "frozen" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                  "bg-gray-500/20 text-gray-400 border border-gray-500/30"
                }`}>
                  {poll.status.toUpperCase()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
                <div className="p-2 sm:p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-[10px] sm:text-xs mb-1">Total Bets</p>
                  <p className="text-white font-bold text-lg sm:text-xl">{poll.bets.length}</p>
                </div>
                <div className="p-2 sm:p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-[10px] sm:text-xs mb-1">Total Pot</p>
                  <p className="text-white font-bold text-lg sm:text-xl">${poll.totalPot.toFixed(2)}</p>
                </div>
                <div className="p-2 sm:p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-[10px] sm:text-xs mb-1">YES Bets</p>
                  <p className="text-white font-bold text-lg sm:text-xl">
                    {poll.bets.filter((b) => b.choice === "YES").length}
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-[10px] sm:text-xs mb-1">NO Bets</p>
                  <p className="text-white font-bold text-lg sm:text-xl">
                    {poll.bets.filter((b) => b.choice === "NO").length}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {poll.status === "active" && (
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Actions</h3>
                <button
                  onClick={freezePoll}
                  disabled={isProcessing || poll.bets.length === 0}
                  className="w-full py-2.5 sm:py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-white text-sm sm:text-base transition"
                >
                  {isProcessing ? "Freezing..." : "🧊 Freeze Poll (Lock Bets)"}
                </button>
                {poll.bets.length === 0 && (
                  <p className="text-white/50 text-xs mt-2 text-center">
                    Need at least 1 bet to freeze
                  </p>
                )}
              </div>
            )}

            {poll.status === "frozen" && (
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Settle Poll</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={() => settlePoll("ULTRA_RARE")}
                    disabled={isProcessing}
                    className="py-3 sm:py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 rounded-lg font-bold text-white text-sm sm:text-base transition"
                  >
                    🌟 Ultra Rare Pulled!
                  </button>
                  <button
                    onClick={() => settlePoll("NO_ULTRA_RARE")}
                    disabled={isProcessing}
                    className="py-3 sm:py-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 rounded-lg font-bold text-white text-sm sm:text-base transition"
                  >
                    ❌ No Ultra Rare
                  </button>
                </div>
              </div>
            )}

            {/* Bets List */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
                All Bets ({poll.bets.length})
              </h3>
              
              <div className="space-y-2 max-h-[50vh] sm:max-h-96 overflow-y-auto pr-1">
                {poll.bets.length === 0 ? (
                  <p className="text-white/50 text-center py-8 text-sm">No bets yet</p>
                ) : (
                  poll.bets.map((bet) => (
                    <div
                      key={bet.id}
                      className="p-2.5 sm:p-3 bg-white/5 border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm sm:text-base truncate">{bet.handle}</p>
                        <p className="text-white/50 text-[10px] sm:text-xs font-mono">
                          {bet.wallet.slice(0, 4)}...{bet.wallet.slice(-4)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          bet.choice === "YES" 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {bet.choice}
                        </div>
                        
                        {bet.payout !== null && bet.payout !== undefined && (
                          <div className="text-right">
                            <p className="text-white font-medium text-sm">${Number(bet.payout).toFixed(2)}</p>
                            {bet.isCardWinner && (
                              <p className="text-yellow-400 text-[10px] sm:text-xs whitespace-nowrap">🎴 Card Winner</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Summary (if settled) */}
            {poll.status === "settled" && poll.outcome && (
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Settlement Summary</h3>
                
                <div className="space-y-2 sm:space-y-3">
                  <div className="p-2.5 sm:p-3 bg-white/5 rounded-lg">
                    <p className="text-white/50 text-[10px] sm:text-xs mb-1">Outcome</p>
                    <p className="text-white font-bold text-sm sm:text-base">
                      {poll.outcome === "ULTRA_RARE" ? "🌟 Ultra Rare Pulled!" : "❌ No Ultra Rare"}
                    </p>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-white/5 rounded-lg">
                    <p className="text-white/50 text-[10px] sm:text-xs mb-1">Winners</p>
                    <p className="text-white font-bold text-sm sm:text-base">
                      {poll.bets.filter((b) => b.payout && b.payout > 0).length} bettors
                    </p>
                  </div>

                  {poll.cardWinner && (
                    <div className="p-2.5 sm:p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                      <p className="text-yellow-400 text-[10px] sm:text-xs mb-1">🎴 Physical Card Winner</p>
                      <p className="text-white font-bold text-sm sm:text-base mb-1 break-all">
                        {poll.bets.find((b) => b.wallet === poll.cardWinner)?.handle || "Unknown"}
                      </p>
                      <p className="text-yellow-300/70 font-mono text-[10px] sm:text-xs break-all">
                        {poll.cardWinner.slice(0, 8)}...{poll.cardWinner.slice(-8)}
                      </p>
                    </div>
                  )}

                  <div className="p-2.5 sm:p-3 bg-white/5 rounded-lg">
                    <p className="text-white/50 text-[10px] sm:text-xs mb-1">Settled At</p>
                    <p className="text-white font-medium text-xs sm:text-sm break-words">
                      {poll.settledAt ? new Date(poll.settledAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
