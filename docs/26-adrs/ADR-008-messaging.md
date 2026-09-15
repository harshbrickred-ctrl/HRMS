# ADR-008 - Messaging: In-Process ? Service Bus Later

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect  
**Related:** [10-system-architecture](../10-system-architecture.md), [19-azure-target-architecture](../19-azure-target-architecture.md), ADR-001

---

## Context

Leave approvals, emails, and reports need asynchronous work. Introducing Kafka/Rabbit/Service Bus on day one adds ops cost before product validation.

## Options

1. **In-process domain events + DB outbox / optional Redis queues**; **Azure Service Bus later**.  
2. **RabbitMQ or Kafka in Compose from Sprint 1.**  
3. **Azure Service Bus from first Azure deploy.**  
4. **Only synchronous request path** (no async).

## Decision

**MVP/Stage A:** In-process Nest events and a **durable outbox** (PostgreSQL) for email/notifications; Redis/BullMQ **optional**.  
**Later:** Azure **Service Bus** when cross-system durability or fan-out justifies it (e.g., payroll sync at volume).

## Rationale

- Modular monolith does not need a broker for intra-app events (**Fact** style).  
- Outbox survives process crash better than pure in-memory.  
- Service Bus is the locked -later- Azure choice (**Fact**).  
- Avoids premature paid messaging.

## Consequences

**Positive:** Simpler Stage A; clear upgrade path behind interfaces.  
**Negative:** Must avoid long-running work on HTTP threads; dual-publish complexity when SB arrives.  
**Follow-ups:** `IMessageBus` abstraction; idempotent consumers; minimize PII in payloads.
