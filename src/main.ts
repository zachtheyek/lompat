import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import { partyColor } from "./colors";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

interface Slim { s: string; n: string; c: number; h: number; p: number; lp: string; y0: number; y1: number; }
interface Contest { year: number; election: string; date: string; seat: string; state: string; party: string; party_canon: string; coalition: string | null; result: string; votes_perc: number | null; hop: boolean; }
interface Switch { year: number; from: string; to: string; cross_coalition: boolean; }
interface Cand { uid: string; slug: string; name: string; sex: string; n_contests: number; n_parties: number; n_switches: number; first_year: number; last_year: number; last_party: string; parties: string[]; contests: Contest[]; switches: Switch[]; }
interface LB { top: any[]; n_switchers: number; n_candidates: number; total_switches: number; routes: { from: string; to: string; n: number }[]; by_year: { year: number; n: number }[]; }

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const dot = (c: string) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c}"></span>`;
const pchip = (p: string) => `<span class="pchip" style="background:${partyColor(p)}">${esc(p)}</span>`;

let INDEX: Slim[] | null = null;
async function loadIndex() { if (!INDEX) INDEX = await fetch(`${BASE}data/index.json`).then((r) => r.json()); return INDEX!; }
async function loadLB(): Promise<LB> { return fetch(`${BASE}data/leaderboard.json`).then((r) => r.json()); }
async function loadCand(slug: string): Promise<Cand> {
  const pre = (window as any).__CAND__;
  if (pre && pre.slug === slug) return pre;
  return fetch(`${BASE}data/cand/${slug}.json`).then((r) => { if (!r.ok) throw new Error("404"); return r.json(); });
}
function go(path: string) { history.pushState({}, "", BASE + path); route(); }

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

// ---- shared search wiring ----
function wireSearch(input: HTMLInputElement, acEl: HTMLElement) {
  let active = -1, hits: Slim[] = [];
  const close = () => { acEl.innerHTML = ""; active = -1; };
  const draw = async () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return close();
    const idx = await loadIndex();
    hits = idx.filter((x) => x.n.toLowerCase().includes(q)).slice(0, 25);
    acEl.innerHTML = hits.map((h, i) => `
      <li data-slug="${h.s}" class="${i === active ? "active" : ""}">
        ${dot(partyColor(h.lp))}<span>${esc(h.n)}</span>
        ${h.h > 0 ? `<span class="badge-mini">${h.h} 🐸</span>` : ""}
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

function header() {
  return `<header class="top"><div class="wrap">
    <div class="logo" id="home"><span class="frog">🐸</span> Lompat</div>
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

  const rowHtml = (rec: any, i: number) => {
    const path = rec.parties.map((p: string, j: number) =>
      `${j ? '<span class="arrow">→</span>' : ""}${pchip(p)}`).join("");
    return `<div class="row" data-slug="${rec.slug}">
      <div class="rank">${i + 1}</div>
      <div class="who"><div class="nm">${esc(rec.name)}</div><div class="path">${path}</div></div>
      <div class="hops"><span class="num">${rec.n_switches}</span><span class="lbl">hops</span></div>
    </div>`;
  };

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

      <div class="section-title">🏆 The Frog Leaderboard</div>
      <div class="section-sub">Ranked by number of party switches across the elections they contested. Renames &amp; mergers don't count — only real moves.</div>
      <div class="lb" id="lb">${lb.top.slice(0, 20).map(rowHtml).join("")}</div>
      <div class="more"><button id="showmore">Show top 100 →</button></div>

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
  document.getElementById("home")!.onclick = () => go("");
  app.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => go(`p/${(r as HTMLElement).dataset.slug}/`)));
  document.getElementById("showmore")!.onclick = (e) => {
    document.getElementById("lb")!.innerHTML = lb.top.slice(0, 100).map(rowHtml).join("");
    app.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => go(`p/${(r as HTMLElement).dataset.slug}/`)));
    (e.target as HTMLElement).parentElement!.remove();
  };
}

// ---------- CANDIDATE ----------
async function renderCand(slug: string) {
  app.innerHTML = `${header()}<div class="loading">Loading…</div>`;
  wireSearch(document.getElementById("hsearch") as HTMLInputElement, document.getElementById("hac")!);
  document.getElementById("home")!.onclick = () => go("");
  let c: Cand;
  try { c = await loadCand(slug); }
  catch { app.querySelector(".loading")!.outerHTML = `<div class="wrap loading">Politician not found. <a href="${BASE}" style="color:var(--accent)">Back home →</a></div>`; return; }

  document.title = `${c.name} — party trajectory · Lompat`;
  const isFrog = c.n_switches > 0;
  const span = `${c.first_year}–${c.last_year}`;
  const items: string[] = [];
  c.contests.forEach((ct) => {
    if (ct.hop) {
      // find matching switch detail
      const sw = c.switches.find((s) => s.year === ct.year && s.to === ct.party_canon);
      items.push(`<div class="hopmark">🐸 HOPPED${sw ? ` · ${esc(sw.from)} → ${esc(sw.to)}${sw.cross_coalition ? " (crossed coalition)" : ""}` : ""}</div>`);
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
    ? `${c.name}: ${c.n_switches} party-hop${c.n_switches > 1 ? "s" : ""} across ${c.n_parties} parties — ${c.parties.join(" → ")}. 🐸 On the record:`
    : `${c.name}: ${c.n_contests} elections, never switched parties (${c.parties[0]}). A rare loyalist. 🐸`;
  const pageUrl = location.origin + `${BASE}p/${c.slug}/`;

  app.querySelector(".loading")!.outerHTML = `<main class="cand"><div class="wrap">
    <a class="backlink" id="back">← Leaderboard</a>
    <div class="candhead">
      <div class="nm">${esc(c.name)}</div>
      <div class="meta">${c.n_contests} elections · ${span} · ${c.n_parties} part${c.n_parties === 1 ? "y" : "ies"}</div>
      <div class="summary">${isFrog
        ? `Hopped <b>${c.n_switches}</b> time${c.n_switches > 1 ? "s" : ""} across <b>${c.n_parties}</b> parties:`
        : `Contested <b>${c.n_contests}</b> times and <b>never switched</b> party.`}
        <div class="path" style="margin-top:10px">${c.parties.map((p, j) => `${j ? '<span class="arrow">→</span>' : ""}${pchip(p)}`).join("")}</div>
      </div>
      <div class="verdict ${isFrog ? "frog" : "loyal"}">${isFrog ? `🐸 ${c.n_switches >= 4 ? "Super-frog" : "Frog"}` : "🪨 Loyalist"}</div>
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
  document.getElementById("copy")!.onclick = async (e) => { await navigator.clipboard.writeText(pageUrl); (e.target as HTMLElement).textContent = "✓ Copied!"; };
}

function footer() {
  return `<footer><div class="wrap">
    Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by Thevesh Thevananthan (CC0). Not affiliated with the author.<br>
    Lompat tracks party as seen across <b>elections contested</b> — not real-time floor-crossing between polls. Renames &amp; mergers are not counted as hops. <a href="https://github.com/zachtheyek/lompat" target="_blank" rel="noopener">Source &amp; method</a>.
  </div></footer>`;
}

route();
