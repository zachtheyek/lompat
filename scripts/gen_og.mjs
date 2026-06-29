// OG cards → dist/og/<slug>.png for every switcher + prominent loyalist, plus a default.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

mkdirSync("dist/og", { recursive: true });
const fontDir = "node_modules/@fontsource/space-grotesk/files";
const fonts = [
  { name: "Space Grotesk", weight: 400, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-400-normal.woff")) },
  { name: "Space Grotesk", weight: 700, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-700-normal.woff")) },
];
const PARTY = { UMNO: "#cc0001", MCA: "#16348f", MIC: "#f0a30a", DAP: "#d7282f", PKR: "#0096d6", PAS: "#1f8a4c", BERSATU: "#b01116", AMANAH: "#e2231a", GERAKAN: "#e4002b", PBB: "#1a6f7e", WARISAN: "#2aa7a0", PBS: "#2e7d32", STAR: "#283593", BEBAS: "#6a6a78", S46: "#8a6d3b", BERJAYA: "#c0392b", USNO: "#34495e", BN: "#1f4ea1", PH: "#d7282f", PN: "#0e2a6b" };
function pc(p) { if (PARTY[p]) return PARTY[p]; let h = 0; for (const ch of p) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 50%)`; }

function pill(p) {
  return `<div style="display:flex;align-items:center;background:${pc(p)};color:#fff;font-size:26px;font-weight:700;padding:6px 16px;border-radius:9px;margin:0 10px 10px 0">${p}</div>`;
}
// drawn chevron (the → glyph isn't in the font subset, so it would render as tofu)
const chev = `<div style="display:flex;width:12px;height:12px;border-top:3px solid #5d6678;border-right:3px solid #5d6678;transform:rotate(45deg);margin:0 16px 10px 6px"></div>`;
// long names overflow the fixed 630px card — shrink the type so they stay ~2 lines.
const nameSize = (n) => (n.length > 46 ? 40 : n.length > 32 ? 50 : 62);

function brand() {
  return `<div style="display:flex;align-items:center">
      <div style="display:flex;width:30px;height:30px;border-radius:50%;background:#34d27b;margin-right:16px"></div>
      <div style="display:flex;font-size:28px;font-weight:700;letter-spacing:5px;color:#34d27b">LOMPAT</div>
    </div>`;
}

function switcherCard(c) {
  const full = c.path || c.parties;
  const parties = full.slice(0, 7);
  const extra = full.length - parties.length;
  const path = parties.map((p, i) => (i ? chev : "") + pill(p)).join("") +
    (extra > 0 ? `<div style="display:flex;align-items:center;color:#8b95a7;font-size:24px;margin-bottom:10px">+${extra} more</div>` : "");
  const win = c.win_rate != null ? ` · won ${Math.round(c.win_rate * 100)}% of them` : "";
  return html(`
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:58px 68px;background:#0e1117;font-family:'Space Grotesk'">
    ${brand()}
    <div style="display:flex;font-size:${nameSize(c.name)}px;font-weight:700;color:#eef2f8;line-height:1.05;margin-top:26px;max-width:1064px">${c.name}</div>
    <div style="display:flex;align-items:center;margin-top:24px">
      <div style="display:flex;font-size:116px;font-weight:700;color:#ff5470;line-height:1">${c.n_switches}</div>
      <div style="display:flex;flex-direction:column;margin-left:24px">
        <div style="display:flex;font-size:34px;color:#eef2f8;font-weight:700">party hops</div>
        <div style="display:flex;font-size:25px;color:#8b95a7">across ${c.n_parties} parties${win} · ${c.first_year}–${c.last_year}</div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;margin-top:30px;max-width:1064px">${path}</div>
    <div style="display:flex;margin-top:auto;font-size:22px;color:#5d6678">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
}

function loyalistCard(c) {
  const party = c.last_party || (c.parties && c.parties[0]) || "";
  const careerPct = Math.round((c.career_win_rate ?? 0) * 100);
  return html(`
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:58px 68px;background:#0e1117;font-family:'Space Grotesk'">
    ${brand()}
    <div style="display:flex;font-size:${nameSize(c.name)}px;font-weight:700;color:#eef2f8;line-height:1.05;margin-top:26px;max-width:1064px">${c.name}</div>
    <div style="display:flex;align-items:center;margin-top:24px">
      <div style="display:flex;font-size:116px;font-weight:700;color:#34d27b;line-height:1">${c.n_contests}</div>
      <div style="display:flex;flex-direction:column;margin-left:24px">
        <div style="display:flex;font-size:34px;color:#eef2f8;font-weight:700">elections, never switched</div>
        <div style="display:flex;font-size:25px;color:#8b95a7">a rare loyalist · ${c.first_year}–${c.last_year}</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;margin-top:30px;max-width:1064px">
      ${pill(party)}
      <div style="display:flex;align-items:center;color:#8b95a7;font-size:26px;margin-bottom:10px">won ${careerPct}% of contests</div>
    </div>
    <div style="display:flex;margin-top:auto;font-size:22px;color:#5d6678">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
}

const slugs = JSON.parse(readFileSync("public/data/og_list.json", "utf8"));
const limit = process.env.OG_LIMIT ? parseInt(process.env.OG_LIMIT, 10) : slugs.length;
const list = slugs.slice(0, limit);
let i = 0, t0 = Date.now();
for (const slug of list) {
  const c = JSON.parse(readFileSync(join("public/data/cand", slug + ".json"), "utf8"));
  const card = c.n_switches > 0 ? switcherCard(c) : loyalistCard(c);
  const svg = await satori(card, { width: 1200, height: 630, fonts });
  writeFileSync(join("dist/og", slug + ".png"), new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
  if (++i % 200 === 0) process.stdout.write(`  ${i}/${list.length}\n`);
}
// default landing card
const def = html(`
  <div style="display:flex;flex-direction:column;justify-content:center;width:1200px;height:630px;padding:72px;background:#0e1117;font-family:'Space Grotesk'">
    <div style="display:flex;align-items:center;margin-bottom:26px">
      <div style="display:flex;width:36px;height:36px;border-radius:50%;background:#34d27b;margin-right:18px"></div>
      <div style="display:flex;font-size:32px;font-weight:700;letter-spacing:7px;color:#34d27b">LOMPAT</div>
    </div>
    <div style="display:flex;flex-direction:column;font-size:92px;font-weight:700;color:#eef2f8;line-height:1.02;letter-spacing:-2px">
      <div style="display:flex">Malaysia's political</div>
      <div style="display:flex;color:#ff5470">frogs, on the record.</div>
    </div>
    <div style="display:flex;margin-top:34px;font-size:30px;color:#8b95a7">Every party-hop since 1955 — search any politician, or meet the champions</div>
    <div style="display:flex;margin-top:18px;font-size:22px;color:#5d6678">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
writeFileSync("dist/og-default.png", new Resvg(await satori(def, { width: 1200, height: 630, fonts }), { fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log(`generated ${i} OG cards + default in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
