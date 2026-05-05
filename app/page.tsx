"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const getSourceLabel = (source: string) =>
  source
    .replace("https://en.wikipedia.org/wiki/", "")
    .replaceAll("_", " ");

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#f3efe3] text-[#1c1b18]">
      <div className="pointer-events-none absolute inset-0">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="grain-overlay" />
      </div>

      <div className="relative z-10 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-[#1c1b18]/10 bg-[#fffaf0]/75 p-4 shadow-[0_10px_35px_rgba(28,27,24,0.12)] backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="inline-flex items-center rounded-full border border-[#1c1b18]/20 bg-[#fffaf0] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#6f6758]">
                Knowledge Companion
              </p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                RAG Chat Studio
              </h1>
              <p className="max-w-2xl text-sm text-[#5a5448] sm:text-base">
                Explore AI, IoT, Blockchain, and Cybersecurity with sourced answers from your vector knowledge base.
              </p>
            </div>
            <div className="rounded-xl border border-[#1c1b18]/15 bg-white/80 px-4 py-3 text-right shadow-sm">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#867c6d]">Mode</p>
              <p className="text-sm font-semibold text-[#2e2a23]">Hugging Face + Gemini</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6 pt-2 sm:px-6">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          {messages.length === 0 && (
            <div className="surface-pop flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-[#1c1b18]/15 bg-[#fffaf0]/85 p-8 text-center shadow-[0_18px_50px_rgba(28,27,24,0.12)] backdrop-blur-sm">
              <div className="mb-4 rounded-2xl border border-[#1c1b18]/15 bg-white/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[#7c715f]">
                Start a conversation
              </div>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Ask anything</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#635c4f] sm:text-base">
                Try prompts like &ldquo;What is blockchain in simple terms?&rdquo; or &ldquo;How does IoT security differ from traditional network security?&rdquo;
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className="message-appear flex gap-4" style={{ animationDelay: `${index * 40}ms` }}>
              {message.role === "user" ? (
                <>
                  <div className="flex-1" />
                  <div className="max-w-3xl rounded-2xl border border-[#df7a27]/40 bg-gradient-to-br from-[#ee9f4f] to-[#db6a36] px-4 py-3 text-[#2b1808] shadow-[0_14px_30px_rgba(219,106,54,0.35)] sm:px-5 sm:py-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#5e3113]">You</p>
                    <p className="mt-1 text-sm leading-relaxed sm:text-base">{message.content}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="max-w-3xl flex-1">
                    <div className="rounded-2xl border border-[#1c1b18]/15 bg-[#fffaf0]/95 px-4 py-3 shadow-[0_12px_30px_rgba(28,27,24,0.12)] sm:px-5 sm:py-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#7e7466]">Assistant</p>
                      <p className="mt-1 text-sm leading-relaxed text-[#2b2822] sm:text-base">{message.content}</p>
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[#1c1b18]/10 bg-white/75 p-3 text-xs text-[#5f5749]">
                        <p className="font-mono uppercase tracking-[0.12em] text-[#7f7464]">Sources</p>
                        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {message.sources.map((source, idx) => (
                            <li key={idx} className="truncate rounded-md border border-[#1c1b18]/10 bg-[#fffaf0] px-2.5 py-1.5">
                              {getSourceLabel(source)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-4">
              <div className="max-w-3xl flex-1">
                <div className="rounded-2xl border border-[#1c1b18]/15 bg-[#fffaf0]/95 px-4 py-4 shadow-[0_12px_30px_rgba(28,27,24,0.12)] sm:px-5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ea8f45]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#df6f3c] [animation-delay:120ms]" />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ba5d43] [animation-delay:240ms]" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="h-2 w-3/4 animate-pulse rounded bg-[#e2d8c4]" />
                    <div className="h-2 w-full animate-pulse rounded bg-[#e2d8c4] [animation-delay:120ms]" />
                    <div className="h-2 w-2/3 animate-pulse rounded bg-[#e2d8c4] [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="relative z-10 px-4 pb-4 sm:px-6 sm:pb-6">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl rounded-2xl border border-[#1c1b18]/10 bg-[#fffaf0]/85 p-3 shadow-[0_14px_40px_rgba(28,27,24,0.15)] backdrop-blur-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about AI, IoT, Blockchain, or Cybersecurity..."
              disabled={loading}
              className="flex-1 rounded-xl border border-[#1c1b18]/15 bg-white px-4 py-3 text-sm text-[#22201c] placeholder:text-[#8d846f] outline-none transition-all focus:border-[#d56a3a] focus:ring-2 focus:ring-[#d56a3a]/20 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-gradient-to-r from-[#ea8f45] to-[#cf5d3d] px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[#2b1308] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 sm:text-base"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
