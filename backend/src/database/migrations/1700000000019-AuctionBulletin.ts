import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuctionBulletin1700000000019 implements MigrationInterface {
  name = 'AuctionBulletin1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();
    try {
      // 1. 创建 auctions 表
      await queryRunner.query(`
        CREATE TABLE "auctions" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "tenantId" uuid NOT NULL,
          "type" character varying(20) NOT NULL,
          "targetEntity" character varying(100),
          "targetId" uuid,
          "description" text NOT NULL,
          "status" character varying(20) NOT NULL DEFAULT 'open',
          "minBid" integer NOT NULL DEFAULT 0,
          "endsAt" TIMESTAMP NOT NULL,
          "winnerId" uuid,
          "winningBid" integer,
          "createdBy" uuid NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_auctions" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_auctions_tenantId" ON "auctions" ("tenantId")`);

      // 2. 创建 bids 表
      await queryRunner.query(`
        CREATE TABLE "bids" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "auctionId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "tenantId" uuid NOT NULL,
          "amount" integer NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_bids" PRIMARY KEY ("id"),
          CONSTRAINT "FK_bids_auctionId" FOREIGN KEY ("auctionId")
            REFERENCES "auctions"("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_bids_auctionId" ON "bids" ("auctionId")`);

      // 3. 给 tasks 表添加 claimMode 列（如果还没有的话）
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'claimMode'
          ) THEN
            ALTER TABLE "tasks" ADD COLUMN "claimMode" character varying(20) NOT NULL DEFAULT 'single';
          END IF;
        END $$;
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bids"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auctions"`);
  }
}
