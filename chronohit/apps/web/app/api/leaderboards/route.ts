import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = url.searchParams.get('game') || 'reaction';
  const period = url.searchParams.get('period') || 'week';
  const scope = url.searchParams.get('scope') || 'world';
  const key = `lb:${game}:${period}:${scope}`;
  const top = await redis.zrange(key, 0, 49, { withScores: true, rev: true });
  return NextResponse.json({ top });
}