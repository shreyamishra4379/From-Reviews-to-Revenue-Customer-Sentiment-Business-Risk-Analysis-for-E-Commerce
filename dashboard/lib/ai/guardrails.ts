import { readFileSync } from "fs";
import { join } from "path";
import { STATE_NAMES } from "@/lib/format";

// AI guardrails for Ask AI. Every message is classified HERE, before any provider call:
//
//   greeting / thanks / goodbye / "what can you do"  -> answered locally (0 API tokens)
//   off-topic (weather, people, general maths, ...)   -> declined locally (0 API tokens)
//   project question, or a follow-up to one           -> sent to Groq / Gemini
//
// Local replies are composed for each message from the project's real results (a
// random fact, suggestions built from real category and state names, the time of day,
// the user's own greeting word, whether they already greeted), so they are not fixed
// canned strings.

export type Intent = "greeting" | "thanks" | "farewell" | "capabilities" | "project" | "off_topic";

export interface Turn { role: "user" | "assistant"; content: string }

// ── Text normalisation ───────────────────────────────────────────────────────
/** lower-case, no accents, repeated letters collapsed ("Hiiiii" -> "hi", "Nooooo" -> "no") */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z0-9$%'\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const words = (t: string) => t.split(" ").filter(Boolean);

// ── Small talk ───────────────────────────────────────────────────────────────
const GREETING_WORDS = new Set([
  "hi", "hii", "hello", "helo", "hey", "heya", "hiya", "yo", "hola", "oi", "ola", "namaste", "namaskar",
  "greetings", "howdy", "sup", "wassup", "whats", "what's", "up", "good", "morning", "afternoon", "evening",
  "day", "there", "all", "everyone", "team", "bot", "assistant", "buddy", "friend", "dear", "sir", "madam",
  "how", "are", "you", "u", "r", "doing", "is", "it", "going", "bom", "dia", "boa", "tarde", "noite", "and",
]);
const THANKS_WORDS = new Set([
  "thanks", "thank", "thx", "ty", "tq", "you", "so", "much", "a", "lot", "obrigado", "obrigada", "great",
  "awesome", "nice", "cool", "perfect", "ok", "okay", "got", "it", "helpful", "that", "was", "very", "super",
  "brilliant", "amazing", "good", "job", "appreciate", "cheers",
]);
const FAREWELL_WORDS = new Set([
  "bye", "goodbye", "good", "night", "see", "you", "later", "soon", "ya", "cya", "tchau", "take", "care",
  "that's", "thats", "all", "for", "now", "today", "done", "ok", "okay", "thanks",
]);
const SMALL_TALK_MAX_WORDS = 7;

function onlyWordsFrom(ws: string[], vocab: Set<string>): boolean {
  return ws.length > 0 && ws.length <= SMALL_TALK_MAX_WORDS && ws.every(w => vocab.has(w));
}

const CAPABILITY_PATTERNS = [
  /^(what|which)( all)? (can|could|do) (you|u) (do|help|answer|tell)/,
  /^(who|what) are (you|u)\b/,
  /^(help|menu|options|start)$/,
  /^how (can|do) (you|u|i) (help|use)/,
  /^what (kind of |type of |sort of )?questions/,
];

// ── Project vocabulary ───────────────────────────────────────────────────────
const DOMAIN_TERMS = [
  "review", "rating", "rated", "star", "stars", "score", "sentiment", "positive", "negative", "neutral",
  "complain", "complaint", "customer", "buyer", "order", "deliver", "delivery", "late", "delay", "on time",
  "on-time", "shipping", "ship", "freight", "carrier", "price", "priced", "seller", "vendor", "store",
  "category", "categories", "product", "item", "revenue", "sales", "sale", "exposure", "risk", "money", "brl",
  "reais", "r$", "topic", "aspect", "nlp", "text", "comment", "portuguese", "language model", "xlm",
  "roberta", "transformer", "embedding", "cluster", "kmeans", "k-means", "tf-idf", "tfidf", "nmf", "sql",
  "query", "queries", "table", "duckdb", "parquet", "dataset", "data set", "the data", "this data", "olist",
  "brazil", "brazilian", "state", "city", "statistic", "correlation", "spearman", "regression", "logistic",
  "odds", "mann-whitney", "mann whitney", "kruskal", "p-value", "p value", "pvalue", "significan", "median",
  "average rating", "average score", "rate", "percentage", "trend", "monthly", "per month", "2016", "2017",
  "2018", "fraud", "scam", "counterfeit", "fake", "security", "integrity", "pentest", "penetration",
  "attack", "dashboard", "project", "analysis", "analytics", "pipeline", "stage", "methodology", "method",
  "eda", "insight", "finding", "result", "payment", "installment", "boleto", "voucher", "credit card",
  "refund", "return", "profit", "margin", "clv", "lifetime value", "prioriti", "priority", "segment",
  "act first", "scenario", "business impact", "recommend", "agreement", "accuracy", "limitation",
  "assumption", "causation", "causal", "association", "sample size", "low-n", "low n", "fingerprint",
  "sha-256", "manifest", "unhappy", "dissatisf", "satisf", "quality", "packaging", "damaged", "broken",
  "wrong item", "missing item", "description", "customer service",
];

