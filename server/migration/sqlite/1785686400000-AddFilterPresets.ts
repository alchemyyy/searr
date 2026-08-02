import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFilterPresets1785686400000 implements MigrationInterface {
  name = 'AddFilterPresets1785686400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "filter_preset" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" varchar NOT NULL, "filters" text NOT NULL, "isDefaultMovie" boolean NOT NULL DEFAULT (0), "isDefaultTv" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), CONSTRAINT "UQ_filter_preset_name" UNIQUE ("name"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_name_nocase" ON "filter_preset" (LOWER("name"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_default_movie" ON "filter_preset" ("isDefaultMovie") WHERE "isDefaultMovie" = 1`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_default_tv" ON "filter_preset" ("isDefaultTv") WHERE "isDefaultTv" = 1`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "filter_preset"`);
  }
}
