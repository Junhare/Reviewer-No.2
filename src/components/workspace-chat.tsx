"use client";

import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Download, FileText, FolderPlus, History, Loader2, LogIn, LogOut, MoreHorizontal, Pencil, Search, Send, Trash2, User } from "lucide-react";

type MessageArtifact = { file: string; href: string; summary: string; content?: string };

type Message = {
  id: string;
  role: "user" | "agent";
  agent?: string;
  body: string;
  logs?: string[];
  reasoningSummary?: string;
  toolTraces?: ToolTrace[];
  quickActions?: QuickAction[];
  pending?: boolean;
  artifact?: MessageArtifact;
};

type QuickAction = { label: string; value: string };
type ToolTrace = { tool: string; query: string; status: "completed" | "failed" | "skipped"; summary: string };
type RunEvent = { id: string; actor: string; type: "decision" | "agent_step" | "tool_call" | "reasoning" | "memory"; message: string; createdAt: string };
type RunStep = { agent: string; skill: string; statusText: string; output: string; summary: string };
type RunSnapshot = {
  id: string;
  status: "running" | "waiting_for_user" | "completed" | "failed";
  currentStatus: string;
  elapsedSeconds: number;
  progress: { current: number; total: number };
  activeStep?: RunStep;
  completedSteps: RunStep[];
  events: RunEvent[];
  reasoningSummary?: string;
  toolTraces: ToolTrace[];
  requiresUserInput?: boolean;
  question?: string;
  result?: {
    title: string;
    logs: string[];
    quickActions?: QuickAction[];
    artifact?: MessageArtifact;
  };
};

type ProjectSummary = { id: string; title: string; topic: string; status: string; updatedAt: string };
type ConversationSummary = {
  id: string;
  projectId?: string;
  title: string;
  messages: Message[];
  updatedAt: string;
};
type AccountUser = { id: string; email: string; name: string };
type WorkspaceCache = {
  projects: ProjectSummary[];
  conversations: ConversationSummary[];
  activeProjectId: string | null;
  activeConversationId: string | null;
};
type RouterDecision = { intent: string; route: "conversation" | "researchflow" | "resume_pending" | "task_control"; confidence: number; reply: string; reason: string };
type SidebarMenuTarget = { type: "project" | "chat"; id: string } | null;

