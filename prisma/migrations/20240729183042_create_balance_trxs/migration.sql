-- CreateTable
CREATE TABLE "balance_trxs" (
    "id" SERIAL NOT NULL,
    "balance_before" VARCHAR(50) NOT NULL DEFAULT '0',
    "balance_after" VARCHAR(50) NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" VARCHAR(50) NOT NULL,
    "price" VARCHAR(50) NOT NULL,
    "balance_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_trxs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "balance_trxs_balance_id_key" ON "balance_trxs"("balance_id");

-- AddForeignKey
ALTER TABLE "balance_trxs" ADD CONSTRAINT "balance_trxs_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
