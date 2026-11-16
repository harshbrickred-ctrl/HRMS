/**
 * Convert a docs/*.md file into a standalone shareable HTML page
 * (same visual language as peopleos-management-overview.html).
 *
 * Usage: node scripts/md-to-shareable-html.mjs docs/36-product-guide-sales-leadership.md peopleos-product-guide-sales-leadership.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const inRel = process.argv[2] || "docs/36-product-guide-sales-leadership.md";
const outRel =
  process.argv[3] || "peopleos-product-guide-sales-leadership.html";

const mdPath = path.resolve(ROOT, inRel);
const outPath = path.resolve(ROOT, outRel);
const md = fs.readFileSync(mdPath, "utf8").replace(/\r\n/g, "\n");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveHref(href) {
  if (/^https?:\/\//i.test(href) || href.startsWith("#") || href.startsWith("mailto:")) {
    return href;
  }
  let h = href;
  if (h.endsWith(".md")) {
    if (h.startsWith("../")) h = h.slice(3);
    else if (h.startsWith("./")) h = h.slice(2);
    if (!h.startsWith("docs/") && !h.includes("/")) h = `docs/${h}`;
    else if (!h.startsWith("docs/") && h.match(/^\d{2}-/)) h = `docs/${h}`;
  }
  return h;
}

function inline(s) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    return `<a href="${escapeHtml(resolveHref(href))}">${text}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const lines = md.split("\n");
let i = 0;
let title = "PeopleOS — Product Guide";
const meta = [];
const toc = [];
const body = [];

if (lines[0]?.startsWith("# ")) {
  title = lines[0].slice(2).trim();
  i = 1;
}

while (i < lines.length && lines[i].trim() !== "---") {
  const m = lines[i].match(/^\*\*([^*]+):\*\*\s*(.+)$/);
  if (m) meta.push({ k: m[1], v: m[2] });
  i++;
}
if (lines[i]?.trim() === "---") i++;

function parseTable(start) {
  const rows = [];
  let j = start;
  while (j < lines.length && lines[j].trim().startsWith("|")) {
    const raw = lines[j].trim();
    if (!/^\|?\s*:?-{3,}/.test(raw.replace(/\|/g, "|")) && !/^\|?\s*[-:| ]+\s*$/.test(raw)) {
      const cells = raw
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      rows.push(cells);
    } else if (/^[\s|:-]+$/.test(raw)) {
      // separator row — skip
    } else {
      const cells = raw
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
    }
    j++;
  }
  return { rows, next: j };
}

while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) {
    i++;
    continue;
  }
  if (line.trim() === "---") {
    body.push('<hr class="rule" />');
    i++;
    continue;
  }

  const h2 = line.match(/^##\s+(.+)/);
  if (!h2) {
    i++;
    continue;
  }

  const text = h2[1].trim();
  const id = slugify(text);
  const numMatch = text.match(/^(\d+)\.\s+(.*)/);
  toc.push({
    id,
    num: numMatch?.[1] || "",
    label: numMatch?.[2] || text,
  });
  body.push(`<section id="${id}">`);
  body.push('<div class="content-inner">');
  if (numMatch) {
    body.push(
      `<div class="section-head"><span class="section-num">${numMatch[1]}</span><h2>${escapeHtml(numMatch[2])}</h2></div>`,
    );
  } else {
    body.push(
      `<div class="section-head"><h2>${escapeHtml(text)}</h2></div>`,
    );
  }
  i++;

  while (i < lines.length && !lines[i].match(/^##\s+/)) {
    const L = lines[i];
    if (!L.trim()) {
      i++;
      continue;
    }
    if (L.trim() === "---") {
      body.push('<hr class="rule" />');
      i++;
      continue;
    }
    const h3 = L.match(/^###\s+(.+)/);
    if (h3) {
      const t3 = h3[1].trim();
      body.push(`<h3 id="${slugify(t3)}">${escapeHtml(t3)}</h3>`);
      i++;
      continue;
    }
    if (L.trim().startsWith("|")) {
      const { rows, next } = parseTable(i);
      if (rows.length) {
        body.push('<div class="table-wrap"><table>');
        body.push(
          `<thead><tr>${rows[0].map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`,
        );
        body.push("<tbody>");
        for (const r of rows.slice(1)) {
          body.push(
            `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
          );
        }
        body.push("</tbody></table></div>");
      }
      i = next;
      continue;
    }
    if (/^[-*]\s+/.test(L.trim())) {
      body.push("<ul>");
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        body.push(
          `<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`,
        );
        i++;
      }
      body.push("</ul>");
      continue;
    }
    if (/^\d+\.\s+/.test(L.trim())) {
      body.push("<ol>");
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        body.push(
          `<li>${inline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`,
        );
        i++;
      }
      body.push("</ol>");
      continue;
    }
    if (
      L.trim().startsWith("*") &&
      L.trim().endsWith("*") &&
      !L.trim().startsWith("**")
    ) {
      body.push(
        `<p class="footnote">${inline(L.trim().replace(/^\*|\*$/g, ""))}</p>`,
      );
      i++;
      continue;
    }
    const paras = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^#{1,3}\s/) &&
      lines[i].trim() !== "---" &&
      !lines[i].trim().startsWith("|") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paras.push(lines[i]);
      i++;
    }
    if (paras.length) body.push(`<p>${inline(paras.join(" "))}</p>`);
  }
  body.push("</div></section>");
}

const tocHtml = toc
  .map(
    (t) =>
      `<li><a href="#${t.id}">${t.num ? `<span class="num">${t.num}</span>` : ""}${escapeHtml(t.label)}</a></li>`,
  )
  .join("\n");

const metaHtml = meta
  .map(
    (m) =>
      `<div class="meta-item"><div class="k">${escapeHtml(m.k)}</div><div class="v">${inline(m.v)}</div></div>`,
  )
  .join("\n");

const displayTitle = title.replace(/^PeopleOS — /, "");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#16212E;
    --muted:#5C6B7A;
    --paper:#FFFFFF;
    --panel:#F4F6F8;
    --line:#DCE2E8;
    --accent:#0E6E5B;
    --accent-tint:#E4F2EE;
    --serif:"Fraunces", Georgia, serif;
    --sans:"Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    --mono:"Roboto Mono", monospace;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    margin:0;
    font-family:var(--sans);
    color:var(--ink);
    background:var(--paper);
    line-height:1.6;
    font-size:15.5px;
  }
  a{color:var(--accent); text-decoration:none;}
  a:hover{text-decoration:underline;}
  code{
    font-family:var(--mono);
    font-size:0.86em;
    background:var(--panel);
    padding:0.1em 0.35em;
    border-radius:3px;
  }
  .shell{
    display:grid;
    grid-template-columns:250px 1fr;
    max-width:1240px;
    margin:0 auto;
  }
  @media (max-width:900px){
    .shell{grid-template-columns:1fr;}
    nav.toc{display:none;}
  }
  nav.toc{
    position:sticky;
    top:0;
    align-self:start;
    height:100vh;
    overflow-y:auto;
    padding:36px 20px 36px 28px;
    border-right:1px solid var(--line);
  }
  nav.toc .brand{
    font-family:var(--serif);
    font-weight:600;
    font-size:1.05rem;
    margin-bottom:2px;
  }
  nav.toc .brand-sub{
    font-size:0.72rem;
    color:var(--muted);
    margin-bottom:28px;
    display:block;
  }
  nav.toc ol{
    list-style:none;
    margin:0;
    padding:0;
    border-left:1px solid var(--line);
  }
  nav.toc li{margin:0;}
  nav.toc a{
    display:block;
    color:var(--muted);
    font-size:0.83rem;
    padding:7px 0 7px 16px;
    border-left:2px solid transparent;
    margin-left:-1px;
  }
  nav.toc a:hover{color:var(--ink); text-decoration:none;}
  nav.toc a.active{
    color:var(--accent);
    border-left-color:var(--accent);
    font-weight:600;
  }
  nav.toc .num{
    font-family:var(--mono);
    font-size:0.72rem;
    color:var(--muted);
    margin-right:7px;
  }
  main{padding:0 0 40px 0;}
  .content-inner{
    max-width:760px;
    margin:0 auto;
    padding:0 48px;
  }
  @media (max-width:600px){
    .content-inner{padding:0 20px;}
  }
  header.masthead{
    padding:64px 48px 44px;
    border-bottom:1px solid var(--line);
    background:radial-gradient(120% 140% at 100% 0%, var(--accent-tint) 0%, transparent 55%);
  }
  header.masthead .content-inner{padding:0;}
  .eyebrow{
    font-size:0.78rem;
    color:var(--muted);
    margin-bottom:18px;
  }
  .eyebrow strong{color:var(--ink);}
  h1.title{
    font-family:var(--serif);
    font-weight:600;
    font-size:2.45rem;
    line-height:1.1;
    margin:0 0 14px;
    letter-spacing:-0.01em;
  }
  .subtitle{
    font-size:1.02rem;
    color:var(--muted);
    max-width:560px;
    margin:0 0 30px;
  }
  .meta-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:18px 28px;
    padding-top:26px;
    border-top:1px solid var(--line);
  }
  .meta-item .k{
    font-size:0.7rem;
    color:var(--muted);
    margin-bottom:4px;
    text-transform:uppercase;
    letter-spacing:0.04em;
  }
  .meta-item .v{font-size:0.9rem; font-weight:500;}
  section{
    padding:56px 0;
    border-bottom:1px solid var(--line);
  }
  section:last-of-type{border-bottom:none;}
  .section-head{
    display:flex;
    align-items:baseline;
    gap:14px;
    margin-bottom:26px;
  }
  .section-num{
    font-family:var(--mono);
    font-size:0.85rem;
    color:var(--accent);
  }
  h2{
    font-family:var(--serif);
    font-weight:600;
    font-size:1.7rem;
    margin:0;
  }
  h3{
    font-family:var(--serif);
    font-weight:600;
    font-size:1.15rem;
    margin:32px 0 12px;
  }
  p{margin:0 0 14px;}
  ul, ol{margin:0 0 18px; padding-left:1.25rem;}
  li{margin:0 0 8px;}
  .table-wrap{
    overflow-x:auto;
    margin:0 0 22px;
    border:1px solid var(--line);
    border-radius:4px;
  }
  table{width:100%; border-collapse:collapse; font-size:0.92rem;}
  th, td{
    text-align:left;
    padding:10px 12px;
    border-bottom:1px solid var(--line);
    vertical-align:top;
  }
  th{
    background:var(--panel);
    font-size:0.75rem;
    text-transform:uppercase;
    letter-spacing:0.04em;
    color:var(--muted);
    font-weight:600;
  }
  tr:last-child td{border-bottom:none;}
  tr:nth-child(even) td{background:#fafbfc;}
  hr.rule{
    border:none;
    border-top:1px solid var(--line);
    margin:28px 0;
  }
  .footnote{
    font-size:0.9rem;
    color:var(--muted);
    font-style:italic;
    margin-top:28px;
  }
  footer.doc-foot{
    max-width:760px;
    margin:0 auto;
    padding:24px 48px 60px;
    font-size:0.82rem;
    color:var(--muted);
  }
  @media (max-width:600px){
    footer.doc-foot{padding:24px 20px 48px;}
    header.masthead{padding:40px 20px 32px;}
  }
</style>
</head>
<body>
<div class="shell">
  <nav class="toc" aria-label="Table of contents">
    <div class="brand">PeopleOS</div>
    <span class="brand-sub">Sales &amp; Leadership guide</span>
    <ol>
      ${tocHtml}
    </ol>
  </nav>
  <main>
    <header class="masthead">
      <div class="content-inner">
        <div class="eyebrow"><strong>PeopleOS</strong> · Product guide · Non-technical</div>
        <h1 class="title">${escapeHtml(displayTitle)}</h1>
        <p class="subtitle">Features and role workflows for sales and leadership — what the product does today, in plain language.</p>
        <div class="meta-grid">
          ${metaHtml}
        </div>
      </div>
    </header>
    ${body.join("\n")}
    <footer class="doc-foot">
      Source: <a href="docs/36-product-guide-sales-leadership.md">docs/36-product-guide-sales-leadership.md</a>
      · Companion: <a href="peopleos-management-overview.html">Management overview</a>
    </footer>
  </main>
</div>
<script>
  const links = [...document.querySelectorAll("nav.toc a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  function sync() {
    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= 120) current = s;
    }
    if (!current) return;
    links.forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === "#" + current.id),
    );
  }
  window.addEventListener("scroll", sync, { passive: true });
  sync();
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${path.relative(ROOT, outPath)} (${html.length} bytes, ${toc.length} sections)`);
