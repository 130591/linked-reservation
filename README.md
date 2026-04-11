# Linked Reservation

> Conversational booking system that turns WhatsApp messages into confirmed reservations — no app, no manual work.

[![NestJS](https://img.shields.io/badge/NestJS-11-red)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## What is it?

A hotel, pousada, or hostel receives a WhatsApp message: _"Do you have a room available for next weekend for 2 people?"_

Linked Reservation:
1. Reads the message via Twilio webhook
2. Extracts intent and entities (check-in, check-out, guests) with Claude AI
3. Generates a temporary, personalized booking link
4. Sends the link back to the guest
5. The guest completes the reservation autonomously — room selection, availability check, payment
6. Staff are notified on the configured channel

No manual spreadsheets. No double-bookings. No dropped conversations.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          linked-reservation                             │
│                                                                         │
│  ┌─────────────┐    ┌──────────────────────────────────────────────┐   │
│  │   Twilio    │    │                  NestJS App                  │   │
│  │  WhatsApp   │───▶│                                              │   │
│  │  Webhook    │    │  ┌─────────────┐    ┌────────────────────┐  │   │
│  └─────────────┘    │  │Conversation │    │    Reservation     │  │   │
│                     │  │   Module    │    │      Module        │  │   │
│  ┌─────────────┐    │  │             │    │                    │  │   │
│  │   Auth0     │    │  │ ┌─────────┐ │    │  ┌─────────────┐  │  │   │
│  │  (JWT/JIT)  │───▶│  │ │ Claude  │ │    │  │ SelectRoom  │  │  │   │
│  └─────────────┘    │  │ │  Haiku  │ │    │  │ GenerateLink│  │  │   │
│                     │  │ │ Intent  │ │    │  │ConfirmPaymt │  │  │   │
│  ┌─────────────┐    │  │ │Extract  │ │    │  └─────────────┘  │  │   │
│  │  AWS SQS    │◀───│  │ └─────────┘ │    └────────────────────┘  │   │
│  │  (Outbox)   │    │  └─────────────┘                            │   │
│  │             │───▶│                                              │   │
│  │  ┌────────┐ │    │  ┌─────────────┐    ┌────────────────────┐  │   │
│  │  │Session │ │    │  │  Identity   │    │   Notification     │  │   │
│  │  │Expire  │ │    │  │   Module    │    │      Module        │  │   │
│  │  │ Queue  │ │    │  │             │    │                    │  │   │
│  │  └────────┘ │    │  │ Auth0 JIT   │    │  Routing Rules     │  │   │
│  └─────────────┘    │  │ Provisioning│    │  Quiet Hours       │  │   │
│                     │  │ Trial Mgmt  │    │  Twilio Send       │  │   │
│  ┌─────────────┐    │  └─────────────┘    └────────────────────┘  │   │
│  │  PostgreSQL │◀───│                                              │   │
│  │             │    │  ┌───────────────────────────────────────┐  │   │
│  │  schema:    │    │  │             Common Layer              │  │   │
│  │  identity   │    │  │  Outbox · Redis · Config · Filters    │  │   │
│  │  reservation│    │  └───────────────────────────────────────┘  │   │
│  │  notif.     │    └──────────────────────────────────────────────┘   │
│  │  common     │                                                        │
│  └─────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘

Event flow (Outbox pattern):
  Service ──▶ DB (outbox table) ──▶ OutboxPublisherJob ──▶ SQS ──▶ Consumer
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| **Conversation** | Receives WhatsApp webhooks, extracts intent via LLM, manages conversational state in Redis |
| **Reservation** | Room selection, hold creation, session/link generation, payment confirmation |
| **Notification** | Routes events to the right recipient/channel, respects quiet hours, sends via Twilio |
| **Identity** | Auth0 JWT guard with JIT provisioning, Property (hotel) lifecycle, trial management |

### Key design decisions

| Decision | Why |
|---|---|
| `BIGSERIAL id` + `UUID externalId` | Numeric PK for fast DB queries; UUID for external APIs/events (no internal ID leakage) |
| Outbox pattern | Atomic event publishing — event is persisted in the same DB transaction as the domain change |
| PostgreSQL schemas | Hard isolation between domains without running multiple databases |
| neverthrow (`Result`/`ResultAsync`) | Domain errors as values — no invisible exception paths, forced error handling at call site |
| Redis for session state | Conversation state is ephemeral and high-frequency; fits cache semantics |
| Named datasource (`reservation`) | Single TypeORM datasource shared across all modules, avoiding connection pool fragmentation |

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | NestJS 11 |
| Database | PostgreSQL 16 (TypeORM, typeorm-transactional) |
| Cache | Redis 7 |
| Queue | AWS SQS (local: ElasticMQ) |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5`) |
| WhatsApp | Twilio Programmable Messaging |
| Auth | Auth0 (RS256 JWT + JIT provisioning) |
| Testing | Jest (unit + integration) |

---

## Running locally

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- A free [Twilio](https://www.twilio.com/) account (WhatsApp sandbox)
- An [Anthropic](https://console.anthropic.com/) API key
- An [Auth0](https://auth0.com/) tenant

### 1. Clone and install

```bash
git clone https://github.com/your-org/linked-reservation.git
cd linked-reservation/backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — see reference below
```

### 3. Start infrastructure

```bash
# From project root
docker compose up -d
# Starts: PostgreSQL, Redis, ElasticMQ (SQS)
```

### 4. Create SQS queues (ElasticMQ)

```bash
aws --endpoint-url=http://localhost:9324 sqs create-queue \
  --queue-name outbox-events.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false

aws --endpoint-url=http://localhost:9324 sqs create-queue \
  --queue-name session-expire.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=false
```

### 5. Run migrations

```bash
cd backend
npm run migration:run
```

### 6. Start the API

```bash
npm run start:dev
# API available at http://localhost:3000
```

### 7. Test WhatsApp webhook (Twilio sandbox)

Configure the Twilio sandbox to forward messages to:
```
https://<your-ngrok>.ngrok.io/webhooks/whatsapp
```

Or test locally:
```bash
curl -X POST http://localhost:3000/webhooks/whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp%3A%2B5511999990000&Body=quero+reservar+um+quarto+para+o+proximo+fim+de+semana"
```

---

## Environment variables

```dotenv
# App
NODE_ENV=development
PORT=3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=linked_reservation
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AWS SQS (use ElasticMQ locally)
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:9324
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
SQS_OUTBOX_QUEUE_URL=http://localhost:9324/000000000000/outbox-events.fifo
SQS_SESSION_EXPIRE_QUEUE_URL=http://localhost:9324/000000000000/session-expire.fifo

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.linked-reservation.com
AUTH0_M2M_CLIENT_ID=...
AUTH0_M2M_CLIENT_SECRET=...
```

---

## Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E
npm run test:e2e
```

### Test structure

```
src/
├── conversation/__test__/    # Conversation flow integration tests
├── identity/__test__/        # Auth0 guard, provisioning, trial expiration
├── notification/__test__/    # Router rules, notification dispatch
├── reservation/__test__/     # Select room, generate link, confirm payment
│   └── fixture/              # In-memory fakes (FakeReservationRepository, etc.)
test/
└── app.e2e-spec.ts           # End-to-end smoke test
```

Unit tests use in-memory fakes instead of mocks — fakes enforce the same contract as real repositories, catching integration bugs earlier.

---

## Project structure

```
linked-reservation/
├── docker-compose.yml
├── README.md
└── backend/
    ├── src/
    │   ├── app.module.ts
    │   ├── common/
    │   │   ├── config/               # ConfigService (typed env vars)
    │   │   ├── database/
    │   │   │   ├── entities/         # BaseEntity (id, externalId, createdAt, updatedAt)
    │   │   │   ├── migrations/
    │   │   │   ├── persistence/      # TypeOrmPersistenceModule factory
    │   │   │   └── repositories/     # DefaultTypeOrmRepository<T>
    │   │   ├── framework/
    │   │   │   └── filters/          # DomainResultFilter (Result → HTTP)
    │   │   ├── integrations/twilio/
    │   │   ├── messaging/
    │   │   │   ├── outbox/           # OutboxEvent, OutboxRepository, OutboxPublisherJob
    │   │   │   └── sqs.module.ts
    │   │   └── redis/
    │   ├── conversation/
    │   │   ├── core/
    │   │   │   ├── contract/         # ConversationState, Intent types
    │   │   │   ├── prompts/          # Booking intent prompt
    │   │   │   └── service/          # IntentExtractorService, ConversationService
    │   │   ├── http/                 # WhatsApp webhook controller
    │   │   └── persist/              # Redis-backed session state
    │   ├── identity/
    │   │   ├── core/
    │   │   │   ├── domain/           # Property, Staff, errors (neverthrow)
    │   │   │   └── service/          # ProvisionPropertyService
    │   │   ├── http/guards/          # Auth0JwtGuard (lazy ESM import)
    │   │   ├── jobs/                 # TrialExpirationJob (@Cron)
    │   │   └── persist/              # PropertyEntity, StaffMemberEntity
    │   ├── notification/
    │   │   ├── core/
    │   │   │   ├── domain/           # RoutingRule, NotificationError
    │   │   │   └── service/          # NotificationRouterService
    │   │   └── persist/              # NotificationEntity, RoutingRuleEntity
    │   └── reservation/
    │       ├── core/
    │       │   ├── domain/           # Reservation, Room, Stay, Session
    │       │   └── service/          # SelectRoom, GenerateLink, ConfirmPayment
    │       ├── http/                 # BookingController
    │       ├── jobs/                 # ExpireSessionConsumer (SQS)
    │       └── persist/              # All reservation entities + repositories
    └── test/
        └── app.e2e-spec.ts
```

---

## Main flows

### 1. Conversational booking

```
Guest (WhatsApp) → Twilio → POST /webhooks/whatsapp
  → ConversationService.handle(message, stayId)
    → IntentExtractorService.extract()   [Claude Haiku]
    → Redis: update ConversationState
    → if intent == BOOK_ROOM && entities complete:
        → ReservationService.generateLink(sessionId)
        → TwilioService.sendMessage(link)
```

### 2. Reservation flow

```
Guest opens link → GET /booking/:token
  → SelectRoomService.execute(sessionId, roomId)
    → RoomRepository.findOne()
    → ReservationRepository.createHold()
    → Outbox: publish HOLD_CREATED event
  → ConfirmPaymentService.execute(reservationId)
    → ReservationRepository.update(status = CONFIRMED)
    → Outbox: publish RESERVATION_CONFIRMED event
      → NotificationModule: notify staff via configured channel
```

### 3. Trial expiration (cron)

```
@Cron('0 9 * * *') TrialExpirationJob.run()
  → PropertyRepository.findTrialPropertiesExpiring(before: now+24h)
    → suspend: entity.status = 'suspended' → save()
    → warn:    publish property.trial.expiring event → SQS
      → NotificationModule: email/WhatsApp admin
```

---

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feat/my-feature`
3. Follow the domain conventions (see [Memory](/.claude/projects/) for project norms)
4. Run `npm test` — all tests must pass
5. Open a PR with a clear description of the motivation

Code conventions:
- Domain errors as `Result`/`ResultAsync` (neverthrow) — no `throw` in domain layer
- Use `entity.externalId` (UUID) in events and API responses; `entity.id` (number) only in DB queries
- BDD-style test descriptions: `describe('when ...')` / `it('should ...')`
- No mocks for repositories in integration tests — use in-memory fakes

---

## License

MIT © Everton Paixao