// Words from category names that are too generic to mean "this project" on their own
const GENERIC = new Set(["stuff", "general", "interest", "other", "others", "small", "house", "fixed",
  "games", "tools", "drinks", "music", "books", "party", "christmas", "supplies", "signaling", "security"]);

// Short follow-ups ("why?", "and the second one?") count only right after a project question.
const FOLLOW_UP_CUES = /\b(why|how come|more|explain|elaborate|detail|details|what about|and|which|that|those|this|these|it|its|them|they|second|third|first|last|other|others|else|also|too|instead|same|compare|versus|vs|breakdown|show|list|top|bottom|example|examples|mean|means|meaning)\b/;
const FOLLOW_UP_MAX_WORDS = 14;

interface ProjectContext {
  phrases: string[];        // multi-word / symbol terms, matched as whole phrases
  prefixes: string[];       // domain words, matched as word prefixes ("deliver" -> "delivered")
  exact: Set<string>;       // short terms and real category / state / aspect words, whole words only
  categories: string[];     // well-reviewed categories, readable names
  states: { code: string; name: string }[];
  aspects: string[];
  facts: (() => string)[];
}

let ctxCache: ProjectContext | null = null;

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "public", "data", `${name}.json`), "utf-8")) as T;
}

const readable = (s: string) => s.replace(/_/g, " ");
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const sample = <T,>(xs: T[], n: number): T[] => [...xs].sort(() => Math.random() - 0.5).slice(0, n);
const pct = (f: number) => `${(f * 100).toFixed(1)}%`;
const isPhrase = (t: string) => /[ $-]/.test(t);

function context(): ProjectContext {
  if (ctxCache) return ctxCache;
  const overview = loadJson<{
    reviews_with_text: number; text_coverage_pct: number;
    ontime_vs_late: { ontime_mean: number; late_mean: number; late_neg_review_rate: number; ontime_neg_review_rate: number };
    headlines: {
      top_aspects_by_negative: { aspect: string; share_of_negative_pct: number }[];
      highest_negative_rate_aspect: { aspect: string; neg_pct: number };
      late_delivery: { late_pct: number };
      exposure: { affected_order_value_BRL: number; affected_orders: number };
      act_first: { count: number; categories: { category: string }[] };
    };
  }>("overview");
  const cats = loadJson<{ categories: { category: string; low_n: boolean }[] }>("category_intelligence").categories;
  const nlp = loadJson<{ aspects: { aspect: string }[]; topics: { label: string }[] }>("nlp_insights");
  const delivery = loadJson<{ state_late_rates: { state: string; late_rate_pct: number }[] }>("delivery");

  const h = overview.headlines;
  const o = overview.ontime_vs_late;
  const states = Object.entries(STATE_NAMES).map(([code, name]) => ({ code, name }));
  const worstState = delivery.state_late_rates[0];

  const facts: (() => string)[] = [
    () => `late orders average ${o.late_mean.toFixed(2)} stars, against ${o.ontime_mean.toFixed(2)} when they arrive on time`,
    () => `${pct(o.late_neg_review_rate)} of reviews on late orders are 1 or 2 stars, compared with ${pct(o.ontime_neg_review_rate)} for on-time orders`,
    () => `${h.top_aspects_by_negative[0].aspect.toLowerCase()} is the most common complaint, at ${h.top_aspects_by_negative[0].share_of_negative_pct}% of negative aspect mentions`,
    () => `when a review mentions a ${h.highest_negative_rate_aspect.aspect.toLowerCase()}, it is negative ${h.highest_negative_rate_aspect.neg_pct}% of the time`,
    () => `${h.late_delivery.late_pct}% of delivered orders arrived after their estimated date`,
    () => `${h.act_first.count} categories combine high complaint rates with high order value, led by ${readable(h.act_first.categories[0].category)}`,
    () => `${STATE_NAMES[worstState.state] ?? worstState.state} has the highest late-delivery rate of any state, at ${worstState.late_rate_pct.toFixed(1)}%`,
    () => `${overview.reviews_with_text.toLocaleString("en-US")} reviews (${overview.text_coverage_pct}%) include written text, all in Portuguese`,
    () => `R$ ${(h.exposure.affected_order_value_BRL / 1e6).toFixed(2)}M of order value sits in ${h.exposure.affected_orders.toLocaleString("en-US")} orders with a negative review`,
  ];

  const domain = DOMAIN_TERMS.map(normalise);
  const named = [
    ...cats.map(c => readable(c.category)),
    ...states.map(s => s.name),
    ...nlp.aspects.map(a => a.aspect.replace("/", " ")),
    ...nlp.topics.map(t => t.label.replace("/", " ")),
  ].map(normalise);
  const namedWords = named.flatMap(n => words(n)).filter(w => w.length >= 5 && !GENERIC.has(w));

  const ctx: ProjectContext = {
    phrases: [...new Set([...domain, ...named].filter(isPhrase))],
    prefixes: [...new Set(domain.filter(t => !isPhrase(t) && t.length >= 4))],
    exact: new Set([
      ...domain.filter(t => !isPhrase(t) && t.length < 4),
      ...namedWords,
      ...named.filter(n => !isPhrase(n) && n.length >= 5),
    ]),
    categories: cats.filter(c => !c.low_n).map(c => readable(c.category)),
    states,
    aspects: nlp.aspects.map(a => a.aspect).filter(a => a !== "Uncategorized"),
    facts,
  };
  ctxCache = ctx;
  return ctx;
}

