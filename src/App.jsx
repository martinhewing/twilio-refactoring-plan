import { useState, useEffect, useCallback, useRef } from "react";

const INITIAL_PHASES = [
  {
    id: -1, title: "Security Incident", subtitle: "Live credentials in .env committed to repo",
    weeks: "Immediate", color: "#ef4444",
    perfGate: "N/A — resolve before anything else",
    gates: [
      { cmd: "git log --all -S 'TWILIO_AUTH_TOKEN' | wc -l", expected: "0" },
      { cmd: "git ls-files .env .env.test | wc -l", expected: "0" },
    ],
    tasks: [
      { id: "s1", label: "Rotate ALL credentials: Twilio SID+Token, Anthropic key, DB passwords", done: false },
      { id: "s2", label: "Add .env and .env.test to .gitignore", done: false },
      { id: "s3", label: "Remove from git history (git filter-repo / BFG)", done: false },
      { id: "s4", label: "Verify no credential in any reachable commit", done: false },
      { id: "s5", label: "Commit .env.example with placeholder values only", done: false },
    ],
  },
  {
    id: 0, title: "Code Discovery", subtitle: "Module 1 — Three graduated test levels + performance baseline",
    weeks: "Week 1–2", color: "#f97316",
    perfGate: "Baseline P95 measured. docs/perf/baseline.md committed (includes pg_stat_statements).",
    gates: [
      { cmd: "pytest tests/characterization/ -x", expected: "exit 0, 0 skipped" },
      { cmd: "test -f docs/perf/baseline.md", expected: "exit 0" },
      { cmd: "test -f docs/failure-scenarios.md", expected: "exit 0" },
      { cmd: "test -f docs/diagrams/redis-contamination.md", expected: "exit 0" },
      { cmd: "test -f docs/diagrams/fsm-forced-transitions.md", expected: "exit 0" },
      { cmd: "test -f docs/audits/twiml-usage.md", expected: "exit 0" },
    ],
    tasks: [
      { id: "0a", label: "Map redis_client contamination graph (15+ functions) → docs/diagrams/", done: false },
      { id: "0b", label: "Audit every transition_to() call site (12+ forced) → docs/diagrams/", done: false },
      { id: "0c", label: "Audit TwiML: every XML response in WhatsApp path → docs/audits/", done: false },
      { id: "0d", label: "Document every sync IO call in async context + every KEYS * call", done: false },
      { id: "0e", label: "Fill in production failure scenario table → docs/failure-scenarios.md", done: false },
      { id: "0f", label: "Level 1 tests: PURE FUNCTIONS — FSM transitions, phone normalisation, currency mapping, part extraction. No IO needed. Build momentum here", done: false },
      { id: "0g", label: "Level 2 tests: BLACK-BOX FUNCTIONAL — webhook in → session exists, button → FSM change, message → response. Hit real Redis/Postgres", done: false },
      { id: "0h", label: "Level 3 tests: DB & PERF VERIFICATION — Redis key structure, pg_stat_statements (COMMITs, INSERTs), forced transition audit, TwiML audit", done: false },
      { id: "0i", label: "Instrument perf baseline → docs/perf/baseline.md (timing middleware + py-spy + pg_stat_statements + Redis SLOWLOG)", done: false },
      { id: "0j", label: "Baseline tooling: ruff, mypy, minimal CI. Tag rollback/phase-0", done: false },
    ],
  },
  {
    id: 1, title: "Foundation", subtitle: "Module 2 Phase 1 · One smell per commit · Async Redis",
    weeks: "Week 3–4", color: "#eab308",
    perfGate: "P95 Redis GET < 50% of docs/perf/baseline.md. Gate CANNOT be evaluated if 0i is incomplete.",
    gates: [
      { cmd: "grep -r 'from redis import Redis' src/ | wc -l", expected: "0" },
      { cmd: "grep -r 'TWILIO_AUTH_TOKEN' src/app/main.py | wc -l", expected: "0" },
      { cmd: "# docs/perf/phase-1.md Redis GET P95 vs baseline", expected: "< 50% of baseline" },
      { cmd: "git tag -l 'rollback/phase-1' | wc -l", expected: "1" },
    ],
    tasks: [
      { id: "1a", label: "UV + pyproject.toml — pin deps, include woocommerce>=3.0.0, lock file", done: false },
      { id: "1b", label: "§13 — Pydantic Settings. SettingsDep. One smell, one commit", done: false },
      { id: "1c", label: "Replace redis.Redis → redis.asyncio.Redis (PHASE BLOCKER). One smell, one commit", done: false },
      { id: "1d", label: "§14 — App factory + lifespan. All clients in lifespan. One smell, one commit", done: false },
      { id: "1e", label: "Define Inquiry entity (TAX-ENTITY-FIX) + WooCommerceClient(Protocol)", done: false },
      { id: "1f", label: "Measure → docs/perf/phase-1.md. Tag rollback/phase-1", done: false },
    ],
  },
  {
    id: 2, title: "Data Layer", subtitle: "Module 2 Phase 2 · SessionRepo correction · One smell per commit",
    weeks: "Week 5–6", color: "#22c55e",
    perfGate: "No Redis .keys() in repos/services. delete_by_pattern P95 < 5ms.",
    gates: [
      { cmd: "grep -rn 'redis.*\\.keys(\\|_redis\\.keys(' src/app/repositories/ src/app/services/ | wc -l", expected: "0" },
      { cmd: "test -f src/app/domain/customer.py -a -f src/app/domain/session.py -a -f src/app/domain/inquiry.py", expected: "exit 0" },
      { cmd: "pytest tests/lsp/ -x", expected: "exit 0, 0 skipped" },
      { cmd: "# docs/perf/phase-2.md delete_by_pattern P95", expected: "< 5 ms" },
      { cmd: "git tag -l 'rollback/phase-2' | wc -l", expected: "1" },
    ],
    tasks: [
      { id: "2a", label: "§7 — Pydantic schemas. One smell, one commit", done: false },
      { id: "2b", label: "§1 — Repository Protocols: Customer, Session, Message, Inquiry, Part", done: false },
      { id: "2c", label: "SessionRepo: wrap in char tests → fix 6 violations → Protocol conformance", done: false },
      { id: "2d", label: "Replace ALL Redis .keys() with SCAN in repositories + services", done: false },
      { id: "2e", label: "§4 — FakeRepos BEFORE concretes (PRT-4)", done: false },
      { id: "2f", label: "§8 — Concrete repos. to_domain()/from_domain()", done: false },
      { id: "2g", label: "§9 — DI wiring: Annotated + Depends (INJ-2)", done: false },
      { id: "2h", label: "B.2.4 — LSP parametrised suite (structural — accepted cost)", done: false },
      { id: "2i", label: "Measure → docs/perf/phase-2.md. Tag rollback/phase-2", done: false },
    ],
  },
  {
    id: 3, title: "Service Layer", subtitle: "Module 2 Phase 3 · FSM resolution · TwiML fix · One smell per commit",
    weeks: "Week 7–8", color: "#0ea5e9",
    perfGate: "P95 webhook < 200ms (Anthropic mocked). No TwiML in WhatsApp. No sync IO.",
    gates: [
      { cmd: "grep -n 'transition_to' src/app/api/routes/webhook.py | wc -l", expected: "0" },
      { cmd: "grep -rn 'text/xml' src/app/api/routes/webhook.py | wc -l", expected: "0" },
      { cmd: "grep -rn 'requests\\.post\\|requests\\.get' src/ | wc -l", expected: "0" },
      { cmd: "# docs/perf/phase-3.md POST /webhook P95 (Anthropic mocked)", expected: "< 200 ms" },
      { cmd: "grep -r 'use_new_webhook' src/app/settings.py | wc -l", expected: "1" },
      { cmd: "git tag -l 'rollback/phase-3' | wc -l", expected: "1" },
    ],
    tasks: [
      { id: "3a", label: "Resolve FSM forced transitions: bug / missing state / incomplete VALID_TRANSITIONS", done: false },
      { id: "3b", label: "Fix Bug 6: all WhatsApp → PlainTextResponse('', 200). Remove TwiML", done: false },
      { id: "3c", label: "VoiceService (PAT-4 Facade). asyncio.gather() for independent calls", done: false },
      { id: "3d", label: "MessageService — client.messages.create(), NOT TwiML", done: false },
      { id: "3e", label: "AIService — Protocol. Verify await on ALL async calls", done: false },
      { id: "3f", label: "AudioService — Cartesia Protocol + async cache-aside (PAT-5)", done: false },
      { id: "3g", label: "ImageUploadService — WooCommerce Protocol. httpx async. Background task", done: false },
      { id: "3h", label: "TimerService (SCAN), QueueService (async Redis)", done: false },
      { id: "3i", label: "Webhook → thin orchestrator. No forced transitions, no TwiML, no sync IO", done: false },
      { id: "3j", label: "Feature flag: APP_USE_NEW_WEBHOOK. Tag rollback/phase-3", done: false },
    ],
  },
  {
    id: 4, title: "Testing & Polish", subtitle: "Module 3 · Behavioural = safety net · No wiring tests",
    weeks: "Week 9", color: "#8b5cf6",
    perfGate: "Unit suite < 0.5s. No assert_called_with or call_count in tests/.",
    gates: [
      { cmd: "pytest tests/tier1/ tests/tier2/ tests/tier3/ -x", expected: "exit 0, 0 skipped" },
      { cmd: "grep -rn 'call_count\\|assert_called_with\\|assert_called_once' tests/ | wc -l", expected: "0" },
      { cmd: "# pytest tests/unit/ --durations=0 total", expected: "< 0.5s" },
      { cmd: "git tag -l 'rollback/phase-4' | wc -l", expected: "1" },
    ],
    tasks: [
      { id: "4a", label: "§12 — Exception hierarchy. Register before routers", done: false },
      { id: "4b", label: "Tier 1 (all behavioural): FSM, webhook parsing, exceptions", done: false },
      { id: "4c", label: "Tier 2 (mixed): repo LSP (structural), AI prompts, routing (behavioural)", done: false },
      { id: "4d", label: "Tier 3 (behavioural): E2E, timer, queue, WooCommerce, latency", done: false },
      { id: "4e", label: "Audit: remove any wiring test (grep assert_called_with)", done: false },
      { id: "4f", label: "Structured logging with duration_ms. Tag rollback/phase-4", done: false },
    ],
  },
  {
    id: 5, title: "CI/CD & Deploy", subtitle: "Module 5 · /health/ready checks Postgres ONLY (Redis is soft dep)",
    weeks: "Week 10", color: "#ec4899",
    perfGate: "Production P95 < 200ms. 7 days parallel running, 0 discrepancies.",
    gates: [
      { cmd: "curl -sf https://app.example.com/health/ready", expected: "exit 0" },
      { cmd: "# /health/ready checks Postgres only — NOT Redis", expected: "503 only if DB down" },
      { cmd: "# docs/perf/production.md POST /webhook P95", expected: "< 200 ms" },
      { cmd: "# docs/perf/parallel-running.md discrepancies", expected: "0 for 7 days" },
      { cmd: "grep -r 'legacy_webhook_handler' src/ | wc -l", expected: "0" },
    ],
    tasks: [
      { id: "5a", label: "GitHub Actions: lint → test-fast → test-full → deploy", done: false },
      { id: "5b", label: "Docker Compose: app + worker + db + redis + migrate", done: false },
      { id: "5c", label: "/health/live → always 200. /health/ready → Postgres SELECT 1 ONLY (Redis excluded — soft dep)", done: false },
      { id: "5d", label: "1 week parallel running: old returns, new logs comparison", done: false },
      { id: "5e", label: "P95 dashboards + regression alerts", done: false },
      { id: "5f", label: "Cutover: disable flag, remove old code path", done: false },
    ],
  },
];

