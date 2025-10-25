// /assets/wallet-badge.js
import { getDeviceId } from "/assets/utils.js";

async function refreshWallet() {
  const el = document.getElementById("wallet-badge");
  if (!el) return;
  const userId = getDeviceId(); // ή το πραγματικό login user id
  try {
    const r = await fetch(`/api/wallet?user_id=${encodeURIComponent(userId)}`);
    const j = await r.json();
    el.textContent = `Credits: ${j.balance ?? 0}`;
  } catch {
    el.textContent = `Credits: —`;
  }
}
window.addEventListener("DOMContentLoaded", refreshWallet);
