import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Sin esto, drizzle-kit intenta introspeccionar también los schemas
  // internos de Supabase (auth, storage, realtime, ...) y falla con sus
  // constraints — nuestras tablas viven todas en "public".
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