const BUGS = [
  { id: 1, title: "Sync Redis Blocking Event Loop", severity: "CRITICAL", file: "src/app/repositories/session.py", fix: "redis.asyncio.Redis. Phase 1 blocker.", phase: 1 },
  { id: 2, title: "KEYS * Full Keyspace Scan", severity: "CRITICAL", file: "session.py + timer.py", fix: "SCAN cursor. Module 5 teaches this. Phase 2 blocker.", phase: 2 },
  { id: 3, title: "Sequential API Calls", severity: "HIGH", file: "webhook handler", fix: "asyncio.gather(). Phase 3.", phase: 3 },
  { id: 4, title: "Sync requests.post()", severity: "HIGH", file: "app/main.py", fix: "httpx.AsyncClient or background task. Phase 3.", phase: 3 },
  { id: 5, title: "Module-Level File Reads", severity: "MEDIUM", file: "app/main.py", fix: "Lazy load. Phase 1.", phase: 1 },
  { id: 6, title: "TwiML in WhatsApp Webhook", severity: "HIGH", file: "main.py + webhook.py", fix: "All WhatsApp → PlainTextResponse('', 200). Phase 3.", phase: 3 },
];

const COVERAGE_TIERS = [
  { tier: 1, name: "Before production traffic", phase: "Phase 0 + 2", items: [
    { text: "FSM valid transitions — every VALID_TRANSITIONS entry", type: "B" },
    { text: "FSM invalid transitions — every rejection path", type: "B" },
    { text: "FSM forced transitions — every call site from audit", type: "B" },
    { text: "Webhook parsing — valid, malformed, missing fields", type: "B" },
    { text: "Customer get_or_create — new, existing, normalisation", type: "B" },
    { text: "Exception hierarchy — every type → correct HTTP status", type: "B" },
  ]},
  { tier: 2, name: "Before service extraction", phase: "Phase 2", items: [
    { text: "SessionRepo — Fake AND Real (LSP B.2.4)", type: "S" },
    { text: "CustomerRepo — same parametrised suite", type: "S" },
    { text: "AI prompt — state + message → expected output", type: "B" },
    { text: "Message routing — button → correct response", type: "B" },
    { text: "WhatsApp returns 200 empty body, not TwiML (Bug 6)", type: "B" },
  ]},
  { tier: 3, name: "Before production deploy", phase: "Phase 4", items: [
    { text: "E2E webhook — message → customer → FSM → response", type: "B" },
    { text: "Timer lifecycle — start, check, cancel, expire", type: "B" },
    { text: "Queue lifecycle — enqueue, dequeue, process", type: "B" },
    { text: "WooCommerce upload — success, failure, timeout", type: "B" },
    { text: "Rate limiting — allowed, rejected, cooldown", type: "B" },
    { text: "Latency — webhook < 200ms excl Anthropic", type: "B" },
  ]},
];

