export default function LeaderboardPage() {
  // Demo ranking data
  const users = [
    { rank: 1, name: 'AlphaGamer', points: 128450, streak: 12 },
    { rank: 2, name: 'BetMaster', points: 116320, streak: 9 },
    { rank: 3, name: 'PuntPro', points: 102910, streak: 7 },
    { rank: 4, name: 'StreamShark', points: 89540, streak: 5 },
    { rank: 5, name: 'ClutchQueen', points: 84210, streak: 14 },
    { rank: 6, name: 'OddsWizard', points: 80150, streak: 3 },
    { rank: 7, name: 'BankrollBob', points: 76600, streak: 2 },
    { rank: 8, name: 'EdgeHunter', points: 72890, streak: 6 },
    { rank: 9, name: 'ValueVince', points: 70110, streak: 4 },
    { rank: 10, name: 'RiskyRae', points: 66820, streak: 1 },
  ];

  return (
    <main className="relative w-full py-10 px-6 xl:px-10 max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text">Leaderboard</h1>
        <p className="text-sm text-dim">Top users by points. Demo data for preview purposes.</p>
      </header>

      <div className="panel overflow-hidden">
        <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-[#adadb8] px-4 py-2 border-b border-white/10">
          <div className="col-span-1">Rank</div>
          <div className="col-span-6 sm:col-span-6">User</div>
          <div className="col-span-3 text-right">Points</div>
          <div className="col-span-2 text-right">Streak</div>
        </div>
        <ul className="divide-y divide-white/10">
          {users.map((u) => (
            <li key={u.rank} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/5">
              <div className="col-span-1 font-semibold text-white/90">#{u.rank}</div>
              <div className="col-span-6 sm:col-span-6 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] text-xs font-bold">
                  {u.name.substring(0,1)}
                </div>
                <div className="truncate">
                  <div className="text-white truncate">{u.name}</div>
                  <div className="text-[10px] text-[#adadb8]">Lifetime points</div>
                </div>
              </div>
              <div className="col-span-3 text-right font-semibold text-white tabular-nums">{u.points.toLocaleString()}</div>
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[11px] border border-emerald-500/20">
                  +{u.streak}
                  <span className="opacity-80">streak</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
