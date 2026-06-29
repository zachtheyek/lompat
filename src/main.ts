import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import { partyColor } from "./colors";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

interface Slim { s: string; n: string; c: number; h: number; p: number; lp: string; y0: number; y1: number; wr: number | null; nw: number; cwr: number; }
interface Contest { year: number; election: string; date: string; seat: string; state: string; party: string; party_canon: string; coalition: string | null; result: string; votes_perc: number | null; hop: boolean; }
interface Switch { year: number; from: string; to: string; cross_coalition: boolean; win: boolean; vs_old: "beat" | "lost_to" | null; return: boolean; }
interface Cand { uid: string; slug: string; name: string; sex: string; n_contests: number; n_parties: number; n_switches: number; first_year: number; last_year: number; last_party: string; parties: string[]; path: string[]; wins: boolean[]; n_wins: number; win_rate: number | null; n_returns: number; n_cross: number; career_win_rate: number; contests: Contest[]; switches: Switch[]; }
interface LBRec { slug: string; name: string; n_switches: number; n_parties: number; first_year: number; last_year: number; parties: string[]; path: string[]; wins: boolean[]; n_wins: number; win_rate: number | null; n_returns: number; n_cross: number; career_win_rate: number; }
interface Route { id: string; from: string; to: string; n: number; wins: number; members: number; }
interface Move { id: string; to: string; year: number; n: number; wins: number; }
interface LB { top: LBRec[]; n_switchers: number; n_candidates: number; total_switches: number; routes: Route[]; events: Move[]; inflows: { party: string; n: number }[]; outflows: { party: string; n: number }[]; by_year: { year: number; n: number }[]; }
interface Loyal { slug: string; name: string; party: string; n_contests: number; win_rate: number; first_year: number; last_year: number; }
interface Vet { slug: string; name: string; path: string[]; wins: boolean[]; n_contests: number; n_switches: number; first_year: number; last_year: number; }
interface EventDetail { type: "m" | "r"; from?: string; to: string; year?: number; n: number; wins: number; members: { s: string; w: number }[]; }

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const dot = (c: string) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c}"></span>`;
const pchip = (p: string) => `<span class="pchip" style="background:${partyColor(p)}">${esc(p)}</span>`;
const pct = (x: number) => Math.round(x * 100);

// ---- labels ----
// katak tier by hop count: 0 = loyalist, 1–3 = katak, 4+ = super-katak.
function katakLabel(h: number) {
  if (h === 0) return { txt: "Loyalist", emoji: "💍", cls: "loyal" };
  if (h >= 4) return { txt: "Super-katak", emoji: "🐸", cls: "superkatak" };
  return { txt: "Katak", emoji: "🐸", cls: "katak" };
}
// landing tier by win-rate. >60% soft, 25–60% bumpy, <25% crash.
function landing(wr: number | null) {
  if (wr == null) return null;
  if (wr > 0.6) return { txt: "Soft landing", emoji: "🟢", cls: "soft" };
  if (wr >= 0.25) return { txt: "Bumpy landing", emoji: "🟡", cls: "bumpy" };
  return { txt: "Crash landing", emoji: "🔴", cls: "crash" };
}
const landingCls = (wr: number | null) => landing(wr)?.cls ?? "";
// career win-share (shown for everyone): same thresholds as landing, distinct emoji set.
function careerTier(wr: number) {
  if (wr > 0.6) return { emoji: "🏆", cls: "soft" };
  if (wr >= 0.25) return { emoji: "🗳️", cls: "bumpy" };
  return { emoji: "📉", cls: "crash" };
}
const katakBadge = (h: number) => { const k = katakLabel(h); return `<span class="kbadge ${k.cls}">${k.emoji} ${h}</span>`; };
const timingBadge = (wr: number | null) => { const t = landing(wr); return t ? `<span class="tbadge ${t.cls}" title="${t.txt} · ${pct(wr!)}% of jumps won">${pct(wr!)}%</span>` : ""; };