const BASELINE_TEMPLATE = [
  { dep: "POST /webhook", notes: "Endpoint" },
  { dep: "GET /health", notes: "Endpoint" },
  { dep: "Redis GET", notes: "Per-call" },
  { dep: "Redis KEYS", notes: "⚠ Bug 2" },
  { dep: "Anthropic", notes: "Per-call" },
  { dep: "Twilio send", notes: "Per-call" },
  { dep: "WooCommerce POST", notes: "⚠ Bug 4" },
  { dep: "PostgreSQL query", notes: "Per-call" },
];

const PERF_TARGETS = [
  { phase: 0, target: "Baseline recorded (incl pg_stat_statements)", metric: "docs/perf/baseline.md exists", dep: "—" },
  { phase: 1, target: "Redis P95 < 50% of baseline", metric: "docs/perf/phase-1.md vs baseline", dep: "Phase 0 task 0i" },
  { phase: 2, target: "KEYS * eliminated, delete P95 < 5ms", metric: "docs/perf/phase-2.md", dep: "grep scoped to repos+services" },
  { phase: 3, target: "Webhook P95 < 200ms (mock Anthropic)", metric: "docs/perf/phase-3.md", dep: "No sync IO, no TwiML" },
  { phase: 4, target: "Unit suite < 0.5s", metric: "pytest --durations=0", dep: "No wiring tests" },
  { phase: 5, target: "Production P95 < 200ms", metric: "docs/perf/production.md", dep: "7d parallel, 0 discrepancies" },
];

