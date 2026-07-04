import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { searchResearchSources, type ResearchPaper, type ResearchSearchQuality, type ResearchToolTrace } from "@/lib/research-tools";
import { buildMemoryContext, rememberRunTurn } from "@/lib/session-memory";

export type RunStatus = "running" | "waiting_for_user" | "completed" | "failed";

export type AgentName =
  | "ResearchFlow"
  | "Orchestrator"
  | "Clarifier Agent"
  | "Research Agent"
  | "Writer/Compiler Agent"
  | "Reviewer Agent";

export type SkillName =
  | "scope-clarification-skill"
  | "paper-search-skill"
  | "evidence-extraction-skill"
  | "gap-analysis-skill"
  | "paper-blueprint-writing-skill"
  | "review-challenge-skill"
  | "revision-routing-skill"
  | "conversation-response-skill";

type ArtifactName =
  | "research-brief.json"
  | "paper-pool.json"
  | "evidence-pack.json"
  | "gap-analysis.json"
  | "paper-blueprint.md"
  | "review-notes.json"
  | "revision-log.json"
  | "conversation-response.md";

type Intent = "clarify" | "research" | "write" | "review" | "revise" | "full_workflow" | "status" | "chitchat";
type WorkflowStepId =
  | "scope"
  | "paper-search"
  | "evidence"
  | "gap-analysis"
  | "blueprint-draft"
  | "blueprint-revision"
  | "review"
  | "revision-routing";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  body: string;
};

export type RunStep = {
  id: string;
  agent: AgentName;
  skill: SkillName;
  statusText: string;
  decision: string;
  output: ArtifactName;
  summary: string;
};

export type RunEvent = {
  id: string;
  actor: AgentName | "Tool";
  type: "decision" | "agent_step" | "tool_call" | "reasoning" | "memory";
  message: string;
  createdAt: string;
};

export type RunResult = {
  title: string;
  logs: string[];
  quickActions?: QuickAction[];
  artifact?: {
    file: string;
    href: string;
    summary: string;
  };
};

export type RunSnapshot = {
  id: string;
  status: RunStatus;
  currentStatus: string;
  elapsedSeconds: number;
  progress: {
    current: number;
    total: number;
  };
  activeStep?: RunStep;
  completedSteps: RunStep[];
  events: RunEvent[];
  reasoningSummary?: string;
  toolTraces: ResearchToolTrace[];
  requiresUserInput?: boolean;
  question?: string;
  result?: RunResult;
};

type SkillModule = {
  name: SkillName;
  content: string;
  promptBytes: number;
};

type RunRecord = {
  id: string;
  sessionId?: string;
  topic: string;
  history: ChatHistoryMessage[];
  memoryContext: ReturnType<typeof buildMemoryContext>;
  intent: Intent;
  createdAt: number;
  status: RunStatus;
  currentIndex: number;
  currentStatus: string;
  targetStepCount: number;
  steps: RunStep[];
  completedSteps: RunStep[];
  artifacts: Partial<Record<ArtifactName, string>>;
  liveToolContexts: Partial<Record<"paper-search", string>>;
  liveSearchQuality?: ResearchSearchQuality;
  events: RunEvent[];
  reasoningSummaries: string[];
  toolTraces: ResearchToolTrace[];
  quickActions?: QuickAction[];
  pendingQuestion?: string;
  userClarifications: string[];
  result?: RunResult;
};

type AgentOutput = {
  summary: string;
  artifact: string;
  quickActions?: QuickAction[];
  reasoningSummary?: string;
  toolTraces?: ResearchToolTrace[];
};

type QuickAction = {
  label: string;
  value: string;
};

type OpenAIResult = {
  text: string;
  reasoningSummary?: string;
};

type OrchestratorDecision =
  | { type: "run_agent"; step: RunStep; reason: string }
  | { type: "call_tool"; tool: "paper_search"; query: string; reason: string }
  | { type: "ask_user"; question: string; reason: string }
  | { type: "final"; reason: string };

type QualityGateResult = {
  passed: boolean;
  severity: "info" | "warning" | "blocking";
  issues: string[];
  nextAction: "ask_user" | "run_agent" | "final";
  question?: string;
  reason: string;
};

declare global {
  // Preserve active runs across Next.js dev-server hot reloads.
  // Without this, the POST /api/runs module can create a run and the
  // GET /api/runs/[runId] module can reload into an empty Map.
  var __researchflowRuns: Map<string, RunRecord> | undefined;
}

const runs = globalThis.__researchflowRuns ?? new Map<string, RunRecord>();
globalThis.__researchflowRuns = runs;

const outputInstructions =
  "Return strict JSON only, with exactly these keys: summary, artifact, quickActions. summary must be one concise Chinese sentence. artifact must contain the artifact content as either JSON text or Markdown text. quickActions must be an array of at most 3 objects with label and value strings, or [] when no UI choices are clearly appropriate. For conversational Markdown answers, use structured Chinese with short paragraphs and numbered lists when giving multiple points; do not collapse several questions into one long paragraph. Only return quickActions when the options are directly grounded in the current user input and current project context; if the user only says they want to consult a research question, quickActions must be []. Never infer TOD, transport, city, spatial data, survey data, passenger-flow, card-swipe, or mobile-signaling options unless the current project context or latest input explicitly mentions them. When asking the user to choose among three or fewer clear options, state those options explicitly as 1., 2., 3. and still allow the user to type another answer. For internal JSON artifacts, keep only decision-useful fields. For paper-blueprint.md, include the required blueprint sections and keep it concise rather than artificially short. Do not wrap the JSON in Markdown fences.";

function loadSkill(name: SkillName): SkillModule {
  const skillPath = path.join(process.cwd(), "skills", `${name}.md`);
  const content = readFileSync(skillPath, "utf8");

  return {
    name,
    content,
    promptBytes: Buffer.byteLength(content, "utf8"),
  };
}

function readSampleArtifact(file: string) {
  return readFileSync(path.join(process.cwd(), "sample-project", file), "utf8");
}

function readSampleInternal(file: string) {
  return readFileSync(path.join(process.cwd(), "sample-project", "internal", file), "utf8");
}

function buildSteps(intent: Intent): RunStep[] {
  if (intent !== "full_workflow") return [buildRoutedStep(intent)];

  return [
    {
      id: "scope",
      agent: "Clarifier Agent",
      skill: "scope-clarification-skill",
      statusText: "正在收敛研究范围",
      decision: "用户输入仍是宽泛主题，先限定研究对象、边界和排除项。",
      output: "research-brief.json",
      summary: "",
    },
    {
      id: "paper-search",
      agent: "Research Agent",
      skill: "paper-search-skill",
      statusText: "正在整理起始论文池",
      decision: "Orchestrator 已获取实时论文检索结果，Research Agent 需要结构化候选论文池。",
      output: "paper-pool.json",
      summary: "",
    },
    {
      id: "evidence",
      agent: "Research Agent",
      skill: "evidence-extraction-skill",
      statusText: "正在结构化提取证据",
      decision: "Writer 不能直接从论文列表写作，需要先得到方法、变量、发现和局限。",
      output: "evidence-pack.json",
      summary: "",
    },
    {
      id: "blueprint-draft",
      agent: "Writer/Compiler Agent",
      skill: "paper-blueprint-writing-skill",
      statusText: "正在生成论文框架草稿",
      decision: "brief、paper pool 和 evidence pack 已具备，可以生成主产物草稿。",
      output: "paper-blueprint.md",
      summary: "",
    },
    {
      id: "review",
      agent: "Reviewer Agent",
      skill: "review-challenge-skill",
      statusText: "正在执行 Reviewer 质询",
      decision: "最终输出前需要分类检查 scope、evidence、gap、method 和 writing 风险。",
      output: "review-notes.json",
      summary: "",
    },
    {
      id: "revision-routing",
      agent: "Orchestrator",
      skill: "revision-routing-skill",
      statusText: "正在路由返工并检查质量门",
      decision: "Reviewer issue 已分类，需要把返工路由给合适的 Agent 并判断是否 ready。",
      output: "revision-log.json",
      summary: "",
    },
  ];
}

