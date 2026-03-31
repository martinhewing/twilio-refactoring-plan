# twilio-refactoring-plan

**The WhatsApp Webhook Monster** — an AI-examined worksheet for discovering, debugging, and characterization-testing a production Twilio/WhatsApp monolith before refactoring begins.

**Live:** [twilio-refactoring-plan.connectaiml.com](https://twilio-refactoring-plan.connectaiml.com)

---

## Why this exists

The ConnectionSphere WhatsApp FSM monolith (`app/main.py`, ~1,300 lines) handles customer conversations via Twilio, manages session state in Redis, routes through a finite state machine, and calls the Claude API for AI-powered responses. A previous refactor reorganised the code into clean modules — and every test broke. The tests measured *wiring* (method signatures, call counts, argument shapes), not *behaviour*. When the structure changed, the safety net vanished.

This worksheet enforces a different sequence: **Understand → Observe → Test**. Every classification must be defended. Every bug must be observed live in the debugger. Every test must assert behaviour, not structure.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│   src/App.jsx ─── React SPA (Vite)              │
│   ├── Worksheet UI (sidebar + scrollable body)  │
│   ├── AnswerField (text + voice input)          │
│   ├── ExamSection (EXAMINE questions + TTS)     │
│   ├── InterviewDialog (FAANG prompts + TTS)     │
│   └── localStorage (progress persistence)       │
│                                                  │
│   ● REC ──→ /api/transcribe ──→ Cartesia Ink    │
│   ▶ TTS ──→ /api/speak ──────→ Cartesia Sonic   │
│   DEFEND ─→ /api/assess ─────→ Claude Sonnet    │
└──────────────┬──────────────────────────────────┘
               │ POST
┌──────────────▼──────────────────────────────────┐
│         Nginx (DO VPS — 157.245.36.85)          │
│         SSL termination + reverse proxy          │
│                      │                           │
│         ┌────────────▼──────────────────┐       │
│         │   Uvicorn — port 8394         │       │
│         │   server.py — FastAPI         │       │
│         │                               │       │
│         │   POST /api/assess            │       │
│         │   POST /api/speak             │       │
│         │   POST /api/transcribe        │       │
│         │   GET  /api/health            │       │
│         │   GET  /*  → static/          │       │
│         └───────────────────────────────┘       │
└─────────────────────────────────────────────────┘
```

Uvicorn serves both the API routes and the pre-built React SPA from `static/`. No Node.js on the server.

---

## Worksheet structure

The worksheet is a single React component (`src/App.jsx`) with all content, model answers, and examination logic embedded as data. It progresses through three phases.

### Phase 1 — Discovery (Q1–Q7)

Seven questions that classify every violation in the monolith. Each question has answer fields, a debugger exercise, and a DEFEND gate that must be passed (assessed by Claude) before the next question unlocks.

| Section | Target | What you classify |
|---|---|---|
| **Q1** · `webhook()` | `whatsapp_webhook()` | CAT-6 Orchestration, SOLID-SRP — six concerns in one function |
| **Q2** · Redis Client | `redis.StrictRedis` × 3 | CONC-3 — synchronous client inside `async def` blocks the event loop |
| **Q3** · `.keys()` Scan | `redis_client.keys()` | O(N) full-keyspace scan, zero `scan_iter` usage |
| **Q4** · Decorator | `@handle_whatsapp_errors` | SOLID-DIP — HTTP-layer decorator applied to domain methods |
| **Q5** · `State.ERROR` | `ERROR = ("Error",)` | Trailing comma creates tuple — customers permanently stuck |
| **Q6** · Observations | SM001–SM005 curl sequence | PAT-8 State Pattern — same input, different output by state |
| **Q7** · Prod Failure | Biggest production concern | CONC-3 blocks all customers, invisible in current logging |

### Phase 2 — Characterization Tests (L1–L3)

Three test levels with pseudocode templates, test case data tables, and EXAMINE questions after each test.

| Level | Scope | Template | What you test |
|---|---|---|---|
| **L1** · Pure Functions | `generate_departmental_reference_id`, `map_country_code_to_currency`, `extract_part_qty_pairs`, `extract_department_transfer`, `is_button_press`, `normalize_whitespace` | A.1, B.1.1 | Determinism, edge cases, idempotence |
| **L2** · FSM Transitions | `WhatsAppFSM.transition_to()`, `to_dict()`, `from_dict()` | B.1.4, TST-5 | State mutation, history entries, round-trip, `State.ERROR` tuple bug characterization |
| **L3** · Webhook Behaviour | Full HTTP POST → Redis → Twilio | B.1.9 | 8 scenarios: new customer, button presses, AI processing, error recovery, idempotency bug |

### Phase 3 — Completion

Checklist covering setup, discovery, defend, and testing phases. Key takeaways and a preview of Module 02 (Extraction Strategy).

### Supporting sections

- **DT-METHOD-1 Pre-Prompt Checklist** — CAT-x category, OOP/SOLID label, test template. Answer all three before writing any test.
- **Failure Matrix** — 8 production failure scenarios with fix patterns, corruption status, and recoverability.
- **Concept Tracker** — 20 concepts (e.g. "A.1 Idempotence", "TST-5 Characterization", "Round-Trip Testing") tracked across EXAMINE questions. Sidebar shows which concepts have been confirmed.

---

## Classification taxonomy

The worksheet uses a label system from the [Complete Python TDD & OOP Guide](research.txt):

**Method categories** classify what a function does:

| Label | Category | Test template |
|---|---|---|
| CAT-1 | Query — returns data, no side effects | A.1 |
| CAT-2 | Mutation — changes internal state | B.1.4 |
| CAT-3 | Command — triggers external IO | B.1.8 |
| CAT-4 | Factory — creates and returns a new object | B.1.1 |
| CAT-5 | Validation — raises on bad input | A.2 |
| CAT-6 | Orchestration — coordinates multiple CAT-x ops | B.1.9 |
| CAT-8 | Computation — pure calculation | A.1 |

**Design violations** classify what is wrong:

| Label | Violation |
|---|---|
| SOLID-SRP | Class has more than one reason to change |
| SOLID-DIP | Depends on concrete, not abstraction |
| OOP-ENCAP | Internal state exposed to callers |
| CONC-3 | Synchronous call inside async handler |
| PRT-2 | No Protocol at an IO boundary |
| PAT-8 | State Pattern — behaviour changes by state |

---

## Assessment system

Every DEFEND button sends the candidate's answer and the model answer to Claude Sonnet via `/api/assess`. The examiner applies a two-stage evaluation:

### Stage 1 — Anti-plagiarism check

The examiner compares the candidate's wording against the model answer. If the answer reproduces the model answer verbatim or near-verbatim (same sentences, same phrasing, minor word swaps), it is rejected as PARTIAL with feedback asking the candidate to explain in their own words. Copying the model answer is never CONFIRMED, no matter how correct the content is.

### Stage 2 — Genuine understanding

Only after the plagiarism check passes:

- **CONFIRMED** — the candidate explains the concept in their own words with genuine understanding. Different phrasing, analogies, examples, or simplified explanations are all acceptable — even preferred. They do not need to cover every detail, just the key insight.
- **PARTIAL** — missing a key insight, or answer is too vague to demonstrate understanding. Feedback shown plus a follow-up probe question with its own DEFEND button. Up to 10 partial attempts before NOT_MET.
- **NOT_MET** — fundamental misunderstanding (only after 10 partials).

The stage gating order is: Q1 → Q2 → Q3 → Q4 → Q5 → Q6 → Q7. Each gate field must reach CONFIRMED before the next section is visible.

---

## Voice features

| Feature | Button | Backend | Fallback |
|---|---|---|---|
| **Examiner voice** | ▶ on EXAMINE, FOLLOW-UP, and FAANG INTERVIEW sections | Cartesia Sonic (`/api/speak`) | Browser `speechSynthesis` |
| **Voice input** | ● REC on all answer fields and follow-up inputs | Cartesia Ink (`/api/transcribe`) | Browser `webkitSpeechRecognition` |

---

## Run locally

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Backend

```bash
uv sync
uv run uvicorn server:app --reload --port 3001
```

Required environment variables (`.env`):

```env
ANTHROPIC_API_KEY=sk-ant-...
CARTESIA_API_KEY=...
CARTESIA_MODEL=sonic-2
CARTESIA_EXAMINER_VOICE_ID=79a125e8-cd45-4c13-8a67-188112f4dd22
```

The frontend proxies `/api/*` to the backend via `vite.config.js`.

---

## Production deployment

### Infrastructure

| Component | Specification |
|---|---|
| VPS | Digital Ocean Droplet — `157.245.36.85` |
| Port | `8394` |
| Reverse proxy | Nginx (SSL termination via certbot) |
| Process manager | systemd (`refactoring-factory.service`) |
| Domain | `twilio-refactoring-plan.connectaiml.com` |

Part of the [Factory Hub](https://github.com/martinhewing) — six instances on one VPS:

| Port | Instance |
|------|----------|
| 8391 | ConnectionSphere Factory (system design) |
| 8392 | SpanishTutor Factory |
| 8393 | OOD Factory |
| 8394 | **Refactoring Factory** |
| 8395 | Competitive Programming Factory |
| 8396 | Debugging Factory |

### Deploy

The frontend is built locally and committed as `static/`. Pushes to `main` trigger the GitHub Actions workflow which SSHs into the VPS, pulls the latest code, syncs Python dependencies, and restarts the service.

```bash
# Build frontend locally
npm run build

# Commit and push
git add -A
git commit -m "your change"
git push origin main
```

No Node.js is installed on the VPS. The deploy workflow runs `git pull` → `uv sync` → `systemctl restart`.

### Manual deploy

```bash
ssh root@157.245.36.85 "
  export PATH=\$HOME/.local/bin:\$PATH
  cd /app/refactoring-factory
  git pull origin main
  uv sync --no-dev
  systemctl restart refactoring-factory
  sleep 3
  curl -s http://localhost:8394/api/health
"
```

---

## File structure

```
twilio-refactoring-plan/
├── src/
│   └── App.jsx              # Entire worksheet — data, components, and layout
├── static/                  # Vite build output (committed, served by Uvicorn)
│   ├── index.html
│   └── assets/
├── server.py                # FastAPI backend (assess, speak, transcribe, static serving)
├── pyproject.toml           # Python dependencies (uv)
├── package.json             # Node dependencies (react, vite — dev only)
├── vite.config.js           # Vite dev server + build config
├── .env                     # API keys (not committed)
├── .env.example             # Template for .env
├── deploy/
│   ├── refactoring-factory.service   # systemd unit
│   ├── nginx-refactoring-factory     # Nginx site config
│   └── provision-refactoring.sh      # One-time VPS instance setup
├── .github/
│   └── workflows/
│       └── deploy.yml       # VPS deployment on push to main
└── README.md
```

### Inside `src/App.jsx`

The file is structured as data-first, components second:

```
Lines ~1–60       Constants (CAT_DEFS, SOLID_DEFS, TEMPLATES, SECTIONS)
Lines ~60–120     FAILURE_SCENARIOS
Lines ~120–340    PURE_FUNCTIONS (L1 test specs with pseudocode + case data)
Lines ~340–520    FSM_TESTS (L2 test specs)
Lines ~520–720    WEBHOOK_SCENARIOS (L3 test specs)
Lines ~720–1050   M (model answers — every field has a FAANG-level reference)
Lines ~1050–1100  EXAM (per-test examination questions + concepts)
Lines ~1100–1150  Examiner logic (assessAnswer, stage gating)
Lines ~1150–1200  speakText (TTS function)
Lines ~1200–1250  CONCEPTS (20 tracked concepts)
Lines ~1250–1550  Components (CatBadge, AnswerField, Checkbox, Collapsible, etc.)
Lines ~1550–2100  Module01 main component (sidebar + all sections)
```

---

## Data model

All state lives in a single `checks` object persisted to `localStorage` under the key `module01_checks`. Keys follow these patterns:

| Pattern | Example | Purpose |
|---|---|---|
| `answer_{id}` | `answer_q1_op1` | Text entered by the candidate |
| `verdict_{id}` | `verdict_q1d_defend` | `CONFIRMED`, `PARTIAL`, `NOT_MET`, or `ERROR` |
| `feedback_{id}` | `feedback_q1d_defend` | Examiner feedback text |
| `probe_{id}` | `probe_q1d_defend` | Follow-up question from examiner |
| `answer_probe_{id}` | `answer_probe_q1d_defend` | Candidate's follow-up answer |
| `partial_count_{id}` | `partial_count_q1d_defend` | Number of PARTIAL attempts (max 10) |
| `{checkbox_id}` | `q1_done` | Boolean — checkbox state |

Reset all progress via the sidebar button or `localStorage.removeItem("module01_checks")`.

---

## What's next

**Module 02 — Extraction Strategy** covers the actual refactor:

| Extract | Target | Label |
|---|---|---|
| `redis.StrictRedis` → `redis.asyncio.Redis` | `app/infrastructure/redis.py` | SOLID-DIP, CONC-3 |
| `session_repo` read/write | `app/repositories/session.py` | PRT-2 Repository |
| `process_with_ai()` | `app/services/ai.py` | SOLID-SRP |
| `client.messages.create()` | `app/services/message.py` | SOLID-SRP |
| `whatsapp_webhook()` | `app/api/routes/webhook.py` | CAT-6, SOLID-SRP |
| `.keys()` calls | `scan_iter` throughout | CONC-3 |
| `ic()` calls | `structlog` | LOG-1 |
| `TEMP_IMAGE_FOLDER` | `app/config.py` env vars | CFG-1 |

---

## Licence

Private — ConnectionSphere Ltd.