const REFACTORING_LOOP = [
  { step: 1, action: "Run tests", detail: "pytest tests/ -v" },
  { step: 2, action: "Fix ONE smell", detail: "Small, focused change" },
  { step: 3, action: "Run tests again", detail: "Catch regressions immediately" },
  { step: 4, action: "Commit", detail: "Save your progress" },
  { step: 5, action: "If tests fail → revert", detail: "Try a smaller change" },
  { step: 6, action: "Repeat", detail: "Never fix two smells in one commit" },
];

const FAILURE_SCENARIOS = [
  "Twilio API is down for 5 minutes",
  "Redis connection drops mid-request",
  "Anthropic rate limit exceeded (429)",
  "WooCommerce returns malformed JSON",
  "Customer sends 50MB image for upload",
  "Two webhook requests for same customer overlap",
  "PostgreSQL disk is 99% full",
  "Customer message contains SQL injection",
  "Cartesia TTS service is down",
  "FSM state in Redis is corrupted / invalid JSON",
];

const EXTRACTION_ORDER = [
  { step: 1, items: "get_part_details(), get_timer_logs()", reason: "Leaf functions" },
  { step: 2, items: "RateLimiter", reason: "Standalone class" },
  { step: 3, items: "add_to_queue(), get_queue_status()", reason: "→ QueueService" },
  { step: 4, items: "get/save_sales_session()", reason: "→ StakeholderService" },
  { step: 5, items: "save_and_debug_user_session()", reason: "→ CustomerService" },
  { step: 6, items: "SessionRepository", reason: "Fix Bug 1+2 → async + SCAN" },
  { step: 7, items: "TimerService", reason: "Fix Bug 2 → async + SCAN" },
  { step: 8, items: "whatsapp_webhook()", reason: "Last — all deps clean" },
];

