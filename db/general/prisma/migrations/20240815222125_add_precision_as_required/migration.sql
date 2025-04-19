/*
  Warnings:

  - Made the column `precision` on table `pairs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "pairs" ALTER COLUMN "precision" SET NOT NULL;
