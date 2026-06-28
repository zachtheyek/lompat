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

## Labels

Every politician carries up to two labels.

**1. Katak tier** — by number of party-switches (hops):

| Hops | Label | Colour |
|------|-------|--------|
| 0 | **Loyalist** 💍 | green |
| 1–3 | **Katak** 🐸 | pink-red |
| 4+ | **Super-katak** 🐸 | purple |

**2. Landing tier** — by *win-rate* (share of jumps that landed an election win for
hoppers; career win-share for loyalists):

| Win-rate | Label |
|----------|-------|
| > 60% | 🟢 **Soft landing** |
| 25–60% | 🟡 **Bumpy landing** |
| < 25% | 🔴 **Crash landing** |

Candidate cards also surface 🪃 **Boomerang** (returned to a former party), 🔀
**Coalition-crosser** (jumps that crossed coalition lines), and 🎖 **Veteran** (10+
elections) where they apply.

**How a single hop is scored W or L (the "hybrid" rule):** a hop is a **win** if the
candidate won their first contest under the new party, otherwise a **loss** — so every
hop gets a verdict. Where the party the candidate *left* also contested that very seat,
we additionally flag the clean head-to-head result ("beat their former party" / "former
party won this seat").

## Leaderboards

The home page has six ranked views: **Most jumps**, **Best & worst-timed** (by jump
win-rate, sortable), **Loyal & true** (loyalists by career win-rate), **Boomerangs**,
**Coalition-crossers**, and **Veterans**. **Biggest organized hops** lists elections
where 5+ candidates jumped into the same party at once (splits, defection waves, new
parties — e.g. the 2022 Sheraton-era move to BERSATU); each event page lists every
candidate involved and the share who won their seat. Most-travelled routes are clickable
too (e.g. *who has gone UMNO → BEBAS*).

## Data, build & self-update

Data is **generated, not committed** — `scripts/build_data.py` reads the
[meco-data](https://github.com/zachtheyek/meco-data) foundation (`out/*.parquet`) and
writes `public/data/`. The deploy workflow regenerates it on every push **and weekly**,
so when the underlying MECo data is refreshed the live site updates itself with no code
change.

```bash
npm install
npm run data    # one-liner refresh: rebuild public/data from ../meco-data/out (needs pandas + pyarrow)
npm run dev     # local dev server
npm run build   # vite + OG cards (switchers + loyalists with 4+ elections) + prerender + 404 SPA fallback
```

To refresh the underlying data itself, update the [meco-data](https://github.com/zachtheyek/meco-data)
foundation (its README has the one-liner); the next weekly build here picks it up.

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