const FSM_GROUPS = [
  { name: "Navigation", states: ["Main Menu", "Sales Inquiries", "Admin Support", "Track Order"] },
  { name: "Inquiry", states: ["New Sales", "Existing Sales", "New Admin", "Existing Admin", "New Tracking", "Existing Tracking"] },
  { name: "Processing", states: ["AI Processing", "AI Done", "Pending Transfer", "Transfer Accepted", "Transfer Rejected"] },
  { name: "Sales Response", states: ["Decision Point", "Quick Reply", "Full Quote", "Timer Active"] },
  { name: "Completion", states: ["Quick Reply Sent", "Quote Sent", "Timer Expired", "Inquiry Completed"] },
];

const ARCH_LAYERS = [
  { label: "API Layer (§10)", color: "#22c55e", items: ["POST /webhook → PlainTextResponse('', 200)", "/health/ready → Postgres ONLY (Redis excluded)", "/health/live → always 200"] },
  { label: "Service Layer (§5, TAX-SVC)", color: "#3b82f6", items: ["VoiceService (PAT-4, asyncio.gather)", "MessageService (messages.create, NOT TwiML)", "AIService (Protocol)", "AudioService (PAT-5 cache)", "ImageUploadService (httpx async)"] },
  { label: "Domain (§1–§3, no IO)", color: "#8b5cf6", items: ["WhatsAppFSM (PAT-8, 27 states)", "ConversationHistory (DLL)", "Customer / Session / Inquiry", "PhoneNumber / FSMTransition (frozen VOs)"] },
  { label: "Repository (§8, Protocol boundary)", color: "#f97316", items: ["CustomerRepo (Protocol → Fake → Postgres)", "SessionRepo (Protocol → Fake → async Redis)", "InquiryRepo (Protocol → Fake → Postgres)"] },
  { label: "Infrastructure (app.state, lifespan §14)", color: "#ef4444", items: ["redis.asyncio (SOFT dep)", "PostgreSQL (HARD dep)", "Twilio Client", "AsyncAnthropic", "WooCommerce (httpx)"] },
];

const STORAGE_KEY = "refactor-plan-v5";

// localStorage persistence helpers (GitHub Pages compatible)
const storage = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
  delete: (key) => { try { localStorage.removeItem(key); } catch {} },
};

function ProgressRing({ percent, size = 64, stroke = 5, color }) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#27272a" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease" }} />
    </svg>
  );
}

function Tag({ children, color = "#52525b" }) {
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
      {children}
    </span>
  );
}

