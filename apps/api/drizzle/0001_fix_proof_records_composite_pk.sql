/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'proof_records'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "proof_records" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "proof_records" ADD CONSTRAINT "proof_records_id_kind_pk" PRIMARY KEY("id","kind");