/*
  Warnings:

  - You are about to drop the column `userId` on the `Team` table. All the data in the column will be lost.
  - Added the required column `outcome` to the `MatchEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `team` to the `MatchEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_userId_fkey";

-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "opponentPlayerId" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL,
ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "rotation" INTEGER,
ADD COLUMN     "team" TEXT NOT NULL,
ALTER COLUMN "payload" SET DEFAULT '{}';

-- AlterTable
ALTER TABLE "MatchSet" ADD COLUMN     "oppTimeoutsRemaining" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "ourTimeoutsRemaining" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "userId";

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT,
    "jersey" INTEGER NOT NULL,
    "position" TEXT,

    CONSTRAINT "OpponentPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timeout" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "calledBy" TEXT NOT NULL,
    "atScoreUs" INTEGER NOT NULL,
    "atScoreThem" INTEGER NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timeout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "attackTotal" INTEGER NOT NULL DEFAULT 0,
    "attackKills" INTEGER NOT NULL DEFAULT 0,
    "attackErrors" INTEGER NOT NULL DEFAULT 0,
    "attackEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serveTotal" INTEGER NOT NULL DEFAULT 0,
    "serveAces" INTEGER NOT NULL DEFAULT 0,
    "serveErrors" INTEGER NOT NULL DEFAULT 0,
    "serveEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receptionTotal" INTEGER NOT NULL DEFAULT 0,
    "receptionPerfect" INTEGER NOT NULL DEFAULT 0,
    "receptionGood" INTEGER NOT NULL DEFAULT 0,
    "receptionErrors" INTEGER NOT NULL DEFAULT 0,
    "receptionEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockTotal" INTEGER NOT NULL DEFAULT 0,
    "blockKills" INTEGER NOT NULL DEFAULT 0,
    "blockErrors" INTEGER NOT NULL DEFAULT 0,
    "blockTouches" INTEGER NOT NULL DEFAULT 0,
    "digTotal" INTEGER NOT NULL DEFAULT 0,
    "digPerfect" INTEGER NOT NULL DEFAULT 0,
    "digGood" INTEGER NOT NULL DEFAULT 0,
    "digErrors" INTEGER NOT NULL DEFAULT 0,
    "setTotal" INTEGER NOT NULL DEFAULT 0,
    "setPerfect" INTEGER NOT NULL DEFAULT 0,
    "setGood" INTEGER NOT NULL DEFAULT 0,
    "setErrors" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpponentMatchStats" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "opponentPlayerId" TEXT NOT NULL,
    "attackTotal" INTEGER NOT NULL DEFAULT 0,
    "attackKills" INTEGER NOT NULL DEFAULT 0,
    "attackErrors" INTEGER NOT NULL DEFAULT 0,
    "attackEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serveTotal" INTEGER NOT NULL DEFAULT 0,
    "serveAces" INTEGER NOT NULL DEFAULT 0,
    "serveErrors" INTEGER NOT NULL DEFAULT 0,
    "serveEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receptionTotal" INTEGER NOT NULL DEFAULT 0,
    "receptionPerfect" INTEGER NOT NULL DEFAULT 0,
    "receptionGood" INTEGER NOT NULL DEFAULT 0,
    "receptionErrors" INTEGER NOT NULL DEFAULT 0,
    "receptionEfficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockTotal" INTEGER NOT NULL DEFAULT 0,
    "blockKills" INTEGER NOT NULL DEFAULT 0,
    "blockErrors" INTEGER NOT NULL DEFAULT 0,
    "blockTouches" INTEGER NOT NULL DEFAULT 0,
    "digTotal" INTEGER NOT NULL DEFAULT 0,
    "digPerfect" INTEGER NOT NULL DEFAULT 0,
    "digGood" INTEGER NOT NULL DEFAULT 0,
    "digErrors" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpponentMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStats_matchId_playerId_key" ON "PlayerMatchStats"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "OpponentMatchStats_matchId_opponentPlayerId_key" ON "OpponentMatchStats"("matchId", "opponentPlayerId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentPlayer" ADD CONSTRAINT "OpponentPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timeout" ADD CONSTRAINT "Timeout_setId_fkey" FOREIGN KEY ("setId") REFERENCES "MatchSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_opponentPlayerId_fkey" FOREIGN KEY ("opponentPlayerId") REFERENCES "OpponentPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchStats" ADD CONSTRAINT "PlayerMatchStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentMatchStats" ADD CONSTRAINT "OpponentMatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpponentMatchStats" ADD CONSTRAINT "OpponentMatchStats_opponentPlayerId_fkey" FOREIGN KEY ("opponentPlayerId") REFERENCES "OpponentPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
