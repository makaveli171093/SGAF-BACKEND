/*
  Warnings:

  - You are about to drop the column `descrption` on the `financial_obligations` table. All the data in the column will be lost.
  - You are about to drop the column `guardiaCi` on the `student_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `guardiaName` on the `student_profiles` table. All the data in the column will be lost.
  - Added the required column `description` to the `financial_obligations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guardianName` to the `student_profiles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "financial_obligations" DROP COLUMN "descrption",
ADD COLUMN     "description" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "student_profiles" DROP COLUMN "guardiaCi",
DROP COLUMN "guardiaName",
ADD COLUMN     "guardianCi" TEXT,
ADD COLUMN     "guardianName" TEXT NOT NULL;