function buildWorkflowStep(stepId: WorkflowStepId): RunStep {
  const dynamicSteps: Record<WorkflowStepId, RunStep> = {
    scope: {
      id: "scope",
      agent: "Clarifier Agent",
      skill: "scope-clarification-skill",
      statusText: "Clarifier 正在收敛研究范围",
      decision: "Orchestrator 判断当前项目仍缺少明确研究对象、边界或排除项，因此先由 Clarifier 产出 research-brief.json。",
      output: "research-brief.json",
      summary: "",
    },
    "paper-search": {
      id: "paper-search",
      agent: "Research Agent",
      skill: "paper-search-skill",
      statusText: "Research Agent 正在结构化论文池",
      decision: "Orchestrator 已取得真实检索上下文，需要 Research Agent 将候选文献整理为 paper-pool.json。",
      output: "paper-pool.json",
      summary: "",
    },
    evidence: {
      id: "evidence",
      agent: "Research Agent",
      skill: "evidence-extraction-skill",
      statusText: "Research Agent 正在提取证据包",
      decision: "Orchestrator 判断已有论文池但证据结构不足，需要 Research Agent 提取方法、变量、发现和局限。",
      output: "evidence-pack.json",
      summary: "",
    },
    "gap-analysis": {
      id: "gap-analysis",
      agent: "Research Agent",
      skill: "gap-analysis-skill",
      statusText: "Research Agent 正在识别研究缺口",
      decision: "Orchestrator 判断已有证据需要转化为可辩护的研究缺口，因此调用 gap-analysis-skill。",
      output: "gap-analysis.json",
      summary: "",
    },
    "blueprint-draft": {
      id: "blueprint-draft",
      agent: "Writer/Compiler Agent",
      skill: "paper-blueprint-writing-skill",
      statusText: "Writer/Compiler 正在生成论文框架草稿",
      decision: "Orchestrator 判断研究简报、论文池、证据包和研究缺口已足够，Writer/Compiler 可以生成 paper-blueprint.md。",
      output: "paper-blueprint.md",
      summary: "",
    },
    "blueprint-revision": {
      id: "blueprint-revision",
      agent: "Writer/Compiler Agent",
      skill: "paper-blueprint-writing-skill",
      statusText: "Writer/Compiler 正在根据 Reviewer 反馈返工",
      decision: "Orchestrator 判断 Reviewer 或质量门发现写作/结构问题，需要 Writer/Compiler 更新 paper-blueprint.md。",
      output: "paper-blueprint.md",
      summary: "",
    },
    review: {
      id: "review",
      agent: "Reviewer Agent",
      skill: "review-challenge-skill",
      statusText: "Reviewer 正在质询论文框架",
      decision: "Orchestrator 判断已有 blueprint，需要 Reviewer 进行 scope、evidence、gap、method 和 writing 风险审查。",
      output: "review-notes.json",
      summary: "",
    },
    "revision-routing": {
      id: "revision-routing",
      agent: "Orchestrator",
      skill: "revision-routing-skill",
      statusText: "Orchestrator 正在路由返工并检查质量门",
      decision: "Orchestrator 根据 Reviewer issue 分类决定返工方向，并生成 revision-log.json。",
      output: "revision-log.json",
      summary: "",
    },
  };

  return { ...dynamicSteps[stepId] };
}

function buildRoutedStep(intent: Exclude<Intent, "full_workflow">): RunStep {
  const routed: Record<Exclude<Intent, "full_workflow">, RunStep> = {
    clarify: {
      id: "clarify-dialogue",
      agent: "Clarifier Agent",
      skill: "conversation-response-skill",
      statusText: "Clarifier 正在判断研究问题",
      decision: "用户正在讨论选题、范围或可行性，由 Clarifier 进行引导式回应。",
      output: "conversation-response.md",
      summary: "",
    },
    research: {
      id: "research-dialogue",
      agent: "Research Agent",
      skill: "conversation-response-skill",
      statusText: "Research Agent 正在整理检索建议",
      decision: "用户正在询问论文、证据或检索方向，由 Research Agent 回应。",
      output: "conversation-response.md",
      summary: "",
    },
    write: {
      id: "write-dialogue",
      agent: "Writer/Compiler Agent",
      skill: "conversation-response-skill",
      statusText: "Writer/Compiler 正在回应写作请求",
      decision: "用户正在讨论框架、段落或写作表达，由 Writer/Compiler 回应。",
      output: "conversation-response.md",
      summary: "",
    },
    review: {
      id: "review-dialogue",
      agent: "Reviewer Agent",
      skill: "conversation-response-skill",
      statusText: "Reviewer 正在检查问题",
      decision: "用户正在询问质量、风险或是否满意，由 Reviewer 回应。",
      output: "conversation-response.md",
      summary: "",
    },
    revise: {
      id: "revise-dialogue",
      agent: "Orchestrator",
      skill: "conversation-response-skill",
      statusText: "Orchestrator 正在判断修改路径",
      decision: "用户正在要求修改或完善，由 Orchestrator 判断下一步返工方向。",
      output: "conversation-response.md",
      summary: "",
    },
    chitchat: {
      id: "chitchat-dialogue",
      agent: "ResearchFlow",
      skill: "conversation-response-skill",
      statusText: "ResearchFlow 正在回应日常对话",
      decision: "用户输入是日常对话或非研究短句，由会话入口直接回应，不进入研究工作流。",
      output: "conversation-response.md",
      summary: "",
    },
    status: {
      id: "status-dialogue",
      agent: "Orchestrator",
      skill: "conversation-response-skill",
      statusText: "Orchestrator 正在读取项目状态",
      decision: "用户正在询问流程或状态，由 Orchestrator 回应。",
      output: "conversation-response.md",
      summary: "",
    },
  };

  return routed[intent];
}

export function createRun(topic: string, history: ChatHistoryMessage[] = [], sessionId?: string) {
  const id = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const memoryContext = buildMemoryContext(sessionId);
  const combinedHistory = [...memoryContext.persistedMessages, ...history];
  const intent = classifyIntent(topic, combinedHistory);
  const record: RunRecord = {
    id,
    sessionId,
    topic,
    history: combinedHistory,
    memoryContext,
    intent,
    createdAt: Date.now(),
    status: "running",
    currentIndex: 0,
    currentStatus: "Orchestrator 正在读取上下文并决定下一步",
    targetStepCount: intent === "full_workflow" ? 7 : 1,
    steps: [],
    completedSteps: [],
    artifacts: {},
    liveToolContexts: {},
    liveSearchQuality: undefined,
    events: [createRunEvent("Orchestrator", "decision", `Intent classified as ${intent}; session memory loaded.`)],
    reasoningSummaries: [],
    toolTraces: [],
    userClarifications: [],
  };

  runs.set(id, record);
  void executeRun(record);
  return snapshotRun(record);
}

export async function createRunAndWait(topic: string, history: ChatHistoryMessage[] = [], sessionId?: string) {
  const snapshot = createRun(topic, history, sessionId);
  const record = runs.get(snapshot.id);
  if (record) await waitForRunToSettle(record);
  return getRun(snapshot.id) ?? snapshot;
}

export function resumeRun(runId: string, answer: string) {
  const record = runs.get(runId);
  if (!record) return null;
  if (record.status !== "waiting_for_user") throw new Error("Run is not waiting for user input.");

  const trimmed = answer.trim();
  if (!trimmed) throw new Error("Missing user answer.");

  record.status = "running";
  record.pendingQuestion = undefined;
  record.result = undefined;
  record.topic = `${record.topic}\n\n用户补充：${trimmed}`;
  record.history.push({ role: "user", body: trimmed });
  record.userClarifications.push(trimmed);
  record.currentStatus = "Orchestrator 正在根据你的补充继续推进";
  record.events.push(createRunEvent("Orchestrator", "decision", `Resuming run with user clarification: ${trimmed}`));

  void executeRun(record);
  return snapshotRun(record);
}