// path renderer: full sequential trajectory; if `wins` supplied, a W/L mark sits above each arrow.
function pathHtml(path: string[], wins?: boolean[] | null) {
  return path.map((p, j) => {
    let arrow = "";
    if (j) arrow = wins
      ? `<span class="hop"><span class="wl ${wins[j - 1] ? "w" : "l"}">${wins[j - 1] ? "W" : "L"}</span><span class="arrow">→</span></span>`
      : `<span class="arrow">→</span>`;
    return arrow + pchip(p);
  }).join("");
}

// Standard competition ranking ("1224"): rows sharing the displayed metric value share a
// placement, and the next distinct value skips ahead. Input must already be sorted.
function placed<T>(arr: T[], metric: (t: T) => number): { r: T; place: number }[] {
  let place = 0; let prev: number | null = null;
  return arr.map((r, i) => { const v = metric(r); if (v !== prev) { place = i + 1; prev = v; } return { r, place }; });
}

// generic leaderboard / member row
function cardRow(slug: string, name: string, path: string[], wins: boolean[] | null, rank: number, num: string, sub: string, cls = "") {
  return `<div class="row" data-slug="${slug}">
      <div class="rank">${rank}</div>
      <div class="who"><div class="nm">${esc(name)}</div><div class="path">${pathHtml(path, wins)}</div></div>
      <div class="hops"><span class="num ${cls}">${num}</span><span class="lbl">${sub}</span></div>
    </div>`;
}

// ---- data caches ----
let INDEX: Slim[] | null = null, LB: LB | null = null, LOYAL: Loyal[] | null = null, VETS: Vet[] | null = null, EVENTS: Record<string, EventDetail> | null = null, CARDMAP: Map<string, LBRec> | null = null;
const j = (f: string) => fetch(`${BASE}data/${f}`).then((r) => { if (!r.ok) throw new Error("404"); return r.json(); });
async function loadIndex() { if (!INDEX) INDEX = await j("index.json"); return INDEX!; }
async function loadLB() { if (!LB) { LB = await j("leaderboard.json"); CARDMAP = new Map(LB!.top.map((r) => [r.slug, r])); } return LB!; }
async function loadLoyal() { if (!LOYAL) LOYAL = await j("loyal.json"); return LOYAL!; }
async function loadVets() { if (!VETS) VETS = await j("veterans.json"); return VETS!; }
async function loadEvents() { if (!EVENTS) EVENTS = await j("events.json"); return EVENTS!; }
async function loadCand(slug: string): Promise<Cand> {
  const pre = (window as any).__CAND__;
  if (pre && pre.slug === slug) return pre;
  return j(`cand/${slug}.json`);
}

function go(path: string) { history.pushState({}, "", BASE + path); route(); }
const enc = encodeURIComponent, dec = decodeURIComponent;
function eventUrl(id: string) {
  const [t, a, b] = id.split("|");
  return `e/${t}/${enc(a)}/${enc(b)}/`;
}

// ---- leaderboard UI state (preserved across a card visit; reset by the logo) ----
const lbState = { mode: "jumps", level: 25 as number, sortDir: "desc" as "desc" | "asc", scrollY: 0 };
let restoreScroll = false;
function resetHome() { lbState.mode = "jumps"; lbState.level = 25; lbState.sortDir = "desc"; lbState.scrollY = 0; }

