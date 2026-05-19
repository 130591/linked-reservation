import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Corrects room_id and session_id in reservation.reservations from uuid
 * to bigint, aligning with the project convention: internal FK columns
 * reference the numeric BIGSERIAL id, not the external UUID.
 *
 * Safe in development: TRUNCATE removes seed data; real data never existed.
 */
export class FixReservationForeignKeyTypes1775970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove all test data so ALTER TYPE succeeds without conversion issues
    await queryRunner.query(`TRUNCATE TABLE "reservation"."reservations" CASCADE`)

    // Drop the GiST exclusion constraint that references room_id
    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      DROP CONSTRAINT "XCL_aa8b27ff3830782414d17ee00c"
    `)

    // Change column types
    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      ALTER COLUMN "room_id"    TYPE bigint USING 0,
      ALTER COLUMN "session_id" TYPE bigint USING 0
    `)

    // Recreate the exclusion constraint with bigint room_id (btree_gist already enabled)
    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      ADD CONSTRAINT "XCL_reservations_room_period"
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(check_in, check_out, '[]') WITH &&
      ) WHERE ("status" IN ('HOLD', 'CONFIRMED') AND "deleted_at" IS NULL)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE "reservation"."reservations" CASCADE`)

    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      DROP CONSTRAINT "XCL_reservations_room_period"
    `)

    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      ALTER COLUMN "room_id"    TYPE uuid USING gen_random_uuid(),
      ALTER COLUMN "session_id" TYPE uuid USING gen_random_uuid()
    `)

    await queryRunner.query(`
      ALTER TABLE "reservation"."reservations"
      ADD CONSTRAINT "XCL_aa8b27ff3830782414d17ee00c"
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(check_in, check_out, '[]') WITH &&
      ) WHERE ("status" IN ('HOLD', 'CONFIRMED') AND "deleted_at" IS NULL)
    `)
  }
}
