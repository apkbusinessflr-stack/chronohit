// /assets/wallet-badge.js
// Διαβάζει το balance και γράφει στο <span id="wallet-badge">Credits: X</span>
// Αν έχεις login με πραγματικό userId, χρησιμοποίησέ το αντί για getDeviceId()
import { getDeviceId } from "/assets/utils.js";

async function refreshWallet() {
  const el = document.getElementById("wallet-badge");
  if (!el) return;

  // TODO: αν έχεις αυθεντικό user UUID από auth, βάλε το εδώ
  const userId = localStorage.getItem("user.uuid") || null;

  // Αν ΔΕΝ έχεις ακόμα UUID χρήστη, ΜΗΝ καλείς το API (χρειάζεται uuid). Δείξε placeholder.
  if (!userId) {
    el.textContent = "Credits: —";
    return;
  }

  try {
    const r = await fetch(`/api/wallet?user_id=${encodeURIComponent(userId)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    el.textContent = `Credits: ${j.credits ?? 0}`;
  } catch (e) {
    el.textContent = "Credits: —";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", refreshWallet);
} else {
  refreshWallet();
}
