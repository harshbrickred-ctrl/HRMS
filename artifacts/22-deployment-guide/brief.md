---
manual: false
generated: 2026-09-13
---

# 22 — Deployment Guide

**Audience:** Delivery / Ops / QA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Stage A: Local Docker Compose + internal pilot host

## Key takeaways

- api: NestJS — Stateless
- web: React build via nginx (or Vite preview only for local) — Stateless
- db: PostgreSQL — Volume
- object (optional): MinIO or filesystem volume — Volume
- proxy (optional): Caddy/nginx TLS terminator — Stateless
- Docker Desktop or Docker Engine + Compose: Runtime — Docker Desktop licensing depends on org size — verify; Engine+Compose on Linux VM often safer for company host
- Node.js LTS (local undockered dev): Optional — OSS
- Git: Source — OSS

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/22-deployment-guide.md`](../../docs/22-deployment-guide.md)

## Related artifacts

_None listed._
