import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyVoteAndPoints1700000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fill null scores with 0, then make column NOT NULL with default 0
    await queryRunner.query(`
      UPDATE "review_votes" SET "score" = 0 WHERE "score" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "review_votes"
        ALTER COLUMN "score" SET NOT NULL,
        ALTER COLUMN "score" SET DEFAULT 0,
        ALTER COLUMN "score" TYPE integer USING "score"::integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "review_votes"
        ALTER COLUMN "score" DROP NOT NULL,
        ALTER COLUMN "score" DROP DEFAULT,
        ALTER COLUMN "score" TYPE decimal(6,2) USING "score"::decimal(6,2)
    `);
  }
}
