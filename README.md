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

**Katak tier** — by number of party-switches (hops):

| Hops | Label | Colour |
|------|-------|--------|
| 0 | **Loyalist** 💍 | blue |
| 1–3 | **Katak** 🐸 | pink-red |
| 4+ | **Super-katak** 🐸 | purple |

**Landing tier** (hoppers only) — by *jump win-rate*, the share of hops that landed an
election win. **Career win-rate** (shown for *everyone*) uses the same thresholds with a
distinct emoji set:

| Win-rate | Landing (jumps) | Career (all) |
|----------|-----------------|--------------|
| > 60% | 🟢 Soft landing | 🏆 |
| 25–60% | 🟡 Bumpy landing | 🗳️ |
| < 25% | 🔴 Crash landing | 📉 |

Candidate cards also surface 🪃 **Boomerang** (returned to a former party), 🔀
**Coalition-crosser** (jumps that crossed coalition lines, teal), and 🎖 **Veteran** (10+
elections, orange) where they apply.

**How a single hop is scored W or L (the "hybrid" rule):** a hop is a **win** if the
candidate won their first contest under the new party, otherwise a **loss** — so every
hop gets a verdict. Where the party the candidate *left* also contested that very seat,
we additionally flag the clean head-to-head result ("beat their former party" / "former
party won this seat").

## Leaderboards & explorers

The home page has six ranked views, in order: **Most jumps**, **Best & worst-timed** (by
jump win-rate, sortable), **Boomerangs**, **Coalition-crossers**, **Loyal & true**
(loyalists by career win-rate, sortable), and **Veterans** (most elections). Alongside:

- **Most-travelled routes** and **Where they go** (biggest inflows / outflows) — both show
  win-rates; routes are clickable (e.g. *everyone who has gone UMNO → BEBAS*).
- **Biggest organized hops** — elections where 5+ candidates jumped into the same party at
  once (splits, defection waves, new parties — e.g. the 2022 Sheraton-era move to BERSATU,
  or PEJUANG 2022 where 26 ran and none won). Each event page lists every candidate with
  their W/L and the share who won.
- **Hops by year** — a Tufte-style time series (grey = an election year, green = the peak).

## Data, build & self-update

Data is **generated, not committed** — `scripts/build_data.py` reads the
[meco-data](https://github.com/zachtheyek/meco-data) foundation (`out/*.parquet`) and
writes `public/data/`. The deploy workflow regenerates it on every push, and **weekly**:
the weekly run first checks whether the MECo data actually changed since the last deploy
(stamped in `dist/data-version.txt`) and does nothing if not. So the live site
**self-updates** whenever the data is refreshed, with no code change and no idle rebuilds.

Refreshing the underlying data is itself automatic: [meco-data](https://github.com/zachtheyek/meco-data)
auto-refreshes weekly from the upstream corpus and this site picks it up the same day.

```bash
npm install
npm run data    # one-liner refresh: rebuild public/data from ../meco-data/out (needs pandas + pyarrow)
npm run dev     # local dev server
npm run build   # vite + OG cards (every searchable candidate) + prerender + 404 SPA fallback
```

## Sibling projects

Part of a family of civic data-viz tools built on the Malaysian Election Corpus:

- [**Undi Wrapped**](https://zachtheyek.github.io/undi-wrapped/) — your constituency's election story, Spotify-Wrapped style
- [**Salasilah**](https://zachtheyek.github.io/salasilah/) — the family tree of Malaysia's parties & coalitions
- [**Nadi Demokrasi**](https://zachtheyek.github.io/nadi-demokrasi/) — the health of the democracy in six indicators
- [**Undi Lain**](https://zachtheyek.github.io/undi-lain/) — re-run past elections under different voting systems
- [**Undi Generasi**](https://zachtheyek.github.io/undi-generasi/) — how Malaysia votes across generations

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
