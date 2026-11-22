ALTER TABLE "auth_tokens" ADD COLUMN "kind" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "code_hash" text;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;