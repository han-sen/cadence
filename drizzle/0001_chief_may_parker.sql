CREATE TABLE "chart" (
	"id" text PRIMARY KEY NOT NULL,
	"seed_mbid" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"events" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_view" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chart_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chart" ADD CONSTRAINT "chart_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_view" ADD CONSTRAINT "chart_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_view" ADD CONSTRAINT "chart_view_chart_id_chart_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."chart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chart_seedMbid_createdAt_idx" ON "chart" USING btree ("seed_mbid","created_at");--> statement-breakpoint
CREATE INDEX "chart_view_userId_viewedAt_idx" ON "chart_view" USING btree ("user_id","viewed_at");