/*
  Warnings:

  - You are about to drop the column `currentTurn` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `InitiativeEntry` table. All the data in the column will be lost.
  - Added the required column `encounterId` to the `InitiativeEntry` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentTurn" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Clear existing initiative entries (dev data) before restructuring
DELETE FROM "InitiativeEntry";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "campaignId" TEXT NOT NULL,
    "activeMapId" TEXT,
    "activeEncounterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GameSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("activeMapId", "campaignId", "createdAt", "id", "name", "shortCode", "status", "updatedAt") SELECT "activeMapId", "campaignId", "createdAt", "id", "name", "shortCode", "status", "updatedAt" FROM "GameSession";
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
CREATE UNIQUE INDEX "GameSession_shortCode_key" ON "GameSession"("shortCode");
CREATE TABLE "new_InitiativeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roll" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InitiativeEntry_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InitiativeEntry_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "PlayerCharacter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InitiativeEntry" ("characterId", "id", "roll", "sortOrder") SELECT "characterId", "id", "roll", "sortOrder" FROM "InitiativeEntry";
DROP TABLE "InitiativeEntry";
ALTER TABLE "new_InitiativeEntry" RENAME TO "InitiativeEntry";
CREATE UNIQUE INDEX "InitiativeEntry_encounterId_characterId_key" ON "InitiativeEntry"("encounterId", "characterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
