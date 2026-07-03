CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_session_token_hash_unique" UNIQUE("session_token_hash")
);
--> statement-breakpoint
CREATE TABLE "business_cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"monthly_budget_usd" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_cost_centers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "manual_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_type" text NOT NULL,
	"source_id" text NOT NULL,
	"business_cost_center_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_imported" numeric(12, 0) DEFAULT '0',
	"rows_updated" numeric(12, 0) DEFAULT '0',
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "technical_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_project_id" text,
	"external_project_name" text NOT NULL,
	"external_project_slug" text,
	"business_cost_center_id" uuid,
	"mapping_confidence" text DEFAULT 'unmapped' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "v0_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text NOT NULL,
	"title" text,
	"web_url" text,
	"vercel_project_id" text,
	"technical_project_id" uuid,
	"manual_business_cost_center_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "v0_chats_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "v0_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_event_id" text,
	"source_hash" text NOT NULL,
	"type" text,
	"total_cost" numeric(14, 6) NOT NULL,
	"prompt_cost" numeric(14, 6),
	"completion_cost" numeric(14, 6),
	"chat_id" text,
	"message_id" text,
	"user_id" text,
	"user_email" text,
	"model" text,
	"event_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "v0_usage_events_source_event_id_unique" UNIQUE("source_event_id"),
	CONSTRAINT "v0_usage_events_source_hash_unique" UNIQUE("source_hash")
);
--> statement-breakpoint
CREATE TABLE "vercel_billing_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_hash" text NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"service_name" text,
	"service_category" text,
	"billed_cost" numeric(14, 6),
	"effective_cost" numeric(14, 6),
	"billing_currency" text,
	"consumed_quantity" numeric(20, 6),
	"consumed_unit" text,
	"region_name" text,
	"vercel_project_id" text,
	"vercel_project_name" text,
	"technical_project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_json" jsonb,
	CONSTRAINT "vercel_billing_charges_source_hash_unique" UNIQUE("source_hash")
);
--> statement-breakpoint
ALTER TABLE "manual_mappings" ADD CONSTRAINT "manual_mappings_business_cost_center_id_business_cost_centers_id_fk" FOREIGN KEY ("business_cost_center_id") REFERENCES "public"."business_cost_centers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_projects" ADD CONSTRAINT "technical_projects_business_cost_center_id_business_cost_centers_id_fk" FOREIGN KEY ("business_cost_center_id") REFERENCES "public"."business_cost_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v0_chats" ADD CONSTRAINT "v0_chats_technical_project_id_technical_projects_id_fk" FOREIGN KEY ("technical_project_id") REFERENCES "public"."technical_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v0_chats" ADD CONSTRAINT "v0_chats_manual_business_cost_center_id_business_cost_centers_id_fk" FOREIGN KEY ("manual_business_cost_center_id") REFERENCES "public"."business_cost_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vercel_billing_charges" ADD CONSTRAINT "vercel_billing_charges_technical_project_id_technical_projects_id_fk" FOREIGN KEY ("technical_project_id") REFERENCES "public"."technical_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "technical_projects_external_id_idx" ON "technical_projects" USING btree ("external_project_id");--> statement-breakpoint
CREATE INDEX "technical_projects_bcc_idx" ON "technical_projects" USING btree ("business_cost_center_id");--> statement-breakpoint
CREATE INDEX "v0_chats_vercel_project_idx" ON "v0_chats" USING btree ("vercel_project_id");--> statement-breakpoint
CREATE INDEX "v0_chats_technical_project_idx" ON "v0_chats" USING btree ("technical_project_id");--> statement-breakpoint
CREATE INDEX "v0_usage_events_chat_idx" ON "v0_usage_events" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "v0_usage_events_event_created_idx" ON "v0_usage_events" USING btree ("event_created_at");--> statement-breakpoint
CREATE INDEX "vercel_billing_charges_period_idx" ON "vercel_billing_charges" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "vercel_billing_charges_project_idx" ON "vercel_billing_charges" USING btree ("vercel_project_id");--> statement-breakpoint
CREATE INDEX "vercel_billing_charges_tp_idx" ON "vercel_billing_charges" USING btree ("technical_project_id");