const S = {
  app: { minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14 },
  header: { borderBottom: "1px solid #27272a", padding: "20px 32px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: -0.5 },
  sub: { color: "#71717a", fontSize: 12, marginTop: 2 },
  nav: { display: "flex", gap: 4, padding: "12px 32px", borderBottom: "1px solid #18181b" },
  navBtn: (active) => ({ background: active ? "#27272a" : "transparent", color: active ? "#fff" : "#71717a",
    border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400 }),
  body: { display: "flex", gap: 0, height: "calc(100vh - 120px)" },
  sidebar: { width: 260, borderRight: "1px solid #18181b", overflowY: "auto", padding: "12px 0" },
  main: { flex: 1, overflowY: "auto", padding: 32 },
  phaseBtn: (active, color) => ({ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    background: active ? "#18181b" : "transparent", border: "none", borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
    padding: "10px 16px", cursor: "pointer", color: active ? "#fff" : "#71717a" }),
  card: { background: "#111", border: "1px solid #27272a", borderRadius: 10, padding: 20, marginBottom: 16 },
  h2: { fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 12 },
  code: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: "#18181b",
    border: "1px solid #27272a", borderRadius: 4, padding: "2px 7px", color: "#a1a1aa" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #27272a", color: "#71717a", fontWeight: 600, fontSize: 11 },
  td: { padding: "7px 10px", borderBottom: "1px solid #18181b", verticalAlign: "top" },
};

export default function App() {
  const [phases, setPhases] = useState(INITIAL_PHASES);
  const [activePhase, setActivePhase] = useState(0);
  const [view, setView] = useState("plan");
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);

  useEffect(() => {
    const result = storage.get(STORAGE_KEY);
    if (result && result.value) {
      try {
        const saved = JSON.parse(result.value);
        setPhases(prev => prev.map(p => {
          const sp = saved.phases?.find(x => x.id === p.id);
          if (!sp) return p;
          return { ...p, tasks: p.tasks.map(t => { const st = sp.tasks?.find(x => x.id === t.id); return st ? { ...t, done: st.done } : t; }) };
        }));
        if (saved.activePhase !== undefined) setActivePhase(saved.activePhase);
        if (saved.view) setView(saved.view);
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      storage.set(STORAGE_KEY, JSON.stringify({
        phases: phases.map(p => ({ id: p.id, tasks: p.tasks.map(t => ({ id: t.id, done: t.done })) })),
        activePhase, view,
      }));
    }, 500);
  }, [phases, activePhase, view, loaded]);

  const toggleTask = useCallback((phaseId, taskId) => {
    setPhases(prev => prev.map(p => p.id === phaseId
      ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
      : p));
  }, []);

  const resetAll = useCallback(() => {
    if (!window.confirm("Reset all progress across all phases? This cannot be undone.")) return;
    setPhases(INITIAL_PHASES);
    storage.delete(STORAGE_KEY);
  }, []);

  const totalTasks = phases.reduce((s, p) => s + p.tasks.length, 0);
  const doneTasks = phases.reduce((s, p) => s + p.tasks.filter(t => t.done).length, 0);
  const overallPct = totalTasks ? (doneTasks / totalTasks) * 100 : 0;
  const pp = (p) => p.tasks.length ? (p.tasks.filter(t => t.done).length / p.tasks.length) * 100 : 0;
  const active = phases.find(p => p.id === activePhase) || phases[0];
  const VIEWS = ["plan", "bugs", "coverage", "perf", "diagrams"];

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <ProgressRing percent={overallPct} color="#3b82f6" />
        <div>
          <div style={S.title}>Twilio Monolith Refactoring Plan</div>
          <div style={S.sub}>ConnectionSphere · 10 weeks · Module 1→5 · One smell per commit · Behavioural safety net</div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag color="#ef4444">Phase -1: Security</Tag>
            <Tag color="#3b82f6">{Math.round(overallPct)}% complete</Tag>
            <Tag color="#71717a">{doneTasks}/{totalTasks} tasks</Tag>
          </div>
        </div>
        <button onClick={resetAll} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #3f3f46",
          color: "#71717a", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
          Reset all
        </button>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {VIEWS.map(v => (
          <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div style={S.body}>
        {/* Sidebar — phase list */}
        {(view === "plan") && (
          <div style={S.sidebar}>
            {phases.map(p => (
              <button key={p.id} style={S.phaseBtn(activePhase === p.id, p.color)} onClick={() => setActivePhase(p.id)}>
                <ProgressRing percent={pp(p)} size={32} stroke={3} color={p.color} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "#52525b" }}>{p.weeks}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div style={S.main}>

          {/* PLAN VIEW */}
          {view === "plan" && active && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: active.color }} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{active.title}</div>
                  <div style={{ color: "#71717a", fontSize: 13 }}>{active.subtitle} · {active.weeks}</div>
                </div>
              </div>

              {/* Perf gate */}
              <div style={{ ...S.card, borderLeft: `3px solid ${active.color}`, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", marginBottom: 6, letterSpacing: 1 }}>PERFORMANCE GATE</div>
                <div style={{ color: "#e4e4e7", fontSize: 13 }}>{active.perfGate}</div>
              </div>

              {/* Falsifiable gates */}
              {active.gates && active.gates.length > 0 && (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.h2}>Falsifiable Gates</div>
                  {active.gates.map((g, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                      <code style={S.code}>{g.cmd}</code>
                      <span style={{ color: "#71717a", fontSize: 12 }}>→</span>
                      <span style={{ color: "#22c55e", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{g.expected}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              <div style={S.card}>
                <div style={S.h2}>Tasks — {active.tasks.filter(t => t.done).length}/{active.tasks.length}</div>
                {active.tasks.map(t => (
                  <div key={t.id} onClick={() => toggleTask(active.id, t.id)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0",
                      borderBottom: "1px solid #18181b", cursor: "pointer" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${t.done ? active.color : "#3f3f46"}`,
                      background: t.done ? active.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                      {t.done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ color: t.done ? "#52525b" : "#e4e4e7", textDecoration: t.done ? "line-through" : "none", fontSize: 13, lineHeight: 1.5 }}>
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BUGS VIEW */}
          {view === "bugs" && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Diagnosed Performance Pathologies</div>
              {BUGS.map(b => {
                const sev = b.severity === "CRITICAL" ? "#ef4444" : b.severity === "HIGH" ? "#f97316" : "#eab308";
                return (
                  <div key={b.id} style={{ ...S.card, borderLeft: `3px solid ${sev}` }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <Tag color={sev}>{b.severity}</Tag>
                      <span style={{ fontWeight: 700, color: "#fff" }}>Bug {b.id}: {b.title}</span>
                    </div>
                    <div style={{ color: "#71717a", fontSize: 12, marginBottom: 6 }}><code style={S.code}>{b.file}</code></div>
                    <div style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 6 }}><strong style={{ color: "#e4e4e7" }}>Fix:</strong> {b.fix}</div>
                    <Tag color="#3b82f6">Phase {b.phase}</Tag>
                  </div>
                );
              })}
            </div>
          )}

          {/* COVERAGE VIEW */}
          {view === "coverage" && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Coverage Map</div>
              <div style={{ color: "#71717a", fontSize: 13, marginBottom: 20 }}>Behavioural = safety net · Structural = Protocol conformance · Wiring tests = liabilities</div>
              {COVERAGE_TIERS.map(tier => (
                <div key={tier.tier} style={S.card}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                    <Tag color="#3b82f6">Tier {tier.tier}</Tag>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{tier.name}</span>
                    <span style={{ color: "#71717a", fontSize: 12 }}>{tier.phase}</span>
                  </div>
                  {tier.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #18181b" }}>
                      <Tag color={item.type === "B" ? "#22c55e" : "#f97316"}>{item.type === "B" ? "BEH" : "STR"}</Tag>
                      <span style={{ color: "#e4e4e7", fontSize: 13 }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* PERF VIEW */}
          {view === "perf" && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Performance Targets</div>
              <div style={{ color: "#71717a", fontSize: 13, marginBottom: 20 }}>Each phase produces <code style={S.code}>docs/perf/phase-N.md</code> committed to the repo. Includes pg_stat_statements.</div>
              <div style={S.card}>
                <div style={S.h2}>Phase Gates</div>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Phase</th><th style={S.th}>Target</th><th style={S.th}>Metric</th><th style={S.th}>Dependency</th>
                  </tr></thead>
                  <tbody>{PERF_TARGETS.map(p => (
                    <tr key={p.phase}>
                      <td style={S.td}><Tag color="#3b82f6">{p.phase}</Tag></td>
                      <td style={S.td}>{p.target}</td>
                      <td style={S.td}><code style={S.code}>{p.metric}</code></td>
                      <td style={{ ...S.td, color: "#71717a" }}>{p.dep}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={S.card}>
                <div style={S.h2}>Baseline Template — docs/perf/baseline.md</div>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Dependency</th><th style={S.th}>P50</th><th style={S.th}>P95</th><th style={S.th}>P99</th><th style={S.th}>Notes</th>
                  </tr></thead>
                  <tbody>{BASELINE_TEMPLATE.map(r => (
                    <tr key={r.dep}>
                      <td style={S.td}>{r.dep}</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                      <td style={{ ...S.td, color: "#71717a" }}>{r.notes}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* DIAGRAMS VIEW */}
          {view === "diagrams" && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 20 }}>Architecture & Diagrams</div>

              {/* Refactoring loop */}
              <div style={S.card}>
                <div style={S.h2}>The Refactoring Loop — One smell per commit</div>
                {REFACTORING_LOOP.map(r => (
                  <div key={r.step} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #18181b" }}>
                    <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 13, minWidth: 16 }}>{r.step}.</span>
                    <span style={{ color: "#fff", fontWeight: 600, minWidth: 160 }}>{r.action}</span>
                    <code style={S.code}>{r.detail}</code>
                  </div>
                ))}
              </div>

              {/* Extraction order */}
              <div style={S.card}>
                <div style={S.h2}>redis_client Extraction Order — leaves first</div>
                {EXTRACTION_ORDER.map(r => (
                  <div key={r.step} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #18181b" }}>
                    <Tag color="#ef4444">{r.step}</Tag>
                    <span style={{ color: "#fff", fontWeight: 600, flex: 1 }}>{r.items}</span>
                    <span style={{ color: "#71717a", fontSize: 12 }}>{r.reason}</span>
                  </div>
                ))}
              </div>

              {/* FSM groups */}
              <div style={S.card}>
                <div style={S.h2}>FSM State Groups — 27 states, 12+ forced transitions</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {FSM_GROUPS.map(g => (
                    <div key={g.name} style={{ background: "#18181b", borderRadius: 8, padding: "10px 14px", minWidth: 160 }}>
                      <div style={{ color: "#3b82f6", fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{g.name}</div>
                      {g.states.map(s => <div key={s} style={{ color: "#a1a1aa", fontSize: 12, padding: "2px 0" }}>{s}</div>)}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#ef44441a", borderRadius: 6, border: "1px solid #ef444433" }}>
                  <span style={{ color: "#ef4444", fontWeight: 600, fontSize: 12 }}>⚠ Forced transitions:</span>
                  <span style={{ color: "#a1a1aa", fontSize: 12 }}> whatsapp_webhook() bypasses VALID_TRANSITIONS for all 6 inquiry entry states. Phase 0 audit determines: bug / missing state / incomplete dict.</span>
                </div>
              </div>

              {/* Target architecture */}
              <div style={S.card}>
                <div style={S.h2}>Target Architecture</div>
                {ARCH_LAYERS.map(layer => (
                  <div key={layer.label} style={{ borderLeft: `3px solid ${layer.color}`, paddingLeft: 12, marginBottom: 14 }}>
                    <div style={{ color: layer.color, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{layer.label}</div>
                    {layer.items.map(item => <div key={item} style={{ color: "#a1a1aa", fontSize: 13, padding: "2px 0" }}>{item}</div>)}
                  </div>
                ))}
              </div>

              {/* Failure scenarios */}
              <div style={S.card}>
                <div style={S.h2}>Production Failure Scenarios — Phase 0 deliverable</div>
                <div style={{ color: "#71717a", fontSize: 12, marginBottom: 12 }}>Fill in What Happens / Data Lost / Recovery for each → docs/failure-scenarios.md</div>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Scenario</th><th style={S.th}>What Happens?</th><th style={S.th}>Data Lost?</th><th style={S.th}>Recovery?</th>
                  </tr></thead>
                  <tbody>{FAILURE_SCENARIOS.map((s, i) => (
                    <tr key={i}>
                      <td style={S.td}>{s}</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                      <td style={{ ...S.td, color: "#52525b" }}>—</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
