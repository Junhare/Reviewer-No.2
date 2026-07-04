export type ResearchPaperSource = "openAlex" | "semanticScholar" | "crossref";

export type ResearchPaper = {
  paperId?: string;
  doi?: string;
  title: string;
  abstract?: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  url?: string;
  authors: string[];
  sources: ResearchPaperSource[];
  qualityScore: number;
  retrievalRank?: number;
};

export type ResearchToolTrace = {
  tool: string;
  query: string;
  status: "completed" | "failed" | "skipped";
  summary: string;
  fetched?: number;
  totalAvailable?: number;
};

export type ResearchSearchQuality = {
  totalCandidates: number;
  usablePapers: number;
  papersWithAbstract: number;
  papersWithDoiOrUrl: number;
  completedProviders: string[];
  failedProviders: string[];
  fallbackRecommended: boolean;
  issues: string[];
};

type ProviderSearchResult = {
  papers: ResearchPaper[];
  trace: ResearchToolTrace;
  totalAvailable?: number;
};

type SemanticScholarPaper = {
  paperId?: string;
  externalIds?: {
    DOI?: string;
  };
  title?: string;
  abstract?: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  influentialCitationCount?: number;
  url?: string;
  authors?: Array<{
    name?: string;
  }>;
};

type SemanticScholarSearchResponse = {
  data?: SemanticScholarPaper[];
  total?: number;
};

type OpenAlexWork = {
  id?: string;
  doi?: string;
  display_name?: string;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  primary_location?: {
    source?: {
      display_name?: string;
    };
  };
  cited_by_count?: number;
  authorships?: Array<{
    author?: {
      display_name?: string;
    };
  }>;
};

type OpenAlexSearchResponse = {
  meta?: {
    count?: number;
  };
  results?: OpenAlexWork[];
};

type CrossrefWork = {
  DOI?: string;
  title?: string[];
  abstract?: string;
  published?: {
    "date-parts"?: number[][];
  };
  "container-title"?: string[];
  "is-referenced-by-count"?: number;
  URL?: string;
  author?: Array<{
    given?: string;
    family?: string;
  }>;
};

type CrossrefSearchResponse = {
  message?: {
    items?: CrossrefWork[];
    "total-results"?: number;
  };
};

const providerFetchLimit = getEnvNumber("RESEARCHFLOW_PROVIDER_FETCH_LIMIT", 15);
const mergedPaperLimit = getEnvNumber("RESEARCHFLOW_MERGED_PAPER_LIMIT", 20);
const providerTimeoutMs = getEnvNumber("RESEARCHFLOW_PROVIDER_TIMEOUT_MS", 7_000);

export async function searchResearchSources(query: string) {
  const searchQuery = buildAcademicSearchQuery(query);
  const [openAlex, semanticScholar, crossref] = await Promise.all([
    searchOpenAlexWorks(searchQuery, providerFetchLimit).catch((error) => failedProvider("openAlex.searchWorks", searchQuery, error)),
    searchSemanticScholarPapers(searchQuery, providerFetchLimit).catch((error) => failedProvider("semanticScholar.searchPapers", searchQuery, error)),
    searchCrossrefWorks(searchQuery, providerFetchLimit).catch((error) => failedProvider("crossref.searchWorks", searchQuery, error)),
  ]);

  const candidates = [...openAlex.papers, ...semanticScholar.papers, ...crossref.papers].filter(isUsablePaper);
  const papers = mergeDuplicatePapers(candidates)
    .map(scorePaper)
    .sort((left, right) => right.qualityScore - left.qualityScore || (right.citationCount ?? 0) - (left.citationCount ?? 0))
    .slice(0, mergedPaperLimit);
  const traces = [openAlex.trace, semanticScholar.trace, crossref.trace];
  const quality = summarizeSearchQuality(candidates.length, papers, traces);

  return {
    papers,
    traces,
    quality,
    query: searchQuery,
    totalAvailable: Math.max(openAlex.totalAvailable ?? 0, semanticScholar.totalAvailable ?? 0, crossref.totalAvailable ?? 0),
  };
}

