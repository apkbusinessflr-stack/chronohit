export type Outcome = 'hit'|'miss'|'late';
export function scoreRound(events: {outcome: Outcome, reactionMs?: number}[]) {
  let score = 0, streak=0, maxStreak=0, penalties=0, total=0, count=0;
  for (const e of events) {
    if (e.outcome === 'hit') { score += 1; streak++; maxStreak = Math.max(maxStreak, streak); }
    else { score -= 1; penalties++; streak=0; }
    if (e.reactionMs) { total += e.reactionMs; count++; }
  }
  const avg = count ? Math.round(total / count) : 999;
  if (avg < 300) score += 1;
  score += Math.floor(maxStreak/5);
  return { finalScore: score, avgReactionMs: avg, penalties, streakMax: maxStreak };
}