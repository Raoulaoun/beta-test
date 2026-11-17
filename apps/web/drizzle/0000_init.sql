CREATE TYPE "public"."funnel_kind" AS ENUM('visit', 'upload_started', 'score_shown', 'lead_submitted', 'exit_prompt_shown', 'exit_prompt_converted');--> statement-breakpoint
CREATE TYPE "public"."goal_kind" AS ENUM('pillar', 'band');--> statement-breakpoint
CREATE TYPE "public"."managing_for_others" AS ENUM('no', 'friends_family', 'formal');--> statement-breakpoint
CREATE TYPE "public"."score_type" AS ENUM('full', 'early', 'starter');--> statement-breakpoint
CREATE TYPE "public"."result_source" AS ENUM('upload', 'connected');--> statement-breakpoint
CREATE TYPE "public"."crm_stage" AS ENUM('new', 'contacted', 'webinar_registered', 'webinar_attended', 'applied', 'not_a_fit');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"country" text,
	"managing_for_others" "managing_for_others",
	"consent_contact" boolean DEFAULT false NOT NULL,
	"consent_marketing" boolean DEFAULT false NOT NULL,
	"source" jsonb,
	"introduced_by" text,
	"retest_reminder_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ok" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text NOT NULL,
	"last_totp_step" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"stage" "crm_stage" DEFAULT 'new' NOT NULL,
	"stage_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"status" text NOT NULL,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" "funnel_kind" NOT NULL,
	"campaign" text,
	"result_id" uuid,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" "goal_kind" NOT NULL,
	"pillar" text,
	"target" integer,
	"band" text,
	"baseline_result_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"achieved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"area" text NOT NULL,
	"segment" text,
	"polarity" text NOT NULL,
	"trades" integer,
	"share" numeric(7, 4),
	"pf_without" numeric(9, 4),
	"data" jsonb,
	"rank" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"access_token_hash" text NOT NULL,
	"source" "result_source" DEFAULT 'upload' NOT NULL,
	"connected_account_id" uuid,
	"account_fingerprint" text,
	"platform" text NOT NULL,
	"score_type" "score_type" NOT NULL,
	"score" integer,
	"uncapped_score" integer,
	"band" text,
	"pillars" jsonb,
	"metrics" jsonb,
	"red_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_weakness" text,
	"broker" text,
	"account_type" text NOT NULL,
	"size_bucket" text,
	"months" numeric(6, 2),
	"closed_trades" integer NOT NULL,
	"period_days" integer,
	"evaluation_date" date NOT NULL,
	"scoring_version" text NOT NULL,
	"payload" jsonb NOT NULL,
	"campaign" text,
	"utm" jsonb,
	"introduced_by" text,
	"device" text,
	"left_at" text,
	"exit_prompt_shown" boolean DEFAULT false NOT NULL,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm" ADD CONSTRAINT "crm_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_baseline_result_id_results_id_fk" FOREIGN KEY ("baseline_result_id") REFERENCES "public"."results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_insights" ADD CONSTRAINT "result_insights_result_id_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_login_attempts_idx" ON "admin_login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_hash_key" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_key" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_email_idx" ON "auth_tokens" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "crm_notes_account_idx" ON "crm_notes" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "email_log_account_idx" ON "email_log" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "funnel_events_idx" ON "funnel_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_active_idx" ON "goals" USING btree ("account_id") WHERE "goals"."active";--> statement-breakpoint
CREATE INDEX "result_insights_result_idx" ON "result_insights" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "results_account_idx" ON "results" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "results_fingerprint_idx" ON "results" USING btree ("account_fingerprint");--> statement-breakpoint
CREATE INDEX "results_dropoff_idx" ON "results" USING btree ("created_at") WHERE "results"."account_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_hash_key" ON "sessions" USING btree ("token_hash");