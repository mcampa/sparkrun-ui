"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, MessageSquarePlus, Sparkles, Square } from "lucide-react";
import { rpc } from "@/lib/rpc/client";
import type { ClusterStatus } from "@/lib/schemas";
import { Select } from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";

type Message = { role: "user" | "assistant"; content: string };

export function ChatPage({ initial }: { initial: ClusterStatus }) {
  const [status, setStatus] = useState<ClusterStatus>(initial);
  const [explicitClusterId, setExplicitClusterId] = useState<string | null>(null);
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

  useEffect(() => {
    if (hasConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (!text || !selectedClusterId || isStreaming) return;

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
          <div className="min-w-0 flex-1">
            <Select
              value={selectedClusterId}
              onValueChange={handleClusterChange}
              options={instances}
              placeholder="Select an instance…"
              className="h-8 max-w-[18rem] border-transparent bg-transparent shadow-none hover:bg-zinc-100 dark:border-transparent dark:bg-transparent dark:hover:bg-zinc-800"
            />
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
              disabled={!inputText.trim() || !selectedClusterId}
              aria-label="Send message"
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
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-3xl flex-col">
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

      <div className="-mx-2 flex-1 overflow-y-auto px-2">
        <div className="flex flex-col gap-6 py-4">
          {messages.map((msg, i) => (
            <MessageRow
              key={i}
              message={msg}
              isStreamingTail={isStreaming && i === messages.length - 1 && !msg.content}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="pt-3 pb-2">{composer}</div>
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
