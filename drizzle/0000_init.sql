CREATE TABLE "ai_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"model" text NOT NULL,
	"content" text NOT NULL,
	"focus" text DEFAULT '' NOT NULL,
	"stats" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candles_1m" (
	"ticker" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" double precision NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "candles_1m_ticker_ts_pk" PRIMARY KEY("ticker","ts")
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" integer NOT NULL,
	"side" text NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"price" double precision NOT NULL,
	"qty" double precision NOT NULL,
	"fee" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"trade_date" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"planned_stop" double precision,
	"planned_target" double precision,
	"setup_tags" text[] DEFAULT '{}' NOT NULL,
	"emotion_tags" text[] DEFAULT '{}' NOT NULL,
	"confidence" integer,
	"followed_plan" boolean,
	"entry_reason" text DEFAULT '' NOT NULL,
	"exit_reason" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"candles_status" text DEFAULT 'none' NOT NULL,
	"candles_error" text,
	"excursion" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "executions_position_idx" ON "executions" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "positions_trade_date_idx" ON "positions" USING btree ("trade_date");--> statement-breakpoint
CREATE INDEX "positions_ticker_idx" ON "positions" USING btree ("ticker");