// ---- toast ----
function toast(msg: string) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span class="tick">✓</span> ${esc(msg)}`;
  t.classList.add("show");
  clearTimeout((t as any)._h);
  (t as any)._h = setTimeout(() => t!.classList.remove("show"), 2600);
}

function getRoute() {
  const p = location.pathname;
  let m = p.match(/\/e\/m\/([^/]+)\/([^/]+)/);
  if (m) return { type: "event" as const, key: `m|${dec(m[1])}|${dec(m[2])}` };
  m = p.match(/\/e\/r\/([^/]+)\/([^/]+)/);
  if (m) return { type: "event" as const, key: `r|${dec(m[1])}|${dec(m[2])}` };
  m = p.match(/\/p\/([^/]+)/);
  if (m) return { type: "cand" as const, slug: dec(m[1]) };
  const c = new URLSearchParams(location.search).get("c");
  if (c) return { type: "cand" as const, slug: c };
  return { type: "home" as const };
}
async function route() {
  const r = getRoute();
  if (r.type === "cand") return renderCand(r.slug);
  if (r.type === "event") return renderEvent(r.key);
  renderHome();
}
window.addEventListener("popstate", route);

// ordered-token match: every query token must appear, in order, as a substring of the name.
function matchTokens(name: string, toks: string[]): boolean {
  let pos = 0;
  for (const t of toks) { const i = name.indexOf(t, pos); if (i < 0) return false; pos = i + t.length; }
  return true;
}

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
  if (el) el.onclick = (e) => { e.preventDefault(); resetHome(); go(""); };
}

function header() {
  return `<header class="top"><div class="wrap">
    <a class="logo" id="home" href="${BASE}"><span class="frog">🐸</span> Lompat</a>
    <div class="grow"></div>
    <div class="searchbox"><input id="hsearch" type="search" autocomplete="off" placeholder="Search a politician…" /><ul class="ac" id="hac"></ul></div>
  </div></header>`;
}

// ---- Tufte-style hops-by-year chart ----
function yearChart(by_year: { year: number; n: number }[]): string {
  const W = 720, H = 188, padL = 8, padR = 8, padT = 30, padB = 22;
  const y0 = 1955, y1 = Math.max(...by_year.map((d) => d.year));
  const maxN = Math.max(...by_year.map((d) => d.n));
  const peak = by_year.reduce((a, b) => (b.n > a.n ? b : a));
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = (yr: number) => padL + (yr - y0) / (y1 - y0) * innerW;
  const bw = Math.max(2.5, innerW / (y1 - y0) * 0.62);
  const baseY = padT + innerH;
  const bars = by_year.filter((d) => d.n > 0).map((d) => {
    const h = d.n / maxN * innerH, isPeak = d.year === peak.year;
    return `<rect x="${(x(d.year) - bw / 2).toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${isPeak ? "var(--accent)" : "#3a4456"}"></rect>`;
  }).join("");
  // direct label on the peak; range-frame baseline; first/last/peak year ticks only
  const peakX = x(peak.year), peakH = peak.n / maxN * innerH;
  const labels = `
    <text x="${peakX}" y="${(baseY - peakH - 9).toFixed(1)}" text-anchor="middle" class="yc-peak">${peak.n} hops · ${peak.year}</text>
    <line x1="${padL}" y1="${baseY}" x2="${padL + innerW}" y2="${baseY}" class="yc-base"></line>
    <text x="${padL}" y="${H - 6}" text-anchor="start" class="yc-tick">${y0}</text>
    <text x="${peakX}" y="${H - 6}" text-anchor="middle" class="yc-tick">${peak.year}</text>
    <text x="${padL + innerW}" y="${H - 6}" text-anchor="end" class="yc-tick">${y1}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="yearchart" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Party-hops by election year, peaking at ${peak.year}">${bars}${labels}</svg>`;
}

