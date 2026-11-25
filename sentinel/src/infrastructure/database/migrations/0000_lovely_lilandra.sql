CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(240) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"identifier_issuer" varchar(120),
	"identifier_value" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_issuer_value_unique" ON "organisations" USING btree ("identifier_issuer","identifier_value");