export async function resumeRunAndWait(runId: string, answer: string) {
  const snapshot = resumeRun(runId, answer);
  const record = snapshot ? runs.get(snapshot.id) : null;
  if (record) await waitForRunToSettle(record);
  return snapshot ? getRun(snapshot.id) ?? snapshot : null;
}

async function waitForRunToSettle(record: RunRecord) {
  const deadline = Date.now() + 45_000;
  while (record.status === "running" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (record.status === "running") {
    record.status = "failed";
    record.currentStatus = "Run timed out before the serverless response deadline.";
    record.events.push(createRunEvent("Orchestrator", "decision", record.currentStatus));
  }
}

function classifyIntent(topic: string, history: ChatHistoryMessage[]): Intent {
  const hasPriorConversation = history.length > 0;
  const compactTopic = topic.trim().toLowerCase().replace(/[\s。！？!?.,，、~～]+/g, "");
  const isCasualTurn =
    /^(你好|您好|哈喽|嗨|在吗|你是谁|你叫什么|我感觉有点冷|我有点冷|有点冷|好冷|我有点累|有点累|我有点饿|有点饿|我有点困|有点困|我有点烦|有点烦|hi|hello|hey)$/.test(
      compactTopic,
    ) ||
    (!/研究|论文|文献|综述|选题|课题|框架|提纲|方法|变量|数据|模型|TOD|交通|规划|城市|轨道|站点|出行|土地利用|建成环境|可达性|Reviewer|review|paper|article/i.test(
      topic,
    ) &&
      compactTopic.length > 0 &&
      compactTopic.length <= 18);
  const asksForFullWorkflow =
    /全流程|直接开始|开始帮我|生成.*(论文框架|完整|详细)|撰写.*(论文框架|完整|详细)|输出.*paper-blueprint|blueprint|最终文件|完整.*框架|完整论文框架|帮我.*完整/.test(
      topic,
    );
  const asksResearch = /查找|检索|论文|文献|paper|article|证据|来源|semantic|crossref/i.test(topic);
  const asksReview = /满意|评价|问题|风险|质疑|review|缺点|漏洞|怎么看|质量/i.test(topic);
  const asksRevise = /修改|完善|改写|优化|调整|返工|补充/i.test(topic);
  const asksWrite = /写|撰写|段落|摘要|引言|框架|提纲|标题/i.test(topic);
  const asksStatus = /进度|状态|做到哪|完成了什么|下一步|计划|phase/i.test(topic);
  const asksClarify = /主题|选题|方向|范围|切入点|可行|你觉得|怎么研究|我想做.*研究|关于.*研究|TOD|交通导向|交通导向规划/i.test(topic);

  if (asksForFullWorkflow || (!hasPriorConversation && /我想研究|帮我研究|写一篇|论文框架|文献综述/.test(topic))) {
    return "full_workflow";
  }
  if (isCasualTurn) return "chitchat";
  if (asksStatus) return "status";
  if (asksResearch) return "research";
  if (asksReview) return "review";
  if (asksRevise) return "revise";
  if (asksWrite) return "write";
  if (asksClarify) return "clarify";
  return hasPriorConversation ? "clarify" : "status";
}

export function getRun(id: string) {
  const record = runs.get(id);
  if (!record) return null;
  return snapshotRun(record);
}

async function executeRun(record: RunRecord) {
  try {
    for (let turn = 0; turn < 10 && record.status === "running"; turn += 1) {
      const decision = dynamicOrchestratorDecide(record);
      record.events.push(createRunEvent("Orchestrator", "decision", decision.reason));

      if (decision.type === "call_tool") {
        await runToolDecision(record, decision);
        continue;
      }

      if (decision.type === "run_agent") {
        await runAgentDecision(record, decision.step);
        continue;
      }

      if (decision.type === "ask_user") {
        pauseForUser(record, decision.question, decision.reason);
        return;
      }

      finishRun(record, decision.reason);
      return;
    }

    if (record.status === "running") throw new Error("Orchestrator stopped after reaching the maximum decision turns.");
  } catch (error) {
    record.status = "failed";
    record.currentStatus = error instanceof Error ? error.message : "OpenAI Agent harness failed";
    record.events.push(createRunEvent("Orchestrator", "decision", record.currentStatus));
  }
}

function orchestratorDecide(record: RunRecord): OrchestratorDecision {
  if (record.intent !== "full_workflow") {
    if (!record.completedSteps.length) {
      const step = buildRoutedStep(record.intent);
      return {
        type: "run_agent",
        step,
        reason: `Routed conversational turn to ${step.agent} because intent is ${record.intent}.`,
      };
    }
    return { type: "final", reason: "The routed conversational turn has produced an answer, so the run can finish." };
  }

  if (!record.artifacts["research-brief.json"]) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("scope"),
      reason: "Scope is not yet defined, so Clarifier Agent must produce the research brief first.",
    };
  }

  if (!record.liveToolContexts["paper-search"]) {
    return {
      type: "call_tool",
      tool: "paper_search",
      query: record.topic,
      reason: "The paper pool needs live evidence before the Research Agent drafts paper-pool.json.",
    };
  }

  if (!record.artifacts["paper-pool.json"]) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("paper-search"),
      reason: "Live paper metadata is available, so Research Agent can structure the paper pool.",
    };
  }

  if (!record.artifacts["evidence-pack.json"]) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("evidence"),
      reason: "The paper pool exists, so Research Agent can extract evidence before writing.",
    };
  }

  if (!record.artifacts["paper-blueprint.md"]) {
    const writerGate = evaluateWriterGate(record);
    if (!writerGate.passed) {
      return {
        type: "ask_user",
        question: writerGate.question ?? "请补充更多研究范围或证据需求。",
        reason: writerGate.reason,
      };
    }
    return {
      type: "run_agent",
      step: buildWorkflowStep("blueprint-draft"),
      reason: "The evidence pack exists and Writer gate passed, so Writer/Compiler Agent can draft the paper blueprint.",
    };
  }

  if (!record.artifacts["review-notes.json"]) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("review"),
      reason: "A draft blueprint exists, so Reviewer Agent should challenge its quality and risks.",
    };
  }

  if (!record.artifacts["revision-log.json"]) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("revision-routing"),
      reason: "Reviewer notes exist, so Orchestrator should route revisions and check the quality gate.",
    };
  }

  const finalGate = evaluateFinalGate(record);
  if (!finalGate.passed) {
    return {
      type: "ask_user",
      question: finalGate.question ?? "最终输出前还需要你确认是否继续。",
      reason: finalGate.reason,
    };
  }

  return { type: "final", reason: "All required artifacts and quality-gate outputs exist, so the workflow can finish." };
}

type WorkflowStateSummary = {
  hasResearchBrief: boolean;
  hasLiveSearch: boolean;
  hasPaperPool: boolean;
  hasEvidencePack: boolean;
  hasGapAnalysis: boolean;
  hasBlueprint: boolean;
  hasReviewNotes: boolean;
  hasRevisionLog: boolean;
  hasUserClarification: boolean;
  needsScopeConfirmation: boolean;
  needsScopeRefresh: boolean;
  searchNeedsUserInput: boolean;
  searchIssues: string[];
  reviewerRoutes: Set<WorkflowStepId>;
  needsEvidenceRefresh: boolean;
  needsGapRefresh: boolean;
  needsWritingRefresh: boolean;
  needsFreshReview: boolean;
  summary: string;
};

