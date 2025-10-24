# ChronoHit Upgrade Patch (Stroop Blitz + API generalization)

## Περιεχόμενα
- `games/stroop-blitz/index.html` — νέο παιχνίδι (25s, Easy/Default/Hard/Trial), auto-submit (`game:"sb"`).
- `/api/daily.js` — per-game daily counters (`?game=...`, default "tap").
- `/api/score.js` — υποστήριξη `sb` (Stroop Blitz) + validations + per-game limit + Redis push.
- `/api/leaderboard.js` — `game=sb` με negative zscore (ώστε τα μεγαλύτερα score να βγαίνουν πρώτα).
- `/api/ads-config.js` — προστέθηκε slot `stroop` (ENV: `ADSENSE_SLOT_STROOP`).
- `vercel.json` — προαιρετικά headers/caching (μη-δεσμευτικό).

## Εγκατάσταση
1) Αντέγραψε τα αρχεία ακριβώς στα ίδια paths στο repo σου (overwrite όπου υπάρχει).
2) (Προαιρετικά) στο `/index.html` πρόσθεσε κάρτα:
   <section class="card">
     <h2>Stroop Blitz</h2>
     <p class="lead">Tap the ink color, not the word. 25s. Fast, tricky, addictive.</p>
     <a class="btn" href="/games/stroop-blitz/">Play →</a>
   </section>
3) Vercel ENV (αν θες διαφήμιση στο Stroop): `ADSENSE_SLOT_STROOP=<slot>`.

## Σημειώσεις
- Backwards compatible: τα υπάρχοντα games δεν επηρεάζονται.
- Αν λείπουν Upstash ENV, τα endpoints απλώς δουλεύουν χωρίς persistence (dev mode).
- Αν δεν υπάρχει slot για Stroop, απλώς δεν θα φορτώσει ad εκεί.