export function WorkspaceChat() {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authError, setAuthError] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progressLog, setProgressLog] = useState("Ready");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [sidebarMenu, setSidebarMenu] = useState<SidebarMenuTarget>(null);

  const tabSessionRef = useRef(createEphemeralSessionId());
  const messageCounter = useRef(0);
  const messageStreamRef = useRef<HTMLDivElement | null>(null);
  const conversationsRef = useRef<ConversationSummary[]>([]);
  const activeConversationIdRef = useRef<string | null>(null);
  const persistTimersRef = useRef<Map<string, number>>(new Map());

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const currentProjectId = activeConversation?.projectId ?? activeProjectId;
  const currentSessionId = useMemo(() => {
    if (currentProjectId) return `project-${currentProjectId}`;
    if (activeConversationId) return `conversation-${activeConversationId}`;
    return tabSessionRef.current;
  }, [activeConversationId, currentProjectId]);
  const currentAgent = isRunning ? progressLog : pendingRunId ? "Waiting for clarification" : "Ready";
  const visibleProjects = filterByQuery(projects, sidebarQuery, (project) => `${project.title} ${project.topic}`);
  const visibleConversations = filterByQuery(
    conversations.filter((conversation) => !conversation.projectId),
    sidebarQuery,
    (conversation) => conversation.title,
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (cancelled) return;
        if (response.ok) {
          const data = (await response.json()) as { user: AccountUser | null };
          const sessionUser = data.user ?? readCachedAccount();
          if (sessionUser) {
            setAccount(sessionUser);
            writeCachedAccount(sessionUser);
          }
        } else {
          const sessionUser = readCachedAccount();
          if (sessionUser) setAccount(sessionUser);
        }
      } catch {
        if (cancelled) return;
        const sessionUser = readCachedAccount();
        if (sessionUser) setAccount(sessionUser);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function closeSidebarMenu() {
      setSidebarMenu(null);
    }

    window.addEventListener("click", closeSidebarMenu);
    return () => window.removeEventListener("click", closeSidebarMenu);
  }, []);

  function resetWorkspaceState() {
    for (const timer of persistTimersRef.current.values()) window.clearTimeout(timer);
    persistTimersRef.current.clear();
    conversationsRef.current = [];
    activeConversationIdRef.current = null;
    setProjects([]);
    setConversations([]);
    setActiveProjectId(null);
    setActiveConversationId(null);
    setMessages([]);
    setPendingRunId(null);
    setSidebarMenu(null);
    setSidebarQuery("");
    setInput("");
    setIsRunning(false);
    setProgressLog("Ready");
  }

  function applyWorkspaceCache(cache: WorkspaceCache) {
    conversationsRef.current = cache.conversations;
    activeConversationIdRef.current = cache.activeConversationId;
    setProjects(cache.projects);
    setConversations(cache.conversations);
    setActiveProjectId(cache.activeProjectId);
    setActiveConversationId(cache.activeConversationId);
    const active = cache.conversations.find((conversation) => conversation.id === cache.activeConversationId) ?? null;
    setMessages(active?.messages ?? []);
  }

  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;
    async function loadData() {
      if (!account) {
        resetWorkspaceState();
        return;
      }
      const cachedWorkspace = readWorkspaceCache(account.id);
      if (cachedWorkspace) applyWorkspaceCache(cachedWorkspace);

      const [projectResponse, conversationResponse] = await Promise.all([
        fetch("/api/projects").catch(() => null),
        fetch("/api/conversations").catch(() => null),
      ]);
      if (cancelled) return;
      const serverProjects = projectResponse?.ok ? ((await projectResponse.json()) as { projects: ProjectSummary[] }).projects : null;
      const serverConversations = conversationResponse?.ok
        ? ((await conversationResponse.json()) as { conversations: ConversationSummary[] }).conversations
        : null;

      if (serverProjects && (serverProjects.length || !cachedWorkspace)) setProjects(serverProjects);
      if (serverConversations && (serverConversations.length || !cachedWorkspace)) {
        conversationsRef.current = serverConversations;
        setConversations(serverConversations);
        if (serverConversations[0]) {
          setActiveConversationId(serverConversations[0].id);
          setActiveProjectId(serverConversations[0].projectId ?? null);
          setMessages(serverConversations[0].messages);
        } else {
          setActiveConversationId(null);
          setActiveProjectId(null);
          setMessages([]);
        }
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [account, authChecked]);

  useEffect(() => {
    const stream = messageStreamRef.current;
    if (stream) stream.scrollTo({ top: stream.scrollHeight, behavior: "smooth" });
  }, [messages, isRunning, progressLog]);

  useEffect(() => {
    if (!account || !authChecked) return;
    writeWorkspaceCache(account.id, {
      projects,
      conversations,
      activeProjectId,
      activeConversationId,
    });
  }, [account, authChecked, projects, conversations, activeProjectId, activeConversationId]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: authEmail, name: authName, password: authPassword }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setAuthError(data?.error ?? "Authentication failed.");
      return;
    }
    const data = (await response.json()) as { user: AccountUser };
    setAuthPassword("");
    writeCachedAccount(data.user);
    setAccount(data.user);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCachedAccount();
    setAccount(null);
    resetWorkspaceState();
    setAuthError("");
    setAuthPassword("");
  }

  async function handleNewProject() {
    const topic = window.prompt("Project topic")?.trim();
    if (!topic) return;
    const title = window.prompt("Project title", summarizeConversationTitle(topic)) ?? undefined;
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, topic }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { project: ProjectSummary };
    setProjects((current) => [data.project, ...current]);
    setActiveProjectId(data.project.id);
    setActiveConversationId(null);
    setMessages([]);
  }

  async function handleNewChat(projectId?: string) {
    const title = window.prompt("Chat name", projectId ? "New project chat" : "New chat")?.trim();
    if (!title) return;
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, title, messages: [] }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { conversation: ConversationSummary };
    replaceConversations([data.conversation, ...conversationsRef.current]);
    setActiveConversationId(data.conversation.id);
    setActiveProjectId(projectId ?? null);
    setMessages([]);
  }

  function selectProject(project: ProjectSummary) {
    setSidebarMenu(null);
    setActiveProjectId(project.id);
    setActiveConversationId(null);
    setMessages([]);
  }

  function selectConversation(conversation: ConversationSummary) {
    setSidebarMenu(null);
    const latest = conversationsRef.current.find((item) => item.id === conversation.id) ?? conversation;
    setActiveConversationId(latest.id);
    setActiveProjectId(latest.projectId ?? null);
    setMessages(latest.messages);
  }

  async function renameProject(project: ProjectSummary) {
    setSidebarMenu(null);
    const title = window.prompt("Rename project", project.title)?.trim();
    if (!title || title === project.title) return;
    const previousProject = project;
    setProjects((current) => current.map((item) => (item.id === project.id ? { ...item, title, updatedAt: new Date().toISOString() } : item)));
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      setProjects((current) => current.map((item) => (item.id === previousProject.id ? previousProject : item)));
      return;
    }
    const data = (await response.json()) as { project: ProjectSummary };
    setProjects((current) => current.map((item) => (item.id === data.project.id ? data.project : item)));
  }

  async function deleteProjectFromSidebar(project: ProjectSummary) {
    setSidebarMenu(null);
    if (!window.confirm(`Delete project "${project.title}"? This also removes its project chats and runs.`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    replaceConversations(conversationsRef.current.filter((conversation) => conversation.projectId !== project.id));
    if (activeProjectId === project.id || activeConversation?.projectId === project.id) {
      setActiveProjectId(null);
      setActiveConversationId(null);
      setMessages([]);
    }
  }

  async function renameConversation(conversation: ConversationSummary) {
    setSidebarMenu(null);
    const title = window.prompt("Rename chat", conversation.title)?.trim();
    if (!title || title === conversation.title) return;
    const previousConversation = conversationsRef.current.find((item) => item.id === conversation.id) ?? conversation;
    clearConversationPersistTimer(conversation.id);
    replaceConversations(
      conversationsRef.current.map((item) =>
        item.id === conversation.id ? { ...item, title, updatedAt: new Date().toISOString() } : item,
      ),
    );
    const response = await fetch(`/api/conversations/${conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      replaceConversations(conversationsRef.current.map((item) => (item.id === previousConversation.id ? previousConversation : item)));
      return;
    }
    const data = (await response.json()) as { conversation: ConversationSummary };
    replaceConversations(conversationsRef.current.map((item) => (item.id === data.conversation.id ? { ...item, ...data.conversation } : item)));
    if (activeConversationId === data.conversation.id) setMessages(data.conversation.messages);
  }

  async function deleteConversationFromSidebar(conversation: ConversationSummary) {
    setSidebarMenu(null);
    if (!window.confirm(`Delete chat "${conversation.title}"?`)) return;
    const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    if (!response.ok) return;
    clearConversationPersistTimer(conversation.id);
    const remaining = conversationsRef.current.filter((item) => item.id !== conversation.id);
    replaceConversations(remaining);
    if (activeConversationId === conversation.id) {
      const fallback = remaining.find((item) => !item.projectId) ?? remaining[0] ?? null;
      setActiveConversationId(fallback?.id ?? null);
      setActiveProjectId(fallback?.projectId ?? null);
      setMessages(fallback?.messages ?? []);
    }
  }

  async function ensureConversationForSubmit() {
    if (activeConversationIdRef.current) return activeConversationIdRef.current;
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: activeProjectId ?? undefined, title: activeProjectId ? "New project chat" : "New chat", messages: [] }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { conversation: ConversationSummary };
    replaceConversations([data.conversation, ...conversationsRef.current]);
    setActiveConversationId(data.conversation.id);
    setActiveProjectId(data.conversation.projectId ?? null);
    setMessages([]);
    return data.conversation.id;
  }

  function replaceConversations(next: ConversationSummary[]) {
    conversationsRef.current = next;
    setConversations(next);
  }

  function clearConversationPersistTimer(conversationId: string) {
    const timer = persistTimersRef.current.get(conversationId);
    if (timer) window.clearTimeout(timer);
    persistTimersRef.current.delete(conversationId);
  }

  function updateConversationMessages(conversationId: string, updater: (messages: Message[]) => Message[]) {
    const target = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    if (!target) return;
    const updatedMessages = updater(target.messages);
    const updatedConversation = { ...target, messages: updatedMessages, updatedAt: new Date().toISOString() };
    replaceConversations(
      conversationsRef.current
        .map((conversation) => (conversation.id === conversationId ? updatedConversation : conversation))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
    if (activeConversationIdRef.current === conversationId) setMessages(updatedMessages);
    schedulePersistConversation(updatedConversation);
  }

  function schedulePersistConversation(conversation: ConversationSummary) {
    const existingTimer = persistTimersRef.current.get(conversation.id);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      persistTimersRef.current.delete(conversation.id);
      persistConversation(conversation.id, conversation.title, conversation.messages).then((updated) => {
        if (!updated) return;
        replaceConversations(
          conversationsRef.current
            .map((current) =>
              current.id === updated.id
                ? { ...current, ...updated, title: current.title !== conversation.title ? current.title : updated.title }
                : current,
            )
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
        );
        if (activeConversationIdRef.current === updated.id) setMessages(updated.messages);
      });
    }, 350);
    persistTimersRef.current.set(conversation.id, timer);
  }

  async function submitMessage(rawInput: string) {
    const trimmed = rawInput.trim();
    if (!trimmed || isRunning) return;

    messageCounter.current += 1;
    const userMessageId = `user-request-${messageCounter.current}`;
    const responseMessageId = `run-response-${messageCounter.current}`;
    const conversationId = await ensureConversationForSubmit();
    if (!conversationId) return;
    const baseMessages = conversationsRef.current.find((conversation) => conversation.id === conversationId)?.messages ?? messages;
    const history = baseMessages.map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      body: [message.body, ...(message.logs ?? [])].join("\n"),
    }));
    const routerDecision = await routeConversationWithLLM(trimmed, Boolean(pendingRunId), history);
    const isResume = Boolean(pendingRunId) && routerDecision.route === "resume_pending";

    updateConversationMessages(conversationId, (current) => [
      ...current,
      { id: userMessageId, role: "user", body: trimmed },
      { id: responseMessageId, role: "agent", agent: "ResearchFlow", body: "", logs: [`Router: ${routerDecision.reason}`], pending: true },
    ]);
    setInput("");
    setIsRunning(true);

    if (routerDecision.route === "conversation" || routerDecision.route === "task_control") {
      if (routerDecision.route === "task_control") setPendingRunId(null);
      setProgressLog("Conversation Router");
      await typeLocalReply(conversationId, responseMessageId, routerDecision.reply || "I will treat this as a normal conversation turn.");
      setIsRunning(false);
      setProgressLog("Ready");
      return;
    }

    try {
      setProgressLog(isResume ? "Resuming run" : "Starting run");
      const run = isResume
        ? await resumeExistingRun(pendingRunId as string, trimmed)
        : await createNewRun(history, currentSessionId, trimmed, currentProjectId);
      applyRunSnapshot(conversationId, run, responseMessageId);
      if (run.status === "running") pollRun(conversationId, run.id, responseMessageId);
      else settleRunState(run);
    } catch {
      setIsRunning(false);
      setProgressLog("Run failed");
      updateConversationMessages(conversationId, (current) =>
        current.map((message) =>
          message.id === responseMessageId
            ? { ...message, body: "Run failed. Check API routes and server environment variables.", pending: false }
            : message,
        ),
      );
    }
  }

  function applyRunSnapshot(conversationId: string, run: RunSnapshot, responseMessageId: string) {
    setProgressLog(run.currentStatus);
    updateConversationMessages(conversationId, (current) =>
      current.map((message) =>
        message.id === responseMessageId
          ? {
              ...message,
              body: run.question ?? run.result?.title ?? run.currentStatus,
              logs: run.result?.logs ?? formatRunEvents(run),
              reasoningSummary: run.reasoningSummary,
              toolTraces: run.toolTraces,
              quickActions: run.result?.quickActions,
              pending: run.status === "running",
              artifact: run.result?.artifact,
            }
          : message,
      ),
    );
  }

  function pollRun(conversationId: string, runId: string, responseMessageId: string) {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`);
        if (!response.ok) throw new Error("Failed to read run");
        const run = (await response.json()) as RunSnapshot;
        applyRunSnapshot(conversationId, run, responseMessageId);
        if (run.status !== "running") {
          window.clearInterval(interval);
          settleRunState(run);
        }
      } catch {
        window.clearInterval(interval);
        setIsRunning(false);
        setProgressLog("Run failed");
      }
    }, 650);
  }

  function settleRunState(run: RunSnapshot) {
    setIsRunning(false);
    if (run.status === "waiting_for_user") {
      setPendingRunId(run.id);
      setProgressLog("Waiting for clarification");
      return;
    }
    setPendingRunId(null);
    setProgressLog(run.status === "completed" ? "Paper Blueprint ready" : "Run failed");
  }

  async function typeLocalReply(conversationId: string, messageId: string, text: string) {
    for (const index of Array.from({ length: text.length }, (_, offset) => offset + 1)) {
      await new Promise((resolve) => window.setTimeout(resolve, 8));
      updateConversationMessages(conversationId, (current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, body: text.slice(0, index), pending: index < text.length } : message,
        ),
      );
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitMessage(input);
  }

  function handleArtifactDownload(event: MouseEvent<HTMLAnchorElement>, artifact: MessageArtifact) {
    if (!artifact.content) return;

    event.preventDefault();
    const blob = new Blob([artifact.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!authChecked) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand auth-brand">
            <span className="brand-mark">RF</span>
            <div>
              <strong>ResearchFlow Agent</strong>
              <span>Loading account</span>
            </div>
          </div>
          <p className="subtle">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand auth-brand">
            <span className="brand-mark">RF</span>
            <div>
              <strong>ResearchFlow Agent</strong>
              <span>Academic planning workspace</span>
            </div>
          </div>
          <h1>{authMode === "register" ? "Create an account" : "Sign in"}</h1>
          <p className="subtle">This lightweight gate keeps provider keys server-side while preserving separate local workspaces.</p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "register" ? (
              <label>
                Name
                <input onChange={(event) => setAuthName(event.target.value)} placeholder="Researcher" value={authName} />
              </label>
            ) : null}
            <label>
              Email
              <input onChange={(event) => setAuthEmail(event.target.value)} placeholder="researcher@example.com" type="email" value={authEmail} />
            </label>
            <label>
              Password
              <input onChange={(event) => setAuthPassword(event.target.value)} placeholder="8+ characters" type="password" value={authPassword} />
            </label>
            {authError ? <p className="auth-error">{authError}</p> : null}
            <button className="button primary" type="submit">
              <LogIn size={16} /> {authMode === "register" ? "Register" : "Sign in"}
            </button>
          </form>
          <button className="link-button" onClick={() => setAuthMode(authMode === "register" ? "login" : "register")} type="button">
            {authMode === "register" ? "Already have an account? Sign in" : "Need an account? Register"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="chat-shell">
      <aside className="chat-sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">RF</span>
          <div>
            <strong>ResearchFlow</strong>
            <span>AI research planning</span>
          </div>
        </div>
        <button className="sidebar-action" onClick={() => void handleNewChat()} type="button">
          <History size={16} /> New chat
        </button>
        <button className="sidebar-action ghost" onClick={() => void handleNewProject()} type="button">
          <FolderPlus size={16} /> New project
        </button>
        <label className="sidebar-search">
          <Search size={15} />
          <input onChange={(event) => setSidebarQuery(event.target.value)} placeholder="Search" value={sidebarQuery} />
        </label>
        <section className="sidebar-section">
          <div className="sidebar-heading">Projects</div>
          <div className="project-list">
            {visibleProjects.map((project) => (
              <div className={project.id === activeProjectId ? "sidebar-row has-actions active" : "sidebar-row has-actions"} key={project.id}>
                <button className="sidebar-row-main" onClick={() => selectProject(project)} type="button">
                  <span>{project.title}</span>
                </button>
                <a className="icon-button" href={`/projects/${project.id}`} title="Project page">
                  <FileText size={15} />
                </a>
                <button
                  aria-expanded={sidebarMenu?.type === "project" && sidebarMenu.id === project.id}
                  aria-label={`Open actions for ${project.title}`}
                  className="icon-button sidebar-more-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSidebarMenu((current) => (current?.type === "project" && current.id === project.id ? null : { type: "project", id: project.id }));
                  }}
                  type="button"
                >
                  <MoreHorizontal size={16} />
                </button>
                {sidebarMenu?.type === "project" && sidebarMenu.id === project.id ? (
                  <div className="sidebar-menu" onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => void renameProject(project)} type="button">
                      <Pencil size={15} /> Rename
                    </button>
                    <button className="danger" onClick={() => void deleteProjectFromSidebar(project)} type="button">
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!visibleProjects.length ? <p className="sidebar-empty">No projects yet.</p> : null}
          </div>
        </section>
        <section className="sidebar-section">
          <div className="sidebar-heading">Chats</div>
          <div className="project-list">
            {visibleConversations.map((conversation) => (
              <div className={conversation.id === activeConversationId ? "sidebar-row active" : "sidebar-row"} key={conversation.id}>
                <button className="sidebar-row-main" onClick={() => selectConversation(conversation)} type="button">
                  <span>{conversation.title}</span>
                </button>
                <button
                  aria-expanded={sidebarMenu?.type === "chat" && sidebarMenu.id === conversation.id}
                  aria-label={`Open actions for ${conversation.title}`}
                  className="icon-button sidebar-more-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSidebarMenu((current) => (current?.type === "chat" && current.id === conversation.id ? null : { type: "chat", id: conversation.id }));
                  }}
                  type="button"
                >
                  <MoreHorizontal size={16} />
                </button>
                {sidebarMenu?.type === "chat" && sidebarMenu.id === conversation.id ? (
                  <div className="sidebar-menu" onClick={(event) => event.stopPropagation()}>
                    <button onClick={() => void renameConversation(conversation)} type="button">
                      <Pencil size={15} /> Rename
                    </button>
                    <button className="danger" onClick={() => void deleteConversationFromSidebar(conversation)} type="button">
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!visibleConversations.length ? <p className="sidebar-empty">No chats yet.</p> : null}
          </div>
        </section>
        <div className="sidebar-footer">
          <User size={16} />
          <div className="account-meta">
            <strong>{account.name}</strong>
            <span>{account.email}</span>
          </div>
          <button aria-label="Sign out" className="icon-button" onClick={() => void handleLogout()} title="Sign out" type="button">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <div>
            <p className="eyebrow">{activeProject ? `Project / ${activeProject.title}` : "Chat workspace"}</p>
            <h1>{activeConversation?.title ?? activeProject?.title ?? "Research workspace"}</h1>
            <p>Enter a research idea. Orchestrator will route agents, call literature tools, and pause for confirmation at risky checkpoints.</p>
          </div>
          <div className="run-status">
            {isRunning ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
            <span>{currentAgent}</span>
          </div>
        </header>

        <div className="message-stream" ref={messageStreamRef}>
          {!messages.length ? (
            <article className="empty-state">
              <h2>Start with a vague research idea</h2>
              <p>ResearchFlow turns early research uncertainty into a traceable paper blueprint workflow.</p>
            </article>
          ) : null}
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              {message.role === "agent" ? (
                <div className="message-avatar agent-avatar">{message.pending ? <Loader2 className="spin" size={16} /> : <Bot size={16} />}</div>
              ) : null}
              <div className={message.pending ? "message-body transient" : "message-body"}>
                <div className="message-meta">
                  <strong>{message.role === "user" ? "You" : message.agent ?? "ResearchFlow"}</strong>
                  {message.pending ? <span>Running</span> : null}
                </div>
                {message.logs?.length ? <div className="message-logs">{message.logs.slice(-16).map((log, index) => <span key={`${message.id}-${index}`}>{log}</span>)}</div> : null}
                <p className="message-text">{message.body}</p>
                {message.toolTraces?.length ? (
                  <div className="tool-trace-list">
                    {message.toolTraces.map((trace, index) => (
                      <div className="tool-trace" key={`${trace.tool}-${index}`}>
                        <strong>{trace.tool} · {trace.status}</strong>
                        <span>{trace.query}</span>
                        <span>{trace.summary}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.reasoningSummary ? <details className="reasoning-panel"><summary>Reasoning summary</summary><p>{message.reasoningSummary}</p></details> : null}
                {message.quickActions?.length ? (
                  <div className="quick-action-list">
                    {message.quickActions.map((action) => <button disabled={isRunning} key={action.label} onClick={() => void submitMessage(action.value)} type="button">{action.label}</button>)}
                  </div>
                ) : null}
                {(() => {
                  const artifact = getMessageArtifact(message);
                  return artifact ? (
                    <a className="file-card" download={artifact.file} href={artifact.href} onClick={(event) => handleArtifactDownload(event, artifact)}>
                      <FileText size={18} />
                      <span><strong>{artifact.file}</strong><small>{artifact.summary}</small></span>
                      <span className="file-card-action"><Download size={15} /> Download</span>
                    </a>
                  ) : null;
                })()}
              </div>
              {message.role === "user" ? <div className="message-avatar user-avatar"><User size={16} /></div> : null}
            </article>
          ))}
        </div>

        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void submitMessage(input); }}>
          <textarea
            aria-label="Research request"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={pendingRunId ? "Answer the Orchestrator clarification to resume this run." : "Enter a research idea, e.g. TOD around rail stations and resident travel behavior..."}
            rows={2}
            value={input}
          />
          <button className="send-button" disabled={isRunning || !input.trim()} type="submit"><Send size={17} /></button>
        </form>
      </section>
    </main>
  );
}

async function createNewRun(history: Array<{ role: "user" | "assistant"; body: string }>, sessionId: string, topic: string, projectId: string | null) {
  const response = await fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ history, projectId, sessionId, topic }) });
  if (!response.ok) throw new Error("Failed to create run");
  return (await response.json()) as RunSnapshot;
}

