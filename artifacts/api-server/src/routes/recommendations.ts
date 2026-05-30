import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, recommendationsTable } from "@workspace/db";
import {
  ListRecommendationsQueryParams,
  GetRecommendationParams,
  GetRecommendationResponse,
  ListRecommendationsResponse,
  GetFeaturedRecommendationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/recommendations", async (req, res): Promise<void> => {
  const parsed = ListRecommendationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, platform } = parsed.data;
  let query = db.select().from(recommendationsTable).$dynamic();

  if (category) {
    query = query.where(eq(recommendationsTable.category, category));
  }

  const recommendations = await query.orderBy(desc(recommendationsTable.rating));

  let results = recommendations;
  if (platform) {
    results = results.filter(r => r.platforms.includes(platform));
  }

  res.json(ListRecommendationsResponse.parse(results));
});

router.get("/recommendations/featured", async (_req, res): Promise<void> => {
  const featured = await db
    .select()
    .from(recommendationsTable)
    .where(eq(recommendationsTable.isFeatured, true))
    .orderBy(desc(recommendationsTable.rating));

  res.json(GetFeaturedRecommendationsResponse.parse(featured));
});

router.get("/recommendations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetRecommendationParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rec] = await db
    .select()
    .from(recommendationsTable)
    .where(eq(recommendationsTable.id, parsed.data.id));

  if (!rec) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }

  res.json(GetRecommendationResponse.parse(rec));
});

export default router;
