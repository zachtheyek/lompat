import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import { partyColor } from "./colors";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

interface Slim { s: string; n: string; c: number; h: number; p: number; lp: string; y0: number; y1: number; wr: number | null; nw: number; }
interface Contest { year: number; election: string; date: string; seat: string; state: string; party: string; party_canon: string; coalition: string | null; result: string; votes_perc: number | null; hop: boolean; }
interface Switch { year: number; from: string; to: string; cross_coalition: boolean; win: boolean; vs_old: "beat" | "lost_to" | null; }
interface Cand { uid: string; slug: string; name: string; sex: string; n_contests: number; n_parties: number; n_switches: number; first_year: number; last_year: number; last_party: string; parties: string[]; path: string[]; wins: boolean[]; n_wins: number; win_rate: number | null; contests: Contest[]; switches: Switch[]; }
interface LBRec { slug: string; name: string; n_switches: number; n_parties: number; first_year: number; last_year: number; parties: string[]; path: string[]; wins: boolean[]; n_wins: number; win_rate: number | null; }
interface LB { top: LBRec[]; n_switchers: number; n_candidates: number; total_switches: number; routes: { from: string; to: string; n: number }[]; by_year: { year: number; n: number }[]; }

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const dot = (c: string) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c}"></span>`;
const pchip = (p: string) => `<span class="pchip" style="background:${partyColor(p)}">${esc(p)}</span>`;

// ---- labels ----
// katak tier by hop count: 0 = loyalist, 1–3 = katak, 4+ = super-katak.
function katakLabel(h: number) {
  if (h === 0) return { txt: "Loyalist", emoji: "💍", cls: "loyal" };
  if (h >= 4) return { txt: "Super-katak", emoji: "🐸", cls: "superkatak" };
  return { txt: "Katak", emoji: "🐸", cls: "katak" };
}
// timing tier by jump win-rate (share of hops that landed a win); null for loyalists.
function timingLabel(wr: number | null) {
  if (wr == null) return null;
  if (wr > 0.5) return { txt: "Soft landing", emoji: "🟢", cls: "soft" };
  if (wr > 0) return { txt: "Bumpy landing", emoji: "🟡", cls: "bumpy" };
  return { txt: "Crash landing", emoji: "🔴", cls: "crash" };
}
const katakBadge = (h: number) => { const k = katakLabel(h); return `<span class="kbadge ${k.cls}">${k.emoji} ${h}</span>`; };
const timingBadge = (wr: number | null) => { const t = timingLabel(wr); return t ? `<span class="tbadge ${t.cls}" title="${t.txt} · ${Math.round(wr! * 100)}% of jumps won">${Math.round(wr! * 100)}%</span>` : ""; };

// path renderer: full sequential trajectory; if `wins` supplied, a W/L mark sits above each arrow.
function pathHtml(path: string[], wins?: boolean[]) {
  return path.map((p, j) => {
    let arrow = "";
    if (j) arrow = wins
      ? `<span class="hop"><span class="wl ${wins[j - 1] ? "w" : "l"}">${wins[j - 1] ? "W" : "L"}</span><span class="arrow">→</span></span>`
      : `<span class="arrow">→</span>`;
    return arrow + pchip(p);
  }).join("");
}

let INDEX: Slim[] | null = null;
async function loadIndex() { if (!INDEX) INDEX = await fetch(`${BASE}data/index.json`).then((r) => r.json()); return INDEX!; }
async function loadLB(): Promise<LB> { return fetch(`${BASE}data/leaderboard.json`).then((r) => r.json()); }
async function loadCand(slug: string): Promise<Cand> {
  const pre = (window as any).__CAND__;
  if (pre && pre.slug === slug) return pre;
  return fetch(`${BASE}data/cand/${slug}.json`).then((r) => { if (!r.ok) throw new Error("404"); return r.json(); });
}
function go(path: string) { history.pushState({}, "", BASE + path); route(); }

