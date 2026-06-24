// OG cards for the top switchers → dist/og/<slug>.png, plus a default landing card.
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
function card(rec) {
  const parties = rec.parties.slice(0, 7);
  const extra = rec.parties.length - parties.length;
  const path = parties.map((p, i) => (i ? chev : "") + pill(p)).join("") +
    (extra > 0 ? `<div style="display:flex;align-items:center;color:#8b95a7;font-size:24px;margin-bottom:10px">+${extra} more</div>` : "");
  return html(`
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:60px 68px;background:#0e1117;font-family:'Space Grotesk'">
    <div style="display:flex;align-items:center">
      <div style="display:flex;width:30px;height:30px;border-radius:50%;background:#34d27b;margin-right:16px"></div>
      <div style="font-size:28px;font-weight:700;letter-spacing:5px;color:#34d27b">LOMPAT</div>
    </div>
    <div style="display:flex;font-size:64px;font-weight:700;color:#eef2f8;line-height:1.05;margin-top:30px;max-width:1064px">${rec.name}</div>
    <div style="display:flex;align-items:baseline;margin-top:26px">
      <div style="display:flex;font-size:120px;font-weight:700;color:#ff5470;line-height:1">${rec.n_switches}</div>
      <div style="display:flex;flex-direction:column;margin-left:24px">
        <div style="display:flex;font-size:34px;color:#eef2f8;font-weight:700">party hops</div>
        <div style="display:flex;font-size:26px;color:#8b95a7">across ${rec.n_parties} parties · ${rec.first_year}–${rec.last_year}</div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;margin-top:34px;max-width:1064px">${path}</div>
    <div style="display:flex;margin-top:auto;font-size:22px;color:#5d6678">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
}

const lb = JSON.parse(readFileSync("public/data/leaderboard.json", "utf8"));
const top = lb.top.slice(0, 300);
let i = 0, t0 = Date.now();
for (const rec of top) {
  const svg = await satori(card(rec), { width: 1200, height: 630, fonts });
  writeFileSync(join("dist/og", rec.slug + ".png"), new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
  if (++i % 100 === 0) process.stdout.write(`  ${i}/${top.length}\n`);
}
// default landing card
const def = html(`
  <div style="display:flex;flex-direction:column;justify-content:center;width:1200px;height:630px;padding:72px;background:#0e1117;font-family:'Space Grotesk'">
    <div style="display:flex;align-items:center;margin-bottom:26px">
      <div style="display:flex;width:36px;height:36px;border-radius:50%;background:#34d27b;margin-right:18px"></div>
      <div style="font-size:32px;font-weight:700;letter-spacing:7px;color:#34d27b">LOMPAT</div>
    </div>
    <div style="display:flex;flex-direction:column;font-size:92px;font-weight:700;color:#eef2f8;line-height:1.02;letter-spacing:-2px">
      <div style="display:flex">Malaysia's political</div>
      <div style="display:flex;color:#ff5470">frogs, on the record.</div>
    </div>
    <div style="display:flex;margin-top:34px;font-size:30px;color:#8b95a7">${lb.total_switches.toLocaleString()} party-hops · ${lb.n_switchers.toLocaleString()} katak · every election since 1955</div>
    <div style="display:flex;margin-top:18px;font-size:22px;color:#5d6678">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
writeFileSync("dist/og-default.png", new Resvg(await satori(def, { width: 1200, height: 630, fonts }), { fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log(`generated ${i} OG cards + default in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