async function resumeExistingRun(runId: string, answer: string) {
  const response = await fetch(`/api/runs/${runId}/resume`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer }) });
  if (!response.ok) throw new Error("Failed to resume run");
  return (await response.json()) as RunSnapshot;
}

async function persistConversation(conversationId: string, currentTitle: string | undefined, messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.body.trim();
  const shouldAutoname = !currentTitle || currentTitle === "New chat" || currentTitle === "New project chat";
  const title = shouldAutoname && firstUserMessage ? summarizeConversationTitle(firstUserMessage) : undefined;
  const response = await fetch(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        agent: message.agent,
        body: message.body,
        logs: message.logs,
        reasoningSummary: message.reasoningSummary,
        toolTraces: message.toolTraces,
        quickActions: message.quickActions,
        artifact: message.artifact ?? getMessageArtifact(message),
        createdAt: new Date().toISOString(),
      })),
    }),
  });
  if (!response.ok) return null;
  return ((await response.json()) as { conversation: ConversationSummary }).conversation;
}

function getMessageArtifact(message: Message) {
  if (message.artifact) return message.artifact;

  const file = message.body.match(/(?:下载文件|Download file)[:：]\s*([^\n]+)/i)?.[1]?.trim();
  const href = message.body.match(/(?:下载地址|Download URL)[:：]\s*(\/api\/artifacts\/[^\s]+)/i)?.[1]?.trim();

  if (!file || !href) return undefined;

  return {
    file,
    href,
    summary: "Click to download the generated paper blueprint.",
  };
}