function dynamicOrchestratorDecide(record: RunRecord): OrchestratorDecision {
  if (record.intent !== "full_workflow") {
    if (record.intent === "research" && !record.completedSteps.length) {
      const searchGate = evaluateConversationalSearchGate(record);
      if (!searchGate.passed) {
        return {
          type: "ask_user",
          question: searchGate.question ?? "请先补充一个更具体的检索范围。",
          reason: searchGate.reason,
        };
      }
    }

    if (!record.completedSteps.length) {
      const step = buildRoutedStep(record.intent);
      return {
        type: "run_agent",
        step,
        reason: `Routed conversational turn to ${step.agent} because intent is ${record.intent}.`,
      };
    }
    return { type: "final", reason: "The routed conversational turn has produced an answer, so the run can finish." };
  }

  const state = summarizeWorkflowState(record);
  record.events.push(createRunEvent("Orchestrator", "reasoning", state.summary));

  if (!state.hasResearchBrief) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("scope"),
      reason: "Dynamic Orchestrator: scope is missing, so Clarifier must create research-brief.json.",
    };
  }

  if (state.needsScopeRefresh) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("scope"),
      reason: "Dynamic Orchestrator: Reviewer routed a scope issue back to Clarifier and that scope work has not been refreshed yet.",
    };
  }

  if (state.needsScopeConfirmation) {
    return {
      type: "ask_user",
      question:
        "在继续检索和写作前，我需要确认研究切入点。请补充你的研究对象、案例/地区、核心变量或你最想回答的研究问题。",
      reason: "Dynamic Orchestrator: the brief exists, but the scope is still too broad to safely continue.",
    };
  }

  if (!state.hasLiveSearch) {
    return {
      type: "call_tool",
      tool: "paper_search",
      query: record.topic,
      reason: "Dynamic Orchestrator: no live paper-search context exists, so call the search tool before evidence work.",
    };
  }

  if (state.searchNeedsUserInput) {
    return {
      type: "ask_user",
      question:
        "当前真实文献检索质量不足。请补充更具体的关键词、研究对象、城市/地区或数据范围；如果要继续，也可以明确允许使用弱检索结果生成带风险标注的初稿。",
      reason: `Dynamic Orchestrator: paper-search quality is weak: ${state.searchIssues.join(" ")}`,
    };
  }

  if (!state.hasPaperPool) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("paper-search"),
      reason: "Dynamic Orchestrator: live search exists but paper-pool.json is missing, so Research Agent structures the paper pool.",
    };
  }

  if (!state.hasEvidencePack || state.needsEvidenceRefresh) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("evidence"),
      reason: state.needsEvidenceRefresh
        ? "Dynamic Orchestrator: Reviewer routed an evidence/method issue back to Research Agent."
        : "Dynamic Orchestrator: paper-pool.json exists but evidence-pack.json is missing.",
    };
  }

  if (!state.hasGapAnalysis || state.needsGapRefresh) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("gap-analysis"),
      reason: state.needsGapRefresh
        ? "Dynamic Orchestrator: Reviewer routed a gap issue back to Research Agent."
        : "Dynamic Orchestrator: evidence exists but gap-analysis.json is missing.",
    };
  }

  const writerGate = evaluateWriterGate(record);
  if (!writerGate.passed) {
    return {
      type: "ask_user",
      question: writerGate.question ?? "请补充更多研究范围或证据需求。",
      reason: `Dynamic Orchestrator: Writer gate blocked the next writing action. ${writerGate.reason}`,
    };
  }

  if (!state.hasBlueprint || state.needsWritingRefresh) {
    return {
      type: "run_agent",
      step: buildWorkflowStep(state.hasBlueprint ? "blueprint-revision" : "blueprint-draft"),
      reason: state.needsWritingRefresh
        ? "Dynamic Orchestrator: Reviewer or the quality gate found writing/structure issues, so Writer revises the blueprint."
        : "Dynamic Orchestrator: required research artifacts are ready, so Writer drafts paper-blueprint.md.",
    };
  }

  if (!state.hasReviewNotes || state.needsFreshReview) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("review"),
      reason: state.needsFreshReview
        ? "Dynamic Orchestrator: artifacts changed after review, so Reviewer must check the current blueprint again."
        : "Dynamic Orchestrator: blueprint exists but review-notes.json is missing.",
    };
  }

  const finalGate = evaluateFinalGate(record);
  if (!finalGate.passed) {
    const routedStep = routeFinalGateIssue(record, finalGate);
    if (routedStep) {
      return {
        type: "run_agent",
        step: buildWorkflowStep(routedStep),
        reason: `Dynamic Orchestrator: final gate failed and was routed to ${routedStep}. ${finalGate.reason}`,
      };
    }

    return {
      type: "ask_user",
      question: finalGate.question ?? "最终输出前还需要你确认是否继续。",
      reason: `Dynamic Orchestrator: final gate failed but no safe automatic route was available. ${finalGate.reason}`,
    };
  }

  if (!state.hasRevisionLog) {
    return {
      type: "run_agent",
      step: buildWorkflowStep("revision-routing"),
      reason: "Dynamic Orchestrator: core artifacts pass the quality gate, but revision-log.json is missing.",
    };
  }

  return {
    type: "final",
    reason:
      "Dynamic Orchestrator: scope, search, evidence, gap analysis, blueprint, review, revision log, and final quality gate are ready.",
  };
}

function summarizeWorkflowState(record: RunRecord): WorkflowStateSummary {
  const reviewerRoutes = routeReviewerIssues(record);
  const hasResearchBrief = Boolean(record.artifacts["research-brief.json"]);
  const hasLiveSearch = Boolean(record.liveToolContexts["paper-search"]);
  const hasPaperPool = Boolean(record.artifacts["paper-pool.json"]);
  const hasEvidencePack = Boolean(record.artifacts["evidence-pack.json"]);
  const hasGapAnalysis = Boolean(record.artifacts["gap-analysis.json"]);
  const hasBlueprint = Boolean(record.artifacts["paper-blueprint.md"]);
  const hasReviewNotes = Boolean(record.artifacts["review-notes.json"]);
  const hasRevisionLog = Boolean(record.artifacts["revision-log.json"]);
  const hasUserClarification = record.userClarifications.length > 0;
  const searchIssues = record.liveSearchQuality?.issues ?? [];
  const searchNeedsUserInput = Boolean(record.liveSearchQuality?.fallbackRecommended && !hasUserClarification);
  const latestReviewIndex = latestCompletedIndex(record, "review");
  const latestScopeIndex = latestCompletedIndex(record, "scope");
  const latestEvidenceIndex = latestCompletedIndex(record, "evidence");
  const latestGapIndex = latestCompletedIndex(record, "gap-analysis");
  const latestWriterIndex = Math.max(latestCompletedIndex(record, "blueprint-draft"), latestCompletedIndex(record, "blueprint-revision"));
  const latestBlueprintIndex = latestWriterIndex;
  const needsScopeCheck =
    hasResearchBrief && !hasUserClarification && needsScopeConfirmation(record.topic, record.artifacts["research-brief.json"] ?? "");

  const needsFreshReview = hasBlueprint && hasReviewNotes && latestBlueprintIndex > latestReviewIndex;
  const needsScopeRefresh = reviewerRoutes.has("scope") && latestScopeIndex <= latestReviewIndex;
  const needsEvidenceRefresh =
    (reviewerRoutes.has("evidence") && latestEvidenceIndex <= latestReviewIndex) ||
    (reviewerRoutes.has("scope") && latestEvidenceIndex <= Math.max(latestReviewIndex, latestScopeIndex));
  const needsGapRefresh =
    (reviewerRoutes.has("gap-analysis") && latestGapIndex <= latestReviewIndex) ||
    (needsEvidenceRefresh && latestGapIndex <= latestEvidenceIndex);
  const needsWritingRefresh =
    (reviewerRoutes.has("blueprint-revision") && latestWriterIndex <= latestReviewIndex) ||
    ((needsScopeRefresh || needsEvidenceRefresh || needsGapRefresh) && latestWriterIndex <= Math.max(latestScopeIndex, latestEvidenceIndex, latestGapIndex));

  return {
    hasResearchBrief,
    hasLiveSearch,
    hasPaperPool,
    hasEvidencePack,
    hasGapAnalysis,
    hasBlueprint,
    hasReviewNotes,
    hasRevisionLog,
    hasUserClarification,
    needsScopeConfirmation: needsScopeCheck,
    needsScopeRefresh,
    searchNeedsUserInput,
    searchIssues,
    reviewerRoutes,
    needsEvidenceRefresh,
    needsGapRefresh,
    needsWritingRefresh,
    needsFreshReview,
    summary: [
      `brief=${hasResearchBrief}`,
      `search=${hasLiveSearch}`,
      `paperPool=${hasPaperPool}`,
      `evidence=${hasEvidencePack}`,
      `gap=${hasGapAnalysis}`,
      `blueprint=${hasBlueprint}`,
      `review=${hasReviewNotes}`,
      `revisionLog=${hasRevisionLog}`,
      `routes=${[...reviewerRoutes].join(",") || "none"}`,
    ].join("; "),
  };
}

