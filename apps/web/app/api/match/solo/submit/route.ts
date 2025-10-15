import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scoreRound } from '@/lib/scoring';
import { isHumanLatency } from '@/lib/antiCheat';

export async function POST(req: Request) {
  const { matchId, userId, events } = await req.json();
  const cooked = events.map((e:any)=> {
    const reactionMs = e.tappedAt && e.shownAt ? Math.max(0, e.tappedAt - e.shownAt) : undefined;
    const outcome = !e.tappedAt ? 'late' : (reactionMs! <= e.window ? 'hit' : 'late');
    return { reactionMs, outcome };
  });
  if (cooked.some(e => e.reactionMs && !isHumanLatency(e.reactionMs))) {
    return new NextResponse('anomaly', { status: 400 });
  }
  const { finalScore, avgReactionMs, penalties, streakMax } = scoreRound(cooked);
  await prisma.score.create({ data: { matchId, userId, finalScore, avgReactionMs, penalties, streakMax } });
  await prisma.match.update({ where: { id: matchId }, data: { status: 'finished' } });
  return NextResponse.json({ finalScore, avgReactionMs, penalties, streakMax });
}