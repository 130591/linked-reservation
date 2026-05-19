import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreatePaymentSchema1775960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS payment`)

    await queryRunner.query(`
      CREATE TABLE "payment"."payment_intents" (
        "id" BIGSERIAL NOT NULL,
        "external_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "reservation_id" uuid NOT NULL,
        "provider_intent_id" varchar NOT NULL,
        "amount_cents" bigint NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'BRL',
        "status" varchar NOT NULL DEFAULT 'pending',
        "customer" jsonb NOT NULL DEFAULT '{}',
        "last_event_payload" jsonb,
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_payment_intents_external_id" UNIQUE ("external_id"),
        CONSTRAINT "UQ_payment_intents_provider_intent_id" UNIQUE ("provider_intent_id"),
        CONSTRAINT "PK_payment_intents" PRIMARY KEY ("id")
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "payment"."webhook_events" (
        "id" BIGSERIAL NOT NULL,
        "external_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "event_id" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "payload" jsonb NOT NULL,
        "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_webhook_events_external_id" UNIQUE ("external_id"),
        CONSTRAINT "UQ_webhook_events_event_id" UNIQUE ("event_id"),
        CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id")
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment"."webhook_events"`)
    await queryRunner.query(`DROP TABLE IF EXISTS "payment"."payment_intents"`)
    await queryRunner.query(`DROP SCHEMA IF EXISTS payment`)
  }
}