function routeReviewerIssues(record: RunRecord): Set<WorkflowStepId> {
  const issueText = `${record.artifacts["review-notes.json"] ?? ""}\n${record.artifacts["revision-log.json"] ?? ""}`.toLowerCase();
  const routes = new Set<WorkflowStepId>();
  if (!issueText.trim()) return routes;

  if (/scope_issue|scope issue|scope|范围|边界|研究对象/.test(issueText)) routes.add("scope");
  if (/evidence_issue|evidence issue|evidence|source|citation|文献|证据|来源/.test(issueText)) routes.add("evidence");
  if (/gap_issue|gap issue|gap|缺口|创新|贡献/.test(issueText)) routes.add("gap-analysis");
  if (/method_issue|method issue|method|variable|model|方法|变量|模型/.test(issueText)) routes.add("evidence");
  if (/writing_issue|writing issue|writing|structure|logic|表达|结构|逻辑/.test(issueText)) routes.add("blueprint-revision");

  return routes;
}

function routeFinalGateIssue(record: RunRecord, gate: QualityGateResult): WorkflowStepId | null {
  const issueText = `${gate.issues.join(" ")} ${gate.reason}`.toLowerCase();
  if (/review-notes/.test(issueText)) return "review";
  if (/revision-log/.test(issueText)) return "revision-routing";
  if (/paper-blueprint|blueprint|writing|structure|section/.test(issueText)) return record.artifacts["paper-blueprint.md"] ? "blueprint-revision" : "blueprint-draft";
  if (/evidence|paper pool|source|citation/.test(issueText)) return "evidence";
  if (/gap/.test(issueText)) return "gap-analysis";
  return null;
}

function evaluateConversationalSearchGate(record: RunRecord): QualityGateResult {
  const text = `${record.topic}\n${record.history.map((message) => message.body).join("\n")}`;
  const latestClarification = record.userClarifications.at(-1) ?? "";
  const clarificationCount = record.userClarifications.length;

  if (allowsBroadSearch(latestClarification) || allowsBroadSearch(record.topic)) {
    return {
      passed: true,
      severity: "info",
      issues: [],
      nextAction: "run_agent",
      reason: "User explicitly allowed a broad first-pass search.",
    };
  }

  if (!isBroadLiteratureSearchRequest(text)) {
    return {
      passed: true,
      severity: "info",
      issues: [],
      nextAction: "run_agent",
      reason: "Search request is specific enough for a first-pass retrieval.",
    };
  }

  if (hasSearchNarrowingSignals(text)) {
    return {
      passed: true,
      severity: "info",
      issues: [],
      nextAction: "run_agent",
      reason: "Search request includes enough narrowing signals for retrieval.",
    };
  }

  if (clarificationCount >= 2) {
    return {
      passed: true,
      severity: "warning",
      issues: ["The topic remains broad after two clarification turns."],
      nextAction: "run_agent",
      reason: "Search gate allows retrieval after two clarification attempts to avoid an infinite questioning loop.",
    };
  }

  return {
    passed: false,
    severity: "blocking",
    issues: ["The literature search topic is too broad for useful retrieval."],
    nextAction: "ask_user",
    reason: "Conversational search gate blocked direct retrieval because the request is broad and lacks scope.",
    question: [
      "这个检索范围还比较大。为了避免直接搜出一堆泛泛的 TOD 文献，请先选一个收敛方向，或直接补充你的具体关键词：",
      "",
      "1. 研究对象：站点周边空间、居民/通勤者出行行为、土地利用/建成环境、可达性，还是政策/规划绩效？",
      "2. 空间范围：某个城市、某类轨道站点、某条线路，还是跨城市比较？",
      "3. 目标文献：理论综述、测度方法、实证模型、数据来源，还是案例研究？",
      "",
      "如果你只是想先粗略扫一轮，可以回复“先粗搜一轮”。",
    ].join("\n"),
  };
}

function isBroadLiteratureSearchRequest(text: string) {
  return /查找|检索|文献|论文|literature|paper|article/i.test(text) && /\bTOD\b|交通导向|transit.?oriented|交通|规划/i.test(text);
}

function hasSearchNarrowingSignals(text: string) {
  const signals = [
    /深圳|北京|上海|广州|成都|杭州|武汉|南京|城市|city|case/i,
    /站点周边|站域|station area|rail station|metro station/i,
    /步行|可达性|walkability|accessibility/i,
    /出行行为|通勤|travel behavior|commuting|mode choice/i,
    /土地利用|建成环境|built environment|land use/i,
    /客流|刷卡|手机信令|问卷|POI|路网|data|dataset/i,
    /测度|评价|模型|机制|method|measure|index|model|mechanism/i,
    /综述|review|systematic review|bibliometric/i,
  ];

  return signals.filter((pattern) => pattern.test(text)).length >= 2;
}

function allowsBroadSearch(text: string) {
  return /先.*(粗搜|泛搜|大概搜|搜一轮)|就这样.*搜|直接.*搜|不用.*细化|不需要.*细化|broad search|rough search/i.test(text);
}

function latestCompletedIndex(record: RunRecord, stepId: string) {
  for (let index = record.completedSteps.length - 1; index >= 0; index -= 1) {
    if (record.completedSteps[index]?.id === stepId) return index;
  }
  return -1;
}

async function runToolDecision(record: RunRecord, decision: Extract<OrchestratorDecision, { type: "call_tool" }>) {
  record.currentIndex = record.steps.length;
  record.currentStatus = "Orchestrator 正在调用真实论文检索工具";
  record.events.push(createRunEvent("Tool", "tool_call", `Calling ${decision.tool} for query: ${decision.query}`));

  if (decision.tool === "paper_search") {
    const result = await searchResearchSources(decision.query);
    record.toolTraces.push(...result.traces);
    record.liveSearchQuality = result.quality;
    record.liveToolContexts["paper-search"] = JSON.stringify(
      {
        papers: result.papers,
        quality: result.quality,
        totalAvailable: result.totalAvailable,
        query: result.query,
        fallbackSeedAvailable: result.quality.fallbackRecommended,
        fallbackInstruction: result.quality.fallbackRecommended
          ? "Live search is too thin or partially failed. Use seedMaterials as fallback context, and clearly mark any unsupported claims as hypotheses."
          : undefined,
      },
      null,
      2,
    );
    for (const trace of result.traces) {
      record.events.push(createRunEvent("Tool", "tool_call", `${trace.tool}: ${trace.summary}`));
    }
    if (result.quality.issues.length) {
      record.events.push(createRunEvent("Tool", "tool_call", `Live search quality issues: ${result.quality.issues.join(" ")}`));
    }
  }
}