async function routeConversationWithLLM(input: string, hasPendingRun: boolean, recentHistory: Array<{ role: "user" | "assistant"; body: string }>): Promise<RouterDecision> {
  try {
    const response = await fetch("/api/router", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input, hasPendingRun, recentHistory }) });
    if (!response.ok) throw new Error("Router request failed");
    return (await response.json()) as RouterDecision;
  } catch {
    if (hasPendingRun) return { intent: "answer_pending_question", route: "resume_pending", confidence: 0.65, reply: "", reason: "Router fallback treated the input as a clarification answer." };
    if (looksLikeResearchRequest(input)) return { intent: "research_request", route: "researchflow", confidence: 0.7, reply: "", reason: "Router fallback matched research keywords." };
    return { intent: "ordinary_chat", route: "conversation", confidence: 0.5, reply: "I will treat this as a normal conversation turn. Enter a research topic to start the agent workflow.", reason: "Router fallback used conservative conversation route." };
  }
}

function filterByQuery<T>(items: T[], query: string, getText: (item: T) => string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(normalizedQuery));
}

function summarizeConversationTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 36 ? `${compact.slice(0, 36)}...` : compact || "New chat";
}

function looksLikeResearchRequest(input: string) {
  return /research|paper|article|literature|review|blueprint|method|data|model|TOD|transit|论文|文献|研究|选题|框架|方法|变量|数据|综述/i.test(input);
}

