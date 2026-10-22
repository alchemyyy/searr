import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBackendSelectionRules1786146484432 implements MigrationInterface {
  public name = 'AddBackendSelectionRules1786146484432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "backend_selection_rule" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "mediaType" varchar NOT NULL, "serviceId" integer NOT NULL, "ruleType" varchar NOT NULL, "matchType" varchar NOT NULL, "tags" text NOT NULL, "position" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_backend_selection_rule_media_position" ON "backend_selection_rule" ("mediaType", "position")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_backend_selection_rule_media_position"`
    );
    await queryRunner.query(`DROP TABLE "backend_selection_rule"`);
  }
}
