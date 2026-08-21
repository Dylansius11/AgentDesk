CREATE TABLE "keeper_state" (
  "chain_id" integer NOT NULL,
  "contract_address" text NOT NULL,
  "stream" text NOT NULL,
  "next_block" bigint NOT NULL,
  "last_processed_block_hash" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "keeper_state_chain_id_contract_address_stream_pk" PRIMARY KEY("chain_id", "contract_address", "stream")
);
