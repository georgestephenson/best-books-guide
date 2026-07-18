CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"ol_author_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_unique" UNIQUE("slug"),
	CONSTRAINT "authors_ol_author_key_unique" UNIQUE("ol_author_key")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"slug" text NOT NULL,
	"description" text,
	"isbn13" text,
	"ol_work_key" text,
	"cover_path" text,
	"first_published_year" integer,
	"page_count" integer,
	"language" text DEFAULT 'en' NOT NULL,
	"series_id" uuid,
	"series_position" numeric(4, 1),
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_slug_unique" UNIQUE("slug"),
	CONSTRAINT "books_isbn13_unique" UNIQUE("isbn13"),
	CONSTRAINT "books_ol_work_key_unique" UNIQUE("ol_work_key")
);
--> statement-breakpoint
CREATE TABLE "book_authors" (
	"book_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "book_authors_book_id_author_id_pk" PRIMARY KEY("book_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "book_subjects" (
	"book_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "book_subjects_book_id_subject_id_pk" PRIMARY KEY("book_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"parent_list_id" uuid,
	"intro" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"list_id" uuid NOT NULL,
	"book_id" uuid,
	"series_id" uuid,
	"rank" integer NOT NULL,
	"blurb" text,
	CONSTRAINT "list_items_book_unique" UNIQUE("list_id","book_id"),
	CONSTRAINT "list_items_series_unique" UNIQUE("list_id","series_id"),
	CONSTRAINT "list_items_one_target" CHECK (num_nonnulls("list_items"."book_id", "list_items"."series_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_subjects" ADD CONSTRAINT "book_subjects_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_subjects" ADD CONSTRAINT "book_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_parent_list_id_lists_id_fk" FOREIGN KEY ("parent_list_id") REFERENCES "public"."lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authors_name_trgm" ON "authors" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_title_trgm" ON "books" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "books_series_idx" ON "books" USING btree ("series_id","series_position");--> statement-breakpoint
CREATE INDEX "book_authors_author_idx" ON "book_authors" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "book_subjects_subject_idx" ON "book_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "lists_subject_idx" ON "lists" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "lists_parent_idx" ON "lists" USING btree ("parent_list_id");--> statement-breakpoint
CREATE INDEX "list_items_book_idx" ON "list_items" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "list_items_series_idx" ON "list_items" USING btree ("series_id");--> statement-breakpoint
-- Hand-added (ADR-0010): drizzle-kit can't emit DEFERRABLE, so this constraint lives
-- only in the migration, not the drizzle snapshot. INITIALLY DEFERRED lets a whole-list
-- reorder swap ranks within one transaction without tripping the unique mid-update
-- (docs/03 §list_items). Doubles as the (list_id, rank) render-order index.
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_rank_unique" UNIQUE ("list_id", "rank") DEFERRABLE INITIALLY DEFERRED;