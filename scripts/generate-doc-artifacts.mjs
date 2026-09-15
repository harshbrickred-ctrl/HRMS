#!/usr/bin/env node
/**
 * Generate synchronized shareable briefs for every markdown file under docs/.
 * Source of truth remains docs/. Artifacts are derived views.
 *
 * Usage: node scripts/generate-doc-artifacts.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const ARTIFACTS = path.join(ROOT, "artifacts");

const AUDIENCE_HINTS = [
  [/executive|ceo|part.?48|recommendation/i, "CEO / Leadership"],
  [/market|competitor/i, "CEO / Product"],
  [/vision|business.?req|persona|prd|srs|user.?stor|process|ux/i, "Product / HR / BA"],
  [/architect|domain|database|api|security|tenant|azure|zero-cost|migration|adr/i, "Engineering / Architecture"],
  [/test|devops|deploy|sprint|project.?plan|risk|change|govern|kpi|saas|capacity|fr-catalog/i, "Delivery / Ops / QA"],
  [/readme|index/i, "All stakeholders"],
];

function walkMarkdown(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMarkdown(full, acc);
    else if (ent.isFile() && ent.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function relPosix(from, to) {
  return path.relative(from, to).split(path.sep).join("/");
}

function artifactDirFor(docAbs) {
  const rel = path.relative(DOCS, docAbs);
  const noExt = rel.replace(/\.md$/i, "");
  return path.join(ARTIFACTS, noExt);
}

function inferAudience(title, rel) {
  const hay = `${title} ${rel}`;
  for (const [re, label] of AUDIENCE_HINTS) {
    if (re.test(hay)) return label;
  }
  return "General";
}

function stripMdNoise(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStructure(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const paras = [];
  const bullets = [];
  const decisions = [];
  let inTable = false;
  let tableHeader = [];
  let sawDecisionTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !title) {
      title = stripMdNoise(h1[1]);
      continue;
    }

    if (/^\|/.test(line)) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => stripMdNoise(c));
      if (/^\|?\s*:?-+:?\s*\|/.test(line) || cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable && tableHeader.length === 0) {
        tableHeader = cells;
        const headerJoined = cells.join(" ").toLowerCase();
        sawDecisionTable =
          /decision|choice|verdict|locked|priority|module/.test(headerJoined) ||
          cells.length >= 2;
        continue;
      }
      if (sawDecisionTable && cells.length >= 2) {
        const left = cells[0];
        const right = cells.slice(1).join(" — ");
        if (left && right && decisions.length < 10) {
          decisions.push(`${left}: ${right}`);
        }
      }
      continue;
    } else {
      inTable = false;
      tableHeader = [];
      sawDecisionTable = false;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet && bullets.length < 12) {
      const t = stripMdNoise(bullet[1]);
      if (t.length > 12) bullets.push(t);
      continue;
    }

    if (/^#{2,}\s+/.test(line)) continue;
    if (/^---+$/.test(line)) continue;
    if (!line.trim()) continue;
    if (/^\*\*[^*]+\*\*:?\s*$/.test(line.trim())) continue;

    const plain = stripMdNoise(line);
    if (plain.length > 40 && paras.length < 4) {
      // skip metadata-looking short lines
      if (!/^(Document|Audience|Status|Product|Related|Classification)\b/i.test(plain)) {
        paras.push(plain);
      }
    }
  }

  return { title: title || "Untitled", paras, bullets, decisions };
}

function buildThesis({ title, paras, decisions, bullets }) {
  if (paras[0]) {
    const p = paras[0];
    return p.length > 280 ? p.slice(0, 277) + "…" : p;
  }
  if (decisions[0]) return `Primary framing for ${title}: ${decisions[0]}`;
  if (bullets[0]) return bullets[0];
  return `${title} — see the full document for the authoritative argument.`;
}

function pickTakeaways({ decisions, bullets, paras }) {
  const out = [];
  for (const d of decisions) {
    if (out.length >= 8) break;
    out.push(d);
  }
  for (const b of bullets) {
    if (out.length >= 8) break;
    if (!out.includes(b)) out.push(b);
  }
  if (out.length < 3) {
    for (const p of paras.slice(1)) {
      if (out.length >= 6) break;
      out.push(p.length > 160 ? p.slice(0, 157) + "…" : p);
    }
  }
  return out.slice(0, 8);
}

function relatedLinks(relNoExt, allRels) {
  const cluster = {
    "01-executive-proposal": ["02-market-analysis", "23-risk-register", "appendices/part-48-final-recommendation"],
    "02-market-analysis": ["01-executive-proposal", "05-product-requirements-mvp", "appendices/competitor-matrix"],
    "05-product-requirements-mvp": ["03-product-vision", "06-srs-functional", "24-project-plan-12-weeks"],
    "10-system-architecture": ["18-zero-cost-architecture", "19-azure-target-architecture", "26-adrs/ADR-001-architecture"],
    "appendices/part-48-final-recommendation": ["01-executive-proposal", "10-system-architecture", "05-product-requirements-mvp"],
  };
  const keys = cluster[relNoExt] || [];
  return keys.filter((k) => allRels.has(k));
}

function hasManualFlag(briefPath) {
  if (!fs.existsSync(briefPath)) return false;
  const head = fs.readFileSync(briefPath, "utf8").slice(0, 400);
  return /^---\r?\n[\s\S]*?manual:\s*true[\s\S]*?\r?\n---/m.test(head);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdownBrief({
  title,
  audience,
  thesis,
  takeaways,
  sourceRel,
  related,
  generated,
  manual,
}) {
  const relatedBlock =
    related.length === 0
      ? "_None listed._"
      : related.map((r) => `- [${r}](../${r}/brief.md)`).join("\n");

  const fm = manual
    ? `---\nmanual: true\ngenerated: ${generated}\n---\n\n`
    : `---\nmanual: false\ngenerated: ${generated}\n---\n\n`;

  return `${fm}# ${title}

**Audience:** ${audience}  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

${thesis}

## Key takeaways

${takeaways.map((t) => `- ${t}`).join("\n")}

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [\`${sourceRel}\`](${sourceRel})

## Related artifacts

${relatedBlock}
`;
}

function htmlShell({ title, audience, thesis, takeaways, sourceHref, relatedHtml, generated }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — PeopleOS Brief</title>
  <style>
    :root {
      --bg: #f7f5f1;
      --ink: #1c1917;
      --muted: #57534e;
      --line: #d6d3d1;
      --card: #ffffff;
      --accent: #0f766e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.5;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1.25rem 3rem;
    }
    header {
      border-bottom: 1px solid var(--line);
      padding-bottom: 1rem;
      margin-bottom: 1.25rem;
    }
    .eyebrow {
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
      font-weight: 600;
      margin: 0 0 0.35rem;
    }
    h1 {
      font-size: 1.55rem;
      line-height: 1.25;
      margin: 0 0 0.5rem;
      font-weight: 650;
    }
    .meta { color: var(--muted); font-size: 0.95rem; margin: 0; }
    section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 1rem 1.1rem;
      margin: 0.85rem 0;
    }
    h2 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 0 0 0.55rem;
      font-weight: 650;
    }
    p { margin: 0; }
    ul { margin: 0; padding-left: 1.15rem; }
    li { margin: 0.35rem 0; }
    a { color: var(--accent); }
    footer {
      margin-top: 1.5rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">PeopleOS · Artifact brief</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Audience: ${escapeHtml(audience)} · Skim 1–2 minutes · Generated ${escapeHtml(generated)}</p>
    </header>
    <section>
      <h2>Thesis</h2>
      <p>${escapeHtml(thesis)}</p>
    </section>
    <section>
      <h2>Key takeaways</h2>
      <ul>
        ${takeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join("\n        ")}
      </ul>
    </section>
    <section>
      <h2>Evidence & non-claims</h2>
      <p>Respect Fact / Assumption / Estimate / Metric-to-measure labels in the source. This brief is not audited ROI or a substitute for the full document.</p>
    </section>
    <section>
      <h2>Deep dive</h2>
      <p><a href="${escapeHtml(sourceHref)}">${escapeHtml(sourceHref)}</a></p>
    </section>
    ${
      relatedHtml
        ? `<section><h2>Related artifacts</h2>${relatedHtml}</section>`
        : ""
    }
    <footer>Source of truth lives under <code>docs/</code>. Regenerate with <code>node scripts/generate-doc-artifacts.mjs</code>.</footer>
  </div>
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(DOCS)) {
    console.error("docs/ not found");
    process.exit(1);
  }
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const files = walkMarkdown(DOCS).sort((a, b) => a.localeCompare(b));
  const allRels = new Set(
    files.map((f) => path.relative(DOCS, f).replace(/\.md$/i, "").split(path.sep).join("/"))
  );
  const generated = new Date().toISOString().slice(0, 10);
  const indexRows = [];
  let written = 0;
  let skipped = 0;

  for (const abs of files) {
    const rel = path.relative(DOCS, abs).split(path.sep).join("/");
    const relNoExt = rel.replace(/\.md$/i, "");
    const outDir = artifactDirFor(abs);
    fs.mkdirSync(outDir, { recursive: true });

    const briefMdPath = path.join(outDir, "brief.md");
    const briefHtmlPath = path.join(outDir, "brief.html");
    const manual = hasManualFlag(briefMdPath);

    const md = fs.readFileSync(abs, "utf8");
    const struct = extractStructure(md);
    const audience = inferAudience(struct.title, rel);
    const thesis = buildThesis(struct);
    const takeaways = pickTakeaways(struct);
    const sourceRelFromBrief = relPosix(outDir, abs);
    const related = relatedLinks(relNoExt, allRels).map((r) => {
      const depth = relNoExt.split("/").length - 1;
      const prefix = depth > 0 ? "../".repeat(depth) : "";
      return { id: r, md: `${prefix}${r}/brief.md`, html: `${prefix}${r}/brief.html` };
    });

    indexRows.push({
      id: relNoExt,
      title: struct.title,
      audience,
      folder: relNoExt,
    });

    if (manual) {
      skipped++;
      console.log(`skip manual: ${relNoExt}`);
      continue;
    }

    const relatedForMd = related.map((r) => r.id);
    const mdOut = renderMarkdownBrief({
      title: struct.title,
      audience,
      thesis,
      takeaways: takeaways.length ? takeaways : ["See deep-dive document for full argument."],
      sourceRel: sourceRelFromBrief,
      related: relatedForMd,
      generated,
      manual: false,
    });

    // Fix related links in md to be correct relative from this folder
    let mdFixed = mdOut;
    if (related.length) {
      const block = related.map((r) => `- [${r.id}](${r.md})`).join("\n");
      mdFixed = mdFixed.replace(
        /## Related artifacts\n\n[\s\S]*$/m,
        `## Related artifacts\n\n${block}\n`
      );
    }

    const relatedHtml =
      related.length === 0
        ? ""
        : `<ul>${related.map((r) => `<li><a href="${escapeHtml(r.html)}">${escapeHtml(r.id)}</a></li>`).join("")}</ul>`;

    const htmlOut = htmlShell({
      title: struct.title,
      audience,
      thesis,
      takeaways: takeaways.length ? takeaways : ["See deep-dive document for full argument."],
      sourceHref: sourceRelFromBrief,
      relatedHtml,
      generated,
    });

    fs.writeFileSync(briefMdPath, mdFixed, "utf8");
    fs.writeFileSync(briefHtmlPath, htmlOut, "utf8");
    written++;
    console.log(`wrote: ${relNoExt}`);
  }

  // Index
  const indexMd = `# PeopleOS Artifact Index

Quick briefs for every blueprint document. Open a folder’s \`brief.html\` to share, or \`brief.md\` in Git.

**Source of truth:** [\`docs/\`](../docs/00-README.md)  
**Regenerate:** \`node scripts/generate-doc-artifacts.mjs\`  
**Generated:** ${generated}

| Artifact | Audience | Brief |
|----------|----------|-------|
${indexRows
  .map(
    (r) =>
      `| ${r.title} | ${r.audience} | [md](${r.folder}/brief.md) · [html](${r.folder}/brief.html) |`
  )
  .join("\n")}
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PeopleOS Artifact Index</title>
  <style>
    :root { --bg:#f7f5f1; --ink:#1c1917; --muted:#57534e; --line:#d6d3d1; --accent:#0f766e; --card:#fff; }
    body { margin:0; font-family:"Segoe UI",Arial,sans-serif; background:var(--bg); color:var(--ink); }
    .wrap { max-width:960px; margin:0 auto; padding:2rem 1.25rem 3rem; }
    h1 { margin:0 0 .5rem; font-size:1.75rem; }
    p { color:var(--muted); }
    table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); }
    th, td { text-align:left; padding:.65rem .75rem; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
    a { color:var(--accent); }
    .links { white-space:nowrap; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>PeopleOS Artifact Index</h1>
    <p>Shareable briefs · deep dive in <code>docs/</code> · generated ${escapeHtml(generated)}</p>
    <table>
      <thead><tr><th>Topic</th><th>Audience</th><th>Open</th></tr></thead>
      <tbody>
        ${indexRows
          .map(
            (r) => `<tr>
          <td>${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.audience)}</td>
          <td class="links"><a href="${escapeHtml(r.folder)}/brief.html">HTML</a> · <a href="${escapeHtml(r.folder)}/brief.md">MD</a></td>
        </tr>`
          )
          .join("\n")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(ARTIFACTS, "00-INDEX.md"), indexMd, "utf8");
  fs.writeFileSync(path.join(ARTIFACTS, "00-INDEX.html"), indexHtml, "utf8");

  console.log(`\nDone. written=${written} skipped_manual=${skipped} total=${files.length}`);
}

main();
