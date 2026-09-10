import "server-only";
import { desc } from "drizzle-orm";

/** true si DATABASE_URL está configurado (fase de bootstrap: puede no estarlo aún). */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getRecentCargas(limit = 10) {
  if (!isDatabaseConfigured()) return [];
  const { db } = await import("./client");
  const { cargas } = await import("./schema");
  return db.select().from(cargas).orderBy(desc(cargas.createdAt)).limit(limit);
}
