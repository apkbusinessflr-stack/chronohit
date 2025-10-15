import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' });

export async function POST(req: Request) {
  const sig = headers().get('stripe-signature')!;
  const raw = await req.text();
  let evt: Stripe.Event;
  try {
    evt = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch (e:any) {
    return new Response(`Webhook Error: ${e.message}`, { status: 400 });
  }
  if (evt.type === 'checkout.session.completed') {
    const s = evt.data.object as Stripe.Checkout.Session;
    const userId = s.metadata?.userId!;
    const priceId = s.metadata?.priceId;
    const credits = priceId === process.env.STRIPE_PRICE_PACK_100 ? 100 :
                    priceId === process.env.STRIPE_PRICE_PACK_250 ? 250 : 0;
    if (credits > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.creditLedger.create({ data: { userId, delta: credits, source: 'purchase', txnId: s.id } });
        await tx.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
      });
    }
  }
  return new Response('ok');
}