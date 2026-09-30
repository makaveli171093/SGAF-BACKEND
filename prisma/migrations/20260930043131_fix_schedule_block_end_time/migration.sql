/*
  Warnings:

  - You are about to drop the column `endtTime` on the `ScheduleBlock` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `ScheduleBlock` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ScheduleBlock" DROP COLUMN "endtTime",
ADD COLUMN     "endTime" TIME NOT NULL;
