import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, threatsTable } from "@workspace/db";
import {
  ListThreatsQueryParams,
  GetThreatParams,
  GetThreatResponse,
  ListThreatsResponse,
  GetThreatsSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/threats", async (req, res): Promise<void> => {
  const parsed = ListThreatsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, severity } = parsed.data;
  let query = db.select().from(threatsTable).$dynamic();

  const conditions = [];
  if (category) conditions.push(eq(threatsTable.category, category));
  if (severity) conditions.push(eq(threatsTable.severity, severity));

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions));
  }

  const threats = await query.orderBy(desc(threatsTable.publishedAt));

  res.json(ListThreatsResponse.parse(threats.map(t => ({
    ...t,
    publishedAt: t.publishedAt.toISOString(),
  }))));
});

router.get("/threats/summary", async (_req, res): Promise<void> => {
  const threats = await db.select().from(threatsTable);

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let recentCount = 0;

  for (const t of threats) {
    bySeverity[t.severity] = (bySeverity[t.severity] ?? 0) + 1;
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    if (t.publishedAt >= thirtyDaysAgo) recentCount++;
  }

  res.json(GetThreatsSummaryResponse.parse({
    total: threats.length,
    recentCount,
    bySeverity,
    byCategory,
  }));
});

router.get("/threats/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetThreatParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [threat] = await db
    .select()
    .from(threatsTable)
    .where(eq(threatsTable.id, parsed.data.id));

  if (!threat) {
    res.status(404).json({ error: "Threat not found" });
    return;
  }

  res.json(GetThreatResponse.parse({
    ...threat,
    publishedAt: threat.publishedAt.toISOString(),
  }));
});

export default router;
