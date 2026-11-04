BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "escape_room";

-- CreateTable
CREATE TABLE "escape_room"."GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeRunId" TEXT,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escape_room"."GameRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "campaignVersion" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "clearance" TEXT NOT NULL DEFAULT 'guest',
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GameRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escape_room"."RoomProgress" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3),
    "hintLevel" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escape_room"."Artifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escape_room"."RequestAttempt" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mutation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "RequestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "escape_room"."GuestSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_activeRunId_key" ON "escape_room"."GuestSession"("activeRunId");

-- CreateIndex
CREATE INDEX "GameRun_sessionId_startedAt_idx" ON "escape_room"."GameRun"("sessionId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomProgress_runId_roomId_key" ON "escape_room"."RoomProgress"("runId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_runId_kind_key" ON "escape_room"."Artifact"("runId", "kind");

-- CreateIndex
CREATE INDEX "RequestAttempt_runId_createdAt_id_idx" ON "escape_room"."RequestAttempt"("runId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAttempt_runId_requestId_key" ON "escape_room"."RequestAttempt"("runId", "requestId");

-- AddForeignKey
ALTER TABLE "escape_room"."GuestSession" ADD CONSTRAINT "GuestSession_activeRunId_fkey" FOREIGN KEY ("activeRunId") REFERENCES "escape_room"."GameRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escape_room"."GameRun" ADD CONSTRAINT "GameRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "escape_room"."GuestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escape_room"."RoomProgress" ADD CONSTRAINT "RoomProgress_runId_fkey" FOREIGN KEY ("runId") REFERENCES "escape_room"."GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escape_room"."Artifact" ADD CONSTRAINT "Artifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "escape_room"."GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escape_room"."RequestAttempt" ADD CONSTRAINT "RequestAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "escape_room"."GameRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
