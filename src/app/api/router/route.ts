import { NextResponse } from "next/server";

type RouterIntent =
  | "ordinary_chat"
  | "user_state"
  | "system_help"
  | "research_request"
  | "research_followup"
  | "answer_pending_question"
  | "task_control";

type RouterResult = {
  intent: RouterIntent;
  route: "conversation" | "researchflow" | "resume_pending" | "task_control";
  confidence: number;
  reply: string;
  reason: string;
};

const fallbackResult: RouterResult = {
  intent: "ordinary_chat",
  route: "conversation",
  confidence: 0.5,
  reply: "我先把这句话当作普通对话处理。如果你想继续研究任务，可以直接输入具体研究问题。",
  reason: "Local fallback used conservative conversation route.",
};

const defaultRouterModel = "gpt-5.4";
const defaultRouterTimeoutMs = 25_000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    input?: string;
    hasPendingRun?: boolean;
    recentHistory?: Array<{ role: "user" | "assistant"; body: string }>;
  } | null;

  const input = body?.input?.trim();
  if (!input) {
    return NextResponse.json({ ...fallbackResult, reply: "请输入一句话或一个研究问题。" });
  }

  const localDecision = buildRuleFallback(input, Boolean(body?.hasPendingRun));
  if (localDecision.confidence >= 0.9) {
    return NextResponse.json(localDecision);
  }

  const prompt = buildRouterPrompt(input, Boolean(body?.hasPendingRun), body?.recentHistory ?? []);

  try {
    const result = await callOpenAIRouter(prompt);
    return NextResponse.json(result);
  } catch (error) {
    console.error("LLM router failed", error);
    return NextResponse.json(buildRuleFallback(input, Boolean(body?.hasPendingRun)));
  }
}

function buildRouterPrompt(
  input: string,
  hasPendingRun: boolean,
  recentHistory: Array<{ role: "user" | "assistant"; body: string }>,
) {
  return [
    "You are the Conversation Router for a research agent product named ResearchFlow.",
    "Classify the user's latest input. Return strict JSON only. Do not execute the research task.",
    "The latest input is more important than previous context.",
    "",
    "Available intents:",
    "- ordinary_chat: greetings, thanks, casual chat, or small talk that is not about the user's personal state.",
    "- user_state: the user describes their own physical state, emotion, sensation, mood, comfort, discomfort, health, energy, or immediate personal condition.",
    "- system_help: user asks who you are, what you can do, or how to use the product.",
    "- research_request: user proposes a new research topic or asks for research help.",
    "- research_followup: user asks a research-related follow-up without starting a full new workflow.",
    "- answer_pending_question: user appears to answer a currently pending research clarification.",
    "- task_control: cancel, stop, reset, new topic.",
    "",
    "Routes:",
    "- conversation: ordinary_chat, user_state, system_help.",
    "- researchflow: research_request or research_followup.",
    "- resume_pending: answer_pending_question.",
    "- task_control: task_control.",
    "",
    "Critical classification rules:",
    "- Classify personal state expressions as user_state, not ordinary_chat.",
    "- user_state examples: 我感觉好冷啊, 我说好冷呢, 有点冷, 我有点累, 我饿了, 我头有点疼, 我有点焦虑, 今天状态不好, I feel cold, I'm tired, I'm hungry.",
    "- ordinary_chat examples: 你好, 哈哈, 在吗, 谢谢, 今天聊点什么.",
    "- research_request examples: 我想研究 TOD 和居民出行行为, 帮我写一个论文框架, 检索 TOD 文献, 做一个文献综述.",
    "- If hasPendingRun is true, only use answer_pending_question when the latest input clearly answers the pending research clarification.",
    "- A personal state like cold/tired/hungry remains user_state even when a research run is pending.",
    "- Do not infer a research topic from previous TOD context unless the latest input itself is research-related.",
    "",
    "Reply policy:",
    "- If route is conversation and intent is user_state, reply empathetically in concise Chinese. Do not mention research unless it is a soft transition.",
    "- If route is conversation and intent is ordinary_chat/system_help, reply naturally in concise Chinese.",
    "- If route is researchflow or resume_pending, reply must be an empty string.",
    "- If route is task_control, reply should confirm the control action in concise Chinese.",
    "",
    `Has pending run: ${hasPendingRun}`,
    `Recent history: ${JSON.stringify(recentHistory.slice(-6))}`,
    `Latest input: ${input}`,
    "",
    "Return JSON with exactly these keys: intent, route, confidence, reply, reason. confidence is 0-1.",
  ].join("\n");
}

async function callOpenAIRouter(prompt: string): Promise<RouterResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_ROUTER_MODEL || process.env.OPENAI_MODEL || defaultRouterModel;
  const timeoutMs = Number(process.env.OPENAI_ROUTER_TIMEOUT_MS || defaultRouterTimeoutMs);
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 500,
    }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI router failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  const text =
    data.output_text || data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") || "";
  const parsed = JSON.parse(extractJson(text)) as Partial<RouterResult>;

  if (!parsed.intent || !parsed.route) throw new Error("Router JSON missing intent or route");

  return {
    intent: parsed.intent,
    route: parsed.route,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    reason: typeof parsed.reason === "string" ? parsed.reason : "LLM router classified the input.",
  } as RouterResult;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  return trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
}

function buildRuleFallback(input: string, hasPendingRun: boolean): RouterResult {
  const compact = input.trim().toLowerCase().replace(/[\s。！？!?.,，、~～]+/g, "");

  if (/^(你是谁|你是谁呀|你是谁啊|你是什么|你能做什么|介绍一下你|whoareyou|whatcanyoudo)$/.test(compact)) {
    return {
      intent: "system_help",
      route: "conversation",
      confidence: 0.9,
      reply: "我是 ResearchFlow 的对话助手，可以帮你发起研究任务、梳理问题、检索和组织文献线索，也可以回答这个工具怎么用。",
      reason: "Matched local system-help fallback.",
    };
  }

  if (/^(取消|停止|暂停|不用了|算了|退出|cancel|stop)$/.test(compact)) {
    return {
      intent: "task_control",
      route: "task_control",
      confidence: 0.9,
      reply: hasPendingRun ? "已取消当前等待确认的研究流程。" : "当前没有需要取消的研究流程。",
      reason: "Matched local task-control fallback.",
    };
  }

  if (hasPendingRun && !/^(你好|您好|哈喽|嗨|在吗|hi|hello|hey)$/.test(compact)) {
    return {
      intent: "answer_pending_question",
      route: "resume_pending",
      confidence: 0.8,
      reply: "",
      reason: "Pending run exists and the latest input is treated as a clarification answer.",
    };
  }

  if (/研究|论文|文献|综述|选题|课题|框架|提纲|方法|变量|数据|模型|TOD|交通|规划|城市|轨道|站点|出行|土地利用|建成环境|可达性|Reviewer|review|paper|article/i.test(input)) {
    return {
      intent: "research_request",
      route: "researchflow",
      confidence: 0.75,
      reply: "",
      reason: "Matched research keywords in rule fallback.",
    };
  }

  return fallbackResult;
}
