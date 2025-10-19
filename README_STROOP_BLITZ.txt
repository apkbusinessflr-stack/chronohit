ChronoHit — Stroop Blitz patch
================================

This zip contains:
- games/stroop-blitz/index.html          (NEW game)
- api/daily.js                           (PATCH: per-game counter with ?game=)
- api/score.js                           (PATCH: adds game="sb" handling; auto-submit; Upstash)
- api/leaderboard.js                     (PATCH: adds game="sb" parsing; NEG score to rank descending)
- api/ads-config.js                      (PATCH: adds slots.stroop)

How to apply
------------
1) Copy these files into your repo in the same paths (overwrite the API files).
2) Add a CTA card in /index.html pointing to /games/stroop-blitz/ (optional; game works without it).
3) (Optional) Add ENV for the new ad slot in Vercel:
   - ADSENSE_SLOT_STROOP = <your new slot id>
   If empty, the ad simply won't render; the game still plays.

Daily & Leaderboards
--------------------
- Daily counters are now per-game: keys use `${game}:daily:${YYYYMMDD}:${device}:count`.
- Leaderboard keys: `lb:${game}:daily:${YYYYMMDD}`
  - TAP (tap-reflex): zscore = avg (lower is better)
  - SB  (stroop)    : zscore = -score (higher score ranks first)

Client payload for Stroop Blitz auto-submit:
{
  "game": "sb",
  "device": "<anon>",
  "day": "YYYYMMDD",
  "score": 27,
  "correct": 30,
  "wrong": 3,
  "streakMax": 9,
  "accuracy": 90,
  "mode": "hard"
}

Enjoy!
