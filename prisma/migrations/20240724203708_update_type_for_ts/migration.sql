-- AlterTable
ALTER TABLE "klines" ALTER COLUMN "ts" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "pairs" ALTER COLUMN "current_ts" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "strategy_sessions" ALTER COLUMN "start_ts" SET DATA TYPE BIGINT,
ALTER COLUMN "finish_ts" SET DATA TYPE BIGINT;
