import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RunSnapshot } from "@/lib/agent-harness";

export type ProjectStatus = "active" | "completed" | "archived";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  createdAt: string;
};

export type StoredProject = {
  id: string;
  ownerId: string;
  title: string;
  topic: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoredRun = {
  id: string;
  ownerId: string;
  projectId: string;
  topic: string;
  status: RunSnapshot["status"];
  currentStatus: string;
  snapshot: RunSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "agent";
  agent?: string;
  body: string;
  logs?: string[];
  reasoningSummary?: string;
  toolTraces?: RunSnapshot["toolTraces"];
  quickActions?: NonNullable<RunSnapshot["result"]>["quickActions"];
  artifact?: NonNullable<RunSnapshot["result"]>["artifact"];
  createdAt: string;
};

export type StoredConversation = {
  id: string;
  ownerId: string;
  projectId?: string;
  title: string;
  messages: StoredChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type StoredArtifact = {
  id: string;
  ownerId: string;
  projectId: string;
  runId?: string;
  kind:
    | "research_brief"
    | "paper_pool"
    | "evidence_pack"
    | "gap_analysis"
    | "paper_blueprint"
    | "review_notes"
    | "revision_log";
  fileName: string;
  content: string;
  version: number;
  createdAt: string;
};

const runArtifactFiles = [
  "research-brief.json",
  "paper-pool.json",
  "evidence-pack.json",
  "gap-analysis.json",
  "paper-blueprint.md",
  "review-notes.json",
  "revision-log.json",
] as const;

type RunArtifactFile = (typeof runArtifactFiles)[number];

type ProductStore = {
  users: StoredUser[];
  projects: StoredProject[];
  runs: StoredRun[];
  artifacts: StoredArtifact[];
  conversations?: StoredConversation[];
};

const runtimeRoot = process.env.VERCEL ? path.join("/tmp", "researchflow-agent") : process.cwd();
const storePath = path.join(runtimeRoot, ".data", "researchflow-store.json");
const defaultUserEmail = "local@researchflow.dev";

export function getOrCreateDefaultUser() {
  const existing = findUserByEmail(defaultUserEmail);
  if (existing) return existing;

  return createUser({
    email: defaultUserEmail,
    name: "Local Researcher",
  });
}

export function createUser(input: { email: string; name?: string; passwordHash?: string }) {
  const store = readStore();
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = store.users.find((user) => user.email === normalizedEmail);
  if (existing) return existing;

  const user: StoredUser = {
    id: createId("user"),
    email: normalizedEmail,
    name: input.name?.trim() || normalizedEmail.split("@")[0] || "Researcher",
    passwordHash: input.passwordHash,
    createdAt: now(),
  };

  store.users.push(user);
  writeStore(store);
  return user;
}

export function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return readStore().users.find((user) => user.email === normalizedEmail) ?? null;
}

export function findUserById(userId: string) {
  return readStore().users.find((user) => user.id === userId) ?? null;
}

export function listProjects(ownerId: string) {
  return readStore()
    .projects.filter((project) => project.ownerId === ownerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getProject(ownerId: string, projectId: string) {
  return readStore().projects.find((project) => project.ownerId === ownerId && project.id === projectId) ?? null;
}

export function createProject(ownerId: string, input: { title?: string; topic: string }) {
  const store = readStore();
  const project: StoredProject = {
    id: createId("project"),
    ownerId,
    title: input.title?.trim() || summarizeTitle(input.topic),
    topic: input.topic.trim(),
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };

  store.projects.push(project);
  writeStore(store);
  return project;
}

export function updateProject(ownerId: string, projectId: string, input: { title?: string; topic?: string }) {
  const store = readStore();
  const project = store.projects.find((item) => item.ownerId === ownerId && item.id === projectId);
  if (!project) return null;

  if (input.title?.trim()) project.title = input.title.trim();
  if (input.topic?.trim()) project.topic = input.topic.trim();
  project.updatedAt = now();
  writeStore(store);
  return project;
}

export function deleteProject(ownerId: string, projectId: string) {
  const store = readStore();
  const project = store.projects.find((item) => item.ownerId === ownerId && item.id === projectId);
  if (!project) return false;

  const runIds = new Set(store.runs.filter((run) => run.ownerId === ownerId && run.projectId === projectId).map((run) => run.id));
  store.projects = store.projects.filter((item) => !(item.ownerId === ownerId && item.id === projectId));
  store.runs = store.runs.filter((run) => !(run.ownerId === ownerId && run.projectId === projectId));
  store.artifacts = store.artifacts.filter(
    (artifact) => !(artifact.ownerId === ownerId && (artifact.projectId === projectId || (artifact.runId && runIds.has(artifact.runId)))),
  );
  store.conversations = getConversations(store).filter(
    (conversation) => !(conversation.ownerId === ownerId && conversation.projectId === projectId),
  );
  writeStore(store);
  return true;
}

export function listConversations(ownerId: string) {
  return getConversations(readStore())
    .filter((conversation) => conversation.ownerId === ownerId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getConversation(ownerId: string, conversationId: string) {
  return (
    getConversations(readStore()).find(
      (conversation) => conversation.ownerId === ownerId && conversation.id === conversationId,
    ) ?? null
  );
}

export function createConversation(
  ownerId: string,
  input?: { projectId?: string; title?: string; messages?: StoredChatMessage[] },
) {
  const store = readStore();
  const timestamp = now();
  const conversation: StoredConversation = {
    id: createId("chat"),
    ownerId,
    projectId: input?.projectId,
    title: input?.title?.trim() || "New chat",
    messages: input?.messages ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  getConversations(store).push(conversation);
  writeStore(store);
  return conversation;
}

export function updateConversation(
  ownerId: string,
  conversationId: string,
  input: { title?: string; projectId?: string | null; messages?: StoredChatMessage[] },
) {
  const store = readStore();
  const conversation = getConversations(store).find(
    (item) => item.ownerId === ownerId && item.id === conversationId,
  );
  if (!conversation) return null;

  if (input.title?.trim()) conversation.title = input.title.trim();
  if (input.projectId !== undefined) {
    if (input.projectId) conversation.projectId = input.projectId;
    else delete conversation.projectId;
  }
  if (input.messages) conversation.messages = input.messages;
  conversation.updatedAt = now();
  writeStore(store);
  return conversation;
}

export function deleteConversation(ownerId: string, conversationId: string) {
  const store = readStore();
  const before = getConversations(store).length;
  store.conversations = getConversations(store).filter(
    (conversation) => !(conversation.ownerId === ownerId && conversation.id === conversationId),
  );
  if (store.conversations.length === before) return false;
  writeStore(store);
  return true;
}

export function getOrCreateInboxProject(ownerId: string, topic: string) {
  const store = readStore();
  const existing = store.projects.find((project) => project.ownerId === ownerId && project.title === "Research inbox");
  if (existing) return existing;

  const project: StoredProject = {
    id: createId("project"),
    ownerId,
    title: "Research inbox",
    topic: topic.trim() || "Unsorted research requests",
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };

  store.projects.push(project);
  writeStore(store);
  return project;
}

export function upsertRunSnapshot(ownerId: string, projectId: string, topic: string, snapshot: RunSnapshot) {
  const store = readStore();
  const updatedAt = now();
  const existing = store.runs.find((run) => run.id === snapshot.id);

  if (existing) {
    existing.status = snapshot.status;
    existing.currentStatus = snapshot.currentStatus;
    existing.snapshot = snapshot;
    existing.updatedAt = updatedAt;
  } else {
    store.runs.push({
      id: snapshot.id,
      ownerId,
      projectId,
      topic,
      status: snapshot.status,
      currentStatus: snapshot.currentStatus,
      snapshot,
      createdAt: updatedAt,
      updatedAt,
    });
  }

  const project = store.projects.find((item) => item.id === projectId && item.ownerId === ownerId);
  if (project) project.updatedAt = updatedAt;

  if (snapshot.status === "completed" || snapshot.result?.artifact) {
    for (const fileName of runArtifactFiles) {
      const content =
        readRunArtifact(snapshot.id, fileName) ??
        (fileName === snapshot.result?.artifact?.file ? snapshot.result.artifact.summary : null);
      if (!content) continue;

      const kind = artifactKindFromFile(fileName);
      const existingArtifacts = store.artifacts.filter(
        (artifact) =>
          artifact.ownerId === ownerId &&
          artifact.projectId === projectId &&
          artifact.runId === snapshot.id &&
          artifact.kind === kind,
      );
      const latestArtifact = existingArtifacts.at(-1);
      if (latestArtifact?.content === content) continue;

      store.artifacts.push({
        id: createId("artifact"),
        ownerId,
        projectId,
        runId: snapshot.id,
        kind,
        fileName,
        version: existingArtifacts.length + 1,
        content,
        createdAt: updatedAt,
      });
    }
  }

  writeStore(store);
}

export function getStoredRun(ownerId: string, runId: string) {
  return readStore().runs.find((run) => run.ownerId === ownerId && run.id === runId) ?? null;
}

export function getRunOwnerContext(runId: string) {
  const run = readStore().runs.find((item) => item.id === runId);
  return run ? { ownerId: run.ownerId, projectId: run.projectId, topic: run.topic } : null;
}

export function listProjectRuns(ownerId: string, projectId: string) {
  return readStore()
    .runs.filter((run) => run.ownerId === ownerId && run.projectId === projectId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listProjectArtifacts(ownerId: string, projectId: string) {
  return readStore()
    .artifacts.filter((artifact) => artifact.ownerId === ownerId && artifact.projectId === projectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getArtifact(ownerId: string, artifactId: string) {
  return readStore().artifacts.find((artifact) => artifact.ownerId === ownerId && artifact.id === artifactId) ?? null;
}

function readStore(): ProductStore {
  ensureStore();
  const store = JSON.parse(readFileSync(storePath, "utf8")) as ProductStore;
  getConversations(store);
  return store;
}

function writeStore(store: ProductStore) {
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function ensureStore() {
  if (existsSync(storePath)) return;
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeStore({ users: [], projects: [], runs: [], artifacts: [], conversations: [] });
}

function getConversations(store: ProductStore) {
  store.conversations ??= [];
  return store.conversations;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function summarizeTitle(topic: string) {
  const compact = topic.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}...` : compact || "Untitled research project";
}

function artifactKindFromFile(fileName: RunArtifactFile): StoredArtifact["kind"] {
  const map: Record<RunArtifactFile, StoredArtifact["kind"]> = {
    "research-brief.json": "research_brief",
    "paper-pool.json": "paper_pool",
    "evidence-pack.json": "evidence_pack",
    "gap-analysis.json": "gap_analysis",
    "paper-blueprint.md": "paper_blueprint",
    "review-notes.json": "review_notes",
    "revision-log.json": "revision_log",
  };
  return map[fileName];
}

function readRunArtifact(runId: string, fileName: string) {
  const filePath = fileName.endsWith(".json")
    ? path.join(runtimeRoot, "sample-project", "runs", runId, "internal", fileName)
    : path.join(runtimeRoot, "sample-project", "runs", runId, fileName);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
}
