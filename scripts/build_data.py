"""
Lompat — party-hopping data build
=================================
Reads the shared MECo foundation and reconstructs every candidate's party
trajectory across the elections they contested, detecting party switches
(party *renames* are collapsed via the succession table, so a rename is NOT a hop).

Output:
  public/data/index.json            # all multi-contest candidates (searchable)
  public/data/leaderboard.json      # home page: top switchers, routes, organized
                                     # moves, inflows/outflows, by-year, stats
  public/data/loyal.json            # loyalists (>=3 contests) by career win-rate
  public/data/veterans.json         # longest-serving (most elections contested)
  public/data/events.json           # member slug lists per route / organized move
  public/data/cand/<slug>.json      # full trajectory per multi-contest candidate
"""
from __future__ import annotations
import json, re, unicodedata
from pathlib import Path
import pandas as pd

FOUND = Path("../meco-data/out")
OUT = Path("public/data")
(OUT / "cand").mkdir(parents=True, exist_ok=True)

ORGANIZED_MIN = 5   # an "organized move" = >=5 candidates joining one party in one election

b = pd.read_parquet(FOUND / "ballots.parquet")
succ = pd.read_parquet(FOUND / "lookup_party_succession.parquet")
party = pd.read_parquet(FOUND / "lookup_party.parquet").set_index("party_uid")

# Canonical party id: collapse organisational *continuity* — renames, mergers and
# absorptions (the old party ceased to exist and folded into the successor). We do
# NOT collapse splinters/splits: breaking away to form a new party IS a real switch.
CONTINUITY = {"replace", "merge", "absorb"}
cont = succ[succ.type.isin(CONTINUITY)]
rename = dict(zip(cont.predecessor_uid, cont.successor_uid))
def canonical(u):
    seen = set()
    while u in rename and u not in seen:
        seen.add(u); u = rename[u]
    return u

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

b = b.dropna(subset=["candidate_uid", "party_uid"]).copy()
b["pcanon"] = b["party_uid"].map(canonical)
b["pcanon_name"] = b["pcanon"].map(lambda u: party.loc[u, "party"] if u in party.index else u)
b = b.sort_values(["candidate_uid", "date", "ballot_order"])

# Per-hop win/loss ("Hybrid" rule). A hop is a WIN if the candidate won their first
# contest under the new party, else a LOSS — this is defined for every hop. Where the
# party the candidate LEFT also contested that very seat, we additionally flag the
# clean head-to-head outcome ("beat" the old party, or "lost_to" it) for richer copy.
b["won_bool"] = b["result"].str.startswith("won")
contest_winner = b[b["won_bool"]].groupby(["date", "seat_key"])["pcanon"].first().to_dict()
contest_parties = b.groupby(["date", "seat_key"])["pcanon"].apply(set).to_dict()

index = []
routes = {}              # (from_name, to_name) -> {"n":int, "wins":int, "members":{slug:win}}
moves = {}               # (to_name, year) -> {"n":int, "wins":int, "members":{slug:win}}
inflow, outflow = {}, {} # party_name -> hop count
switch_years = {}
n_files = 0

