/*
  Warnings:

  - You are about to drop the column `gradeAt` on the `submissions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "submissions" DROP COLUMN "gradeAt",
ADD COLUMN     "gradedAt" TIMESTAMP(3);