function buildAcademicSearchQuery(input: string) {
  const compact = input.trim();
  const lower = compact.toLowerCase();
  const terms = new Set<string>();

  if (/历史街区|历史文化街区|历史地段|historic(al)?\s+(district|quarter|neighbou?rhood|urban area)/i.test(compact)) {
    terms.add("historic urban district");
    terms.add("historic district regeneration");
  }
  if (/保护更新|保护性更新|城市更新|更新规划|urban renewal|urban regeneration|conservation/.test(lower)) {
    terms.add("urban regeneration");
    terms.add("heritage conservation");
  }
  if (/空间活化|空间活力|活力提升|公共空间活化|空间营造|placemaking|public space|vitality/.test(lower)) {
    terms.add("public space vitality");
    terms.add("placemaking");
  }
  if (/案例研究|案例|个案|case stud(y|ies)/i.test(compact)) {
    terms.add("case study");
  }

  if (/\btod\b|交通导向|公交导向|轨道交通导向|transit.?oriented/.test(lower)) {
    terms.add("transit-oriented development");
    terms.add("TOD");
  }
  if (/交通|出行|通勤|transport|travel|mobility/.test(lower)) {
    terms.add("transport planning");
    terms.add("travel behavior");
  }
  if (/轨道|地铁|站点|station|rail|metro|subway/.test(lower)) {
    terms.add("rail station area");
  }
  if (/步行|可达|walk|accessibility/.test(lower)) {
    terms.add("walkability");
    terms.add("accessibility");
  }
  if (/建成环境|土地利用|城市|空间|built|land use|urban/.test(lower)) {
    terms.add("built environment");
    terms.add("land use");
  }

  const cleaned = compact
    .replace(/可以|帮我|查找|检索|相关|文献|论文|吗|？|\?|一下|请/g, " ")
    .replace(/我想用|选择|题目|优化|设计|框架|给你|拟定|推荐|建议|当前|本轮/g, " ")
    .replace(/[，。！？、；：,.!?;:()[\]{}"'“”‘’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!terms.size && cleaned) return cleaned;
  return Array.from(terms).join(" ");
}

export async function searchOpenAlexWorks(query: string, limit = providerFetchLimit): Promise<ProviderSearchResult> {
  const apiKey = process.env.OPENALEX_API_KEY?.trim();
  if (!apiKey) {
    return {
      papers: [],
      trace: {
        tool: "openAlex.searchWorks",
        query,
        status: "skipped",
        summary: "OpenAlex skipped because OPENALEX_API_KEY is not configured.",
      },
    };
  }

  const params = new URLSearchParams({
    search: query,
    "per-page": String(limit),
    select: [
      "id",
      "doi",
      "display_name",
      "abstract_inverted_index",
      "publication_year",
      "primary_location",
      "cited_by_count",
      "authorships",
    ].join(","),
  });
  const response = await fetchWithTimeout(
    `https://api.openalex.org/works?${params}`,
    {
      headers: openAlexHeaders(apiKey),
    },
    providerTimeoutMs,
  );

  if (!response.ok) {
    throw new Error(`OpenAlex failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAlexSearchResponse;
  const papers = (data.results ?? []).map((work, index) => normalizeOpenAlexWork(work, index + 1)).filter((paper) => paper.title);
  const totalAvailable = data.meta?.count;

  return {
    papers,
    totalAvailable,
    trace: {
      tool: "openAlex.searchWorks",
      query,
      status: "completed",
      summary: formatProviderSummary("OpenAlex", "works", papers.length, totalAvailable),
      fetched: papers.length,
      totalAvailable,
    },
  };
}

export async function searchSemanticScholarPapers(query: string, limit = providerFetchLimit): Promise<ProviderSearchResult> {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  const requestLimit = apiKey ? limit : Math.min(limit, 10);
  const params = new URLSearchParams({
    query,
    limit: String(requestLimit),
    fields: [
      "paperId",
      "externalIds",
      "title",
      "abstract",
      "year",
      "venue",
      "citationCount",
      "influentialCitationCount",
      "url",
      "authors",
    ].join(","),
  });
  const response = await fetchWithTimeout(
    `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
    {
      headers: semanticScholarHeaders(),
    },
    providerTimeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Semantic Scholar failed: ${response.status}`);
  }

  const data = (await response.json()) as SemanticScholarSearchResponse;
  const papers = (data.data ?? []).map((paper, index) => normalizeSemanticScholarPaper(paper, index + 1)).filter((paper) => paper.title);
  const totalAvailable = data.total;

  return {
    papers,
    totalAvailable,
    trace: {
      tool: "semanticScholar.searchPapers",
      query,
      status: "completed",
      summary: formatProviderSummary("Semantic Scholar", "papers", papers.length, totalAvailable),
      fetched: papers.length,
      totalAvailable,
    },
  };
}

export async function getSemanticScholarPaper(paperId: string) {
  const params = new URLSearchParams({
    fields: "paperId,externalIds,title,abstract,year,venue,citationCount,influentialCitationCount,url,authors",
  });
  const response = await fetchWithTimeout(
    `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(paperId)}?${params}`,
    {
      headers: semanticScholarHeaders(),
    },
    providerTimeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Semantic Scholar paper lookup failed: ${response.status}`);
  }

  return normalizeSemanticScholarPaper((await response.json()) as SemanticScholarPaper);
}

export async function searchCrossrefWorks(query: string, rows = providerFetchLimit): Promise<ProviderSearchResult> {
  const params = new URLSearchParams({
    query,
    rows: String(rows),
    select: "DOI,title,abstract,published,container-title,is-referenced-by-count,URL,author",
  });
  const mailto = process.env.CROSSREF_MAILTO?.trim();
  if (mailto) {
    params.set("mailto", mailto);
  }

  const response = await fetchWithTimeout(`https://api.crossref.org/works?${params}`, {}, providerTimeoutMs);
  if (!response.ok) {
    throw new Error(`Crossref failed: ${response.status}`);
  }

  const data = (await response.json()) as CrossrefSearchResponse;
  const papers = (data.message?.items ?? []).map((work, index) => normalizeCrossrefWork(work, index + 1)).filter((paper) => paper.title);
  const totalAvailable = data.message?.["total-results"];

  return {
    papers,
    totalAvailable,
    trace: {
      tool: "crossref.searchWorks",
      query,
      status: "completed",
      summary: formatProviderSummary("Crossref", "works", papers.length, totalAvailable),
      fetched: papers.length,
      totalAvailable,
    },
  };
}

export async function getCrossrefWorkByDoi(doi: string) {
  const mailto = process.env.CROSSREF_MAILTO?.trim();
  const suffix = mailto ? `?${new URLSearchParams({ mailto })}` : "";
  const response = await fetchWithTimeout(`https://api.crossref.org/works/${encodeURIComponent(doi)}${suffix}`, {}, providerTimeoutMs);
  if (!response.ok) {
    throw new Error(`Crossref DOI lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    message?: CrossrefWork;
  };

  return normalizeCrossrefWork(data.message ?? {});
}

function failedProvider(tool: string, query: string, error: unknown): ProviderSearchResult {
  return {
    papers: [],
    trace: {
      tool,
      query,
      status: "failed",
      summary: error instanceof Error ? error.message : `${tool} failed.`,
    },
  };
}

function formatProviderSummary(provider: string, itemName: string, fetched: number, totalAvailable?: number) {
  if (typeof totalAvailable === "number") {
    return `${provider} matched ${totalAvailable.toLocaleString("en-US")} ${itemName}; fetched top ${fetched}.`;
  }

  return `${provider} fetched ${fetched} ${itemName}; total match count unavailable.`;
}

function semanticScholarHeaders() {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  return apiKey ? { "x-api-key": apiKey } : undefined;
}

function openAlexHeaders(apiKey: string) {
  return { authorization: `Bearer ${apiKey}` };
}

function normalizeOpenAlexWork(work: OpenAlexWork, retrievalRank?: number): ResearchPaper {
  return scorePaper({
    paperId: work.id,
    doi: cleanDoi(work.doi),
    title: cleanText(work.display_name) ?? "",
    abstract: decodeOpenAlexAbstract(work.abstract_inverted_index),
    year: work.publication_year,
    venue: cleanText(work.primary_location?.source?.display_name),
    citationCount: work.cited_by_count,
    url: work.doi ?? work.id,
    authors:
      work.authorships
        ?.map((authorship) => cleanText(authorship.author?.display_name))
        .filter(isPresent) ?? [],
    sources: ["openAlex"],
    qualityScore: 0,
    retrievalRank,
  });
}

function normalizeSemanticScholarPaper(paper: SemanticScholarPaper, retrievalRank?: number): ResearchPaper {
  return scorePaper({
    paperId: paper.paperId,
    doi: paper.externalIds?.DOI,
    title: cleanText(paper.title) ?? "",
    abstract: cleanText(paper.abstract),
    year: paper.year,
    venue: cleanText(paper.venue),
    citationCount: paper.citationCount,
    influentialCitationCount: paper.influentialCitationCount,
    url: paper.url,
    authors: paper.authors?.map((author) => cleanText(author.name)).filter(Boolean) as string[] ?? [],
    sources: ["semanticScholar"],
    qualityScore: 0,
    retrievalRank,
  });
}

function normalizeCrossrefWork(work: CrossrefWork, retrievalRank?: number): ResearchPaper {
  return scorePaper({
    doi: cleanText(work.DOI),
    title: cleanText(work.title?.[0]) ?? "",
    abstract: stripTags(work.abstract),
    year: work.published?.["date-parts"]?.[0]?.[0],
    venue: cleanText(work["container-title"]?.[0]),
    citationCount: work["is-referenced-by-count"],
    url: work.URL,
    authors:
      work.author
        ?.map((author) => cleanText([author.given, author.family].filter(Boolean).join(" ")))
        .filter(isPresent) ?? [],
    sources: ["crossref"],
    qualityScore: 0,
    retrievalRank,
  });
}

function mergeDuplicatePapers(papers: ResearchPaper[]) {
  const papersByKey = new Map<string, ResearchPaper>();

  for (const paper of papers) {
    const key = paperKey(paper);
    const existing = papersByKey.get(key);
    papersByKey.set(key, existing ? mergePaper(existing, paper) : paper);
  }

  return [...papersByKey.values()];
}

function mergePaper(left: ResearchPaper, right: ResearchPaper): ResearchPaper {
  const citationCount = Math.max(left.citationCount ?? 0, right.citationCount ?? 0) || undefined;
  const influentialCitationCount =
    Math.max(left.influentialCitationCount ?? 0, right.influentialCitationCount ?? 0) || undefined;

  return scorePaper({
    paperId: left.paperId ?? right.paperId,
    doi: left.doi ?? right.doi,
    title: richerText(left.title, right.title) ?? left.title,
    abstract: richerText(left.abstract, right.abstract),
    year: left.year ?? right.year,
    venue: left.venue ?? right.venue,
    citationCount,
    influentialCitationCount,
    url: left.url ?? right.url,
    authors: left.authors.length >= right.authors.length ? left.authors : right.authors,
    sources: Array.from(new Set([...left.sources, ...right.sources])),
    qualityScore: 0,
    retrievalRank: minDefined(left.retrievalRank, right.retrievalRank),
  });
}

function summarizeSearchQuality(totalCandidates: number, papers: ResearchPaper[], traces: ResearchToolTrace[]): ResearchSearchQuality {
  const completedProviders = traces.filter((trace) => trace.status === "completed").map((trace) => trace.tool);
  const failedProviders = traces.filter((trace) => trace.status === "failed").map((trace) => trace.tool);
  const papersWithAbstract = papers.filter((paper) => Boolean(paper.abstract && paper.abstract.length >= 120)).length;
  const papersWithDoiOrUrl = papers.filter((paper) => Boolean(paper.doi || paper.url)).length;
  const issues: string[] = [];

  if (!completedProviders.length) issues.push("No live paper provider completed successfully.");
  if (papers.length < 4) issues.push("Fewer than 4 usable papers remained after filtering and deduplication.");
  if (papersWithAbstract < 2) issues.push("Fewer than 2 usable papers include abstracts.");
  if (papersWithDoiOrUrl < 4) issues.push("Fewer than 4 usable papers include DOI or URL metadata.");

  return {
    totalCandidates,
    usablePapers: papers.length,
    papersWithAbstract,
    papersWithDoiOrUrl,
    completedProviders,
    failedProviders,
    fallbackRecommended: issues.length > 0,
    issues,
  };
}

function scorePaper(paper: ResearchPaper): ResearchPaper {
  const citationScore = Math.min(Math.log10((paper.citationCount ?? 0) + 1) * 8, 24);
  const recencyScore = scoreRecency(paper.year);
  const retrievalScore = scoreRetrievalRank(paper.retrievalRank);
  const qualityScore =
    20 +
    (paper.doi ? 16 : 0) +
    (paper.url ? 10 : 0) +
    (paper.abstract && paper.abstract.length >= 120 ? 22 : 0) +
    recencyScore +
    (paper.venue ? 8 : 0) +
    (paper.authors.length ? 6 : 0) +
    (paper.sources.length > 1 ? 8 : 0) +
    retrievalScore +
    citationScore;

  return {
    ...paper,
    qualityScore: Math.round(qualityScore),
  };
}

function scoreRecency(year?: number) {
  if (!year) return 0;
  const age = Math.max(0, new Date().getFullYear() - year);
  if (age <= 2) return 16;
  if (age <= 5) return 14;
  if (age <= 10) return 11;
  if (age <= 20) return 7;
  return 3;
}

function scoreRetrievalRank(rank?: number) {
  if (!rank) return 0;
  return Math.max(0, 18 - Math.log2(rank) * 4);
}

function isUsablePaper(paper: ResearchPaper) {
  const title = paper.title.trim();
  if (title.length < 8) return false;
  if (/^(correction|erratum|retracted|withdrawn)\b/i.test(title)) return false;
  if (paper.year && (paper.year < 1950 || paper.year > new Date().getFullYear() + 1)) return false;
  return Boolean(paper.doi || paper.url || paper.abstract || paper.paperId);
}

function paperKey(paper: ResearchPaper) {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
  if (paper.paperId) return `paper:${paper.paperId}`;
  return `title:${normalizeTitle(paper.title)}`;
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function richerText(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

function minDefined(left?: number, right?: number) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.min(left, right);
}

function cleanText(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function cleanDoi(value?: string) {
  return cleanText(value?.replace(/^https?:\/\/doi\.org\//i, ""));
}

function decodeOpenAlexAbstract(index?: Record<string, number[]>) {
  if (!index) return undefined;

  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      words.push({ word, position });
    }
  }

  return cleanText(words.sort((left, right) => left.position - right.position).map(({ word }) => word).join(" "));
}

function isPresent<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function stripTags(value?: string) {
  return cleanText(value?.replace(/<[^>]*>/g, " "));
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

function getEnvNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