for uid, g in b.groupby("candidate_uid"):
    g = g.drop_duplicates(subset=["date", "seat"])  # one row per contest
    name = g["name"].iloc[0]
    sex = g["sex"].iloc[0]
    slug = f"{slugify(name)}-{uid.lower()}"
    contests = []
    prev = None
    switches = []
    path = []          # sequential trajectory, collapsing only *consecutive* repeats
    seen = set()       # canonical parties held so far (for boomerang detection)
    n_wins = n_returns = n_cross = career_wins = 0
    for _, r in g.iterrows():
        hop = prev is not None and r["pcanon"] != prev["pcanon"]
        career_wins += int(bool(r["won_bool"]))
        if prev is None or hop:
            path.append(r["pcanon_name"])
        contests.append({
            "year": int(r["year"]), "election": r["election"], "date": r["date"],
            "seat": r["seat"], "state": r["state"],
            "party": r["party"], "party_canon": r["pcanon_name"],
            "coalition": (r["coalition"] if r["coalition"] != "ALONE" else None),
            "result": r["result"], "votes_perc": (round(float(r["votes_perc"]), 1) if pd.notna(r["votes_perc"]) else None),
            "hop": bool(hop),
        })
        if hop:
            frm, to = prev["pcanon_name"], r["pcanon_name"]
            won = bool(r["won_bool"]); yr = int(r["year"])
            n_wins += won
            crossed = bool(prev["coalition"] != r["coalition"])
            n_cross += crossed
            is_return = r["pcanon"] in seen
            n_returns += is_return
            key = (r["date"], r["seat_key"])
            old_uid = prev["pcanon"]
            vs_old = None  # clean head-to-head against the party just left, same seat
            if old_uid in contest_parties.get(key, set()):
                vs_old = "beat" if won else ("lost_to" if contest_winner.get(key) == old_uid else None)
            switches.append({"year": yr, "from": frm, "to": to, "cross_coalition": crossed,
                             "win": won, "vs_old": vs_old, "return": is_return})
            # aggregates
            rt = routes.setdefault((frm, to), {"n": 0, "wins": 0, "members": {}})
            rt["n"] += 1
            if slug not in rt["members"]:
                rt["members"][slug] = won; rt["wins"] += int(won)
            if to != "BEBAS":  # becoming independent is not "joining a central party"
                mv = moves.setdefault((to, yr), {"n": 0, "wins": 0, "members": {}})
                if slug not in mv["members"]:
                    mv["members"][slug] = won; mv["n"] += 1; mv["wins"] += int(won)
            inflow[to] = inflow.get(to, 0) + 1
            outflow[frm] = outflow.get(frm, 0) + 1
            switch_years[yr] = switch_years.get(yr, 0) + 1
        seen.add(r["pcanon"])
        prev = r
    n_parties = g["pcanon"].nunique()
    n_switches = len(switches)
    rec = {
        "uid": uid, "slug": slug, "name": name, "sex": sex,
        "n_contests": len(g), "n_parties": int(n_parties), "n_switches": n_switches,
        "first_year": int(g["year"].min()), "last_year": int(g["year"].max()),
        "last_party": g["pcanon_name"].iloc[-1],
        "parties": list(dict.fromkeys(g["pcanon_name"].tolist())),
        "path": path,
        "wins": [s["win"] for s in switches],
        "n_wins": n_wins,
        "win_rate": (round(n_wins / n_switches, 4) if n_switches else None),
        "n_returns": n_returns,
        "n_cross": n_cross,
        "career_win_rate": round(career_wins / len(g), 4),
        # every state the candidate has contested in — powers the leaderboard state filter
        "states": sorted(g["state"].dropna().unique().tolist()),
    }
    index.append(rec)
    if len(g) >= 2:  # only multi-contest candidates get a trajectory file
        (OUT / "cand" / f"{slug}.json").write_text(json.dumps(
            {**rec, "contests": contests, "switches": switches}, separators=(",", ":")))
        n_files += 1

index.sort(key=lambda x: (-x["n_switches"], -x["n_parties"], x["name"]))

# ---- search index (multi-contest only; slim for mobile) ----
slim = [{"s": x["slug"], "n": x["name"], "c": x["n_contests"], "h": x["n_switches"],
         "p": x["n_parties"], "lp": x["last_party"], "y0": x["first_year"], "y1": x["last_year"],
         "wr": x["win_rate"], "nw": x["n_wins"], "cwr": x["career_win_rate"]}
        for x in index if x["n_contests"] >= 2]
(OUT / "index.json").write_text(json.dumps(slim, separators=(",", ":")))

# ---- home leaderboard ----
switchers = [x for x in index if x["n_switches"] > 0]
LB_KEYS = ("slug", "name", "n_switches", "n_parties", "first_year", "last_year",
           "parties", "path", "wins", "n_wins", "win_rate", "n_returns", "n_cross",
           "career_win_rate", "states")
lb_top = [{k: x[k] for k in LB_KEYS} for x in switchers]

top_routes = sorted(routes.items(), key=lambda kv: -kv[1]["n"])[:25]
routes_out = [{"id": f"r|{frm}|{to}", "from": frm, "to": to, "n": d["n"], "wins": d["wins"],
               "members": len(d["members"])}
              for (frm, to), d in top_routes]

