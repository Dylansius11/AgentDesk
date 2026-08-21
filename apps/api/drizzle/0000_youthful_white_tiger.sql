CREATE TYPE "public"."category" AS ENUM('grid', 'rebalance', 'yield', 'health');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('created', 'funded', 'active', 'awaiting_attestation', 'completed', 'revoked', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'paused', 'delisted');--> statement-breakpoint
CREATE TYPE "public"."metrics_window" AS ENUM('7d', '30d', 'all');--> statement-breakpoint
CREATE TYPE "public"."outcome_status" AS ENUM('pending', 'win', 'loss', 'neutral', 'expired');--> statement-breakpoint
CREATE TYPE "public"."proof_record_kind" AS ENUM('decision', 'outcome');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "advantage_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_label" text NOT NULL,
	"baseline" jsonb,
	"with_agent" jsonb,
	"outputs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"registered_at" timestamp with time zone,
	"uri_metadata" jsonb,
	"capabilities" jsonb,
	"last_synced_at" timestamp with time zone,
	"sync_source" text
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"address" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"links" jsonb,
	"stake_amount" numeric(18, 6)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_ref" text,
	"agent_id" text NOT NULL,
	"hirer_address" text NOT NULL,
	"config" jsonb,
	"status" "job_status" DEFAULT 'created' NOT NULL,
	"fee_usd1" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"category" "category" NOT NULL,
	"tagline" text,
	"description" text,
	"price_per_task_usd1" numeric(12, 2),
	"risk_level" "risk_level",
	"default_caps" jsonb,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"proof_program" boolean DEFAULT false NOT NULL,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proof_metrics" (
	"agent_id" text NOT NULL,
	"window" "metrics_window" NOT NULL,
	"verified_return_pct" numeric(8, 2),
	"win_rate" numeric(5, 4),
	"max_drawdown_pct" numeric(8, 2),
	"tasks_resolved" integer,
	"avg_response_min" numeric(8, 1),
	"category_stat" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_metrics_agent_id_window_pk" PRIMARY KEY("agent_id","window")
);
--> statement-breakpoint
CREATE TABLE "proof_records" (
	"id" bigint PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"kind" "proof_record_kind" NOT NULL,
	"intent_hash" text,
	"deadline" timestamp with time zone,
	"registered_tx" text,
	"registered_block" bigint,
	"outcome_status" "outcome_status",
	"pnl_usd1" numeric(14, 2),
	"evidence_uri" text,
	"attested_tx" text,
	"attested_block" bigint,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"amount_usd1" numeric(12, 2),
	"fee_usd1" numeric(12, 2),
	"settlement_tx" text,
	"payer" text,
	"payee" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"allowlist" jsonb,
	"spend_cap_usd1" numeric(12, 2),
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"keystore_tx" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"address" text PRIMARY KEY NOT NULL,
	"prefs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"user_address" text NOT NULL,
	"agent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_address_agent_id_pk" PRIMARY KEY("user_address","agent_id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_metrics" ADD CONSTRAINT "proof_metrics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_records" ADD CONSTRAINT "proof_records_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_address_users_address_fk" FOREIGN KEY ("user_address") REFERENCES "public"."users"("address") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proof_records_agent_id_idx" ON "proof_records" USING btree ("agent_id");