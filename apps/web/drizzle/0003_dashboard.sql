CREATE TABLE "known_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "retest_reminders" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "monthly_checkup" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "achieved_result_id" uuid;--> statement-breakpoint
ALTER TABLE "known_devices" ADD CONSTRAINT "known_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "known_devices_token_key" ON "known_devices" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_achieved_result_id_results_id_fk" FOREIGN KEY ("achieved_result_id") REFERENCES "public"."results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "accounts" SET "retest_reminders" = true WHERE "retest_reminder_at" IS NOT NULL;