function createEphemeralSessionId() {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const accountSessionKey = "researchflow.account.current";
const workspaceCachePrefix = "researchflow.workspace.";

function readCachedAccount() {
  try {
    const raw = window.localStorage.getItem(accountSessionKey);
    return raw ? (JSON.parse(raw) as AccountUser) : null;
  } catch {
    return null;
  }
}

function writeCachedAccount(user: AccountUser) {
  window.localStorage.setItem(accountSessionKey, JSON.stringify(user));
}

function clearCachedAccount() {
  window.localStorage.removeItem(accountSessionKey);
}

function readWorkspaceCache(accountId: string) {
  try {
    const raw = window.localStorage.getItem(`${workspaceCachePrefix}${accountId}`);
    return raw ? (JSON.parse(raw) as WorkspaceCache) : null;
  } catch {
    return null;
  }
}

function writeWorkspaceCache(accountId: string, cache: WorkspaceCache) {
  window.localStorage.setItem(`${workspaceCachePrefix}${accountId}`, JSON.stringify(cache));
}

function formatRunEvents(run: RunSnapshot) {
  if (run.requiresUserInput && run.question) return [...run.events.slice(-5).map((event) => `${event.actor}: ${event.message}`), "Orchestrator paused the run for confirmation."];
  if (!run.events.length) return [`Running for ${run.elapsedSeconds}s.`, run.activeStep ? `${run.activeStep.agent} is producing ${run.activeStep.output}.` : "Orchestrator is routing the task."];
  return run.events.slice(-6).map((event) => `${event.actor}: ${event.message}`);
}