// ---- toast ----
function toast(msg: string) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span class="tick">✓</span> ${esc(msg)}`;
  t.classList.add("show");
  clearTimeout((t as any)._h);
  (t as any)._h = setTimeout(() => t!.classList.remove("show"), 2600);
}

function getSlug() {
  const m = location.pathname.match(/\/p\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get("c");
}
async function route() {
  const slug = getSlug();
  if (slug) return renderCand(slug);
  renderHome();
}
window.addEventListener("popstate", route);

// ordered-token match: every query token must appear, in order, as a substring of the
// name (partial/prefix ok). "azmin ali" & "azmi al" match "…azmin bin ali"; "ali azmin" doesn't.
function matchTokens(name: string, toks: string[]): boolean {
  let pos = 0;
  for (const t of toks) {
    const i = name.indexOf(t, pos);
    if (i < 0) return false;
    pos = i + t.length;
  }
  return true;
}

// ---- shared search wiring ----
function wireSearch(input: HTMLInputElement, acEl: HTMLElement) {
  let active = -1, hits: Slim[] = [];
  const close = () => { acEl.innerHTML = ""; active = -1; };
  const draw = async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return close();
    const toks = q.split(/\s+/).filter(Boolean);
    const idx = await loadIndex();
    hits = idx.filter((x) => matchTokens(x.n.toLowerCase(), toks)).slice(0, 25);
    acEl.innerHTML = hits.map((h, i) => `
      <li data-slug="${h.s}" class="${i === active ? "active" : ""}">
        ${dot(partyColor(h.lp))}<span class="nm">${esc(h.n)}</span>
        <span class="badges">${katakBadge(h.h)}${timingBadge(h.wr)}</span>
        <span class="h" style="color:var(--muted)">${h.y0}–${h.y1}</span>
      </li>`).join("");
    acEl.querySelectorAll("li").forEach((li) => li.addEventListener("mousedown", (e) => { e.preventDefault(); go(`p/${(li as HTMLElement).dataset.slug}/`); }));
  };
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { active = Math.min(active + 1, hits.length - 1); draw(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); draw(); }
    else if (e.key === "Enter" && hits[active]) go(`p/${hits[active].s}/`);
    else if (e.key === "Escape") close();
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

function wireLogo() {
  const el = document.getElementById("home");
  if (el) el.onclick = (e) => { e.preventDefault(); go(""); };
}

function header() {
  return `<header class="top"><div class="wrap">
    <a class="logo" id="home" href="${BASE}"><span class="frog">🐸</span> Lompat</a>
    <div class="grow"></div>
    <div class="searchbox"><input id="hsearch" type="search" autocomplete="off" placeholder="Search a politician…" /><ul class="ac" id="hac"></ul></div>
  </div></header>`;
}

// ---------- HOME ----------
async function renderHome() {
  document.title = "Lompat — Malaysia's political frogs, on the record";
  const lb = await loadLB();
  const maxYear = Math.max(...lb.by_year.map((d) => d.n));
  const yearStart = 1955, yearEnd = Math.max(...lb.by_year.map((d) => d.year));
  const byYearMap = new Map(lb.by_year.map((d) => [d.year, d.n]));
  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  const rowJumps = (rec: LBRec, i: number) => `<div class="row" data-slug="${rec.slug}">
      <div class="rank">${i + 1}</div>
      <div class="who"><div class="nm">${esc(rec.name)}</div><div class="path">${pathHtml(rec.path)}</div></div>
      <div class="hops"><span class="num">${rec.n_switches}</span><span class="lbl">hops</span></div>
    </div>`;
  const rowTimed = (rec: LBRec, i: number) => `<div class="row" data-slug="${rec.slug}">
      <div class="rank">${i + 1}</div>
      <div class="who"><div class="nm">${esc(rec.name)}</div><div class="path">${pathHtml(rec.path, rec.wins)}</div></div>
      <div class="hops"><span class="num win">${Math.round(rec.win_rate! * 100)}<span class="pct">%</span></span><span class="lbl">${rec.n_wins}/${rec.n_switches} won</span></div>
    </div>`;

  app.innerHTML = `${header()}
  <main>
    <section class="hero"><div class="wrap">
      <h1><span class="frog">🐸</span> Lompat</h1>
      <p>Malaysia's political <b style="color:var(--ink)">katak</b>, on the record. Every party-hop across every election since 1955 — search any politician, or meet the champions.</p>
      <div class="heroSearch searchbox"><input id="hero-q" type="search" autocomplete="off" placeholder="Search a politician — e.g. Jeffrey Kitingan" /><ul class="ac" id="hero-ac"></ul></div>
    </div></section>
    <div class="wrap">
      <div class="stats">
        <div class="stat"><div class="v">${lb.n_switchers.toLocaleString()}</div><div class="l">politicians have hopped at least once</div></div>
        <div class="stat"><div class="v">${lb.total_switches.toLocaleString()}</div><div class="l">total party-hops recorded</div></div>
        <div class="stat"><div class="v">${Math.round(lb.n_switchers / lb.n_candidates * 100)}%</div><div class="l">of repeat candidates have hopped</div></div>
      </div>

      <div class="section-title">🏆 The Katak Leaderboard</div>
      <div class="lbtoggle" id="lbtoggle">
        <button data-mode="jumps" class="active">Most jumps</button>
        <button data-mode="timed">Best &amp; worst-timed</button>
      </div>
      <div class="section-sub" id="lbsub"></div>
      <div class="sortrow" id="sortrow" hidden><button id="sortbtn"></button></div>
      <div class="lb" id="lb"></div>
      <div class="more" id="morerow"></div>

      <div class="two" style="margin-top:30px">
        <div class="card"><h3>Most-travelled routes</h3>
          ${lb.routes.slice(0, 10).map((r) => `<div class="route">${pchip(r.from)}<span class="arrow">→</span>${pchip(r.to)}<span class="n">${r.n}</span></div>`).join("")}
        </div>
        <div class="card"><h3>Hops by year</h3>
          <div class="yearbars">${years.map((y) => { const n = byYearMap.get(y) || 0; return `<div class="b" style="height:${Math.max(2, n / maxYear * 100)}%" title="${y}: ${n} hops"></div>`; }).join("")}</div>
          <div class="yearaxis"><span>${yearStart}</span><span>2008</span><span>${yearEnd}</span></div>
        </div>
      </div>
    </div>
    ${footer()}
  </main>`;

  wireSearch(document.getElementById("hsearch") as HTMLInputElement, document.getElementById("hac")!);
  wireSearch(document.getElementById("hero-q") as HTMLInputElement, document.getElementById("hero-ac")!);
  wireLogo();
  (document.getElementById("hero-q") as HTMLInputElement).focus();

  // ---- leaderboard state machine ----
  let mode: "jumps" | "timed" = "jumps";
  let level: 25 | 100 | "all" = 25;
  let sortDir: "desc" | "asc" = "desc";
  const lbEl = document.getElementById("lb")!;
  const moreEl = document.getElementById("morerow")!;
  const subEl = document.getElementById("lbsub")!;
  const sortRow = document.getElementById("sortrow") as HTMLElement;
  const sortBtn = document.getElementById("sortbtn")!;

  const pool = (): LBRec[] => {
    if (mode === "jumps") return lb.top;            // already sorted by hop count
    const arr = lb.top.filter((r) => r.n_switches >= 2);  // win-rate needs ≥2 jumps to mean anything
    arr.sort((a, b) => sortDir === "desc"
      ? (b.win_rate! - a.win_rate!) || (b.n_switches - a.n_switches) || (b.n_wins - a.n_wins)
      : (a.win_rate! - b.win_rate!) || (b.n_switches - a.n_switches) || (a.n_wins - b.n_wins));
    return arr;
  };
  const renderLB = () => {
    const p = pool();
    const rows = p.slice(0, level === "all" ? p.length : level);
    lbEl.innerHTML = rows.map((r, i) => mode === "jumps" ? rowJumps(r, i) : rowTimed(r, i)).join("");
    lbEl.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => go(`p/${(r as HTMLElement).dataset.slug}/`)));
    subEl.textContent = mode === "jumps"
      ? "Ranked by number of party-switches across the elections they contested. Renames & mergers don't count — only real moves."
      : "Ranked by how often their jumps paid off — the share of switches where they won under the new party. W = won that election, L = lost.";
    sortRow.hidden = mode !== "timed";
    sortBtn.textContent = sortDir === "desc" ? "Biggest winners first  ↓" : "Biggest losers first  ↑";
    const btns: string[] = [];
    if (level !== 25) btns.push(`<button data-act="less">← see less</button>`);
    if (level === 25 && p.length > 25) btns.push(`<button data-act="more">see more 🐸</button>`);
    else if (level === 100 && p.length > 100) btns.push(`<button data-act="all">see all 🐸</button>`);
    moreEl.innerHTML = btns.join("");
    moreEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const act = (b as HTMLElement).dataset.act;
      level = act === "less" ? 25 : act === "more" ? 100 : "all";
      renderLB();
    }));
  };
  document.getElementById("lbtoggle")!.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const m = (b as HTMLElement).dataset.mode as "jumps" | "timed";
    if (m === mode) return;
    mode = m; level = 25;
    document.querySelectorAll("#lbtoggle button").forEach((x) => x.classList.toggle("active", (x as HTMLElement).dataset.mode === mode));
    renderLB();
  }));
  sortBtn.addEventListener("click", () => { sortDir = sortDir === "desc" ? "asc" : "desc"; level = 25; renderLB(); });
  renderLB();
}

// ---------- CANDIDATE ----------
async function renderCand(slug: string) {
  app.innerHTML = `${header()}<div class="loading">Loading…</div>`;
  wireSearch(document.getElementById("hsearch") as HTMLInputElement, document.getElementById("hac")!);
  wireLogo();
  let c: Cand;
  try { c = await loadCand(slug); }
  catch { app.querySelector(".loading")!.outerHTML = `<div class="wrap loading">Politician not found. <a href="${BASE}" style="color:var(--accent)">Back home →</a></div>`; return; }

  document.title = `${c.name} — party trajectory · Lompat`;
  const isFrog = c.n_switches > 0;
  const span = `${c.first_year}–${c.last_year}`;
  const k = katakLabel(c.n_switches);
  const t = timingLabel(c.win_rate);
  const pct = c.win_rate != null ? Math.round(c.win_rate * 100) : 0;
  const items: string[] = [];
  c.contests.forEach((ct) => {
    if (ct.hop) {
      const sw = c.switches.find((s) => s.year === ct.year && s.to === ct.party_canon);
      const vs = sw && sw.vs_old === "beat" ? " · beat their former party here"
        : sw && sw.vs_old === "lost_to" ? " · former party won this seat" : "";
      items.push(`<div class="hopmark">🐸 HOPPED${sw ? ` · ${esc(sw.from)} → ${esc(sw.to)}${sw.cross_coalition ? " (crossed coalition)" : ""}${vs}` : ""}</div>`);
    }
    const res = ct.result.startsWith("won") ? "won" : "lost";
    items.push(`<div class="tl-item">
      <span class="tl-node" style="background:${partyColor(ct.party_canon)}"></span>
      <div class="tl-card">
        <div class="y">${ct.year} · ${esc(ct.election)}</div>
        <div class="seat">${esc(ct.seat)} <span style="color:var(--muted);font-weight:400">· ${esc(ct.state)}</span></div>
        <div class="pp">${pchip(ct.party_canon)}${ct.party !== ct.party_canon ? `<span style="color:var(--muted);font-size:12px">(as ${esc(ct.party)})</span>` : ""}${ct.coalition ? `<span style="color:var(--muted)">${esc(ct.coalition)}</span>` : ""}<span class="res ${res}">${res === "won" ? "WON" : "lost"}${ct.votes_perc != null ? ` · ${ct.votes_perc.toFixed(0)}%` : ""}</span></div>
      </div>
    </div>`);
  });

  const shareText = isFrog
    ? `${c.name} — ${c.n_switches} party-hop${c.n_switches > 1 ? "s" : ""}, won ${pct}% of them: ${c.path.join(" → ")} 🐸 On the record:`
    : `${c.name}: ${c.n_contests} elections, never switched parties (${c.parties[0]}). A rare loyalist. 💍`;
  const pageUrl = location.origin + `${BASE}p/${c.slug}/`;

  app.querySelector(".loading")!.outerHTML = `<main class="cand"><div class="wrap">
    <button class="backlink" id="back">← Leaderboard</button>
    <div class="candhead">
      <div class="nm">${esc(c.name)}</div>
      <div class="meta">${c.n_contests} elections · ${span} · ${c.n_parties} part${c.n_parties === 1 ? "y" : "ies"}</div>
      <div class="summary">${isFrog
        ? `Hopped <b>${c.n_switches}</b> time${c.n_switches > 1 ? "s" : ""} across <b>${c.n_parties}</b> parties — <b>${pct}%</b> of those jumps landed a win:`
        : `Contested <b>${c.n_contests}</b> times and <b>never switched</b> party.`}
        <div class="path" style="margin-top:10px">${pathHtml(c.path, isFrog ? c.wins : undefined)}</div>
      </div>
      <div class="verdicts">
        <div class="verdict ${k.cls}">${k.emoji} ${k.txt}</div>
        ${t ? `<div class="verdict ${t.cls}">${t.emoji} ${t.txt} · ${pct}% of jumps won</div>` : ""}
      </div>
    </div>
    <div class="timeline">${items.join("")}</div>
    <div class="sharebar">
      <button class="primary" id="copy">🔗 Copy link</button>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener">𝕏 Share</a>
      <a href="https://electiondata.my/candidates/" target="_blank" rel="noopener">Full record on electiondata.my →</a>
    </div>
    ${footer()}
  </div></main>`;
  document.getElementById("back")!.onclick = () => go("");
  document.getElementById("copy")!.onclick = () => { navigator.clipboard?.writeText(pageUrl); toast("Link copied"); };
}

function footer() {
  return `<footer><div class="wrap">
    Lompat tracks party as seen across <b>elections contested</b> — not real-time floor-crossing between polls. Renames &amp; mergers are not counted as hops. Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0). Not affiliated with the author. <a href="https://github.com/zachtheyek/lompat" target="_blank" rel="noopener">Source &amp; methods</a>.
  </div></footer>`;
}

route();
