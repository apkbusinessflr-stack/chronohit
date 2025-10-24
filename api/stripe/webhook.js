module.exports = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret) return res.status(200).json({ ok: true, info: 'Webhook not configured (missing STRIPE_WEBHOOK_SECRET).' });
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ ok:false, error:'Missing stripe-signature header' });
  // Placeholder – add Stripe SDK verification + wallet credit logic here
  return res.status(200).json({ ok: true, received: true });
};
