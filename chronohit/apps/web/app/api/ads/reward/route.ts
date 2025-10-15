import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const { userId, sessionId, provider, placement, credits=1 } = await req.json();
  const existing = await prisma.adReward.findFirst({ where: { sessionId, provider, placement } });
  if (existing) return NextResponse.json({ ok: true, credits: 0 });
  await prisma.$transaction(async (tx) => {
    await tx.adReward.create({ data: { userId, sessionId, provider, placement, credits } });
    await tx.creditLedger.create({ data: { userId, delta: credits, source: 'ad' } });
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
  });
  return NextResponse.json({ ok: true, credits });
}