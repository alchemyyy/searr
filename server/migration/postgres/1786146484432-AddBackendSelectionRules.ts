import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBackendSelectionRules1786146484432 implements MigrationInterface {
  public name = 'AddBackendSelectionRules1786146484432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "backend_selection_rule" ("id" SERIAL NOT NULL, "mediaType" character varying NOT NULL, "serviceId" integer NOT NULL, "ruleType" character varying NOT NULL, "matchType" character varying NOT NULL, "tags" text NOT NULL, "position" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_backend_selection_rule" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_backend_selection_rule_media_position" ON "backend_selection_rule" ("mediaType", "position")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_backend_selection_rule_media_position"`
    );
    await queryRunner.query(`DROP TABLE "backend_selection_rule"`);
  }
}
