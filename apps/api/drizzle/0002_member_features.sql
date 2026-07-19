CREATE TABLE "reading_statuses" (
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"status" text NOT NULL,
	"started_on" date,
	"finished_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_statuses_user_id_book_id_pk" PRIMARY KEY("user_id","book_id"),
	CONSTRAINT "reading_statuses_status_check" CHECK ("reading_statuses"."status" in ('want_to_read', 'reading', 'finished')),
	CONSTRAINT "reading_statuses_finished_on_check" CHECK ("reading_statuses"."finished_on" is null or "reading_statuses"."status" = 'finished')
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_book_unique" UNIQUE("user_id","book_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"review_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "review_reports_reason_check" CHECK ("review_reports"."reason" in ('spam', 'abuse', 'language', 'spoilers', 'other'))
);
--> statement-breakpoint
CREATE TABLE "tracked_lists" (
	"user_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_lists_user_id_list_id_pk" PRIMARY KEY("user_id","list_id")
);
--> statement-breakpoint
ALTER TABLE "reading_statuses" ADD CONSTRAINT "reading_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_statuses" ADD CONSTRAINT "reading_statuses_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_lists" ADD CONSTRAINT "tracked_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_lists" ADD CONSTRAINT "tracked_lists_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reading_statuses_shelf_idx" ON "reading_statuses" USING btree ("user_id","status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reviews_book_visible_idx" ON "reviews" USING btree ("book_id","created_at" DESC NULLS LAST) WHERE not "reviews"."is_hidden";--> statement-breakpoint
CREATE UNIQUE INDEX "review_reports_member_unique" ON "review_reports" USING btree ("review_id","reporter_id") WHERE "review_reports"."reporter_id" is not null;--> statement-breakpoint
CREATE INDEX "review_reports_open_idx" ON "review_reports" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "review_reports_review_idx" ON "review_reports" USING btree ("review_id");