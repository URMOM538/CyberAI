import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  ListOpenaiConversationsResponse,
  GetOpenaiConversationResponse,
  ListOpenaiMessagesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are CyberAI, an expert cybersecurity assistant with deep knowledge of:
- Malware, ransomware, spyware, and all forms of malicious software
- Network security, firewalls, VPNs, and intrusion detection
- Vulnerability assessment and penetration testing concepts
- Antivirus and endpoint protection software
- Security best practices for individuals and organizations
- Recent cybersecurity threats, CVEs, and attack campaigns
- Password security, multi-factor authentication, and identity management
- Phishing, social engineering, and how to recognize and avoid them
- Data privacy, encryption, and secure communications
- Compliance frameworks (NIST, ISO 27001, SOC 2, HIPAA, PCI DSS)
- Incident response and digital forensics basics

Answer questions clearly and accurately. For high-risk threats, emphasize urgency. When recommending tools, be specific and explain why each is suitable. If asked about something outside cybersecurity, politely redirect to security topics.`;

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const convs = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
  res.json(ListOpenaiConversationsResponse.parse(convs.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))));
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
  res.status(201).json({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt.toISOString(),
  });
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetOpenaiConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, parsed.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(GetOpenaiConversationResponse.parse({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
  }));
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeleteOpenaiConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.delete(conversations).where(eq(conversations.id, parsed.data.id)).returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = ListOpenaiMessagesParams.safeParse({ id: parseInt(raw, 10) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(asc(messages.createdAt));

  res.json(ListOpenaiMessagesResponse.parse(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))));
});

router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const [userMsg] = await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  }).returning();

  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
