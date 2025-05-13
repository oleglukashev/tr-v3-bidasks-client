-- CreateTable
CREATE TABLE "klines" (
    "id" TEXT NOT NULL,
    "open" VARCHAR(50) NOT NULL,
    "close" VARCHAR(50) NOT NULL,
    "low" VARCHAR(50) NOT NULL,
    "high" VARCHAR(50) NOT NULL,
    "volume" VARCHAR(50) NOT NULL,
    "ts" BIGINT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "pair_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "klines_id_key" ON "klines"("id");

-- CreateIndex
CREATE UNIQUE INDEX "klines_ts_pair_id_interval_key" ON "klines"("ts", "pair_id", "interval");
