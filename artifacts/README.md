# PeopleOS Documentation Artifacts

**Purpose:** Quick-share topic cards for meetings, email, and onboarding.  
**Source of truth:** [`../docs/`](../docs/) — always prefer the full markdown for depth and decisions.

| Layer | Use when |
|-------|----------|
| `artifacts/<doc>/brief.html` | Browser / email share (self-contained) |
| `artifacts/<doc>/brief.md` | Git / Teams / PR review |
| `docs/<doc>.md` | Authoritative detail, tables, ADRs, requirements |

## How to regenerate

From repo root:

```bash
node scripts/generate-doc-artifacts.mjs
```

This walks every `docs/**/*.md`, writes/updates mirrored folders under `artifacts/`, and refreshes `00-INDEX.md` / `00-INDEX.html`.

### Manual briefs

Hand-tuned packs (CEO-facing) set `manual: true` in `brief.md` frontmatter. The generator **skips overwriting** those `brief.md` / `brief.html` files so curated text is preserved. Remove `manual: true` (or delete the brief) to allow regeneration.

## Index

Start at [00-INDEX.md](00-INDEX.md) or open [00-INDEX.html](00-INDEX.html) in a browser.
