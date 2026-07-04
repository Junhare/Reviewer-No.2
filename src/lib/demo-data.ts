import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  MessagesSquare,
  Search,
  ShieldQuestion,
  Workflow,
} from "lucide-react";

export const project = {
  id: "tod-station-area",
  title: "TOD 模式下城市轨道交通站点周边土地利用与出行行为论文框架",
  shortTitle: "TOD station-area paper blueprint",
  status: "Paper Blueprint ready",
  phase: "Reviewed and revised",
  audience: "Graduate researchers preparing a paper outline",
  objective:
    "把一个模糊的 TOD/交通研究想法，经过澄清、文献证据、Reviewer 质询和返工，汇总成一个可继续写作的详细论文框架。",
};

export const finalArtifact = {
  file: "paper-blueprint.md",
  label: "Paper Blueprint",
  summary:
    "面向用户的最终主产物：包含暂定题目、摘要结构、引言逻辑、综述结构、研究问题、方法路线、数据变量、预期贡献和下一步写作任务。",
  owner: "Writer/Compiler Agent",
};

export const internalArtifacts = [
  {
    file: "research-brief.json",
    owner: "Clarifier Agent",
    summary: "研究目标、范围、关键词、排除项和成功标准。",
  },
  {
    file: "paper-pool.json",
    owner: "Research Agent",
    summary: "候选论文、来源链接、纳入理由和筛选标签。",
  },
  {
    file: "evidence-pack.json",
    owner: "Research Agent",
    summary: "方法、数据、变量、发现、局限的结构化证据。",
  },
  {
    file: "gap-analysis.json",
    owner: "Research Agent + Writer/Compiler",
    summary: "研究空白、可行切入点和证据缺口。",
  },
  {
    file: "review-notes.json",
    owner: "Reviewer Agent",
    summary: "按 scope、evidence、gap、method、writing 分类的质询。",
  },
  {
    file: "revision-log.json",
    owner: "Orchestrator",
    summary: "返工原因、退回对象、加载 skill 和变更摘要。",
  },
];

export const chat = [
  {
    speaker: "User",
    label: "Initial topic",
    text: "我想研究 TOD 模式下城市轨道交通站点周边土地利用和居民出行行为的关系，但还不确定具体切入点。",
  },
  {
    speaker: "Clarifier Agent",
    label: "Scope handoff",
    text: "将主题收敛为：站点周边建成环境如何影响出行行为，不同时研究房价、商业开发和所有 TOD 绩效。",
  },
  {
    speaker: "Research Agent",
    label: "Evidence handoff",
    text: "已形成内部证据包：6 篇起始论文、变量维度、方法线索、局限和可疑因果点。",
  },
  {
    speaker: "Orchestrator",
    label: "Output decision",
    text: "Reviewer 的方法与范围质询已处理，允许 Writer/Compiler 输出最终 paper-blueprint.md。",
  },
];

