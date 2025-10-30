"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BetOutcomeOverlayProps {
  outcome: { kind: "won" | "lost" | "frozen"; amountSol?: number; signature?: string; title?: string } | null;
  onDismiss: () => void;
}

export function BetOutcomeOverlay({ outcome, onDismiss }: BetOutcomeOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (outcome) {
      // Trigger animation
      setVisible(true);
      
      // Auto-dismiss - 2 seconds for freeze, 3 seconds for win/loss
      const dismissTime = outcome.kind === "frozen" ? 2000 : 3000;
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, dismissTime);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [outcome, onDismiss]);

  if (!outcome) return null;

  const isWin = outcome.kind === "won";
  const isLoss = outcome.kind === "lost";
  const isFrozen = outcome.kind === "frozen";
  const formattedAmount = outcome.amountSol ? outcome.amountSol.toFixed(4) : "0.0000";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{ backdropFilter: visible ? "blur(4px)" : "blur(0px)" }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 300);
        }}
      />

      {/* Outcome Card */}
      <div
        className={`relative transform transition-all duration-500 ${
          visible ? "scale-100 rotate-0" : "scale-50 rotate-12"
        }`}
      >
        {isFrozen ? (
          // FROZEN OVERLAY
          <div className="relative">
            {/* Ice crystals/frost effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div className="absolute top-0 left-1/4 w-2 h-2 bg-cyan-300 rounded-full animate-float-1" />
              <div className="absolute top-12 right-1/4 w-3 h-3 bg-blue-200 rounded-full animate-float-2" />
              <div className="absolute top-8 left-1/2 w-2 h-2 bg-cyan-400 rounded-full animate-float-3" />
              <div className="absolute bottom-12 left-1/3 w-3 h-3 bg-blue-300 rounded-full animate-float-1" 
                   style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-8 right-1/3 w-2 h-2 bg-cyan-200 rounded-full animate-float-2" 
                   style={{ animationDelay: '0.7s' }} />
            </div>

            {/* Frost glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-600/20 blur-xl animate-pulse-frost" />

            {/* Main card */}
            <div className="relative w-96 max-w-full bg-gradient-to-br from-cyan-500/95 via-blue-500/95 to-blue-600/95 rounded-2xl shadow-2xl border-4 border-cyan-300/50 p-8 text-center overflow-hidden">
              {/* Snowflake effects */}
              <div className="absolute top-4 left-4 text-white/40 text-2xl animate-spin-slow">❄️</div>
              <div className="absolute top-6 right-6 text-white/30 text-xl animate-spin-slow" style={{ animationDelay: '0.5s' }}>❄️</div>
              <div className="absolute bottom-8 left-8 text-white/40 text-2xl animate-spin-slow" style={{ animationDelay: '1s' }}>❄️</div>
              <div className="absolute bottom-6 right-10 text-white/30 text-xl animate-spin-slow" style={{ animationDelay: '1.5s' }}>❄️</div>

              {/* Ice emoji */}
              <div className="mb-4 animate-freeze-shake">
                <div className="inline-block text-7xl drop-shadow-lg">🧊</div>
              </div>

              {/* Title */}
              <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2 animate-scale-in" 
                  style={{ 
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(200,255,255,0.5)',
                    animationDelay: '0.1s'
                  }}>
                POLL FROZEN!
              </h2>

              {/* Message */}
              <p className="text-lg font-bold text-cyan-950/90 mb-2 animate-fade-in" 
                 style={{ animationDelay: '0.2s' }}>
                {outcome.title || "Betting is now closed"}
              </p>

              <p className="text-base font-semibold text-cyan-900/80 animate-fade-in" 
                 style={{ animationDelay: '0.3s' }}>
                ❄️ Waiting for results... ❄️
              </p>
            </div>
          </div>
        ) : isWin ? (
          // WINNING OVERLAY
          <div className="relative">
            {/* Lightning bolts animation */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <div className="absolute top-0 left-1/4 w-1 h-20 bg-gradient-to-b from-yellow-300 to-transparent animate-lightning-1" 
                   style={{ animationDelay: '0s' }} />
              <div className="absolute top-0 right-1/4 w-1 h-24 bg-gradient-to-b from-yellow-200 to-transparent animate-lightning-2" 
                   style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-0 left-1/2 w-1 h-16 bg-gradient-to-b from-yellow-400 to-transparent animate-lightning-1" 
                   style={{ animationDelay: '0.4s' }} />
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-amber-600/20 blur-xl animate-pulse-glow" />

            {/* Main card */}
            <div className="relative w-96 max-w-full bg-gradient-to-br from-yellow-500/95 via-amber-500/95 to-yellow-600/95 rounded-2xl shadow-2xl border-4 border-yellow-300/50 p-8 text-center overflow-hidden">
              {/* Sparkle effects */}
              <div className="absolute top-4 left-4 w-3 h-3 bg-white rounded-full animate-sparkle" style={{ animationDelay: '0s' }} />
              <div className="absolute top-8 right-8 w-2 h-2 bg-yellow-200 rounded-full animate-sparkle" style={{ animationDelay: '0.3s' }} />
              <div className="absolute bottom-12 left-12 w-2 h-2 bg-white rounded-full animate-sparkle" style={{ animationDelay: '0.6s' }} />
              <div className="absolute bottom-8 right-6 w-3 h-3 bg-yellow-100 rounded-full animate-sparkle" style={{ animationDelay: '0.9s' }} />

              {/* Trophy/Star icon */}
              <div className="mb-4 animate-bounce-slow">
                <div className="inline-block text-7xl drop-shadow-lg">⭐</div>
              </div>

              {/* Title */}
              <h2 className="text-5xl font-black text-white drop-shadow-lg mb-2 animate-scale-in" 
                  style={{ 
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.5)',
                    animationDelay: '0.1s'
                  }}>
                YOU WON!
              </h2>

              {/* Amount */}
              <div className="mb-4">
                <div className="flex items-center justify-center gap-3 animate-scale-in" 
                     style={{ animationDelay: '0.2s' }}>
                  <Image 
                    src="/media/sol_logo.svg" 
                    alt="SOL" 
                    width={48} 
                    height={48}
                    className="drop-shadow-xl"
                  />
                  <span className="text-6xl font-black text-white drop-shadow-xl" 
                        style={{ 
                          textShadow: '3px 3px 6px rgba(0,0,0,0.4), 0 0 30px rgba(255,255,255,0.6)'
                        }}>
                    {formattedAmount}
                  </span>
                </div>
                <div className="text-lg font-semibold text-yellow-950/80 mt-2 animate-fade-in" 
                     style={{ animationDelay: '0.3s' }}>
                  SOL
                </div>
              </div>

              {/* Message */}
              <p className="text-lg font-bold text-yellow-950/90 animate-fade-in" 
                 style={{ animationDelay: '0.4s' }}>
                🎉 Transferred to your wallet! 🎉
              </p>

              {/* Transaction link */}
              <a
                href={`https://explorer.solana.com/tx/${outcome.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-sm text-yellow-950/70 hover:text-yellow-950 underline transition-colors animate-fade-in"
                style={{ animationDelay: '0.5s' }}
              >
                View transaction
              </a>
            </div>
          </div>
        ) : (
          // LOSING OVERLAY
          <div className="relative">
            {/* Dark glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-700/20 to-slate-900/20 blur-xl" />

            {/* Main card */}
            <div className="relative w-96 max-w-full bg-gradient-to-br from-slate-700/95 via-slate-800/95 to-slate-900/95 rounded-2xl shadow-2xl border-4 border-slate-600/50 p-8 text-center overflow-hidden">
              {/* Rain/tear effects */}
              <div className="absolute top-0 left-1/4 w-0.5 h-12 bg-gradient-to-b from-blue-300/50 to-transparent animate-rain" 
                   style={{ animationDelay: '0s' }} />
              <div className="absolute top-0 right-1/3 w-0.5 h-16 bg-gradient-to-b from-blue-300/50 to-transparent animate-rain" 
                   style={{ animationDelay: '0.4s' }} />
              <div className="absolute top-0 left-2/3 w-0.5 h-10 bg-gradient-to-b from-blue-300/50 to-transparent animate-rain" 
                   style={{ animationDelay: '0.8s' }} />

              {/* Icon */}
              <div className="mb-4 animate-shake">
                <div className="inline-block text-7xl opacity-80">💔</div>
              </div>

              {/* Title */}
              <h2 className="text-4xl font-black text-white/90 drop-shadow-lg mb-2 animate-scale-in" 
                  style={{ animationDelay: '0.1s' }}>
                Better Luck Next Time
              </h2>

              {/* Amount */}
              <div className="mb-4">
                <div className="flex items-center justify-center gap-3 animate-scale-in" 
                     style={{ animationDelay: '0.2s' }}>
                  <span className="text-5xl font-black text-red-400/90 drop-shadow-xl">-</span>
                  <Image 
                    src="/media/sol_logo.svg" 
                    alt="SOL" 
                    width={40} 
                    height={40}
                    className="drop-shadow-xl"
                  />
                  <span className="text-5xl font-black text-red-400/90 drop-shadow-xl">
                    {formattedAmount}
                  </span>
                </div>
                <div className="text-lg font-semibold text-slate-400 mt-2 animate-fade-in" 
                     style={{ animationDelay: '0.3s' }}>
                  SOL
                </div>
              </div>

              {/* Message */}
              <p className="text-base font-semibold text-slate-300/80 animate-fade-in" 
                 style={{ animationDelay: '0.4s' }}>
                Your bet didn't win this time
              </p>

              {/* Transaction link */}
              <a
                href={`https://explorer.solana.com/tx/${outcome.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-sm text-slate-400 hover:text-slate-200 underline transition-colors animate-fade-in"
                style={{ animationDelay: '0.5s' }}
              >
                View transaction
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Custom animations in globals.css */}
      <style jsx>{`
        @keyframes lightning-1 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleY(0); }
          10% { opacity: 1; transform: translateY(0) scaleY(1); }
          15% { opacity: 0; transform: translateY(100%) scaleY(1.5); }
        }

        @keyframes lightning-2 {
          0%, 100% { opacity: 0; transform: translateY(0) scaleY(0); }
          10% { opacity: 0.8; transform: translateY(0) scaleY(1); }
          15% { opacity: 0; transform: translateY(120%) scaleY(1.8); }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1.5); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }

        @keyframes scale-in {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes rain {
          0% { opacity: 0; transform: translateY(0); }
          10% { opacity: 0.5; }
          100% { opacity: 0; transform: translateY(300px); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-5px) rotate(-5deg); }
          75% { transform: translateX(5px) rotate(5deg); }
        }

        .animate-lightning-1 {
          animation: lightning-1 1.5s ease-out infinite;
        }

        .animate-lightning-2 {
          animation: lightning-2 1.5s ease-out infinite;
        }

        .animate-sparkle {
          animation: sparkle 1.5s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 1.5s ease-in-out infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out forwards;
          opacity: 0;
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
          opacity: 0;
        }

        .animate-rain {
          animation: rain 2s linear infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
