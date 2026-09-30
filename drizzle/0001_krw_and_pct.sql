CREATE TABLE "fx_rates" (
	"date" text PRIMARY KEY NOT NULL,
	"rate" double precision NOT NULL,
	"rate_date" text NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "stop_pct" double precision;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "target_pct" double precision;--> statement-breakpoint
ALTER TABLE "positions" ADD COLUMN "fx_rate" double precision;--> statement-breakpoint
-- 기존 손절가·목표가(가격)를 평균 매수가 대비 비율(%)로 변환
UPDATE "positions" p SET
  "stop_pct" = CASE WHEN p."planned_stop" IS NOT NULL AND b.avg_entry > 0 THEN round(((b.avg_entry - p."planned_stop") / b.avg_entry * 100)::numeric, 3)::double precision END,
  "target_pct" = CASE WHEN p."planned_target" IS NOT NULL AND b.avg_entry > 0 THEN round(((p."planned_target" - b.avg_entry) / b.avg_entry * 100)::numeric, 3)::double precision END
FROM (
  SELECT "position_id", sum("price" * "qty") / nullif(sum("qty"), 0) AS avg_entry
  FROM "executions" WHERE "side" = 'buy' GROUP BY "position_id"
) b
WHERE b."position_id" = p."id";
