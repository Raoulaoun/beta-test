ALTER TYPE "public"."funnel_kind" ADD VALUE 'form_opened';--> statement-breakpoint
ALTER TABLE "funnel_events" ADD COLUMN "source" text;