// ---------- HOME ----------
async function renderHome() {
  document.title = "Lompat — Malaysia's political frogs, on the record";
  const lb = await loadLB();

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
        <div class="stat"><div class="v">${pct(lb.n_switchers / lb.n_candidates)}%</div><div class="l">of repeat candidates have hopped</div></div>
      </div>

      <div class="section-title">🏆 The Katak Leaderboards</div>
      <div class="lbtoggle" id="lbtoggle"></div>
      <div class="section-sub" id="lbsub"></div>
      <div class="sortrow" id="sortrow" hidden><button id="sortbtn"></button></div>
      <div class="lb" id="lb"></div>
      <div class="more" id="morerow"></div>

      <div class="two" style="margin-top:30px">
        <div class="card"><h3>Most-travelled routes</h3>
          ${lb.routes.slice(0, 10).map((r) => { const wr = r.wins / r.members; return `<div class="route" data-ev="${r.id}">${pchip(r.from)}<span class="arrow">→</span>${pchip(r.to)}<span class="n">${r.n}</span><span class="rwin ${landingCls(wr)}">${pct(wr)}%</span></div>`; }).join("")}
          <div class="cardnote">Hops · win-rate. Tap a route to see everyone who made it.</div>
        </div>
        <div class="card"><h3>Where they go</h3>
          <div class="flow"><div class="flow-h">Most hopped <b>to</b></div>${lb.inflows.map((r) => `<div class="route">${pchip(r.party)}<span class="n">${r.n}</span></div>`).join("")}</div>
          <div class="flow"><div class="flow-h">Most hopped <b>from</b></div>${lb.outflows.map((r) => `<div class="route">${pchip(r.party)}<span class="n">${r.n}</span></div>`).join("")}</div>
        </div>
      </div>

      <div class="section-title" style="margin-top:30px">🪷 Biggest organized hops</div>
      <div class="section-sub">Elections where ${5}+ candidates jumped into the same party at once — splits, defection waves, new-party launches. Tap to see who.</div>
      <div class="lb">${lb.events.slice(0, 8).map((e) => { const wr = e.wins / e.n; return `<div class="row ev" data-ev="${e.id}">
        <div class="who"><div class="nm">${esc(e.to)} <span class="evyear">${e.year}</span></div></div>
        <div class="hops"><span class="num grey">${e.n}</span><span class="lbl">jumpers</span></div>
        <div class="hops"><span class="num ${landingCls(wr)}">${pct(wr)}<span class="pct">%</span></span><span class="lbl">${e.wins}/${e.n} won</span></div>
      </div>`; }).join("")}</div>

      <div class="card" style="margin-top:30px">
        <h3>Hops by year</h3>
        <div class="cardnote" style="margin:-6px 0 8px">Each bar is one election year; its height is how many candidates hopped that year. Party-hopping spikes when coalitions realign.</div>
        ${yearChart(lb.by_year)}
        <div class="yc-legend"><span class="sw ctx"></span> an election year &nbsp;&nbsp; <span class="sw peak"></span> the peak (most hops ever)</div>
      </div>
    </div>
    ${footer()}
  </main>`;

  wireSearch(document.getElementById("hsearch") as HTMLInputElement, document.getElementById("hac")!);
  wireSearch(document.getElementById("hero-q") as HTMLInputElement, document.getElementById("hero-ac")!);
  wireLogo();
  if (!restoreScroll) (document.getElementById("hero-q") as HTMLInputElement).focus();

  // route + organized-move clicks
  const evGo = (el: Element) => { lbState.scrollY = window.scrollY; go(eventUrl((el as HTMLElement).dataset.ev!)); };
  app.querySelectorAll("[data-ev]").forEach((el) => el.addEventListener("click", () => evGo(el)));

  await wireLeaderboards(lb);

  // restore the home scroll position only when returning via "← Leaderboard"; otherwise top.
  if (restoreScroll) { window.scrollTo(0, lbState.scrollY); restoreScroll = false; }
  else window.scrollTo(0, 0);
}

// ---- the six leaderboards ----
const MODES: { key: string; label: string; sortable?: boolean }[] = [
  { key: "jumps", label: "Most jumps" },
  { key: "timed", label: "Best & worst-timed", sortable: true },
  { key: "boom", label: "Boomerangs" },
  { key: "cross", label: "Coalition-crossers" },
  { key: "loyal", label: "Loyal & true", sortable: true },
  { key: "vets", label: "Veterans" },
];
const SUBS: Record<string, string> = {
  jumps: "Ranked by number of party-switches across the elections they contested. Renames & mergers don't count — only real moves.",
  timed: "Ranked by how often their jumps paid off — the share of switches where they won under the new party.",
  loyal: "Politicians who never switched (3+ elections), ranked by how often they won under their one party.",
  boom: "Politicians who left a party and later came back — ranked by number of returns.",
  cross: "Switches that crossed coalition lines, not just parties — ranked by number of crossings.",
  vets: "The longest-serving — ranked by number of elections contested since 1955.",
};

async function wireLeaderboards(lb: LB) {
  const lbEl = document.getElementById("lb")!;
  const moreEl = document.getElementById("morerow")!;
  const subEl = document.getElementById("lbsub")!;
  const sortRow = document.getElementById("sortrow") as HTMLElement;
  const sortBtn = document.getElementById("sortbtn")!;
  const toggleEl = document.getElementById("lbtoggle")!;
  toggleEl.innerHTML = MODES.map((m) => `<button data-mode="${m.key}" class="${m.key === lbState.mode ? "active" : ""}">${m.label}</button>`).join("");

  const rowsFor = async (): Promise<string[]> => {
    const dir = lbState.sortDir;
    if (lbState.mode === "jumps")
      return placed(lb.top, (r) => r.n_switches).map(({ r, place }) => cardRow(r.slug, r.name, r.path, null, place, String(r.n_switches), "hops"));
    if (lbState.mode === "timed") {
      const arr = lb.top.filter((r) => r.n_switches >= 2).sort((a, b) => dir === "desc"
        ? (b.win_rate! - a.win_rate!) || (b.n_switches - a.n_switches)
        : (a.win_rate! - b.win_rate!) || (b.n_switches - a.n_switches));
      return placed(arr, (r) => pct(r.win_rate!)).map(({ r, place }) => cardRow(r.slug, r.name, r.path, r.wins, place, `${pct(r.win_rate!)}<span class="pct">%</span>`, `${r.n_wins}/${r.n_switches} won`, landingCls(r.win_rate)));
    }
    if (lbState.mode === "loyal") {
      const arr = (await loadLoyal()).slice().sort((a, b) => dir === "desc"
        ? (b.win_rate - a.win_rate) || (b.n_contests - a.n_contests)
        : (a.win_rate - b.win_rate) || (b.n_contests - a.n_contests));
      return placed(arr, (r) => pct(r.win_rate)).map(({ r, place }) => cardRow(r.slug, r.name, [r.party], null, place, `${pct(r.win_rate)}<span class="pct">%</span>`, `${r.n_contests} elections`, landingCls(r.win_rate)));
    }
    if (lbState.mode === "boom") {
      const arr = lb.top.filter((r) => r.n_returns >= 1).sort((a, b) => (b.n_returns - a.n_returns) || (b.n_switches - a.n_switches));
      return placed(arr, (r) => r.n_returns).map(({ r, place }) => cardRow(r.slug, r.name, r.path, null, place, String(r.n_returns), r.n_returns === 1 ? "return" : "returns"));
    }
    if (lbState.mode === "cross") {
      const arr = lb.top.filter((r) => r.n_cross >= 1).sort((a, b) => (b.n_cross - a.n_cross) || (b.n_switches - a.n_switches));
      return placed(arr, (r) => r.n_cross).map(({ r, place }) => cardRow(r.slug, r.name, r.path, null, place, String(r.n_cross), r.n_cross === 1 ? "crossing" : "crossings"));
    }
    // vets
    const arr = await loadVets();
    return placed(arr, (r) => r.n_contests).map(({ r, place }) => cardRow(r.slug, r.name, r.path, null, place, String(r.n_contests), "elections"));
  };

  const render = async () => {
    const rows = await rowsFor();
    const shown = rows.slice(0, lbState.level);
    lbEl.innerHTML = shown.join("");
    lbEl.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => { lbState.scrollY = window.scrollY; go(`p/${(r as HTMLElement).dataset.slug}/`); }));
    subEl.textContent = SUBS[lbState.mode];
    const sortable = MODES.find((m) => m.key === lbState.mode)?.sortable;
    sortRow.hidden = !sortable;
    if (sortable) sortBtn.textContent = lbState.sortDir === "desc" ? "Best first  ↓" : "Worst first  ↑";
    const btns: string[] = [];
    if (lbState.level > 25) btns.push(`<button data-act="less">← see less</button>`);
    if (lbState.level < rows.length) btns.push(`<button data-act="more">see more 🐸</button>`);
    moreEl.innerHTML = btns.join("");
    moreEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const act = (b as HTMLElement).dataset.act;
      lbState.level = act === "less" ? 25 : (lbState.level === 25 ? 100 : lbState.level + 100);
      render();
    }));
  };

  toggleEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const m = (b as HTMLElement).dataset.mode!;
    if (m === lbState.mode) return;
    lbState.mode = m; lbState.level = 25; lbState.sortDir = "desc";
    toggleEl.querySelectorAll("button").forEach((x) => x.classList.toggle("active", (x as HTMLElement).dataset.mode === m));
    render();
  }));
  sortBtn.addEventListener("click", () => { lbState.sortDir = lbState.sortDir === "desc" ? "asc" : "desc"; lbState.level = 25; render(); });
  await render();
}

// ---------- EVENT (organized move / route) ----------
async function renderEvent(key: string) {
  app.innerHTML = `${header()}<div class="loading">Loading…</div>`;
  wireSearch(document.getElementById("hsearch") as HTMLInputElement, document.getElementById("hac")!);
  wireLogo();
  let ev: EventDetail | undefined, map: Map<string, LBRec>;
  try { const [events] = await Promise.all([loadEvents(), loadLB()]); ev = events[key]; map = CARDMAP!; }
  catch { app.querySelector(".loading")!.outerHTML = `<div class="wrap loading">Event not found. <a href="${BASE}" style="color:var(--accent)">Back home →</a></div>`; return; }
  if (!ev) { app.querySelector(".loading")!.outerHTML = `<div class="wrap loading">Event not found. <a href="${BASE}" style="color:var(--accent)">Back home →</a></div>`; return; }

  const title = ev.type === "m" ? `The move to ${esc(ev.to)} · ${ev.year}` : `${esc(ev.from!)} → ${esc(ev.to)}`;
  const lead = ev.type === "m"
    ? `${ev.n} candidates jumped into <b>${esc(ev.to)}</b> at the ${ev.year} election.`
    : `${ev.n} politicians have made the <b>${esc(ev.from!)} → ${esc(ev.to)}</b> jump.`;
  document.title = `${title} · Lompat`;
  const succ = pct(ev.wins / ev.n);
  const succCls = landingCls(ev.wins / ev.n);
  // event members are a list, not a ranked board: winners first (ties to the success-rate
  // headline), then most party-hops, then alphabetical — deterministic, not arbitrary.
  const members = ev.members
    .map((m) => ({ m, r: map.get(m.s) }))
    .filter((x) => x.r)
    .sort((a, b) => (b.m.w - a.m.w) || (b.r!.n_switches - a.r!.n_switches) || a.r!.name.localeCompare(b.r!.name));
  const rows = members.map((x, i) => cardRow(x.r!.slug, x.r!.name, x.r!.path, null, i + 1,
    `<span class="wl ${x.m.w ? "w" : "l"}">${x.m.w ? "W" : "L"}</span>`, x.m.w ? "won" : "lost")).join("");

  app.querySelector(".loading")!.outerHTML = `<main class="cand"><div class="wrap">
    <button class="backlink" id="back">← Leaderboard</button>
    <div class="candhead">
      <div class="nm">${title}</div>
      <div class="summary" style="margin-top:10px">${lead}</div>
      <div class="verdicts">
        <div class="verdict ${succCls}">🎯 ${succ}% won their seat</div>
        <div class="verdict">${ev.wins} of ${ev.n} successful</div>
      </div>
    </div>
    <div class="lb" style="margin-top:18px">${rows}</div>
    ${footer()}
  </div></main>`;
  document.getElementById("back")!.onclick = () => backToHome();
  app.querySelectorAll(".lb .row").forEach((r) => r.addEventListener("click", () => go(`p/${(r as HTMLElement).dataset.slug}/`)));
  window.scrollTo(0, 0);
}

function backToHome() { restoreScroll = true; go(""); }

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
  const winPct = c.win_rate != null ? pct(c.win_rate) : 0;
  const careerPct = pct(c.career_win_rate);
  const items: string[] = [];
  c.contests.forEach((ct) => {
    if (ct.hop) {
      const sw = c.switches.find((s) => s.year === ct.year && s.to === ct.party_canon);
      const vs = sw && sw.vs_old === "beat" ? " · beat their former party here"
        : sw && sw.vs_old === "lost_to" ? " · former party won this seat" : "";
      const ret = sw && sw.return ? " · 🪃 returned" : "";
      items.push(`<div class="hopmark">🐸 HOPPED${sw ? ` · ${esc(sw.from)} → ${esc(sw.to)}${sw.cross_coalition ? " (crossed coalition)" : ""}${vs}${ret}` : ""}</div>`);
    }
    const won = ct.result.startsWith("won");
    items.push(`<div class="tl-item">
      <span class="tl-node" style="background:${partyColor(ct.party_canon)}"></span>
      <div class="tl-card">
        <div class="y">${ct.year} · ${esc(ct.election)}</div>
        <div class="seat">${esc(ct.seat)} <span style="color:var(--muted);font-weight:400">· ${esc(ct.state)}</span></div>
        <div class="pp">${pchip(ct.party_canon)}${ct.party !== ct.party_canon ? `<span style="color:var(--muted);font-size:12px">(as ${esc(ct.party)})</span>` : ""}${ct.coalition ? `<span style="color:var(--muted)">${esc(ct.coalition)}</span>` : ""}<span class="res ${won ? "won" : "lost"}">${won ? "WON" : "LOST"}${ct.votes_perc != null ? ` · ${ct.votes_perc.toFixed(0)}%` : ""}</span></div>
      </div>
    </div>`);
  });

  // verdict chips
  const chips: string[] = [`<div class="verdict ${k.cls}">${k.emoji} ${k.txt}</div>`];
  if (isFrog) { const t = landing(c.win_rate); if (t) chips.push(`<div class="verdict ${t.cls}">${t.emoji} ${t.txt} · ${winPct}% of jumps won</div>`); }
  const ct = careerTier(c.career_win_rate);
  chips.push(`<div class="verdict ${ct.cls}">${ct.emoji} ${careerPct}% career wins</div>`);
  if (c.n_returns >= 1) chips.push(`<div class="verdict boom">🪃 Boomerang${c.n_returns > 1 ? ` ×${c.n_returns}` : ""}</div>`);
  if (c.n_cross >= 2) chips.push(`<div class="verdict cross">🔀 Coalition-crosser ×${c.n_cross}</div>`);
  if (c.n_contests >= 10) chips.push(`<div class="verdict vet">🎖 Veteran · ${c.n_contests} elections</div>`);

  const shareText = isFrog
    ? `${c.name} — ${c.n_switches} party-hop${c.n_switches > 1 ? "s" : ""}, won ${winPct}% of them: ${c.path.join(" → ")}. 🐸 On the record:`
    : `${c.name}: ${c.n_contests} elections, never switched parties (${c.parties[0]}). A rare loyalist. 💍 On the record:`;
  const pageUrl = location.origin + `${BASE}p/${c.slug}/`;

  app.querySelector(".loading")!.outerHTML = `<main class="cand"><div class="wrap">
    <button class="backlink" id="back">← Leaderboard</button>
    <div class="candhead">
      <div class="nm">${esc(c.name)}</div>
      <div class="meta">${c.n_contests} elections · ${span} · ${c.n_parties} part${c.n_parties === 1 ? "y" : "ies"}</div>
      <div class="summary">${isFrog
        ? `Hopped <b>${c.n_switches}</b> time${c.n_switches > 1 ? "s" : ""} across <b>${c.n_parties}</b> parties — <b>${winPct}%</b> of those jumps landed a win:`
        : `Contested <b>${c.n_contests}</b> times and <b>never switched</b> party — winning <b>${careerPct}%</b>.`}
        <div class="path" style="margin-top:10px">${pathHtml(c.path, isFrog ? c.wins : null)}</div>
      </div>
      <div class="verdicts">${chips.join("")}</div>
    </div>
    <div class="timeline">${items.join("")}</div>
    <div class="sharebar">
      <button class="primary" id="copy">🔗 Copy link</button>
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener">𝕏 Share</a>
      <a href="https://electiondata.my/candidates/" target="_blank" rel="noopener">Full record on electiondata.my →</a>
    </div>
    ${footer()}
  </div></main>`;
  document.getElementById("back")!.onclick = () => backToHome();
  document.getElementById("copy")!.onclick = () => { navigator.clipboard?.writeText(pageUrl); toast("Link copied"); };
  window.scrollTo(0, 0);
}

function footer() {
  return `<footer><div class="wrap">
    Lompat tracks party as seen across <b>elections contested</b> — not real-time floor-crossing between polls. Renames &amp; mergers are not counted as hops. Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0). Not affiliated with the author. <a href="https://github.com/zachtheyek/lompat" target="_blank" rel="noopener">Source &amp; methods</a>.
  </div></footer>`;
}

route();
