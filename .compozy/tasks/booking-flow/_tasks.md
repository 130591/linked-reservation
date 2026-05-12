# Guest Booking Flow — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Database migrations: payment schema and reservation booking columns | completed | low | — |
| 02 | Stripe configuration schema and shared client provider | completed | low | — |
| 03 | BookingReferenceService (LR-YYMM-XXXXX generator) | completed | low | task_01 |
| 04 | Payment module skeleton: entities, repositories, persistence module | completed | medium | task_01 |
| 05 | PaymentAPI service (createIntent, getStatus, refreshFromProvider) | completed | medium | task_02, task_04 |
| 06 | Extend ConfirmPayment service: idempotency, paymentIntentId, guest details, booking reference | completed | medium | task_01, task_03 |
| 07 | Stripe webhook controller: signature verification, dedup, confirmation dispatch | pending | medium | task_04, task_05, task_06 |
| 08 | Reservation view token methods and ReservationViewTokenGuard | pending | low | — |
| 09 | New booking HTTP endpoints and AppModule wiring | pending | medium | task_05, task_06, task_08 |
| 10 | Frontend workspace scaffold: Vite, React, router, i18n, API client, session and countdown hooks | pending | medium | — |
| 11 | Frontend wizard: Room selection and Guest details steps | pending | medium | task_10 |
| 12 | Frontend payment step: Stripe Payment Element and polling hook | pending | medium | task_09, task_11 |
| 13 | Frontend confirmation and expired routes (closes end-to-end loop) | pending | medium | task_09, task_12 |