export function mentionsProject(norm: string): boolean {
  const c = context();
  const padded = ` ${norm} `;
  return c.phrases.some(p => (p.includes("$") ? norm.includes(p) : padded.includes(` ${p} `))) ||
    words(norm).some(w => c.exact.has(w) || c.prefixes.some(p => w.startsWith(p)));
}

/** Intent of one message, given whether the previous real question was about the project. */
function classifyOne(message: string, afterProjectQuestion: boolean): Intent {
  const norm = normalise(message);
  const ws = words(norm);
  if (ws.length === 0) return "greeting";

  if (onlyWordsFrom(ws, GREETING_WORDS)) return "greeting";
  if (onlyWordsFrom(ws, FAREWELL_WORDS) && /\b(bye|goodbye|see|later|cya|tchau|night|care|done)\b/.test(norm)) return "farewell";
  if (onlyWordsFrom(ws, THANKS_WORDS)) return "thanks";
  if (CAPABILITY_PATTERNS.some(p => p.test(norm))) return "capabilities";

  if (mentionsProject(norm)) return "project";

  // A short follow-up to a project question ("why?", "what about the second one?")
  if (afterProjectQuestion && ws.length <= FOLLOW_UP_MAX_WORDS && FOLLOW_UP_CUES.test(norm)) return "project";
  return "off_topic";
}

const SMALL_TALK: Intent[] = ["greeting", "thanks", "farewell", "capabilities"];

/** Intent of every turn, in order (assistant turns are marked "project"). Small talk does not break a follow-up chain. */
export function classifyTurns(turns: Turn[]): Intent[] {
  let lastReal: Intent | null = null;
  return turns.map(t => {
    if (t.role !== "user") return "project";
    const intent = classifyOne(t.content, lastReal === "project");
    if (!SMALL_TALK.includes(intent)) lastReal = intent;
    return intent;
  });
}

/** Classify the latest message. `history` excludes the latest message. */
export function classify(message: string, history: Turn[]): Intent {
  return classifyTurns([...history, { role: "user", content: message }]).at(-1)!;
}

/**
 * History to send to the AI: only project questions and the answers to them.
 * Greetings, small talk and off-topic turns (and the local replies to them) are dropped,
 * so they cost no tokens on later questions either.
 */
export function historyForModel(turns: Turn[]): Turn[] {
  const intents = classifyTurns(turns);
  const keep: Turn[] = [];
  let keepAnswer = false;
  turns.forEach((t, i) => {
    if (t.role === "user") {
      keepAnswer = intents[i] === "project";
      if (keepAnswer) keep.push(t);
    } else if (keepAnswer) {
      keep.push(t);
    }
  });
  return keep;
}

// ── Local replies (composed per message, no API call) ────────────────────────
function suggestions(n: number): string[] {
  const c = context();
  const [cat1, cat2] = sample(c.categories, 2);
  const state = pick(c.states.filter(s => ["SP", "RJ", "MG", "BA", "RS", "PR", "CE", "AL", "MA", "PE"].includes(s.code)));
  const aspect = pick(c.aspects).toLowerCase();
  const pool = [
    `How does ${cat1} compare with ${cat2} on negative reviews?`,
    `What is the late-delivery rate in ${state.name}?`,
    `How often are ${aspect} complaints negative?`,
    `Which categories should Olist fix first, and why?`,
    `How strongly is delivery delay linked to review scores?`,
    `Which sellers have the most fraud or counterfeit mentions?`,
    `What does the exposure model say at a 5% impact assumption?`,
    `What do customers complain about most in ${cat1}?`,
    `How was the sentiment of Portuguese reviews measured?`,
    `Which states have the most customers?`,
  ];
  return sample(pool, n);
}

