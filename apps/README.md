# PeopleOS apps

## Prerequisites

- Node.js 20+ (Node 22+ recommended for Expo SDK 57)
- Docker Desktop running

## Quick start

```bash
# from repo root
docker compose up -d
cd apps/api
npx prisma migrate dev
npm run prisma:seed
npm run start:dev

# other terminal — web
npm run dev:web

# optional — native mobile (Expo)
npm run dev:mobile
npm run dev:mobile:web
```

Open http://localhost:5173/login — after login you land on **ESS** (`/ess`).  
The sidebar shows **Me** for everyone, plus Team / HR / Admin / Leadership when roles allow.

**Postgres:** `localhost:5440`  
**Mailpit (OTP emails):** UI http://localhost:8025 · SMTP `localhost:1025`

**Forgot password:** http://localhost:5173/forgot-password (OTP arrives in Mailpit)

**Seed users (local only, password `ChangeMe123!`):**

| Email | Roles |
|-------|--------|
| `admin@peopleos.local` | `SECURITY_ADMIN` |
| `employee@peopleos.local` | `EMPLOYEE` |
| `manager@peopleos.local` | `MANAGER`, `EMPLOYEE` |
| `hr@peopleos.local` | `HR_EXEC`, `EMPLOYEE` |

Admin role UI: http://localhost:5173/admin/roles (requires `rbac.assign`)

## Workspace layout

| App | Path | Stack |
|-----|------|--------|
| API | `apps/api` | NestJS + Prisma |
| Web | `apps/web` | Vite + React |
| Mobile | `apps/mobile` | Expo (React Native) — ESS-first, Design44 |