export const timeline = [
  {
    agent: "Orchestrator",
    action: "启动流程并选择 Clarifier Agent",
    reason: "用户输入仍是宽泛主题，需要先收敛研究对象和排除范围。",
    skill: "scope-clarification-skill",
    handoff: "研究范围摘要传给 Research Agent",
    summary: "把主题收敛到站点周边建成环境与出行行为关系。",
    icon: Workflow,
  },
  {
    agent: "Clarifier Agent",
    action: "生成内部 research brief",
    reason: "避免 TOD、房价、客流、城市设计等方向混在一起。",
    skill: "scope-clarification-skill",
    handoff: "research-brief.json",
    summary: "明确目标、关键词、边界、排除项和成功标准。",
    icon: MessagesSquare,
  },
  {
    agent: "Research Agent",
    action: "检索文献并结构化提取",
    reason: "Writer/Compiler 需要可追溯证据，而不是直接让模型写框架。",
    skill: "paper-search-skill + evidence-extraction-skill",
    handoff: "paper-pool.json + evidence-pack.json",
    summary: "整理 6 篇起始论文，提取方法、数据、变量、发现和局限。",
    icon: Search,
  },
  {
    agent: "Writer/Compiler Agent",
    action: "生成论文框架草案",
    reason: "结构化证据和 gap 分析已可用，可以开始组织论文逻辑。",
    skill: "gap-analysis-skill + paper-blueprint-writing-skill",
    handoff: "paper-blueprint.md draft",
    summary: "生成题目、摘要结构、引言逻辑、文献综述结构、研究问题和方法路线。",
    icon: FileText,
  },
  {
    agent: "Reviewer Agent",
    action: "反驳与风险识别",
    reason: "论文框架需要在输出前经过 scope、evidence、gap、method 和 writing 质询。",
    skill: "review-challenge-skill",
    handoff: "review-notes.json",
    summary: "指出因果识别、行为数据可得性和 gap 证据不足风险。",
    icon: ShieldQuestion,
  },
  {
    agent: "Orchestrator",
    action: "路由返工并判断质量门",
    reason: "Reviewer 指出 method_issue 和 gap_issue，需要 Research 补证据、Writer/Compiler 改框架。",
    skill: "revision-routing-skill",
    handoff: "Paper Blueprint ready",
    summary: "返工后确认最终主产物可以输出给用户继续撰写。",
    icon: GitBranch,
  },
];

export const metrics = [
  { value: "1", label: "main user artifact" },
  { value: "6", label: "internal handoff files" },
  { value: "6", label: "source-linked papers" },
  { value: "2", label: "revision cycles" },
];

export const blueprintSections = [
  "论文暂定标题",
  "摘要草案结构",
  "研究背景与问题提出逻辑",
  "文献综述结构",
  "核心研究问题",
  "理论框架或分析框架",
  "数据与变量设计",
  "方法路线",
  "预期贡献",
  "潜在风险与 Reviewer 质询",
  "下一步写作任务",
];

export const revisionSummary = [
  {
    type: "method_issue",
    route: "Writer/Compiler Agent",
    skill: "paper-blueprint-writing-skill",
    change: "在方法路线中加入数据可得性检查、变量表和谨慎的因果表述。",
  },
  {
    type: "gap_issue",
    route: "Research Agent",
    skill: "gap-analysis-skill",
    change: "将 gap 从泛泛的 TOD 绩效，收敛为 walkability 作为 land use 与 travel behavior 的中介机制。",
  },
];

export const agentCards = [
  {
    name: "Orchestrator",
    role: "主管调度",
    icon: BrainCircuit,
    text: "决定阶段、调用 Agent、加载 skill、判断质量门，并决定是否输出 paper-blueprint.md。",
  },
  {
    name: "Clarifier",
    role: "范围收敛",
    icon: MessagesSquare,
    text: "把模糊主题转成研究目标、边界、关键词和排除项，输出内部 research brief。",
  },
  {
    name: "Research",
    role: "证据工作",
    icon: BookOpen,
    text: "负责文献搜索、结构化提取和证据归档，不写最终论文框架。",
  },
  {
    name: "Writer/Compiler",
    role: "主产物编写",
    icon: ClipboardCheck,
    text: "基于内部结构化材料生成 paper-blueprint.md，并根据 Reviewer 意见修改框架。",
  },
  {
    name: "Reviewer",
    role: "反驳质询",
    icon: ShieldQuestion,
    text: "提出 scope、evidence、gap、method、writing 分类问题，不直接修改最终文件。",
  },
];

export const qualityGate = [
  {
    label: "Scope",
    status: "Passed",
    detail: "主题已限定为站点周边建成环境与出行行为。",
    icon: CheckCircle2,
  },
  {
    label: "Evidence",
    status: "Passed",
    detail: "关键论文有 DOI 或来源链接，未把无来源结论写入主产物。",
    icon: CheckCircle2,
  },
  {
    label: "Method",
    status: "Revised",
    detail: "已补充变量设计、数据可得性检查和谨慎的因果表述边界。",
    icon: CheckCircle2,
  },
];

export function artifactUrl(file = finalArtifact.file) {
  return `/artifacts/${project.id}/${file}`;
}
