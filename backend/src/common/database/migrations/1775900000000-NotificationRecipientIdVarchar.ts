import { MigrationInterface, QueryRunner } from 'typeorm'

export class NotificationRecipientIdVarchar1775900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notification"."notifications"
      ALTER COLUMN "recipient_id" TYPE varchar
      USING "recipient_id"::varchar
    `)

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient"
      ON "notification"."notifications" ("recipient_id", "recipient_type", "event_type")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "notification"."IDX_notifications_recipient"`)

    await queryRunner.query(`
      ALTER TABLE "notification"."notifications"
      ALTER COLUMN "recipient_id" TYPE uuid
      USING "recipient_id"::uuid
    `)
  }
}
