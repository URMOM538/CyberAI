import { pgTable, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recommendationsTable = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  platforms: text("platforms").array().notNull().default([]),
  rating: real("rating").notNull().default(0),
  price: text("price").notNull(),
  isFree: boolean("is_free").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  websiteUrl: text("website_url"),
  pros: text("pros").array().notNull().default([]),
  cons: text("cons").array().notNull().default([]),
  bestFor: text("best_for").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendationsTable.$inferSelect;
