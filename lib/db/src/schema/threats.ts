import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const threatsTable = pgTable("threats", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // critical, high, medium, low
  category: text("category").notNull(),
  affectedSystems: text("affected_systems").array().notNull().default([]),
  cveId: text("cve_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  mitigations: text("mitigations").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertThreatSchema = createInsertSchema(threatsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertThreat = z.infer<typeof insertThreatSchema>;
export type Threat = typeof threatsTable.$inferSelect;
