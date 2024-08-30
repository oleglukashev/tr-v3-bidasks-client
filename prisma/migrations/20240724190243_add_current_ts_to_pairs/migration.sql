/*
  Warnings:

  - Added the required column `current_ts` to the `currency_pairs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "currency_pairs" ADD COLUMN     "current_ts" INTEGER NOT NULL;
