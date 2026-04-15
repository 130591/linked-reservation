import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotificationIdempotencyKey1775950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification"."notifications"
      ADD COLUMN "idempotency_key" varchar NULL
    `)

    // Partial unique index: only enforce uniqueness when a key is provided.
    // Same key may target distinct recipients/channels (e.g. staff + customer
    // from the same source event), so the key is scoped by recipient+channel.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_notifications_idempotency_key"
      ON "notification"."notifications" ("idempotency_key", "recipient_id", "channel")
      WHERE "idempotency_key" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "notification"."UQ_notifications_idempotency_key"`)
    await queryRunner.query(`
      ALTER TABLE "notification"."notifications"
      DROP COLUMN "idempotency_key"
    `)
  }
}
