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
  bets?: EventBet[];
}

interface EventBet {
  id: string;
  wallet: string;
  handle: string;
  choice: string;
  stake: number;
  payout?: number | null;
  isCardWinner?: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Generate or retrieve a unique session ID for the user
function getSessionId() {
  if (typeof window === "undefined") return "";
  let sessionId = localStorage.getItem("event_session_id");
  if (!sessionId) {
    sessionId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("event_session_id", sessionId);
  }
  return sessionId;
}

export default function PredictThePullPage() {
  const { addToast } = useToast();
  
  const [handle, setHandle] = useState("");
  const [choice, setChoice] = useState<"YES" | "NO" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState("");

  // Initialize session ID on mount
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Fetch active poll
  const { data: pollData, mutate: mutatePoll } = useSWR<{ poll: EventPoll | null }>(
    "/api/event/poll",
    fetcher,
    { refreshInterval: 3000 }
  );

  // Fetch user's bet
  const { data: betData, mutate: mutateBet } = useSWR<{ bet: EventBet | null; poll: EventPoll | null }>(
    sessionId ? `/api/event/bet?wallet=${sessionId}` : null,
    fetcher,
    { refreshInterval: 3000 }
  );

  const poll = pollData?.poll;
  const userBet = betData?.bet;
  const hasBet = !!userBet;

  const handleSubmit = async () => {
    if (!handle.trim()) {
      addToast({ type: "error", message: "Please enter your name/handle" });
      return;
    }

    if (!choice) {
      addToast({ type: "error", message: "Please select YES or NO" });
      return;
    }

    if (!poll) {
      addToast({ type: "error", message: "No active poll available" });
      return;
    }

    if (!sessionId) {
      addToast({ type: "error", message: "Session not initialized, please refresh" });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/event/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: sessionId,
          handle: handle.trim(),
          choice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to place bet");
      }

      addToast({ type: "success", message: "Bet placed! 🎉" });
      mutateBet();
      mutatePoll();
    } catch (error) {
      console.error("Failed to place bet:", error);
      addToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to place bet",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show results screen if poll is settled
  if (poll?.status === "settled" && userBet) {
    const isWinner = !!(userBet.payout && userBet.payout > 0);
    const isCardWinner = !!userBet.isCardWinner;
    const wasUltraRare = poll.outcome === "ULTRA_RARE";
    
    // Get card winner info from poll
    const cardWinnerWallet = wasUltraRare ? poll.cardWinner : null;
    const cardWinnerBet = wasUltraRare && poll.bets 
      ? poll.bets.find((bet: EventBet) => bet.wallet === cardWinnerWallet)
      : null;
    const cardWinnerName = cardWinnerBet?.handle || (cardWinnerWallet ? `${cardWinnerWallet.slice(0, 4)}...${cardWinnerWallet.slice(-4)}` : null);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background animation for winners */}
        {isWinner && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/20 animate-pulse" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `-${Math.random() * 20}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${3 + Math.random() * 2}s`,
                  }}
                >
                  {['🎉', '✨', '🎊', '⭐', '💫'][Math.floor(Math.random() * 5)]}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="w-full max-w-md space-y-6 relative z-10">
          {/* Outcome Modal Popup */}
          <div className={`transform transition-all duration-1000 ${isWinner ? 'scale-100 opacity-100' : 'scale-100 opacity-100'}`}>
            <div className={`${
              isWinner 
                ? 'bg-gradient-to-br from-emerald-500/30 via-emerald-600/20 to-emerald-700/30 border-emerald-400/50' 
                : 'bg-gradient-to-br from-red-500/30 via-red-600/20 to-red-700/30 border-red-400/50'
            } backdrop-blur-xl border-2 rounded-3xl p-8 shadow-2xl animate-slideDown`}>
              <div className="text-center space-y-4">
                {/* Animated Icon */}
                <div className={`text-8xl mb-4 ${isWinner ? 'animate-bounce' : 'animate-shake'}`}>
                  {isWinner ? "🎉" : "😔"}
                </div>
                
                {/* Result Text */}
                <h1 className={`text-5xl font-extrabold mb-2 ${
                  isWinner ? 'text-emerald-100' : 'text-red-100'
                }`}>
                  {isWinner ? "YOU WIN!" : "YOU LOSE"}
                </h1>

                {/* Winnings Display - Only show for winners */}
                {isWinner ? (
                  <div className="my-6 p-6 bg-emerald-500/30 border-2 border-emerald-400/60 rounded-2xl animate-pulse">
                    <p className="text-emerald-200 text-sm mb-2">You Won</p>
                    <p className="text-emerald-100 font-extrabold text-5xl">
                      ${Number(userBet.payout).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div className="my-6 p-6 bg-red-500/30 border-2 border-red-400/60 rounded-2xl">
                    <p className="text-red-200 text-lg font-semibold">Better luck next time!</p>
                    <p className="text-red-300 text-sm mt-2">You lost $1.00</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Winner Announcement */}
          {wasUltraRare && cardWinnerName && (
            <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 p-6 rounded-2xl shadow-2xl border-4 border-yellow-300 animate-slideDown"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="text-center">
                <div className="text-5xl mb-3 animate-bounce">🎴✨</div>
                <h2 className="text-2xl font-bold text-black mb-2">PHYSICAL CARD WINNER!</h2>
                <div className="bg-black/20 rounded-lg p-3 mt-3">
                  <p className="text-black font-bold text-xl">{cardWinnerName}</p>
                  {isCardWinner && (
                    <p className="text-black/80 text-sm mt-1">That's you! 🎊</p>
                  )}
                </div>
                <p className="text-black/80 text-sm mt-3">Won the physical Ultra Rare card!</p>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl animate-slideUp">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/70 text-sm">Your Bet</span>
                <span className={`font-bold ${
                  userBet.choice === 'YES' ? 'text-green-400' : 'text-red-400'
                }`}>{userBet.choice}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/70 text-sm">Outcome</span>
                <span className="font-bold text-white">
                  {wasUltraRare ? "🌟 Ultra Rare!" : "❌ No Ultra Rare"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/70 text-sm">Total Pot</span>
                <span className="font-bold text-white">${poll.totalPot.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                mutateBet();
                mutatePoll();
              }}
              className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition text-white font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes confetti {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          @keyframes slideDown {
            0% {
              transform: translateY(-100px);
              opacity: 0;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
          @keyframes slideUp {
            0% {
              transform: translateY(50px);
              opacity: 0;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
            20%, 40%, 60%, 80% { transform: translateX(10px); }
          }
          .animate-confetti {
            animation: confetti linear infinite;
          }
          .animate-slideDown {
            animation: slideDown 0.8s ease-out forwards;
          }
          .animate-slideUp {
            animation: slideUp 0.8s ease-out forwards;
            animation-delay: 0.3s;
            opacity: 0;
          }
          .animate-shake {
            animation: shake 0.5s ease-in-out;
          }
        `}</style>
      </div>
    );
  }

  // Show waiting state if user has bet
  if (hasBet && poll) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">
                {poll.status === "frozen" ? "🧊" : "⏳"}
              </div>
              
              <h1 className="text-2xl font-bold text-white">
                {poll.status === "frozen" ? "Poll Frozen" : "Waiting for Pack Opening..."}
              </h1>

              <div className="space-y-3">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-white/70 text-sm mb-1">Your Bet</p>
                  <p className="text-white font-semibold text-lg">{userBet.choice}</p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-white/70 text-sm mb-1">Stake</p>
                  <p className="text-white font-semibold text-lg">$1.00</p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-white/70 text-sm mb-1">Total Pot</p>
                  <p className="text-white font-semibold text-lg">${poll.totalPot.toFixed(2)}</p>
                </div>
              </div>

              {poll.status === "frozen" && (
                <p className="text-white/60 text-sm">
                  The pack is being opened now! Results coming soon...
                </p>
              )}

              {poll.status === "active" && (
                <p className="text-white/60 text-sm">
                  Waiting for the host to start the pack opening...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show betting form
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Predict the Pull 🎴
            </h1>
            <p className="text-white/70 text-sm">
              Will this pack contain an Ultra Rare or better?
            </p>
          </div>

          {!poll ? (
            <div className="text-center py-8">
              <p className="text-white/60">No active poll available</p>
              <p className="text-white/40 text-sm mt-2">Check back soon!</p>
            </div>
          ) : poll.status !== "active" ? (
            <div className="text-center py-8">
              <p className="text-white/60">Poll is currently {poll.status}</p>
              <p className="text-white/40 text-sm mt-2">Wait for the next round!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Name/Handle Input */}
              <div className="space-y-2">
                <label className="block text-white/70 text-sm font-medium">
                  Your Name/Handle
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={32}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>

              {/* Choice Buttons */}
              <div className="space-y-2">
                <label className="block text-white/70 text-sm font-medium">
                  Your Prediction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setChoice("YES")}
                    disabled={isSubmitting}
                    className={`py-4 rounded-lg font-bold text-lg transition ${
                      choice === "YES"
                        ? "bg-green-500 text-white border-2 border-green-400"
                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    YES 🎉
                  </button>
                  <button
                    onClick={() => setChoice("NO")}
                    disabled={isSubmitting}
                    className={`py-4 rounded-lg font-bold text-lg transition ${
                      choice === "NO"
                        ? "bg-red-500 text-white border-2 border-red-400"
                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    NO 😔
                  </button>
                </div>
              </div>

              {/* Stake Display */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                <p className="text-white/70 text-sm mb-1">Fixed Stake</p>
                <p className="text-white font-bold text-2xl">$1.00</p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !handle.trim() || !choice}
                className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-white text-lg shadow-lg transition transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? "Placing Bet..." : "Lock In Your Bet 🚀"}
              </button>

              {/* Total Pot */}
              {poll.totalPot > 0 && (
                <div className="text-center pt-4 border-t border-white/10">
                  <p className="text-white/50 text-xs mb-1">Total Pot</p>
                  <p className="text-white font-semibold">${poll.totalPot.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