function timeOfDay(): string {
  const h = new Date().getHours();
  return h < 5 ? "evening" : h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const bullets = (xs: string[]) => xs.map(x => `- ${x}`).join("\n");

/** Answer in the user's own register: mirror their greeting ("Good morning" -> "Good morning"). */
function greetingWord(norm: string): string {
  const said = norm.match(/\bgood (morning|afternoon|evening|day)\b/)?.[1];
  if (said) return `Good ${said}`;
  if (/\bnamaste|namaskar\b/.test(norm)) return "Namaste";
  if (/\b(ola|oi|bom dia|boa tarde|boa noite)\b/.test(norm)) return "Olá";
  if (/\bhola\b/.test(norm)) return "Hola";
  if (/\b(hey|heya)\b/.test(norm)) return pick(["Hey", "Hey there"]);
  return pick(["Hi", "Hello", `Good ${timeOfDay()}`, "Hi there"]);
}

function offTopicReason(norm: string): string {
  if (/\b(weather|temperature|rain|forecast|climate)\b/.test(norm)) return "I can't check the weather";
  if (/\d/.test(norm) && (/\b(how many|plus|minus|times|divided|multiply|sum|square|calculate|equals)\b/.test(norm) || /[+*/=]/.test(norm))) {
    return "I don't do general maths here";
  }
  if (/\b(who|what) (is|was|are|were)\b/.test(norm)) return "I don't answer general-knowledge questions about people or things outside this project";
  if (/\b(news|tomorrow|date|movie|song|recipe|joke|cricket|football|match)\b/.test(norm)) return "that's outside what I can look up";
  return "that question isn't about this project";
}

export function localReply(intent: Exclude<Intent, "project">, message: string, history: Turn[]): string {
  const c = context();
  const norm = normalise(message);
  const intents = classifyTurns(history);
  const greetedBefore = history.some((t, i) => t.role === "user" && intents[i] === "greeting");
  const askedProject = history.some((t, i) => t.role === "user" && intents[i] === "project");
  const fact = pick(c.facts)();

  switch (intent) {
    case "greeting": {
      const hello = greetingWord(norm);
      const askedHow = /\bhow (are|r) (you|u)\b|\bhow is it going\b|\bwhat'?s up\b|\bsup\b/.test(norm);
      if (greetedBefore) {
        return `${hello} again! ${cap(pick(["here's another finding:", "something you might not have seen yet:", "one more thing from the data:"]))} ${fact}.\n\n` +
          `${pick(["Want to dig into something?", "Ask me anything about the analysis, for example:", "You could try:"])}\n${bullets(suggestions(2))}`;
      }
      return `${hello}! ${askedHow ? "All good on my side, thanks for asking. " : ""}` +
        "I answer questions about the From Reviews to Revenue analysis of the Olist marketplace. " +
        `${pick(["For a start,", "One finding to begin with:", "Here's a quick one from the data:"])} ${fact}.\n\n` +
        `${pick(["You could ask, for example:", "A few things you could ask:", "Some places to start:"])}\n${bullets(suggestions(3))}`;
    }
    case "thanks":
      return `${pick(["You're welcome!", "Glad it helped!", "Happy to help!", "Any time!"])} ` +
        `${askedProject ? pick(["If you want to go further,", "A natural next question:", "You might also look at:"]) : "If you'd like, try:"}\n` +
        bullets(suggestions(2));
    case "farewell":
      return `${pick(["Bye for now!", "See you!", "Take care!", "Goodbye!"])} ` +
        `${pick(["One thing to leave you with:", "Before you go:", "A last fact for the road:"])} ${fact}.`;
    case "capabilities":
      return "I answer questions about this project's data and methods, using its saved results and live SQL on the Olist tables. For example, I can explain:\n" +
        bullets([
          "what customers complain about, by aspect, topic or category",
          "how delivery timing relates to star ratings, by state or category",
          "the statistics (correlations, group tests, regression) and how to read them",
          "the scenario exposure model, the prioritization of categories, and fraud signals",
          "how the NLP, SQL and security parts of the project work",
        ]) +
        `\n\nTry: ${pick(suggestions(3))}`;
    case "off_topic":
      return `${cap(offTopicReason(norm))}: I only answer questions about the From Reviews to Revenue analysis of Olist's reviews, orders and deliveries. ` +
        `${pick(["Here's something I can help with instead:", "You could ask, for example:", "Try one of these:"])}\n${bullets(suggestions(2))}`;
  }
}
