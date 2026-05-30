import { useState, useRef, useEffect, useCallback } from "react";
import {
  useListOpenaiConversations,
  getListOpenaiConversationsQueryKey,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  getGetOpenaiConversationQueryKey,
  useDeleteOpenaiConversation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Send, Plus, Trash2, MessageSquare, ChevronRight, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What is ransomware and how can I protect against it?",
  "Which antivirus should I use for Windows in 2025?",
  "How do I know if my computer has been hacked?",
  "What is a zero-day vulnerability?",
  "How does phishing work and how do I avoid it?",
  "Should I use a VPN? Which one is best?",
  "What is multi-factor authentication and why do I need it?",
  "How do I create strong, secure passwords?",
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-bold text-primary mt-4 mb-1 font-mono">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-primary mt-4 mb-1 font-mono">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-primary mt-4 mb-2 font-mono">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-none space-y-1 my-2">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1 shrink-0" style={{ textShadow: "0 0 6px hsl(205 100% 55%)" }}>›</span>
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1 my-2 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm">
              <span className="text-primary font-mono shrink-0 w-5">{j + 1}.</span>
              <span>{formatInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (line.startsWith("```")) {
      const lang = line.slice(3);
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-black/40 border border-primary/20 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-primary/90"
          style={{ boxShadow: "inset 0 0 20px hsl(205 100% 55% / 0.04)" }}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
    } else if (line.trim() === "") {
      if (elements.length > 0) {
        elements.push(<div key={`gap-${i}`} className="h-1" />);
      }
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{formatInline(line)}</p>);
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="px-1 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono border border-primary/20">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-foreground/90">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function Chat() {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations, isLoading: isLoadingConvs } = useListOpenaiConversations({
    query: { queryKey: getListOpenaiConversationsQueryKey() },
  });

  const { data: activeConv } = useGetOpenaiConversation(
    activeConvId ?? 0,
    { query: { enabled: activeConvId !== null, queryKey: getGetOpenaiConversationQueryKey(activeConvId ?? 0) } }
  );

  const createConv = useCreateOpenaiConversation({
    mutation: {
      onSuccess: (conv) => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setActiveConvId(conv.id);
        setMessages([]);
      },
    },
  });

  const deleteConv = useDeleteOpenaiConversation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeConvId !== null) {
          setActiveConvId(null);
          setMessages([]);
        }
      },
    },
  });

  useEffect(() => {
    if (activeConv?.messages) {
      setMessages(activeConv.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewConversation = useCallback(() => {
    createConv.mutate({ body: { title: `Security Chat ${new Date().toLocaleDateString()}` } });
  }, [createConv]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await new Promise<{ id: number }>((resolve) => {
        createConv.mutate(
          { body: { title: content.slice(0, 40) + (content.length > 40 ? "…" : "") } },
          { onSuccess: (c) => { queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() }); resolve(c); } }
        );
      });
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", isStreaming: true }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/openai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                setMessages(prev => prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, isStreaming: false } : m
                ));
                queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(convId) });
              } else if (data.content) {
                accumulated += data.content;
                const snap = accumulated;
                setMessages(prev => prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: snap, isStreaming: true } : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, content: "An error occurred. Please try again.", isStreaming: false } : m
      ));
    } finally {
      setIsSending(false);
    }
  }, [activeConvId, isSending, createConv, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-card/30">
        <div className="p-3 border-b border-border">
          <Button
            onClick={handleNewConversation}
            className="w-full gap-2 font-mono text-sm"
            size="sm"
            disabled={createConv.isPending}
            style={{ boxShadow: "0 0 12px hsl(205 100% 55% / 0.2)" }}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingConvs ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)
          ) : conversations && conversations.length > 0 ? (
            conversations.slice().reverse().map((conv) => (
              <div key={conv.id} className="group flex items-center gap-1">
                <button
                  onClick={() => {
                    setActiveConvId(conv.id);
                    queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conv.id) });
                  }}
                  className={`flex-1 text-left px-3 py-2 rounded-md text-xs font-mono truncate transition-all duration-150 flex items-center gap-2 ${
                    activeConvId === conv.id
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  style={activeConvId === conv.id ? { boxShadow: "0 0 0 1px hsl(205 100% 55% / 0.15)" } : {}}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </button>
                <button
                  onClick={() => deleteConv.mutate({ id: conv.id })}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground font-mono">
              No conversations yet
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto"
                style={{ boxShadow: "0 0 30px hsl(205 100% 55% / 0.2)" }}>
                <Shield className="w-8 h-8 text-primary" style={{ filter: "drop-shadow(0 0 8px hsl(205 100% 55%))" }} />
              </div>
              <h2 className="text-2xl font-bold font-mono">
                <span className="text-primary" style={{ textShadow: "0 0 12px hsl(205 100% 55% / 0.6)" }}>CyberAI</span> Advisor
              </h2>
              <p className="text-muted-foreground text-sm max-w-md">
                Ask any question about cybersecurity — threats, tools, best practices, or how to stay safe online.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-lg border border-border bg-card/50 hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 text-sm text-muted-foreground hover:text-foreground group"
                  style={{ boxShadow: "0 0 0 0 hsl(205 100% 55% / 0)" }}
                >
                  <span className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/50 group-hover:text-primary transition-colors" />
                    {q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === "user"
                    ? "bg-primary/20 border border-primary/30"
                    : "bg-card border border-border"
                }`}
                  style={msg.role === "user" ? { boxShadow: "0 0 10px hsl(205 100% 55% / 0.2)" } : {}}>
                  {msg.role === "user"
                    ? <User className="w-4 h-4 text-primary" />
                    : <Bot className="w-4 h-4 text-muted-foreground" />
                  }
                </div>

                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary/15 border border-primary/25 text-foreground"
                    : "bg-card border border-border"
                }`}
                  style={msg.role === "user" ? { boxShadow: "0 0 0 1px hsl(205 100% 55% / 0.15)" } : {}}>
                  {msg.isStreaming && msg.content === "" ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground font-mono">Analyzing...</span>
                    </div>
                  ) : (
                    <MarkdownText text={msg.content} />
                  )}
                  {msg.isStreaming && msg.content !== "" && (
                    <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse rounded-sm"
                      style={{ boxShadow: "0 0 4px hsl(205 100% 55%)" }} />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-border p-4 bg-background/50 backdrop-blur">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about cybersecurity..."
                rows={1}
                disabled={isSending}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 font-sans transition-colors overflow-hidden"
                style={{
                  minHeight: "48px",
                  maxHeight: "160px",
                  boxShadow: input ? "0 0 0 1px hsl(205 100% 55% / 0.2), 0 0 12px hsl(205 100% 55% / 0.08)" : undefined,
                }}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isSending}
              className="h-12 w-12 rounded-xl shrink-0"
              style={{ boxShadow: input.trim() ? "0 0 16px hsl(205 100% 55% / 0.3)" : undefined }}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-2 font-mono">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
