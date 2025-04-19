/*
  Warnings:

  - You are about to drop the `klines` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "klines" DROP CONSTRAINT "klines_pair_id_fkey";

-- DropTable
DROP TABLE "klines";
