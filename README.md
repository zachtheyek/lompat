# 🐸 Lompat

**Malaysia's political *katak*, on the record.**
Every party-hop across every election since 1955. Search any politician's full
party trajectory, or browse the national leaderboard of frogs.

🔗 **Live:** https://zachtheyek.github.io/lompat/

![Lompat — Jeffrey Kitingan](https://zachtheyek.github.io/lompat/og/jeffrey-gapari-kitingan-49pcd.png)

## Why it exists

Party-hopping (*lompat parti*) is one of the most resented features of modern
Malaysian politics — the Sheraton Move, the 2022 Anti-Hopping Law. Lompat turns
the question "who has actually hopped, and how often?" into a definitive,
searchable record. This is only possible because the **Malaysian Election Corpus**
gives every candidate a stable unique ID across seven decades — the single hardest
part to reproduce from scraped data.

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://electiondata.my)** (CC0). Not affiliated with the author.
Corpus: [github.com/Thevesh/paper-meco-results](https://github.com/Thevesh/paper-meco-results) ·
paper: *Scientific Data* 13, 190 (2026).

## Method & honest caveats

- A **switch** = the canonical party changes between two consecutive elections a
  candidate contested.
- **Renames, mergers and absorptions are NOT switches** (e.g. PETIR→DAP, or
  PKN+PRM→PKR): the party became another, the person didn't choose to move. We
  *do* count **splinters/splits** (breaking away to form a new party is a choice).
- Lompat sees party **as recorded across the elections a candidate contested** — it
  is *not* a real-time floor-crossing monitor between polls. A mid-term defection
  that isn't followed by contesting under the new party won't appear.
- "Frog" / "katak" is Malaysian political slang for a party-hopper; the framing is
  descriptive, not a judgement of any individual's reasons.

## Build

```bash
npm install
npm run data    # regenerate public/data from ../meco-data/out (needs the foundation + Python)
npm run dev
npm run build   # vite + OG cards (top 300 switchers) + prerender + 404 SPA fallback
```

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
