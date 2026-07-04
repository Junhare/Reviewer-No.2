import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ChatHistoryMessage } from "@/lib/agent-harness";

export type SessionMemory = {
  sessionId: string;
  summary: string;
  messages: Array<ChatHistoryMessage & { createdAt: string }>;
  projectMemory: {
    confirmedScope?: string;
    researchTopic?: string;
    selectedPapers?: string[];
    rejectedDirections?: string[];
  };
  userPreferences: {
    language?: string;
    citationStyle?: string;
    writingStyle?: string;
    interactionStyle?: string;
  };
  updatedAt: string;
};

const defaultUserPreferences = {
  language: "zh-CN",
  citationStyle: "APA",
  writingStyle: "academic, concise, evidence-first",
  interactionStyle: "ask clarifying questions before making irreversible research decisions",
};

export function loadSessionMemory(sessionId: string): SessionMemory {
  const existing = readJson<SessionMemory>(sessionPath(sessionId));
  if (existing) return existing;

  return {
    sessionId,
    summary: "",
    messages: [],
    projectMemory: {},
    userPreferences: defaultUserPreferences,
    updatedAt: new Date().toISOString(),
  };
}

export function saveSessionMemory(memory: SessionMemory) {
  const filePath = sessionPath(memory.sessionId);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(memory, null, 2), "utf8");
}

export function rememberRunTurn(sessionId: string, userMessage: string, assistantMessage: string) {
  const memory = loadSessionMemory(sessionId);
  const createdAt = new Date().toISOString();

  memory.messages.push({ role: "user", body: userMessage, createdAt });
  memory.messages.push({ role: "assistant", body: assistantMessage, createdAt });
  compactSessionMemory(memory);
  memory.updatedAt = createdAt;
  saveSessionMemory(memory);
}

export function buildMemoryContext(sessionId?: string) {
  if (!sessionId) {
    return {
      summary: "",
      projectMemory: {},
      userPreferences: defaultUserPreferences,
      persistedMessages: [] as ChatHistoryMessage[],
    };
  }

  const memory = loadSessionMemory(sessionId);
  return {
    summary: memory.summary,
    projectMemory: memory.projectMemory,
    userPreferences: memory.userPreferences,
    persistedMessages: memory.messages.slice(-8).map(({ role, body }) => ({ role, body })),
  };
}

function compactSessionMemory(memory: SessionMemory) {
  if (memory.messages.length <= 24) return;

  const overflow = memory.messages.splice(0, memory.messages.length - 16);
  const compacted = overflow
    .map((message) => `${message.role}: ${message.body}`)
    .join("\n")
    .slice(-3000);

  memory.summary = [memory.summary, compacted].filter(Boolean).join("\n\n").slice(-5000);
}

function sessionPath(sessionId: string) {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const runtimeRoot = process.env.VERCEL ? path.join("/tmp", "researchflow-agent") : process.cwd();
  return path.join(runtimeRoot, "sample-project", "memory", "sessions", `${safeSessionId}.json`);
}

function readJson<T>(filePath: string) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}
