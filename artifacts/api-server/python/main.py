"""
CyberAI API Server — Python/FastAPI
Replaces the TypeScript Express server with full Python implementation.
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, AsyncGenerator

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI

# ─── DB connection ────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

def db_query(sql: str, params=None):
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

def db_execute(sql: str, params=None, returning=True):
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            result = dict(cur.fetchone()) if returning else None
            conn.commit()
            return result
    finally:
        conn.close()

def db_execute_delete(sql: str, params=None):
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
    finally:
        conn.close()

def fmt_ts(val) -> Optional[str]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val)

# ─── OpenAI client ────────────────────────────────────────────────────────────

AI_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
AI_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")

if not AI_BASE_URL or not AI_API_KEY:
    print("WARNING: OpenAI AI integration env vars not set — chat will not work")

openai_client = OpenAI(
    api_key=AI_API_KEY or "placeholder",
    base_url=AI_BASE_URL or "https://api.openai.com/v1",
) if AI_BASE_URL and AI_API_KEY else None

SYSTEM_PROMPT = """You are CyberAI, an expert cybersecurity assistant with deep knowledge of:
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

Answer questions clearly and accurately. For high-risk threats, emphasize urgency. When recommending tools, be specific and explain why each is suitable. If asked about something outside cybersecurity, politely redirect to security topics."""

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="CyberAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic models ──────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    title: str

class SendMessageRequest(BaseModel):
    content: str

# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/healthz")
def healthz():
    return {"status": "ok", "runtime": "python"}

# ─── Threats ──────────────────────────────────────────────────────────────────

@app.get("/api/threats")
def list_threats(
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
):
    conditions = ["1=1"]
    params = []
    if category:
        conditions.append("category = %s")
        params.append(category)
    if severity:
        conditions.append("severity = %s")
        params.append(severity)

    where = " AND ".join(conditions)
    rows = db_query(f"SELECT * FROM threats WHERE {where} ORDER BY published_at DESC", params or None)

    for r in rows:
        r["publishedAt"] = fmt_ts(r.pop("published_at", None))
        r["createdAt"] = fmt_ts(r.pop("created_at", None))
        r["affectedSystems"] = r.pop("affected_systems", [])
        r["cveId"] = r.pop("cve_id", None)
        r["sourceUrl"] = r.pop("source_url", None)
    return rows


@app.get("/api/threats/summary")
def threats_summary():
    rows = db_query("SELECT severity, category, published_at FROM threats")
    thirty_days_ago = datetime.now(timezone.utc).timestamp() - 30 * 24 * 3600
    by_severity: dict = {}
    by_category: dict = {}
    recent_count = 0
    for r in rows:
        s = r["severity"]
        c = r["category"]
        by_severity[s] = by_severity.get(s, 0) + 1
        by_category[c] = by_category.get(c, 0) + 1
        pub = r["published_at"]
        if pub:
            ts = pub.timestamp() if isinstance(pub, datetime) else 0
            if ts >= thirty_days_ago:
                recent_count += 1
    return {
        "total": len(rows),
        "recentCount": recent_count,
        "bySeverity": by_severity,
        "byCategory": by_category,
    }


@app.get("/api/threats/{threat_id}")
def get_threat(threat_id: int):
    rows = db_query("SELECT * FROM threats WHERE id = %s", (threat_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Threat not found")
    r = rows[0]
    r["publishedAt"] = fmt_ts(r.pop("published_at", None))
    r["createdAt"] = fmt_ts(r.pop("created_at", None))
    r["affectedSystems"] = r.pop("affected_systems", [])
    r["cveId"] = r.pop("cve_id", None)
    r["sourceUrl"] = r.pop("source_url", None)
    return r

# ─── Recommendations ──────────────────────────────────────────────────────────

@app.get("/api/recommendations")
def list_recommendations(
    category: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
):
    conditions = ["1=1"]
    params = []
    if category:
        conditions.append("category = %s")
        params.append(category)

    where = " AND ".join(conditions)
    rows = db_query(f"SELECT * FROM recommendations WHERE {where} ORDER BY rating DESC", params or None)

    def fmt_rec(r):
        r["isFree"] = r.pop("is_free", False)
        r["isFeatured"] = r.pop("is_featured", False)
        r["websiteUrl"] = r.pop("website_url", None)
        r["bestFor"] = r.pop("best_for", None)
        r["createdAt"] = fmt_ts(r.pop("created_at", None))
        return r

    rows = [fmt_rec(r) for r in rows]

    if platform:
        rows = [r for r in rows if platform in (r.get("platforms") or [])]

    return rows


@app.get("/api/recommendations/featured")
def featured_recommendations():
    rows = db_query("SELECT * FROM recommendations WHERE is_featured = true ORDER BY rating DESC")
    for r in rows:
        r["isFree"] = r.pop("is_free", False)
        r["isFeatured"] = r.pop("is_featured", False)
        r["websiteUrl"] = r.pop("website_url", None)
        r["bestFor"] = r.pop("best_for", None)
        r["createdAt"] = fmt_ts(r.pop("created_at", None))
    return rows


@app.get("/api/recommendations/{rec_id}")
def get_recommendation(rec_id: int):
    rows = db_query("SELECT * FROM recommendations WHERE id = %s", (rec_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    r = rows[0]
    r["isFree"] = r.pop("is_free", False)
    r["isFeatured"] = r.pop("is_featured", False)
    r["websiteUrl"] = r.pop("website_url", None)
    r["bestFor"] = r.pop("best_for", None)
    r["createdAt"] = fmt_ts(r.pop("created_at", None))
    return r

# ─── Conversations ────────────────────────────────────────────────────────────

@app.get("/api/openai/conversations")
def list_conversations():
    rows = db_query("SELECT * FROM conversations ORDER BY created_at ASC")
    for r in rows:
        r["createdAt"] = fmt_ts(r.pop("created_at", None))
    return rows


@app.post("/api/openai/conversations", status_code=201)
def create_conversation(body: CreateConversationRequest):
    row = db_execute(
        "INSERT INTO conversations (title) VALUES (%s) RETURNING *",
        (body.title,),
    )
    row["createdAt"] = fmt_ts(row.pop("created_at", None))
    return row


@app.get("/api/openai/conversations/{conv_id}")
def get_conversation(conv_id: int):
    convs = db_query("SELECT * FROM conversations WHERE id = %s", (conv_id,))
    if not convs:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv = convs[0]
    conv["createdAt"] = fmt_ts(conv.pop("created_at", None))

    msgs = db_query(
        "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
        (conv_id,),
    )
    for m in msgs:
        m["createdAt"] = fmt_ts(m.pop("created_at", None))
        m["conversationId"] = m.pop("conversation_id", None)

    conv["messages"] = msgs
    return conv


@app.delete("/api/openai/conversations/{conv_id}", status_code=204)
def delete_conversation(conv_id: int):
    row = db_execute_delete(
        "DELETE FROM conversations WHERE id = %s RETURNING id",
        (conv_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return None


@app.get("/api/openai/conversations/{conv_id}/messages")
def list_messages(conv_id: int):
    msgs = db_query(
        "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
        (conv_id,),
    )
    for m in msgs:
        m["createdAt"] = fmt_ts(m.pop("created_at", None))
        m["conversationId"] = m.pop("conversation_id", None)
    return msgs


@app.post("/api/openai/conversations/{conv_id}/messages")
def send_message(conv_id: int, body: SendMessageRequest):
    convs = db_query("SELECT id FROM conversations WHERE id = %s", (conv_id,))
    if not convs:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI integration not configured")

    db_execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s) RETURNING id",
        (conv_id, "user", body.content),
    )

    history = db_query(
        "SELECT role, content FROM messages WHERE conversation_id = %s ORDER BY created_at ASC",
        (conv_id,),
    )

    chat_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + [
        {"role": m["role"], "content": m["content"]} for m in history
    ]

    def event_stream() -> AsyncGenerator:
        full_response = []
        try:
            stream = openai_client.chat.completions.create(
                model="gpt-5.4",
                max_completion_tokens=8192,
                messages=chat_messages,
                stream=True,
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content if chunk.choices else None
                if content:
                    full_response.append(content)
                    yield f"data: {json.dumps({'content': content})}\n\n"

            assembled = "".join(full_response)
            db_execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s) RETURNING id",
                (conv_id, "assistant", assembled),
            )
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
