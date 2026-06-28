"""
Lompat — party-hopping data build
=================================
Reads the shared MECo foundation and reconstructs every candidate's party
trajectory across the elections they contested, detecting party switches
(party *renames* are collapsed via the succession table, so a rename is NOT a hop).

Output:
  public/data/index.json            # all candidates (searchable)
  public/data/leaderboard.json      # top switchers + national stats
  public/data/cand/<slug>.json      # full trajectory per multi-contest candidate
"""
from __future__ import annotations
import json, re, unicodedata
from pathlib import Path
import pandas as pd

FOUND = Path("../meco-data/out")
OUT = Path("public/data")
(OUT / "cand").mkdir(parents=True, exist_ok=True)

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

index, routes = [], {}
n_files = 0
switch_years = {}

for uid, g in b.groupby("candidate_uid"):
    g = g.drop_duplicates(subset=["date", "seat"])  # one row per contest
    name = g["name"].iloc[0]
    sex = g["sex"].iloc[0]
    contests = []
    prev = None
    switches = []
    path = []          # sequential trajectory, collapsing only *consecutive* repeats
    n_wins = 0         # number of hops where the candidate won under the new party
    for _, r in g.iterrows():
        hop = prev is not None and r["pcanon"] != prev["pcanon"]
        if prev is None or r["pcanon"] != prev["pcanon"]:
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
            won = bool(r["won_bool"])
            n_wins += won
            key = (r["date"], r["seat_key"])
            old_uid = prev["pcanon"]
            vs_old = None  # clean head-to-head against the party just left, same seat
            if old_uid in contest_parties.get(key, set()):
                if won:
                    vs_old = "beat"
                elif contest_winner.get(key) == old_uid:
                    vs_old = "lost_to"
            switches.append({"year": int(r["year"]), "from": frm, "to": to,
                             "cross_coalition": bool(prev["coalition"] != r["coalition"]),
                             "win": won, "vs_old": vs_old})
            routes[(frm, to)] = routes.get((frm, to), 0) + 1
            switch_years[int(r["year"])] = switch_years.get(int(r["year"]), 0) + 1
        prev = r
    n_parties = g["pcanon"].nunique()
    n_switches = len(switches)
    slug = f"{slugify(name)}-{uid.lower()}"
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
    }
    index.append(rec)
    if len(g) >= 2:  # only multi-contest candidates get a trajectory file
        (OUT / "cand" / f"{slug}.json").write_text(json.dumps(
            {**rec, "contests": contests, "switches": switches}, separators=(",", ":")))
        n_files += 1

index.sort(key=lambda x: (-x["n_switches"], -x["n_parties"], x["name"]))
# Search index: only multi-contest candidates (single-contest people can't have hopped),
# slim fields to keep it light on mobile.
slim = [{"s": x["slug"], "n": x["name"], "c": x["n_contests"], "h": x["n_switches"],
         "p": x["n_parties"], "lp": x["last_party"], "y0": x["first_year"], "y1": x["last_year"],
         "wr": x["win_rate"], "nw": x["n_wins"]}
        for x in index if x["n_contests"] >= 2]
(OUT / "index.json").write_text(json.dumps(slim, separators=(",", ":")))

switchers = [x for x in index if x["n_switches"] > 0]
# Trim each leaderboard record to just what the home page renders (rows + OG cards),
# so shipping ALL switchers (for "see all") stays light.
LB_KEYS = ("slug", "name", "n_switches", "n_parties", "first_year", "last_year",
           "parties", "path", "wins", "n_wins", "win_rate")
lb_top = [{k: x[k] for k in LB_KEYS} for x in switchers]
top_routes = sorted(routes.items(), key=lambda kv: -kv[1])[:25]
leaderboard = {
    "top": lb_top,
    "n_switchers": len(switchers),
    "n_candidates": len(index),
    "total_switches": int(sum(x["n_switches"] for x in index)),
    "routes": [{"from": k[0], "to": k[1], "n": v} for k, v in top_routes],
    "by_year": [{"year": y, "n": switch_years[y]} for y in sorted(switch_years)],
}
(OUT / "leaderboard.json").write_text(json.dumps(leaderboard, separators=(",", ":")))

print(f"candidates: {len(index):,}  | switchers: {len(switchers):,}  | trajectory files: {n_files:,}")
print(f"total switches: {leaderboard['total_switches']:,}")
print("top frog:", switchers[0]["name"], switchers[0]["n_switches"], "switches across", switchers[0]["parties"])
