// Lightweight sharing helper (no env needed)
export function shareScore({ title, text, url }) {
  if (navigator.share) {
    return navigator.share({ title, text, url }).catch(()=>{});
  }
  // Fallback: open X/WhatsApp share tabs and copy to clipboard
  try { navigator.clipboard && navigator.clipboard.writeText(url); } catch {}
  const encoded = encodeURIComponent(`${text} ${url}`);
  const x = `https://twitter.com/intent/tweet?text=${encoded}`;
  const wa = `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(x, "_blank", "noopener,noreferrer");
  setTimeout(()=> window.open(wa, "_blank", "noopener,noreferrer"), 300);
}

export function captureReferral() {
  const url = new URL(window.location.href);
  const ref = url.searchParams.get("ref");
  if (ref) {
    try { localStorage.setItem("referrer_code", ref); } catch {}
  }
}

export function makeShareUrl(baseUrl, params) {
  const u = new URL(baseUrl, window.location.origin);
  Object.entries(params || {}).forEach(([k,v])=> u.searchParams.set(k, v));
  // Always tag for analytics (static)
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source","share");
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium","social");
  return u.toString();
}
