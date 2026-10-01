/*
  Warnings:

  - A unique constraint covering the columns `[externalReference]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "gatewayResponse" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "payments_externalReference_key" ON "payments"("externalReference");
