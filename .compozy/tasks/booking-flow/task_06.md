---
status: completed
title: "Extend ConfirmPayment service for idempotency and booking reference"
type: backend
complexity: medium
dependencies:
  - task_01
  - task_03
---

# Task 06: Extend ConfirmPayment service for idempotency and booking reference

## Overview
Extend the existing `ConfirmPayment` service so it can be safely invoked by both the Stripe webhook and the polling fallback. Add idempotency keyed on `paymentIntentId`, persist the guest contact details captured at the payment step, and assign a `LR-YYMM-XXXXX` booking reference at the moment of CONFIRMED transition.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- Extend the existing service in place — DO NOT create a parallel handler. Modify [backend/src/reservation/core/service/confirm-payment.ts](../../../backend/src/reservation/core/service/confirm-payment.ts).
- The handler MUST be idempotent on `paymentIntentId`: if the reservation tied to that intent is already CONFIRMED, return `Ok({ reservationId, bookingReference })` of the existing record without republishing `RESERVATION_CONFIRMED`.
- The handler MUST run in `@Transactional()` so the HOLD → CONFIRMED transition, the booking reference assignment, and the guest-details persistence are atomic.
- The handler MUST validate the underlying session is still active before transitioning. If the session is EXPIRED, return `Err(SESSION_EXPIRED)` and do not transition.
- The handler MUST publish `RESERVATION_CONFIRMED` exactly once per reservation, with payload including `staffId`, `bookingReference`, `guestName`, `roomName`, `period` so the existing notification consumer at `notification/jobs/notification-events.consumer.ts` works unchanged.
- All errors MUST be returned as `Result<_, DomainError>` values, mirroring the existing service style.
- Logger usage MUST follow the existing pattern in `confirm-payment.ts` and `expire-session.consumer.ts`.
</requirements>

## Subtasks
- [x] 6.1 Update the input shape to accept `{ paymentIntentId, guestName, guestEmail, guestPhone }`.
- [x] 6.2 Add the idempotency check at the start of the handler: lookup reservation by `paymentIntentId`; if CONFIRMED, return the existing reference.
- [x] 6.3 Add the session-freshness validation; return `Err(SESSION_EXPIRED)` if the session is no longer active.
- [x] 6.4 Inside the transaction: transition HOLD → CONFIRMED, persist `paymentIntentId` and the three guest-detail columns on the reservation, and call `BookingReferenceService.assignToReservation`.
- [x] 6.5 Publish `RESERVATION_CONFIRMED` with the full payload required by the existing consumer.
- [x] 6.6 Update the existing test file `__test__/integrations/confirm-payment.spec.ts` with the new BDD scenarios.

## Implementation Details
See TechSpec section "Implementation Design → Core Interfaces → Confirmation". The existing handler structure already lives in [confirm-payment.ts](../../../backend/src/reservation/core/service/confirm-payment.ts) — extend it; do not replace.

The reservation columns (`paymentIntentId`, `guestName/Email/Phone`) come from task 01. The booking-reference assignment uses the service from task 03. The session is loaded via the existing `ReservationSessionRepository`.

### Relevant Files
- `backend/src/reservation/core/service/confirm-payment.ts` — file to modify.
- `backend/src/reservation/core/service/booking-reference.ts` — assigns the reference.
- `backend/src/reservation/persist/repositories/reservation.repository.ts` — read/write reservation rows.
- `backend/src/reservation/persist/repositories/reservation-session.repository.ts` — verify session freshness.
- `backend/src/reservation/__test__/integrations/confirm-payment.spec.ts` — existing test file; extend with new scenarios.
- `backend/src/notification/jobs/notification-events.consumer.ts` — existing consumer; payload contract anchors this task.

### Dependent Files
- `backend/src/payment/http/controller/webhook.ts` (task 07) — calls this service.
- `backend/src/reservation/http/controller/booking.ts` (task 09) — `POST /booking/confirmation` calls this service when the polling path triggers an active confirmation.

### Related ADRs
- [ADR-004: Payment Confirmation via Webhook + Polling Fallback](adrs/adr-004.md) — motivates the idempotency requirement.
- [ADR-001: Full Self-Service Booking Wizard as MVP Approach](adrs/adr-001.md) — the zero-manual-intervention goal that this idempotency protects.

## Deliverables
- Modified `confirm-payment.ts` with the new behaviour.
- New BDD scenarios appended to `confirm-payment.spec.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests covering idempotency and the session-expired race **(REQUIRED)**.

## Tests
Follow the BDD pattern of the existing `select-room.spec.ts` and `confirm-payment.spec.ts`. Real Postgres; SQS event bus stubbed; assert on returned `Result` and persisted state.

- Integration tests (BDD):
  - [x] Scenario: Given an active session with a HOLD reservation, When `ConfirmPayment.handle({ paymentIntentId, guestName, guestEmail, guestPhone })` is called, Then the reservation is CONFIRMED, the booking reference matches `^LR-\d{4}-[2-9A-HJKMNP-Z]{5}$`, the three guest-detail columns are populated, and `RESERVATION_CONFIRMED` is published exactly once.
  - [x] Scenario: Given a reservation already CONFIRMED for the same `paymentIntentId`, When `handle` is called again, Then the result is `Ok({ bookingReference: existing })` and no event is republished and the reservation row is unchanged.
  - [x] Scenario: Given a HOLD whose session has transitioned to EXPIRED, When `handle` is called, Then the result is `Err(SESSION_EXPIRED)` and the reservation remains in HOLD (no booking reference assigned, no event published).
  - [x] Scenario: Given two concurrent calls to `handle` for the same `paymentIntentId` (simulating the webhook + poll race), When both run, Then exactly one CONFIRMED transition happens and exactly one event is published.
  - [x] Scenario: Given a HOLD whose `paymentIntentId` does not match any reservation in the database, When `handle` is called, Then the result is `Err(RESERVATION_NOT_FOUND)`.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- The existing notification consumer receives the same `RESERVATION_CONFIRMED` envelope it expects today (no notification-side change required).
- All previous tests in `confirm-payment.spec.ts` continue to pass after the input-shape change (they may need an input-shape update, but no behavioural regression).
