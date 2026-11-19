ALTER TABLE "goals" ADD COLUMN "status" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "from_value" integer;