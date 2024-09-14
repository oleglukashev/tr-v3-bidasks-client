-- AlterTable
ALTER TABLE "strategy_session_trxs" ADD COLUMN     "historyStrategySessionId" INTEGER;

-- CreateTable
CREATE TABLE "history_strategy_sessions" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "data" JSONB NOT NULL DEFAULT '{}',
    "pair_id" INTEGER NOT NULL,
    "start_ts" BIGINT NOT NULL,
    "finish_ts" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "history_strategy_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "history_strategy_sessions" ADD CONSTRAINT "history_strategy_sessions_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_session_trxs" ADD CONSTRAINT "strategy_session_trxs_historyStrategySessionId_fkey" FOREIGN KEY ("historyStrategySessionId") REFERENCES "history_strategy_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
