CREATE TABLE "widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widgets_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "widgets_status_idx" ON "widgets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "widgets_last_refreshed_at_idx" ON "widgets" USING btree ("last_refreshed_at");