org = sorted(((k, v) for k, v in moves.items() if len(v["members"]) >= ORGANIZED_MIN),
             key=lambda kv: -len(kv[1]["members"]))
events_out = [{"id": f"m|{to}|{yr}", "to": to, "year": yr,
               "n": len(d["members"]), "wins": d["wins"]}
              for (to, yr), d in org]

inflows = sorted(inflow.items(), key=lambda kv: -kv[1])[:5]
outflows = sorted(outflow.items(), key=lambda kv: -kv[1])[:5]

leaderboard = {
    "top": lb_top,
    "n_switchers": len(switchers),
    "n_candidates": len(index),
    "total_switches": int(sum(x["n_switches"] for x in index)),
    "routes": routes_out,
    "events": events_out,
    "inflows": [{"party": p, "n": n} for p, n in inflows],
    "outflows": [{"party": p, "n": n} for p, n in outflows],
    "by_year": [{"year": y, "n": switch_years[y]} for y in sorted(switch_years)],
    "states": sorted(b["state"].dropna().unique().tolist()),  # state-filter dropdown options
}
(OUT / "leaderboard.json").write_text(json.dumps(leaderboard, separators=(",", ":")))

# ---- event detail (lazy-loaded on event pages): self-contained meta + members ----
events_full = {}
for (frm, to), d in top_routes:
    events_full[f"r|{frm}|{to}"] = {
        "type": "r", "from": frm, "to": to, "n": len(d["members"]), "wins": d["wins"],
        "members": [{"s": s, "w": int(w)} for s, w in d["members"].items()]}
for (to, yr), d in org:
    events_full[f"m|{to}|{yr}"] = {
        "type": "m", "to": to, "year": yr, "n": len(d["members"]), "wins": d["wins"],
        "members": [{"s": s, "w": int(w)} for s, w in d["members"].items()]}
(OUT / "events.json").write_text(json.dumps(events_full, separators=(",", ":")))

# ---- loyalists by career win-rate (lazy; "Loyal & true" board) ----
loyal = [{"slug": x["slug"], "name": x["name"], "party": x["last_party"],
          "n_contests": x["n_contests"], "win_rate": x["career_win_rate"],
          "first_year": x["first_year"], "last_year": x["last_year"], "states": x["states"]}
         for x in index if x["n_switches"] == 0 and x["n_contests"] >= 3]
loyal.sort(key=lambda x: (-x["win_rate"], -x["n_contests"], x["name"]))
(OUT / "loyal.json").write_text(json.dumps(loyal, separators=(",", ":")))

# ---- veterans / longevity (lazy; "Veterans" board) ----
veterans = sorted(index, key=lambda x: (-x["n_contests"], -(x["last_year"] - x["first_year"]), x["name"]))[:300]
vets_out = [{"slug": x["slug"], "name": x["name"], "path": x["path"], "wins": x["wins"],
             "n_contests": x["n_contests"], "n_switches": x["n_switches"],
             "first_year": x["first_year"], "last_year": x["last_year"], "states": x["states"]}
            for x in veterans]
(OUT / "veterans.json").write_text(json.dumps(vets_out, separators=(",", ":")))

# ---- which candidates get a prerendered page + OG card (shareable) ----
# everyone searchable (i.e. every multi-contest candidate) — switchers AND loyalists —
# so any politician you can pull up has a real share card, not a 404 fallback.
og_slugs = [x["slug"] for x in index if x["n_contests"] >= 2]
(OUT / "og_list.json").write_text(json.dumps(og_slugs, separators=(",", ":")))

print(f"candidates: {len(index):,}  | switchers: {len(switchers):,}  | trajectory files: {n_files:,}")
print(f"total switches: {leaderboard['total_switches']:,}")
print(f"organized moves (>={ORGANIZED_MIN}): {len(events_out)}  | loyalists(>=3): {len(loyal):,}")
print("top frog:", switchers[0]["name"], switchers[0]["n_switches"], "switches across", switchers[0]["parties"])
print("biggest organized move:", events_out[0] if events_out else None)
print("inflows:", [f"{p['party']}={p['n']}" for p in leaderboard["inflows"]])
print("outflows:", [f"{p['party']}={p['n']}" for p in leaderboard["outflows"]])
