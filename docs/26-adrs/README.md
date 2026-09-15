# Architecture Decision Records (ADR-001 … ADR-012)

| ADR | Topic | Decision |
|-----|-------|----------|
| [ADR-001](ADR-001-architecture.md) | Architecture | Modular monolith |
| [ADR-002](ADR-002-database.md) | Database | PostgreSQL + Prisma |
| [ADR-003](ADR-003-authentication.md) | Authentication | Local JWT; OIDC later |
| [ADR-004](ADR-004-authorization.md) | Authorization | RBAC + resource policies |
| [ADR-005](ADR-005-storage.md) | Storage | Local/MinIO → Blob via interface |
| [ADR-006](ADR-006-multi-tenancy.md) | Multi-tenancy | Shared schema + `tenant_id` |
| [ADR-007](ADR-007-api-strategy.md) | API | Versioned REST + OpenAPI |
| [ADR-008](ADR-008-messaging.md) | Messaging | In-process + outbox → Service Bus |
| [ADR-009](ADR-009-initial-zero-cost-architecture.md) | Stage A | Docker Compose OSS + free-tier CI |
| [ADR-010](ADR-010-azure-target-architecture.md) | Stage B | Container Apps + Azure PG + Blob |
| [ADR-011](ADR-011-observability.md) | Observability | Structured logs + OTel → App Insights |
| [ADR-012](ADR-012-deployment-strategy.md) | Deployment | Trunk-based; image rollback |

Parent: [10-system-architecture.md](../10-system-architecture.md)
