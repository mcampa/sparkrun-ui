"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, Loader2, MessageSquarePlus, Sparkles, Square } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus } from "@/lib/schemas";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { useWorkloadHealth } from "@/app/components/useWorkloadHealth";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPage({
  initial,
  initialClusterId,
}: {
  initial: ClusterStatus;
  initialClusterId?: string;
}) {
  const [status, setStatus] = useState<ClusterStatus>(initial);
  const [explicitClusterId, setExplicitClusterId] = useState<string | null>(
    initialClusterId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const instances = useMemo(
    () =>
      status.solo_entries
        .filter((w) => w.host && w.meta.port)
        .map((w) => ({
          value: w.cluster_id,
          label: w.meta.model ?? w.cluster_id,
          description: w.cluster_id,
        })),
    [status.solo_entries],
  );

  const hasInstances = instances.length > 0;
  const selectedClusterId =
    explicitClusterId && instances.some((i) => i.value === explicitClusterId)
      ? explicitClusterId
      : (instances[0]?.value ?? null);
  const selectedInstance = instances.find((i) => i.value === selectedClusterId) ?? null;
  const health = useWorkloadHealth(selectedClusterId);
  const isReady = health.ready;
  const hasConversation = messages.length > 0;

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

  // Auto-scroll the window when new content arrives, but only if the user is
  // already near the bottom — otherwise reading older messages while a long
  // response streams in would yank them back down. Standard ChatGPT pattern.
  useEffect(() => {
    if (!hasConversation) return;
    const distanceFromBottom =
      document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    if (distanceFromBottom < 120) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, hasConversation]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputText]);

  const handleClusterChange = (clusterId: string) => {
    if (clusterId === selectedClusterId) return;
    setMessages([]);
    setExplicitClusterId(clusterId);
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInputText("");
    inputRef.current?.focus();
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedClusterId || isStreaming || !isReady) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText("");
    setIsStreaming(true);

    const assistantIdx = newMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const ac = new AbortController();
    abortRef.current = ac;

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
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasInstances) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              No running instances
            </h2>
            <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Launch a recipe to start chatting with a model running on your DGX Spark cluster.
            </p>
          </div>
          <a
            href="/launch"
            className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
          >
            Launch a recipe
          </a>
        </div>
      </div>
    );
  }

  const composer = (
    <div className="w-full">
      <div className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-zinc-300 focus-within:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:focus-within:border-zinc-700">
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedInstance
              ? `Message ${selectedInstance.label}…`
              : "Select an instance to start chatting"
          }
          rows={1}
          disabled={!selectedClusterId}
          className="max-h-[200px] w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 pb-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Select
              value={selectedClusterId}
              onValueChange={handleClusterChange}
              options={instances}
              placeholder="Select an instance…"
              className="h-8 max-w-[18rem] border-transparent bg-transparent shadow-none hover:bg-zinc-100 dark:border-transparent dark:bg-transparent dark:hover:bg-zinc-800"
            />
            {selectedClusterId && <HealthPill health={health} />}
          </div>
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop generation"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || !selectedClusterId || !isReady}
              aria-label={isReady ? "Send message" : "Instance not ready yet"}
              title={isReady ? undefined : (health.reason ?? "Instance is still starting…")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        Press Enter to send, Shift + Enter for a new line
      </p>
    </div>
  );

  if (!hasConversation) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-2xl flex-col items-center justify-center gap-8 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm">
            <Sparkles size={22} />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            What can I help with?
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Chat with any running model on your cluster.
          </p>
        </div>
        {composer}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-3xl flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="min-w-0 flex-1">
          <Select
            value={selectedClusterId}
            onValueChange={handleClusterChange}
            options={instances}
            placeholder="Select an instance…"
            className="h-8 max-w-[20rem]"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={handleNewChat}>
          <MessageSquarePlus size={14} />
          New chat
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-6 pb-4">
        {messages.map((msg, i) => (
          <MessageRow
            key={i}
            message={msg}
            isStreamingTail={isStreaming && i === messages.length - 1 && !msg.content}
          />
        ))}
        {/* Anchor for auto-scroll. scroll-mb leaves room above the sticky
            composer so the last message stays fully visible. */}
        <div ref={messagesEndRef} className="scroll-mb-40" />
      </div>

      <div className="sticky bottom-0 -mx-2 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent px-2 pt-6 pb-2 dark:from-zinc-950 dark:via-zinc-950/95">
        {composer}
      </div>
    </div>
  );
}

function MessageRow({ message, isStreamingTail }: { message: Message; isStreamingTail: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-sky-600 px-4 py-2.5 text-sm text-white shadow-sm dark:bg-sky-500">
          <div className="break-words whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
        <Bot size={14} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100">
        {isStreamingTail ? (
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s] dark:bg-zinc-500" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s] dark:bg-zinc-500" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" />
          </span>
        ) : (
          <div className="break-words whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
    </div>
  );
}

function HealthPill({ health }: { health: ReturnType<typeof useWorkloadHealth> }) {
  if (health.ready) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Ready
      </span>
    );
  }
  if (health.state === "loading" || health.state === "starting") {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        title={health.state === "starting" ? (health.reason ?? "Model is still loading.") : ""}
      >
        <Loader2 size={10} className="animate-spin" />
        Starting…
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
      title={health.reason ?? "Instance is unreachable."}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Unreachable
    </span>
  );
}
