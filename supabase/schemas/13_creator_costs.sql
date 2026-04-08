CREATE TABLE IF NOT EXISTS "public"."creator_costs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "creator_brand_id" bigint NOT NULL,
  "month" date NOT NULL,
  "cost" numeric NOT NULL CHECK (cost > 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "creator_costs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "creator_costs_creator_brand_id_fkey"
    FOREIGN KEY ("creator_brand_id") REFERENCES "public"."creator_brands" ("id") ON DELETE CASCADE,
  CONSTRAINT "creator_costs_unique" UNIQUE ("creator_brand_id", "month")
);
