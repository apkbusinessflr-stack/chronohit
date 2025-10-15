import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const { game='reaction', mode='solo', difficulty='easy', userId } = await req.json();
  const seed = crypto.randomUUID();
  const match = await prisma.match.create({ data: { gameId: game, mode, difficulty, seed } });
  const params = {
    reactionWindowMs: difficulty==='easy'?700 : difficulty==='medium'?500 : difficulty==='hard'?350 : 250,
    maxActive: game==='reaction' && difficulty!=='easy' ? (difficulty==='hard'?4:6) : 1,
  };
  return NextResponse.json({ matchId: match.id, seed, params });
}