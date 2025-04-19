/*
  Warnings:

  - You are about to drop the column `currency` on the `balances` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[symbol]` on the table `balances` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `symbol` to the `balances` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "balances_currency_key";

-- AlterTable
ALTER TABLE "balances" DROP COLUMN "currency",
ADD COLUMN     "symbol" VARCHAR(50) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "balances_symbol_key" ON "balances"("symbol");