function evaluateWriterGate(record: RunRecord): QualityGateResult {
  const searchQuality = record.liveSearchQuality;
  const evidencePack = record.artifacts["evidence-pack.json"] ?? "";
  const researchBrief = record.artifacts["research-brief.json"] ?? "";
  const paperPool = record.artifacts["paper-pool.json"] ?? "";
  const hasUserClarification = record.userClarifications.length > 0;

  if (!searchQuality && !hasUserClarification) {
    return {
      passed: false,
      severity: "blocking",
      issues: ["Live paper search quality summary is missing."],
      nextAction: "ask_user",
      reason: "Writer gate blocked because live paper search has not produced a quality summary.",
      question: "我还没有拿到可靠的实时论文检索结果。你希望我换一组关键词继续检索，还是先基于已有样例材料生成初稿？",
    };
  }

  if (searchQuality?.fallbackRecommended && !hasUserClarification) {
    return {
      passed: false,
      severity: "blocking",
      issues: searchQuality.issues,
      nextAction: "ask_user",
      reason: `Writer gate blocked because live paper search quality is weak: ${searchQuality.issues.join(" ")}`,
      question:
        "当前真实文献检索结果偏弱。请补充一个更具体的关键词、研究对象、地区范围、数据来源或核心变量；也可以确认先使用本地样例材料作为 fallback。",
    };
  }

  if ((paperPool.length < 300 || evidencePack.length < 300) && !hasUserClarification) {
    return {
      passed: false,
      severity: "blocking",
      issues: ["The paper pool or evidence pack is too thin for drafting."],
      nextAction: "ask_user",
      reason: "Writer gate blocked because paper pool or evidence pack is too thin for drafting.",
      question:
        "当前证据包还偏薄。请你补充一个更具体的关键词、研究对象、地区范围、数据来源或核心变量。",
    };
  }

  if (needsScopeConfirmation(record.topic, researchBrief) && !hasUserClarification) {
    return {
      passed: false,
      severity: "blocking",
      issues: ["The research scope still needs user confirmation."],
      nextAction: "ask_user",
      reason: "Writer gate blocked because the research scope still needs user confirmation.",
      question:
        "在写论文框架前，我需要确认切入点。请说明你更想聚焦的研究对象、核心变量、案例范围或方法路径。",
    };
  }

  return {
    passed: true,
    severity: "info",
    issues: [],
    nextAction: "run_agent",
    reason: searchQuality
      ? `Writer gate passed with ${searchQuality.usablePapers} usable live papers, ${searchQuality.papersWithAbstract} abstracts, and ${searchQuality.papersWithDoiOrUrl} DOI/URL-backed records.`
      : "Writer gate passed after user clarification allowed fallback drafting.",
  };
}

function needsScopeConfirmation(topic: string, researchBrief: string) {
  const text = `${topic}\n${researchBrief}`;
  const hasConcreteObject = /研究对象|案例|城市|地区|样本|人群|行业|企业|平台|学校|社区|数据|变量|方法|时间范围|空间范围|object|case|sample|data|variable|method/i.test(text);
  const expressesUncertainty = /不确定|不知道|还没想好|切入点|范围太大|方向|咨询.*研究|研究.*咨询|clarificationNeeded|null/i.test(text);
  return expressesUncertainty && !hasConcreteObject;
}

function evaluateFinalGate(record: RunRecord): QualityGateResult {
  const blueprint = record.artifacts["paper-blueprint.md"] ?? "";
  const reviewNotes = record.artifacts["review-notes.json"] ?? "";
  const revisionLog = record.artifacts["revision-log.json"] ?? "";
  const issues: string[] = [];

  if (blueprint.length < 500) issues.push("paper-blueprint.md is too short.");
  if (!reviewNotes) issues.push("review-notes.json is missing.");
  if (!revisionLog) issues.push("revision-log.json is missing.");

  const hasCoreSections = /研究问题|理论|变量|方法|贡献|风险|局限|research question|method|contribution/i.test(blueprint);
  if (!hasCoreSections) issues.push("paper-blueprint.md does not show enough core research sections.");

  const hasBlockingIssue = /blocking|blocker|not ready|不可通过|不通过|严重|高风险/i.test(`${reviewNotes}\n${revisionLog}`);
  if (hasBlockingIssue && !record.userClarifications.length) {
    issues.push("Reviewer or revision routing still indicates a blocking issue.");
  }

  if (issues.length) {
    return {
      passed: false,
      severity: "blocking",
      issues,
      nextAction: "ask_user",
      reason: `Final gate blocked: ${issues.join(" ")}`,
      question: "最终输出前质量门还没有完全通过。你希望我优先补强论文框架结构、补充证据，还是先按当前版本输出并在结果中标注风险？",
    };
  }

  return {
    passed: true,
    severity: "info",
    issues: [],
    nextAction: "final",
    reason: "Final gate passed because blueprint, review notes, and revision routing are available.",
  };
}

async function runAgentDecision(record: RunRecord, step: RunStep) {
  record.steps.push(step);
  record.currentIndex = record.steps.length - 1;
  record.currentStatus = step.statusText;
  record.events.push(createRunEvent(step.agent, "agent_step", step.statusText));

  const output = await runAgentStep(record, step);
  const completedStep = { ...step, summary: output.summary };

  record.artifacts[step.output] = output.artifact;
  if (output.reasoningSummary) {
    record.reasoningSummaries.push(output.reasoningSummary);
    record.events.push(createRunEvent(step.agent, "reasoning", output.reasoningSummary));
  }
  if (output.toolTraces?.length) record.toolTraces.push(...output.toolTraces);
  record.quickActions = output.quickActions?.length ? output.quickActions : undefined;
  persistRunArtifact(record.id, step.output, output.artifact);
  record.completedSteps.push(completedStep);
}

function finishRun(record: RunRecord, reason: string) {
  record.status = "completed";
  record.currentIndex = record.steps.length;
  record.currentStatus = record.intent === "full_workflow" ? "Paper Blueprint ready" : "已完成回复";
  record.events.push(createRunEvent("Orchestrator", "decision", reason));
  record.result = buildResult(record);
  if (record.sessionId) {
    rememberRunTurn(record.sessionId, record.topic, record.result.title);
    record.events.push(createRunEvent("Orchestrator", "memory", "This turn was saved to session memory."));
  }
}

function pauseForUser(record: RunRecord, question: string, reason: string) {
  record.status = "waiting_for_user";
  record.currentIndex = record.steps.length;
  record.currentStatus = "Orchestrator 正在等待用户确认";
  record.pendingQuestion = question;
  record.events.push(createRunEvent("Orchestrator", "decision", reason));
  record.events.push(createRunEvent("Orchestrator", "decision", `Asking user: ${question}`));

  if (record.sessionId) {
    rememberRunTurn(record.sessionId, record.topic, question);
    record.events.push(createRunEvent("Orchestrator", "memory", "The clarification question was saved to session memory."));
  }
}

