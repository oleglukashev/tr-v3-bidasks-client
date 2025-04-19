/*
  Warnings:

  - You are about to drop the column `code` on the `currency_pairs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[symbol]` on the table `currency_pairs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `symbol` to the `currency_pairs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "currency_pairs_code_key";

-- AlterTable
ALTER TABLE "currency_pairs" DROP COLUMN "code",
ADD COLUMN     "symbol" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "currency_pairs_symbol_key" ON "currency_pairs"("symbol");
