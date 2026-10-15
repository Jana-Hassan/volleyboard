-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "clientEventId" TEXT;

-- AlterTable
ALTER TABLE "MatchSet" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_clientEventId_key" ON "MatchEvent"("clientEventId");