async function runAgentStep(record: RunRecord, step: RunStep): Promise<AgentOutput> {
  const skill = loadSkill(step.skill);
  const toolContext = await loadToolContext(record, step);
  const prompt = buildStepPrompt(record, step, skill, toolContext);
  try {
    const result = await callOpenAI(prompt);
    return {
      ...parseAgentOutput(result.text),
      reasoningSummary: result.reasoningSummary,
      toolTraces: toolContext.traces,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI call failed";
    record.events.push(createRunEvent(step.agent, "agent_step", `Using local fallback because the model call failed: ${message}`));
    return {
      ...buildLocalFallbackOutput(record, step, toolContext, message),
      toolTraces: toolContext.traces,
    };
  }
}

function buildLocalFallbackOutput(
  record: RunRecord,
  step: RunStep,
  toolContext: { traces: ResearchToolTrace[]; data: string },
  reason: string,
): AgentOutput {
  if (record.intent !== "full_workflow") {
    const fallback = buildConversationalFallback(record, step, reason, toolContext);
    return {
      summary: fallback.summary,
      artifact: fallback.artifact,
    };
  }

  if (record.intent !== "full_workflow") {
    return {
      summary: "已使用本地 fallback 回答这轮问题。",
      artifact: [
        `我现在无法连接外部模型服务，所以先用本地项目材料回答。`,
        `当前处理角色：${step.agent}。`,
        `你的输入：${record.topic}`,
        "建议下一步：如果要继续完整论文框架，可以先按离线样例流程生成，再等外网/API 恢复后替换为真实检索和模型输出。",
      ].join("\n"),
      reasoningSummary: `Local fallback used after model call failed: ${reason}`,
    };
  }

  if (step.output === "research-brief.json") {
    return {
      summary: "外部模型不可用，已暂停研究范围收敛。",
      artifact: JSON.stringify(
        {
          topic: record.topic,
          objective: null,
          scope: null,
          keywords: [],
          exclusions: ["外部模型恢复前不推断研究主题", "不使用内置样例替代用户真实研究方向", "不声称已完成范围收敛或文献检索"],
          clarificationNeeded: ["请补充研究主题、研究对象、案例/地区、数据来源或目标产出。"],
          fallbackReason: reason,
        },
        null,
        2,
      ),
      reasoningSummary: `Local fallback used after model call failed: ${reason}`,
    };
  }

  const seed = getSeedMaterials(step.output);
  const fallbackNote = `\n\nFallback note: 外部模型或网络服务当前不可用，本内容基于项目内置样例材料生成，后续应使用真实 Semantic Scholar / Crossref 和 OpenAI 调用刷新。`;

  if (step.output === "paper-pool.json" && toolContext.data) {
    return {
      summary: "已使用本地 fallback 和可用检索上下文整理论文池。",
      artifact: seed || toolContext.data,
      reasoningSummary: `Local fallback used after model call failed: ${reason}`,
    };
  }

  return {
    summary: `已使用本地 fallback 生成 ${step.output}。`,
    artifact: step.output.endsWith(".md") ? `${seed}${fallbackNote}` : seed,
    reasoningSummary: `Local fallback used after model call failed: ${reason}`,
  };
}

function buildConversationalFallback(
  record: RunRecord,
  step: RunStep,
  reason: string,
  toolContext?: { traces: ResearchToolTrace[]; data: string },
) {
  const topic = record.topic.trim();
  const offlineNote = classifyOpenAIFailure(reason);
  const modelUnavailableIntro = "当前外部模型调用失败，所以我不能可靠判断或展开你的研究主题。";

  if (record.intent === "chitchat") {
    return {
      summary: "ResearchFlow 已回应日常对话。",
      artifact: [
        "这更像一句日常对话，我不会把它当成研究题目。",
        "如果你想继续研究流程，可以直接输入研究问题；如果只是聊天，我会先按普通对话回应。",
        offlineNote,
      ].join("\n"),
    };
  }

  if (record.intent === "clarify") {
    return {
      summary: "Clarifier 因模型不可用而暂停研究澄清。",
      artifact: [
        modelUnavailableIntro,
        `你刚才输入的是：“${topic}”。这句话表达了想咨询研究，但没有给出可判断的具体研究对象或题目。`,
        "",
        "请重新发送更具体的研究信息，例如：研究主题、研究对象、城市/案例、数据来源、你想产出的内容。模型恢复后 Clarifier 才应该基于这些信息收敛选题。",
        "",
        offlineNote,
      ].join("\n"),
    };
  }

  if (record.intent === "research") {
    const foundPapers = parseLivePapers(toolContext?.data);
    if (foundPapers.length) {
      return {
        summary: "Research Agent 已使用检索工具结果给出离线文献列表。",
        artifact: [
          "检索工具已经部分成功，但后续 OpenAI 模型整理失败，所以我先直接展示真实检索结果。",
          "",
          "已返回的候选文献：",
          ...foundPapers.slice(0, 8).map((paper, index) => formatFallbackPaper(paper, index + 1)),
          "",
          "说明：这些条目来自已成功返回的文献源，仍需要后续模型或人工进一步筛选相关性、研究方法和可引用价值。",
          offlineNote,
        ].join("\n"),
      };
    }

    return {
      summary: "Research Agent 因模型不可用而暂停检索建议。",
      artifact: [
        modelUnavailableIntro,
        `你刚才输入的是：“${topic}”。由于无法调用模型，我不会生成关键词、文献方向或研究判断，避免把不相关主题强行套入回复。`,
        "请稍后重试，或先补充明确关键词/研究对象后再发起检索。",
        offlineNote,
      ].join("\n"),
    };
  }

  if (record.intent === "write") {
    return {
      summary: "Writer 因模型不可用而暂停写作建议。",
      artifact: [
        modelUnavailableIntro,
        `你刚才输入的是：“${topic}”。当前不能可靠生成段落、框架或核心机制。`,
        "请稍后重试，或先提供已有标题/摘要/大纲，让系统恢复后继续处理。",
        offlineNote,
      ].join("\n"),
    };
  }

  if (record.intent === "review") {
    return {
      summary: "Reviewer 因模型不可用而暂停评价。",
      artifact: [
        modelUnavailableIntro,
        `你刚才输入的是：“${topic}”。当前不能可靠判断研究质量、风险或缺口。`,
        "请稍后重试，或先粘贴需要评价的具体文本。",
        offlineNote,
      ].join("\n"),
    };
  }

  return {
    summary: `${step.agent} 已给出离线回复。`,
    artifact: [`我理解你的问题是：“${topic}”。`, "当前外部模型调用不可用，我先用本地规则给出保守建议：请补充研究对象、范围、数据来源或你希望产出的材料类型。", offlineNote].join("\n"),
  };
}

function classifyOpenAIFailure(reason: string) {
  if (/aborted|timeout|fetch failed/i.test(reason)) {
    return "\n注：当前外部模型请求超时或网络不可达，所以这轮使用本地规则回复；这通常不是额度用完。";
  }

  if (/401|invalid_api_key/i.test(reason)) {
    return "\n注：OpenAI API key 可能无效，需要检查 .env.local。";
  }

  if (/insufficient_quota|quota|billing/i.test(reason)) {
    return "\n注：OpenAI 额度或账单可能有问题，需要检查账户余额。";
  }

  if (/model|404|400/i.test(reason)) {
    return "\n注：OpenAI 模型名或请求参数可能不兼容，需要检查 OPENAI_MODEL。";
  }

  return "\n注：当前外部模型调用失败，所以这轮使用本地规则回复。";
}

function parseLivePapers(data?: string) {
  if (!data) return [] as ResearchPaper[];
  try {
    const parsed = JSON.parse(data) as { papers?: ResearchPaper[] };
    return Array.isArray(parsed.papers) ? parsed.papers.filter((paper) => paper?.title) : [];
  } catch {
    return [] as ResearchPaper[];
  }
}

function formatFallbackPaper(paper: ResearchPaper, index: number) {
  const meta = [paper.authors.slice(0, 3).join(", "), paper.year, paper.venue].filter(Boolean).join(" | ");
  const link = paper.doi ? `https://doi.org/${paper.doi}` : paper.url;
  return [`${index}. ${paper.title}`, meta ? `   ${meta}` : "", link ? `   ${link}` : ""].filter(Boolean).join("\n");
}

async function loadToolContext(record: RunRecord, step: RunStep) {
  if (step.output !== "paper-pool.json" && step.id !== "research-dialogue") {
    return { traces: [] as ResearchToolTrace[], data: "" };
  }

  const cachedPaperSearch = record.liveToolContexts["paper-search"];
  if (cachedPaperSearch) {
    record.events.push(createRunEvent("Tool", "tool_call", "Research Agent is using the live paper search context selected by Orchestrator."));
    return { traces: [] as ResearchToolTrace[], data: cachedPaperSearch };
  }

  record.events.push(createRunEvent("Tool", "tool_call", "Searching OpenAlex, Semantic Scholar, and Crossref for live paper metadata."));
  const result = await searchResearchSources(record.topic);
  record.liveSearchQuality = result.quality;
  record.liveToolContexts["paper-search"] = JSON.stringify(
    {
      papers: result.papers,
      quality: result.quality,
      totalAvailable: result.totalAvailable,
      query: result.query,
      fallbackSeedAvailable: result.quality.fallbackRecommended,
      fallbackInstruction: result.quality.fallbackRecommended
        ? "Live search is too thin or partially failed. Use seedMaterials as fallback context, and clearly mark any unsupported claims as hypotheses."
        : undefined,
    },
    null,
    2,
  );
  for (const trace of result.traces) {
    record.events.push(createRunEvent("Tool", "tool_call", `${trace.tool}: ${trace.summary}`));
  }
  if (result.quality.issues.length) {
    record.events.push(createRunEvent("Tool", "tool_call", `Live search quality issues: ${result.quality.issues.join(" ")}`));
  }

  return {
    traces: result.traces,
    data: record.liveToolContexts["paper-search"],
  };
}

function buildStepPrompt(
  record: RunRecord,
  step: RunStep,
  skill: SkillModule,
  toolContext: { traces: ResearchToolTrace[]; data: string },
) {
  const context = {
    topic: record.topic,
    intent: record.intent,
    recentConversation: record.history.slice(-8),
    sessionSummary: record.memoryContext.summary,
    projectMemory: record.memoryContext.projectMemory,
    userPreferences: record.memoryContext.userPreferences,
    decision: step.decision,
    output: step.output,
    previousArtifacts: record.artifacts,
    liveToolContext: toolContext.data,
    seedMaterials: record.intent === "full_workflow" ? getSeedMaterials(step.output) : "",
  };

  return [
    `You are ${step.agent} inside ResearchFlow Agent.`,
    "Follow only the loaded skill for this step. Do not use unrelated skills or act as other agents.",
    record.intent !== "full_workflow"
      ? "This is a routed conversational turn. Answer as the selected agent. Do not use demo TOD blueprint content or infer a prior research topic unless the latest user input, current conversation, or current project memory explicitly provides it. Standalone recent chats do not share memory with other chats. Project chats may use only the memory for the same project. Do not create a file unless the user explicitly asked for an artifact."
      : "This is a paper-blueprint workflow run. Produce the requested step artifact.",
    `Loaded skill (${skill.name}, ${skill.promptBytes} bytes):\n${skill.content}`,
    `Current context:\n${JSON.stringify(context, null, 2)}`,
    outputInstructions,
  ].join("\n\n");
}

function getSeedMaterials(output: ArtifactName) {
  if (output === "paper-pool.json") return readSampleInternal("paper-pool.json");
  if (output === "evidence-pack.json") return readSampleInternal("evidence-pack.json");
  if (output === "paper-blueprint.md") return readSampleArtifact("paper-blueprint.md");
  if (output === "review-notes.json") return readSampleInternal("review-notes.json");
  if (output === "revision-log.json") return readSampleInternal("revision-log.json");
  if (output === "gap-analysis.json") return readSampleInternal("gap-analysis.json");
  return "";
}

function persistRunArtifact(runId: string, file: ArtifactName, content: string) {
  if (file === "conversation-response.md") return;

  const runtimeRoot = process.env.VERCEL ? path.join("/tmp", "researchflow-agent") : process.cwd();
  const runDir = path.join(runtimeRoot, "sample-project", "runs", runId);
  const internalDir = path.join(runDir, "internal");
  const isInternal = file.endsWith(".json");
  const outputPath = isInternal ? path.join(internalDir, file) : path.join(runDir, file);

  mkdirSync(isInternal ? internalDir : runDir, { recursive: true });
  writeFileSync(outputPath, content, "utf8");
}

async function callOpenAI(prompt: string): Promise<OpenAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  if (!apiKey) throw new Error("OPENAI_API_KEY is missing in .env.local");

  const reasoningEnabled = process.env.OPENAI_REASONING_ENABLED !== "false";
  const body = JSON.stringify({
    model,
    input: prompt,
    ...(reasoningEnabled
      ? {
          reasoning: {
            effort: process.env.OPENAI_REASONING_EFFORT || "medium",
            summary: process.env.OPENAI_REASONING_SUMMARY || "auto",
          },
        }
      : {}),
  });

  let response: Response | undefined;
  let detail = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetchWithTimeout(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body,
      },
      12000,
    );

    if (response.ok) break;

    detail = await response.text().catch(() => "");
    if (![429, 500, 502, 503, 504, 520].includes(response.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }

  if (!response?.ok) {
    throw new Error(`OpenAI API failed: ${response?.status ?? "unknown"} ${detail.slice(0, 180)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      summary?: Array<{ text?: string }>;
      content?: Array<{ text?: string }>;
    }>;
  };

  const text =
    data.output_text || data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") || "";
  const reasoningSummary = data.output
    ?.filter((item) => item.type === "reasoning")
    .flatMap((item) => item.summary ?? [])
    .map((item) => item.text ?? "")
    .filter(Boolean)
    .join("\n");

  return { text, reasoningSummary: reasoningSummary || undefined };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseAgentOutput(text: string): AgentOutput {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonText) as { artifact?: unknown; quickActions?: unknown; summary?: unknown };

  if (!parsed.summary || !parsed.artifact) {
    throw new Error("OpenAI response did not include summary and artifact");
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : JSON.stringify(parsed.summary),
    artifact: typeof parsed.artifact === "string" ? parsed.artifact : JSON.stringify(parsed.artifact, null, 2),
    quickActions: normalizeQuickActions(parsed.quickActions),
  };
}

function normalizeQuickActions(value: unknown): QuickAction[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const actions = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { label?: unknown; value?: unknown };
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const actionValue = typeof candidate.value === "string" ? candidate.value.trim() : "";
      if (!label || !actionValue) return null;
      return { label, value: actionValue };
    })
    .filter((item): item is QuickAction => Boolean(item))
    .slice(0, 3);

  return actions.length ? actions : undefined;
}

function buildResult(record: RunRecord): RunResult {
  const elapsedSeconds = Math.max(1, Math.ceil((Date.now() - record.createdAt) / 1000));
  if (record.intent !== "full_workflow") {
    const answerStep = record.completedSteps[0];
    const answer = record.artifacts["conversation-response.md"] ?? answerStep?.summary;

    return {
      title: answer ?? `已完成回复，用时约 ${elapsedSeconds} 秒。`,
      quickActions: record.quickActions,
      logs: [
        `由 ${answerStep?.agent ?? "ResearchFlow"} 回应这轮问题。`,
        ...record.toolTraces.map((trace) => `${trace.tool}: ${trace.summary}`),
      ],
    };

    return {
      title: answerStep?.summary ?? `已完成回复，用时约 ${elapsedSeconds} 秒。`,
      logs: [
        `由 ${answerStep?.agent ?? "ResearchFlow"} 回应这轮问题。`,
        ...record.toolTraces.map((trace) => `${trace.tool}: ${trace.summary}`),
        answerStep?.summary ?? "已结合当前对话给出回应。",
      ],
    };
  }

  const reviewerStep = record.completedSteps.find((step) => step.id === "review");
  const routingStep = record.completedSteps.find((step) => step.id === "revision-routing");

  return {
    title: `ResearchFlow 已完成论文框架工作流，用时约 ${elapsedSeconds} 秒。`,
    logs: [
      "已完成范围收敛、文献检索、证据整理、缺口分析、框架生成、质量审查与返工判断。",
      ...record.toolTraces.map((trace) => `${trace.tool}: ${trace.summary}`),
      reviewerStep?.summary ?? "已完成风险检查。",
      routingStep?.summary ?? "已完成返工路由与质量门判断。",
      "最终产物已准备好：paper-blueprint.md。",
    ],
    artifact: {
      file: "paper-blueprint.md",
      href: `/api/artifacts/${record.id}/paper-blueprint.md`,
      summary: "详细论文框架，可作为后续论文写作的主线材料。",
    },
  };
}

function snapshotRun(record: RunRecord): RunSnapshot {
  const activeStep = record.status === "running" ? record.steps[record.currentIndex] : undefined;

  return {
    id: record.id,
    status: record.status,
    currentStatus: record.currentStatus,
    elapsedSeconds: Math.max(1, Math.ceil((Date.now() - record.createdAt) / 1000)),
    progress: {
      current: record.completedSteps.length,
      total: record.targetStepCount,
    },
    activeStep,
    completedSteps: record.completedSteps,
    events: record.events,
    reasoningSummary: record.reasoningSummaries.at(-1),
    toolTraces: record.toolTraces,
    requiresUserInput: record.status === "waiting_for_user",
    question: record.pendingQuestion,
    result: record.result,
  };
}

function createRunEvent(actor: RunEvent["actor"], type: RunEvent["type"], message: string): RunEvent {
  return {
    id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    actor,
    type,
    message,
    createdAt: new Date().toISOString(),
  };
}
