# ADR-002 - Database: PostgreSQL

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Backend Engineer  
**Related:** [12-database-design](../12-database-design.md), ADR-006, ADR-010

---

## Context

HRMS data is relational (org trees, leave balances, approvals, audit). The project needs a mature open-source engine for Stage A and a first-class managed offering on Azure for Stage B.

## Options

1. **PostgreSQL** - Compose locally; Azure Database for PostgreSQL later.  
2. **MySQL / MariaDB** - Common alternative.  
3. **SQL Server** - Strong on Azure but heavier licensing considerations.  
4. **Cosmos DB / document DB** - Flexible JSON; weak fit for relational invariants.  
5. **SQLite** - Local only; not multi-user production.

## Decision

Use **PostgreSQL** as the system of record for all transactional HR data.

## Rationale

- Excellent relational integrity, JSONB when needed, extensions, OSS Stage A (**Fact**).  
- Azure Database for PostgreSQL Flexible Server is the Stage B target (**Fact** locked).  
- Skills common among NestJS teams (**Assumption**).  
- Avoids dual-engine complexity.

## Consequences

**Positive:** One engine Stage A?B; rich constraint model for tenancy uniques.  
**Negative:** Team must manage migrations carefully; must verify extensions on Azure.  
**Follow-ups:** Choose ORM (TypeORM vs Prisma) in Sprint 0; enable SSL in Stage B; backup/PITR drills.
