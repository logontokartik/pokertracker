-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "foodBillCents" INTEGER;

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "miscAdjCents" INTEGER NOT NULL DEFAULT 0;
