import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoomPricePerNight1775980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservation"."rooms"
      ADD COLUMN "price_per_night" bigint NOT NULL DEFAULT 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservation"."rooms"
      DROP COLUMN "price_per_night"
    `)
  }
}
