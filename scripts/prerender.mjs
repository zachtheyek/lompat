// Prerender per-candidate pages with OG tags for the top switchers; rely on a
// 404.html SPA shell for the long tail (those still work, just with the default OG).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SITE = (process.env.SITE_URL || "https://zachtheyek.github.io/lompat").replace(/\/$/, "");
const template = readFileSync("dist/index.html", "utf8");
const base = template
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .replace(/[ \t]*<meta[^>]+(property="og:|name="twitter:|name="description")[^>]*>\n?/g, "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function page(c) {
  const desc = c.n_switches > 0
    ? `${c.name} has switched parties ${c.n_switches} time${c.n_switches > 1 ? "s" : ""} across ${c.n_parties} parties: ${(c.path || c.parties).join(" → ")}. ${c.first_year}–${c.last_year}.`
    : `${c.name} contested ${c.n_contests} elections (${c.first_year}–${c.last_year}) and never switched party (${c.parties[0]}).`;
  const title = `${c.name} — party trajectory · Lompat`;
  const meta = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${SITE}/p/${c.slug}/" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Lompat" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${SITE}/p/${c.slug}/" />
    <meta property="og:image" content="${SITE}/og/${c.slug}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}/og/${c.slug}.png" />
    <script>window.__CAND__=${JSON.stringify(c)}</script>`;
  return base.replace("</head>", meta + "\n  </head>");
}

const lb = JSON.parse(readFileSync("public/data/leaderboard.json", "utf8"));
let n = 0;
for (const rec of lb.top.slice(0, 300)) {
  const c = JSON.parse(readFileSync(join("public/data/cand", rec.slug + ".json"), "utf8"));
  const dir = join("dist", "p", c.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page(c));
  n++;
}
// SPA fallback so any /p/<slug>/ that wasn't prerendered still boots the app
writeFileSync("dist/404.html", template);
console.log(`prerendered ${n} candidate pages + 404 SPA fallback (SITE=${SITE})`);
