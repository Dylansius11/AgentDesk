import { defineConfig } from 'drizzle-kit'

// Generates/pushes migrations for the schema in docs/technical/ERD.md §2.
// db:generate needs no live DB (just this file + schema.ts); db:push needs
// DATABASE_URL (Supabase, not provisioned this session — see .env.example).
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
