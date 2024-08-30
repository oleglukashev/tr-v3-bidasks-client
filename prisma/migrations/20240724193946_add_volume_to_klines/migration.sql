/*
  Warnings:

  - Added the required column `volume` to the `klines` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "klines" ADD COLUMN     "volume" VARCHAR(50) NOT NULL;
