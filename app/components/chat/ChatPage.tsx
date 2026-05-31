"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus } from "@/lib/schemas";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { Textarea } from "@/app/components/ui/Textarea";
import { Card } from "@/app/components/ui/Card";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPage({ initial }: { initial: ClusterStatus }) {
  const [status, setStatus] = useState<ClusterStatus>(initial);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive available instances (workloads with host + port)
  const instances = status.solo_entries
    .filter((w) => w.host && w.meta.port)
    .map((w) => ({
      value: w.cluster_id,
      label: w.meta.recipe ?? w.cluster_id,
      description: `${w.host}:${w.meta.port}`,
    }));

  const hasInstances = instances.length > 0;

  // Live status updates
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const iter = await rpc.status.stream({ intervalMs: 5000 }, { signal: ac.signal });
        for await (const next of iter) {
          if (cancelled) break;
          setStatus(next);
        }
      } catch {
        // silent on abort
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear chat on instance switch
  useEffect(() => {
    setMessages([]);
  }, [selectedClusterId]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedClusterId || isStreaming) return;

    const userMsg: Message = { role: "user", content: inputText.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsStreaming(true);

    // Create placeholder for assistant response
    const assistantIdx = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const ac = new AbortController();

    try {
      const iter = await rpc.chat.stream(
        {
          clusterId: selectedClusterId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        },
        { signal: ac.signal },
      );

      let accumulated = "";
      for await (const token of iter) {
        accumulated += token;
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: accumulated };
          return next;
        });
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const msg = err instanceof Error ? err.message : "Stream failed";
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: "assistant", content: `Error: ${msg}` };
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedInstance = instances.find((i) => i.value === selectedClusterId);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Instance selector bar */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedClusterId}
          onValueChange={setSelectedClusterId}
          options={instances}
          placeholder="Select an instance..."
          className="w-72"
          disabled={!hasInstances}
        />
        {selectedClusterId && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            New Chat
          </Button>
        )}
        {selectedInstance && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedInstance.label}
          </span>
        )}
      </div>

      {/* Message area */}
      {hasInstances ? (
        <Card className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {!selectedClusterId ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Select an instance above to start chatting.
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                Send a message to start the conversation.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-sky-600 text-white"
                          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {msg.role === "assistant" && (
                          <Bot size={16} className="mt-0.5 shrink-0" />
                        )}
                        <span className="whitespace-pre-wrap break-words text-sm">
                          {msg.content ||
                            (isStreaming && i === messages.length - 1 ? (
                              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-current opacity-60" />
                            ) : null)}
                        </span>
                        {msg.role === "user" && (
                          <User size={16} className="mt-0.5 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-center p-8 text-sm text-zinc-500">
            No running instances available. Launch a recipe from the{" "}
            <a href="/launch" className="text-sky-600 underline dark:text-sky-400">
              Launch page
            </a>{" "}
            first.
          </div>
        </Card>
      )}

      {/* Input area */}
      {hasInstances && selectedClusterId && (
        <div className="flex items-end gap-2">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={3}
            className="flex-1"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim() || isStreaming}
            className="shrink-0"
          >
            <Send size={16} />
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
