import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFilterPresets1785686400000 implements MigrationInterface {
  name = 'AddFilterPresets1785686400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "permissions" TYPE bigint USING "permissions"::bigint`
    );
    await queryRunner.query(
      `CREATE TABLE "filter_preset" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "filters" text NOT NULL, "isDefaultMovie" boolean NOT NULL DEFAULT false, "isDefaultTv" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_filter_preset_name" UNIQUE ("name"), CONSTRAINT "PK_filter_preset" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_name_nocase" ON "filter_preset" (LOWER("name"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_default_movie" ON "filter_preset" ("isDefaultMovie") WHERE "isDefaultMovie" = true`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_filter_preset_default_tv" ON "filter_preset" ("isDefaultTv") WHERE "isDefaultTv" = true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "filter_preset"`);
    await queryRunner.query(
      `UPDATE "user" SET "permissions" = "permissions" - 2147483648 WHERE ("permissions" & 2147483648) != 0`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "permissions" TYPE integer USING "permissions"::integer`
    );
  }
}
