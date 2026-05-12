import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddBookingReferenceAndGuestDetails1775960000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      ADD COLUMN "booking_reference" varchar(32),
      ADD COLUMN "payment_intent_id" uuid,
      ADD COLUMN "guest_name" varchar(200),
      ADD COLUMN "guest_email" varchar(320),
      ADD COLUMN "guest_phone" varchar(32)
    `)

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reservations_booking_reference"
      ON "reservation"."reservations" ("booking_reference")
      WHERE "booking_reference" IS NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "reservation"."UQ_reservations_booking_reference"`)
    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      DROP COLUMN "guest_phone",
      DROP COLUMN "guest_email",
      DROP COLUMN "guest_name",
      DROP COLUMN "payment_intent_id",
      DROP COLUMN "booking_reference"
    `)
  }
}
