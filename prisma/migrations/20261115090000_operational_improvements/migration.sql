ALTER TABLE "users" ADD COLUMN "avatarData" TEXT, ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "audit_events" ("id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL, "entityId" TEXT NOT NULL, "detail" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"));
CREATE INDEX "audit_events_entityId_createdAt_idx" ON "audit_events"("entityId", "createdAt");
