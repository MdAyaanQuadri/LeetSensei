-- CreateTable
CREATE TABLE "LeetCodeStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "globalRank" INTEGER NOT NULL DEFAULT 5000000,
    "totalQuestionsSolved" INTEGER NOT NULL DEFAULT 0,
    "mediumQuestionsSolved" INTEGER NOT NULL DEFAULT 0,
    "hardQuestionsSolved" INTEGER NOT NULL DEFAULT 0,
    "easyQuestionsSolved" INTEGER NOT NULL DEFAULT 0,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "activeDays" INTEGER NOT NULL DEFAULT 0,
    "maxStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "submissionHeatMap" JSONB NOT NULL DEFAULT '[]',
    "fundamentalTag" JSONB NOT NULL DEFAULT '[]',
    "intermediateTag" JSONB NOT NULL DEFAULT '[]',
    "advancedTag" JSONB NOT NULL DEFAULT '[]',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeetCodeStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeetCodeStats_userId_key" ON "LeetCodeStats"("userId");

-- AddForeignKey
ALTER TABLE "LeetCodeStats" ADD CONSTRAINT "LeetCodeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
