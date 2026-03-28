import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// DATA — All worksheet content structured for rendering
// ═══════════════════════════════════════════════════════════════════

const CAT_DEFS = {
  "CAT-1": { label: "Query", color: "#61afef", desc: "Returns data, no side effects" },
  "CAT-2": { label: "Mutation", color: "#c678dd", desc: "Changes internal state, returns nothing" },
  "CAT-3": { label: "Command", color: "#e06c75", desc: "Triggers external IO" },
  "CAT-4": { label: "Factory", color: "#98c379", desc: "Creates and returns a new object" },
  "CAT-5": { label: "Validation", color: "#e5c07b", desc: "Raises on bad input, no return value" },
  "CAT-6": { label: "Orchestration", color: "#56b6c2", desc: "Coordinates multiple CAT-x operations" },
  "CAT-8": { label: "Computation", color: "#d19a66", desc: "Pure calculation, no IO, no state" },
};

const SOLID_DEFS = {
  "SOLID-SRP": "Class has more than one reason to change",
  "SOLID-DIP": "Depends on concrete, not abstraction",
  "OOP-ENCAP": "Internal state exposed to callers",
  "CONC-3": "Synchronous call inside async handler",
  "PRT-2": "No Protocol at an IO boundary",
};

const TEMPLATES = {
  "A.1": "Pure function, no fixtures",
  "B.1.1": "Factory, verify no side effects",
  "B.1.4": "State mutation, before/after assertion",
  "B.1.9": "Orchestration, real Redis, monkeypatched IO",
};

const SECTIONS = [
  { id: "orientation", label: "Orientation", icon: "◈" },
  { id: "pre-prompt", label: "DT-METHOD-1", icon: "◆" },
  { id: "setup", label: "Setup", icon: ">" },
  { id: "q1", label: "Q1 · webhook()", icon: "①" },
  { id: "q2", label: "Q2 · Redis Client", icon: "②" },
  { id: "q3", label: "Q3 · .keys() Scan", icon: "③" },
  { id: "q4", label: "Q4 · Decorator", icon: "④" },
  { id: "q5", label: "Q5 · State.ERROR", icon: "⑤" },
  { id: "q6", label: "Q6 · Observations", icon: "⑥" },
  { id: "q7", label: "Q7 · Prod Failure", icon: "⑦" },
  { id: "failure-matrix", label: "Failure Matrix", icon: "!" },
  { id: "tests-l1", label: "Tests · L1 Pure", icon: "▸" },
  { id: "tests-l2", label: "Tests · L2 FSM", icon: "▸" },
  { id: "tests-l3", label: "Tests · L3 Webhook", icon: "▸" },
  { id: "checklist", label: "Completion", icon: "✓" },
];

const FAILURE_SCENARIOS = [
  { scenario: "Redis goes down mid-conversation", fix: "EXC-7 Fallback", corrupt: "?", recoverable: "?" },
  { scenario: "Twilio retries same webhook", fix: "DEC-ERR-8 Idempotency", corrupt: "Possibly — FSM may double-transition", recoverable: "No" },
  { scenario: "Claude API times out in process_with_ai()", fix: "EXC-6 Retry with Backoff", corrupt: "?", recoverable: "?" },
  { scenario: "Two messages from same customer simultaneously", fix: "CONC-5 Lock", corrupt: "?", recoverable: "?" },
  { scenario: "State.ERROR tuple bug hits from_dict()", fix: "BUG Fix immediately", corrupt: "Yes — FSM stuck", recoverable: "No" },
  { scenario: ".keys() called with 50k keys in Redis", fix: "CONC-3 + scan_iter", corrupt: "No", recoverable: "Yes, eventually" },
  { scenario: "format_all_customer_messages() defined twice", fix: "SOLID-SRP Extract", corrupt: "No", recoverable: "Yes" },
  { scenario: "TEMP_IMAGE_FOLDER hardcoded to /Users/martinhewing/...", fix: "CFG-1 Config injection", corrupt: "No", recoverable: "No — immediate crash" },
];

const PURE_FUNCTIONS = [
  { fn: "generate_departmental_reference_id", cat: "CAT-4", template: "B.1.1", edges: "sal_, adm_, log_ prefixes; two calls differ; missing team_type fallback" },
  { fn: "map_country_code_to_currency", cat: "CAT-1", template: "A.1", edges: "+44→GBP, +1→USD, +49→EUR, whatsapp: prefix stripped, unknown→USD" },
  { fn: "extract_part_qty_pairs", cat: "CAT-8", template: "A.1", edges: '"3 x 452-0427", "2x1234-56", "no parts", "" — assert tuple contents' },
  { fn: "extract_department_transfer", cat: "CAT-8", template: "A.1", edges: '"speak to sales team", "transfer to admin", "logistics", "no transfer"' },
  { fn: "is_button_press", cat: "CAT-1", template: "A.1", edges: "every string in ALL_BUTTONS; one that is not; case sensitivity" },
  { fn: "normalize_whitespace", cat: "CAT-8", template: "A.1", edges: "tabs, multiple spaces, leading/trailing, None" },
];

const FSM_TESTS = [
  { test: "MAIN_MENU → SALES_INQUIRIES", template: "B.1.4", assertion: "state before=MAIN_MENU, after=SALES_INQUIRIES, history+1", label: "PAT-8" },
  { test: "MAIN_MENU → ADMIN_SUPPORT", template: "B.1.4", assertion: "same pattern", label: "PAT-8" },
  { test: "MAIN_MENU → TRACK_ORDER", template: "B.1.4", assertion: "same pattern", label: "PAT-8" },
  { test: "SALES → NEW_SALES_INQUIRY", template: "B.1.4", assertion: "state change + history from/to values", label: "PAT-8" },
  { test: "Invalid transition raises", template: "A.1", assertion: "transition_to(QUOTE_SENT) from MAIN_MENU raises ValueError", label: "CAT-5" },
  { test: "State.ERROR tuple bug documented", template: "A.1", assertion: 'assert State.ERROR.value == ("Error",) — IS the bug', label: "BUG" },
  { test: "to_dict() / from_dict() round-trip", template: "B.1.4+B.1.1", assertion: "all fields preserved", label: "OOP-ENCAP" },
  { test: 'from_dict() with "state":"Error"', template: "A.1", assertion: "raises ValueError — characterization", label: "BUG" },
  { test: "Full sales happy path", template: "B.1.9", assertion: "MAIN→SALES→NEW→AI_PROC→AI_DONE", label: "PAT-8" },
];

const WEBHOOK_SCENARIOS = [
  { scenario: "First message from unknown", seed: "None", input: "Body=hello", assertions: "HTTP 200; Redis key created; state=='Main Menu'; mock_twilio called once" },
  { scenario: "salesid1 button", seed: "menu=main", input: "Body=salesid1", assertions: "HTTP 200; state=='Sales Inquiries'; sales submenu dispatched" },
  { scenario: "new_inquiry button", seed: "menu=sales", input: "Body=new_inquiry", assertions: "HTTP 200; state=='New Sales Inquiry'; reference_id starts sal_" },
  { scenario: "Parts inquiry + mock_claude", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200/202; AI template dispatched; requested_quotes non-empty" },
  { scenario: "Unknown button payload", seed: "menu=main", input: "Body=notabutton", assertions: "HTTP 200; no crash; state unchanged" },
  { scenario: "all my messages special command", seed: "any", input: "Body=all my messages", assertions: "HTTP 200; handled before menu routing; cooldown key set" },
  { scenario: "process_with_ai raises", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200 (not 500); state not left as AI_PROCESSING" },
  { scenario: "SM003 re-sent (Twilio retry)", seed: "menu=sales", input: "identical SM003", assertions: "HTTP 200; reference_id unchanged; no second interaction node" },
];

// ═══════════════════════════════════════════════════════════════════
// MODEL ANSWERS — FAANG-level reference answers for every field
// ═══════════════════════════════════════════════════════════════════

const M = {
  // ── Q1: whatsapp_webhook() classification ──
  q1_op1: "HTTP request parsing — extracts form data from the Starlette Request object (from_number, body, profile_name, message_sid) via get_webhook_input()",
  q1_op2: "Session retrieval — loads or initializes the customer session from Redis via session_repo.get_session(), including JSON deserialization and default construction on KeyError",
  q1_op3: "FSM state hydration — reconstructs a WhatsAppFSM instance from the persisted dict via WhatsAppFSM.from_dict(), mapping string state values back to State enum members",
  q1_op4: "Special command routing — checks for meta-commands ('all my messages', 'reset', 'cooldown') via handle_special_commands() before FSM dispatch, short-circuiting the main flow",
  q1_op5: "Menu/state dispatch — routes to the correct handle_* function based on current FSM state (handle_main_menu_selection, handle_sales_inquiries, etc.), triggering FSM transitions",
  q1_op6: "Twilio response dispatch — formats and sends WhatsApp messages via client.messages.create(), including template selection, content variable assembly, and media URL attachment",
  q1_cat: "CAT-6 Orchestration — it coordinates session retrieval (CAT-1), FSM transitions (CAT-2), AI processing (CAT-3), and Twilio dispatch (CAT-3) across multiple concerns",
  q1_solid: "SOLID-SRP — six distinct reasons to change: request parsing format, session storage mechanism, FSM transition rules, special command set, menu routing logic, Twilio API contract",
  q1_summary: "whatsapp_webhook() is a CAT-6 orchestrator that directly performs operations from at least four other categories (parsing, session IO, FSM mutation, external dispatch) instead of delegating to single-responsibility collaborators, violating SRP with six distinct reasons to change.",

  // ── Q1 Debugger ──
  q1d_input: "Dict with keys: from_number (str, e.g. 'whatsapp:+447700000000'), body (str, 'hello'), profile_name (str, 'Test User'), message_sid (str, 'SM_SETUP_001'). from_number is already a string at this point, not bytes.",
  q1d_session: "No — for a new customer, get_session() catches the KeyError from Redis (key does not exist) and falls into the except block, calling initialize_user_session() to create a default session dict. No ValueError is raised.",
  q1d_fsm: "State.MAIN_MENU — the default state assigned by initialize_user_session(). The FSM is pure in-memory at this point; from_dict() only reads the dict passed to it, it does not touch Redis.",
  q1d_special: "False — 'hello' is not in the special commands set ('all my messages', 'reset', etc.), so handle_special_commands() returns False and execution continues to the main menu dispatch.",
  q1d_handle: "handle_main_menu_selection() — because fsm.state is MAIN_MENU. For the 'hello' body which is not a recognized button ID, this function sends the main menu template via Twilio.",
  q1d_defend: "CAT-3 describes a method with a single external side effect (e.g. payment.charge()). whatsapp_webhook() coordinates session retrieval, FSM hydration, state-dependent routing, AI processing, and Twilio dispatch — five distinct operations spanning four CAT-x categories. That is the definition of CAT-6 Orchestration: it coordinates multiple CAT-x operations, it does not perform a single external command.",

  // ── Q2: Redis client analysis ──
  q2_file1: "app/redis_helper.py",
  q2_type1: "redis.StrictRedis (synchronous)",
  q2_file2: "app/main.py",
  q2_type2: "redis.StrictRedis (synchronous) — second independent instance",
  q2_file3: "app/turbo_diesel_ai.py",
  q2_type3: "redis.StrictRedis (synchronous) — third independent instance",
  q2_solid: "SOLID-DIP — three concrete instances of the same synchronous client, each instantiated directly rather than injected through a shared abstraction. Also SOLID-SRP: the same keyspace is accessed from three separate modules with no single owner.",
  q2_blocking: "Customer B's coroutine is queued in the asyncio event loop but cannot execute. asyncio is single-threaded and cooperative — it only switches between coroutines at explicit await suspension points. redis.StrictRedis.get() is a synchronous blocking call that never yields to the event loop. The entire thread is held until the Redis round-trip completes. Customer B's request sits unprocessed in the socket buffer. With network latency or a slow Redis query, this blocks all concurrent customers, not just B.",
  q2_fix: "redis.asyncio.Redis (import path: redis.asyncio) — drop-in replacement that makes every Redis call an awaitable coroutine, yielding to the event loop during network IO so other customers' requests can be processed concurrently.",

  // ── Q2 Debugger ──
  q2d_type: "<class 'redis.client.StrictRedis'> — confirms this is the synchronous client, not redis.asyncio.Redis",
  q2d_iscoro: "False — redis.StrictRedis.get is a regular synchronous method, not a coroutine function. This proves that calling it inside async def will block the event loop.",
  q2d_blocked: "No — the second curl hangs in the terminal with no response. It cannot be processed because the event loop is blocked at the breakpoint (simulating a slow synchronous call). Only after pressing F9 does the second request begin processing.",
  q2d_label: "CONC-3 — synchronous call inside async handler blocks the event loop. The minimum fix is replacing redis.StrictRedis with redis.asyncio.Redis and awaiting every call.",

  // ── Q3: .keys() analysis ──
  q3_keys_total: "Count from grep — typically 2-4 calls across main.py and redis_helper.py (exact count depends on codebase version). Each one is a full O(N) keyspace scan.",
  q3_keys_async: "All of them — they are all called from within async def handlers, meaning every .keys() call blocks the entire event loop for the duration of the scan.",
  q3_scaniter: "0 — scan_iter is never used anywhere in the codebase. Every key enumeration uses the blocking .keys() method.",
  q3_customer: "Complete service freeze. With 50k keys, .keys() takes ~50-200ms depending on value sizes. During that time the Redis server is single-threaded and cannot serve any other commands. Combined with the synchronous Python client (CONC-3), the asyncio event loop is also blocked. Every customer connected to the system experiences a stall — not just the one who triggered the call.",
  q3_defend: "keys() is O(N) where N is the total number of keys in the database — it scans every key, matches the pattern, and returns them all in a single response. scan_iter uses SCAN which is O(1) per call, iterating in batches of ~10 keys with a cursor, allowing Redis to serve other commands between batches. The overall traversal is still O(N), but it is amortised and non-blocking. The guide labels are CONC-3 (synchronous blocking call in async context) and CAT-1/CAT-3 category mismatch: .keys() is classified as a CAT-1 Query (returns data) but under load it behaves as a CAT-3 Command (catastrophic side effect on all other clients). This matters for test template selection because a CAT-1 test (A.1 — assert return value) would pass, but it would not catch the production failure. The test must also assert latency or use scan_iter to document the fix.",

  // ── Q4: Decorator analysis ──
  q4_nonendpoint: "Verify via grep — check whether @handle_whatsapp_errors is applied to any function that is not an @app.post/@app.get endpoint. If it appears on internal methods like validate_state or process_with_ai, that confirms DEC-ERR-1 layer violation.",
  q4_fail1: "If the Request object is passed as a keyword argument (request=request) instead of a positional argument, next(arg for arg in args if isinstance(arg, Request)) raises StopIteration because args contains no Request. The decorator crashes before it can handle the actual error.",
  q4_fail2: "If the decorated function raises before the Request's form_data has been parsed (e.g. during argument validation), the except block tries to read from_number from form data that does not exist yet, raising a second exception that masks the original error. The customer gets a generic 500 instead of the intended error message.",
  q4_oop: "SOLID-DIP — the decorator depends on the concrete Starlette Request type (an HTTP-layer object). Any domain method it decorates now implicitly depends on HTTP infrastructure it should never know about. This is also OOP-ENCAP: the decorator reaches into the transport layer to extract from_number, breaking the boundary between HTTP handling and domain logic.",
  q4_defend: "SOLID-DIP (Dependency Inversion Principle) is violated because the decorator depends on a concrete HTTP-layer type (starlette.requests.Request) and forces that dependency onto every function it decorates. When applied to validate_state — a pure domain method — it means the domain layer now transitively depends on the HTTP layer. DIP says high-level modules (domain logic) should not depend on low-level modules (HTTP framework). The decorator should only exist on the outermost endpoint function, and domain methods should raise domain exceptions that the endpoint layer catches and translates.",

  // ── Q4 Debugger ──
  q4d_from: "Either the correct from_number extracted from the Request's form data, or undefined/raises if the exception fired before form_data was populated. Check the Variables panel — if from_number is None or the except block itself raises, this confirms failure mode 2.",
  q4d_twilio: "It depends on whether from_number was successfully extracted. If from_number is valid, client.messages.create() will attempt to send an error notification to the customer via WhatsApp — this may succeed or fail depending on Twilio credentials and the from_number format. If from_number is None, the create() call itself raises, masking the original error.",
  q4d_status: "The decorator returns a Response with status_code from the WhatsAppException (400 in this case). Twilio receives HTTP 400.",
  q4d_retry: "Twilio retries webhook delivery on any non-2xx response. It will retry up to 3 times with exponential backoff (1s, 2s, 4s). Each retry sends the same webhook payload, potentially triggering the same error handler three more times — and if the handler has side effects (like sending an error message to the customer), the customer receives duplicate error notifications.",

  // ── Q5: State.ERROR bug ──
  q5_value: '("Error",) — a tuple containing the string "Error", not the string "Error" itself. The trailing comma in ERROR = ("Error",) creates a single-element tuple.',
  q5_raises: 'ValueError: "Error" is not a valid State — because State("Error") looks for a member whose .value equals the string "Error", but State.ERROR.value is the tuple ("Error",), not the string. No member matches.',
  q5_redis: 'The to_dict() method calls self.state.value, which for State.ERROR returns ("Error",). JSON serialization writes this as ["Error"] (a JSON array). The "state" field in Redis becomes the array ["Error"] instead of the string "Error".',
  q5_crash: "from_dict() reads the state field and calls State(state_value). If the stored value is the list [\"Error\"], State([\"Error\"]) raises ValueError because no State member has a list as its value. This crashes at the State() constructor call inside from_dict(), approximately line 22 of fsm.py.",
  q5_recoverable: "No — the customer is permanently stuck. Every subsequent message triggers from_dict() which crashes on the corrupted state value. The only fix is manual Redis intervention: redis-cli del \"whatsapp:+44...\" to reset their session, or redis-cli set with a corrected JSON payload.",
  q5_fix: "Remove the trailing comma: ERROR = \"Error\" instead of ERROR = (\"Error\",). One character deletion converts the tuple back to a string.",
  q5_label: "This is a BUG, not an ERR-x or SOLID violation. It does not fit the exception handling taxonomy (ERR-x) because the system is not mishandling an exception — it is producing a corrupt value. It is not a SOLID violation because the design pattern is correct (enum member with string value); the implementation has a syntax error. The characterization test must assert the current broken behaviour: assert State.ERROR.value == (\"Error\",) — documenting the bug so the refactor can fix it safely.",

  // ── Q5 Debugger ──
  q5d_field: 'The exact value depends on JSON serialization of the tuple. Expect either ["Error"] (JSON array) or ("Error",) as a string — either way it is not the plain string "Error" that from_dict() expects.',
  q5d_crash: "Yes — from_dict crashes with ValueError at the State(state_value) call. The stored value is a list or tuple representation, not a valid State member value. The exception message is approximately: '(\"Error\",) is not a valid State' or '['Error'] is not a valid State'.",
  q5d_stuck: "Yes — permanently. Every message from this customer now triggers from_dict() which immediately crashes. There is no self-healing path. The customer's session must be manually deleted from Redis or the state field must be manually corrected.",

  // ── Q6: Observations ──
  q6_SM001: 'fsm_state.state = "Main Menu". Redis key "whatsapp:+447700000000" is created with a full session object including menu, has_seen_menu, inquiry_in_progress, fsm_state with state="Main Menu". The main menu template is sent via Twilio.',
  q6_SM002: 'fsm_state.state = "Sales Inquiries". State changed from "Main Menu" to "Sales Inquiries". FSM history now has one entry recording the transition. The sales submenu template is dispatched.',
  q6_SM003: 'fsm_state.state = "New Sales Inquiry". current_reference_id is now non-null, starting with "sal_" followed by a unique identifier. inquiry_in_progress = true. The system is now ready to accept a parts inquiry.',
  q6_SM004: 'State may transition through "AI Processing" to "AI Processing Done" during the handler. If the Claude API call succeeds, client.messages.create() is called to send the AI response. Check ic() output in the console to confirm the Twilio dispatch.',
  q6_SM005: 'The behaviour depends on current state. After SM004, the state is in AI_PROCESSING_DONE or similar. The unknown text "this is not a valid command" is likely routed to process_with_ai() (treated as a follow-up inquiry) rather than crashing. HTTP 200 is returned. If the state were MAIN_MENU, this text would likely trigger the default menu re-send.',
  q6_unexpected: "SM005 does not crash — it routes through the current state's handler. The same input ('this is not a valid command') produces completely different behaviour depending on which state the FSM is in. In MAIN_MENU it would re-send the menu. In NEW_SALES_INQUIRY it is treated as a parts inquiry and sent to Claude.",
  q6_defend: "PAT-8 (State Pattern) — the same input produces different outputs depending on the object's internal state. The FSM's current state determines which handler processes the message. This is the correct pattern for a conversational system, but it means characterization tests must seed the FSM to a known state before sending input. Testing from a cold start only covers the MAIN_MENU path.",

  // ── Q6 Debugger ──
  q6d_c1: "fsm.state = State.NEW_SALES_INQUIRY (after SM003). inquiry_in_progress = True. The session was loaded from Redis and the FSM hydrated from the persisted dict.",
  q6d_c2_before: "fsm.state = whatever state the handler is transitioning from (depends on which handle_* function runs). Capture the exact value from the Variables panel.",
  q6d_c2_after: "fsm.state = the target state after transition_to(). The FSM object's internal state has changed in memory.",
  q6d_c2_redis: "No — Redis is NOT updated at this point. The transition only mutates the in-memory FSM object. Redis is only written when session_repo.save_session() is called later in the handler. This means if the process crashes between transition and save, the state change is lost.",
  q6d_c3: "Multiple ic() calls fire before the anthropic_client call — typically 3-8 depending on the code path. Each ic() call prints debug output to stdout. In production this means every single customer message generates multiple lines of debug noise in the logs, with no log level control. This is LOG-1 — replace ic() with structured logging (structlog).",
  q6d_c4: "Yes — current_reference_id should be non-null (e.g. 'sal_abc123') because it was set when the new_inquiry button was pressed in SM003. This value is passed into the Twilio template's content_variables.",
  q6d_rw: "Concern 1 (session load) reads from Redis. Concern 4 area (after all processing) writes to Redis via session_repo.save_session(). There are typically 1-2 write calls across the full SM004 flow: one to save the session after processing, and possibly one for cooldown/rate-limit keys.",
  q6d_both: "session_repo is the concern that both reads (get_session at the top) and writes (save_session at the bottom). SOLID-SRP violation: a single object performing both read and write IO in the same request cycle, with the orchestrator manually coordinating the timing. The repository should be injected and the read/write calls should be the orchestrator's responsibility, not mixed into the domain logic.",

  // ── Q7: Production failure ──
  q7_scenario: "Synchronous Redis (CONC-3) blocking the asyncio event loop — every redis.StrictRedis call in every handler blocks all concurrent requests.",
  q7_impact: "All customers are affected simultaneously. When any single customer's request triggers a Redis call, every other customer's coroutine is blocked until that call completes. Under normal load (~50ms per Redis round-trip) this is barely noticeable. Under load spikes, Redis slowdowns, or combined with .keys() scans, the entire service queues. Customers experience delayed or timed-out responses. Twilio may retry, compounding the problem.",
  q7_detection: "No detection signal exists in current logging. print() and ic() do not capture request latency, queue depth, or event loop blocking time. A customer experiencing 5s delays would be invisible in logs. The only signal would be Twilio retry webhooks arriving (same MessageSid appearing multiple times), but the code does not check for duplicates.",
  q7_fix: "CONC-3 — replace redis.StrictRedis with redis.asyncio.Redis across all three files. This is the minimum fix. The structural fix is SOLID-DIP: inject a single async Redis client through a Protocol interface so all three modules share one connection pool.",
  q7_defend: "The previous refactor reorganised the code into clean modules (services, repositories, routes) but did not change the Redis client from synchronous to asynchronous. Structural correctness (SOLID-SRP: each module has one responsibility) does not resolve a concurrency pathology (CONC-3: synchronous IO in async context). You can have perfectly separated concerns that all independently block the event loop. The fix requires changing the runtime behaviour (sync → async), not the code organisation. This is why the guide distinguishes SOLID-SRP (design-time constraint) from CONC-3 (runtime constraint) — they are orthogonal concerns.",

  // ── Q7 Debugger scenarios ──
  q7d_redis: "No — the second request did not receive a response before pressing F9. The terminal hung with no output. This proves that the synchronous Redis call blocks the entire asyncio event loop. While one coroutine is waiting for Redis, no other coroutine can run. The customer whose message arrived during that window experiences a full delay equal to the first customer's Redis round-trip time. Under load, this compounds: N concurrent customers means the Nth customer waits for N-1 Redis calls to complete sequentially.",
  q7d_error: "After the simulated error, Redis contains the session with fsm_state.state set to the tuple-serialised value of State.ERROR. The customer sends their next message, from_dict() is called, it reads the corrupted state value, calls State() with a tuple/list argument, and raises ValueError. The customer is permanently stuck — every subsequent message crashes at from_dict() before any handler can run. The only recovery is manual redis-cli intervention.",
  q7d_idempotent: "Yes — current_reference_id changes on the second call because generate_departmental_reference_id() is called again, producing a new unique ID. A second interaction node is also created. This confirms the system has no idempotency check — it does not inspect MessageSid to detect Twilio retries. The characterization test must assert that two identical POSTs with the same MessageSid produce identical Redis state (they currently do not, which documents the bug).",
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function CatBadge({ cat }) {
  const def = CAT_DEFS[cat];
  if (!def) return <span style={{ color: "#abb2bf", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{cat}</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: def.color + "18", border: `1px solid ${def.color}44`,
      borderRadius: 4, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11, color: def.color, fontWeight: 600, letterSpacing: "0.03em",
    }}>
      {cat} <span style={{ color: def.color + "99", fontWeight: 400 }}>{def.label}</span>
    </span>
  );
}

function SolidBadge({ label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#e06c7518", border: "1px solid #e06c7544",
      borderRadius: 4, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11, color: "#e06c75", fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function TemplateBadge({ tmpl }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "#98c37918", border: "1px solid #98c37944",
      borderRadius: 4, padding: "2px 8px", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11, color: "#98c379", fontWeight: 600,
    }}>
      {tmpl}
    </span>
  );
}

function CodeBlock({ code, lang = "bash", title }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{
      background: "#1a1d23", borderRadius: 8, border: "1px solid #2d313a",
      overflow: "hidden", margin: "12px 0",
    }}>
      {title && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "6px 14px", background: "#21252b", borderBottom: "1px solid #2d313a",
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83" }}>{title}</span>
          <button onClick={copy} style={{
            background: "none", border: "1px solid #3e4451", borderRadius: 4,
            color: copied ? "#98c379" : "#636d83", cursor: "pointer", fontSize: 11,
            fontFamily: "'IBM Plex Mono', monospace", padding: "2px 8px",
          }}>{copied ? "✓ copied" : "copy"}</button>
        </div>
      )}
      <pre style={{
        margin: 0, padding: "14px", overflowX: "auto",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12.5,
        lineHeight: 1.6, color: "#abb2bf", tabSize: 2,
      }}>{code}</pre>
    </div>
  );
}

function AnswerField({ id, placeholder, checks, setChecks, multiline = false }) {
  const val = checks[`answer_${id}`] || "";
  const set = (v) => setChecks(p => ({ ...p, [`answer_${id}`]: v }));
  const [showModel, setShowModel] = useState(false);
  const modelAnswer = M[id];
  const inputStyle = {
    width: "100%", background: "#1a1d23", border: "1px solid #2d313a",
    borderRadius: 6, color: "#abb2bf", fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5, padding: "10px 12px", resize: "vertical", outline: "none",
    transition: "border-color 0.2s", boxSizing: "border-box",
    minHeight: multiline ? 100 : undefined,
  };
  const focus = (e) => e.target.style.borderColor = "#61afef55";
  const blur = (e) => e.target.style.borderColor = "#2d313a";
  return (
    <div>
      {multiline
        ? <textarea value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder}
            style={inputStyle} rows={4} onFocus={focus} onBlur={blur} />
        : <input value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder}
            style={inputStyle} onFocus={focus} onBlur={blur} />
      }
      {modelAnswer && (
        <div style={{ marginTop: 4 }}>
          <button onClick={() => setShowModel(!showModel)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "3px 0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
              color: showModel ? "#56b6c2" : "#3e4451", fontWeight: 600,
              letterSpacing: "0.05em", transition: "color 0.2s",
            }}>
              {showModel ? "HIDE" : "REVEAL"} MODEL ANSWER
            </span>
            <span style={{
              color: showModel ? "#56b6c2" : "#3e4451", fontSize: 10,
              transform: showModel ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 0.2s, color 0.2s", display: "inline-block",
            }}>
              {showModel ? "▾" : "▸"}
            </span>
          </button>
          {showModel && (
            <div style={{
              background: "#56b6c206", border: "1px solid #56b6c218",
              borderLeft: "3px solid #56b6c244", borderRadius: "0 6px 6px 0",
              padding: "10px 14px", marginTop: 4,
            }}>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
                color: "#56b6c266", fontWeight: 700, letterSpacing: "0.06em",
                marginBottom: 6,
              }}>MODEL ANSWER</div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                color: "#8fbcbb", lineHeight: 1.65, whiteSpace: "pre-wrap",
              }}>{modelAnswer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Checkbox({ id, label, checks, setChecks }) {
  const checked = !!checks[id];
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
      padding: "6px 0", userSelect: "none",
    }}>
      <div
        onClick={() => setChecks(p => ({ ...p, [id]: !p[id] }))}
        style={{
          width: 18, height: 18, minWidth: 18, borderRadius: 4, marginTop: 2,
          border: checked ? "2px solid #98c379" : "2px solid #3e4451",
          background: checked ? "#98c37922" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", cursor: "pointer",
        }}
      >
        {checked && <span style={{ color: "#98c379", fontSize: 12, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{
        color: checked ? "#98c379" : "#abb2bf", fontSize: 13.5,
        lineHeight: 1.5, transition: "color 0.15s",
        textDecoration: checked ? "line-through" : "none",
        textDecorationColor: "#98c37944",
      }}>{label}</span>
    </label>
  );
}

function Collapsible({ title, children, defaultOpen = false, accent = "#61afef", icon }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      border: `1px solid ${open ? accent + "44" : "#2d313a"}`,
      borderRadius: 8, overflow: "hidden", margin: "10px 0",
      transition: "border-color 0.2s",
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", background: open ? accent + "0a" : "#21252b",
        border: "none", padding: "12px 16px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        transition: "background 0.2s",
      }}>
        <span style={{
          color: accent, fontSize: 12, transform: open ? "rotate(90deg)" : "rotate(0)",
          transition: "transform 0.2s", display: "inline-block",
        }}>▶</span>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{
          color: "#d7dae0", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13, fontWeight: 600, flex: 1,
        }}>{title}</span>
      </button>
      {open && <div style={{ padding: "16px", borderTop: `1px solid ${accent}22` }}>{children}</div>}
    </div>
  );
}

function InterviewDialog({ question, hint, context }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #e06c7508, #c678dd08)",
      border: "1px solid #e06c7533", borderRadius: 8, padding: "16px 18px",
      margin: "14px 0",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
      }}>
        <span style={{
          background: "#e06c7522", color: "#e06c75", padding: "2px 8px",
          borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}>FAANG INTERVIEW</span>
      </div>
      <p style={{
        color: "#d7dae0", fontSize: 14, lineHeight: 1.6, margin: 0,
        fontWeight: 500, fontStyle: "italic",
      }}>"{question}"</p>
      {context && (
        <p style={{
          color: "#636d83", fontSize: 12.5, lineHeight: 1.5,
          marginTop: 10, marginBottom: 0,
        }}>{context}</p>
      )}
      {hint && (
        <div style={{
          marginTop: 10, padding: "8px 12px", background: "#1a1d23",
          borderRadius: 6, borderLeft: "3px solid #e5c07b",
        }}>
          <span style={{
            color: "#e5c07b", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
          }}>HINT: </span>
          <span style={{ color: "#abb2bf", fontSize: 12.5 }}>{hint}</span>
        </div>
      )}
    </div>
  );
}

function DebuggerExercise({ title, children }) {
  return (
    <div style={{
      background: "#0d1117", border: "1px solid #e5c07b33",
      borderRadius: 8, margin: "14px 0", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px", background: "#e5c07b0a",
        borderBottom: "1px solid #e5c07b22",
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          color: "#0d1117", background: "#e5c07b", padding: "1px 5px",
          borderRadius: 3, fontWeight: 700, letterSpacing: "0.04em",
        }}>DBG</span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
          color: "#e5c07b", fontWeight: 700, letterSpacing: "0.04em",
        }}>DEBUGGER EXERCISE</span>
        <span style={{
          color: "#636d83", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
        }}>— {title}</span>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function StackTrace({ frames }) {
  return (
    <div style={{
      background: "#1a1d23", borderRadius: 6, border: "1px solid #e06c7533",
      overflow: "hidden", margin: "10px 0",
    }}>
      <div style={{
        padding: "6px 12px", background: "#e06c750d",
        borderBottom: "1px solid #e06c7522",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
        color: "#e06c75", fontWeight: 700, letterSpacing: "0.06em",
      }}>STACK TRACE</div>
      {frames.map((f, i) => (
        <div key={i} style={{
          padding: "6px 12px", borderBottom: i < frames.length - 1 ? "1px solid #2d313a" : "none",
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.5,
          display: "flex", gap: 8,
        }}>
          <span style={{ color: "#636d83", minWidth: 20 }}>{i}</span>
          <span style={{ color: "#61afef" }}>{f.file}</span>
          <span style={{ color: "#636d83" }}>:</span>
          <span style={{ color: "#d19a66" }}>{f.line}</span>
          <span style={{ color: "#636d83" }}>in</span>
          <span style={{ color: "#e5c07b" }}>{f.fn}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressRing({ total, done }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  const r = 14, c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#2d313a" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="#98c379" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={c - (c * pct / 100)}
          strokeLinecap="round" transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 0.5s" }} />
      </svg>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
        color: pct === 100 ? "#98c379" : "#636d83",
      }}>{done}/{total}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

export default function Module01() {
  const [activeSection, setActiveSection] = useState("orientation");
  const [checks, setChecks] = useState({});
  const sectionRefs = useRef({});
  const mainRef = useRef(null);

  const totalChecks = useMemo(() => Object.keys(checks).filter(k => !k.startsWith("answer_")).length, [checks]);
  const doneChecks = useMemo(() => Object.values(checks).filter((v, i) => {
    const key = Object.keys(checks)[i];
    return !key?.startsWith("answer_") && v === true;
  }).length, [checks]);

  const checkCount = useMemo(() => {
    let t = 0, d = 0;
    const ckeys = Object.keys(checks).filter(k => !k.startsWith("answer_"));
    t = 42; // total expected
    d = ckeys.filter(k => checks[k] === true).length;
    return { total: t, done: d };
  }, [checks]);

  const scrollTo = useCallback((id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveSection(e.target.dataset.section);
            break;
          }
        }
      },
      { root: mainRef.current, rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const regRef = (id) => (el) => {
    if (el) {
      el.dataset.section = id;
      sectionRefs.current[id] = el;
    }
  };

  const P = ({ children, style: s }) => (
    <p style={{ color: "#abb2bf", fontSize: 14, lineHeight: 1.7, margin: "10px 0", ...s }}>{children}</p>
  );

  const H2 = ({ children, id }) => (
    <h2 id={id} style={{
      fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700,
      color: "#d7dae0", margin: "32px 0 16px", letterSpacing: "-0.02em",
      borderBottom: "1px solid #2d313a", paddingBottom: 10,
    }}>{children}</h2>
  );

  const H3 = ({ children }) => (
    <h3 style={{
      fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 600,
      color: "#c8ccd4", margin: "24px 0 12px", letterSpacing: "-0.01em",
    }}>{children}</h3>
  );

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#0d1117",
      fontFamily: "'Inter', -apple-system, sans-serif", color: "#abb2bf",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ── SIDEBAR ── */}
      <nav style={{
        width: 240, minWidth: 240, background: "#0d1117",
        borderRight: "1px solid #1e2228", display: "flex", flexDirection: "column",
        overflowY: "auto", padding: "16px 0",
      }}>
        <div style={{ padding: "0 16px 16px", borderBottom: "1px solid #1e2228" }}>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
            color: "#d7dae0", letterSpacing: "-0.02em",
          }}>MODULE 01</div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#636d83",
            marginTop: 2, letterSpacing: "0.04em",
          }}>WEBHOOK MONSTER</div>
          <div style={{ marginTop: 12 }}>
            <ProgressRing total={checkCount.total} done={checkCount.done} />
          </div>
        </div>

        <div style={{ padding: "8px 0", flex: 1 }}>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => scrollTo(s.id)} style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "7px 16px", background: activeSection === s.id ? "#61afef0d" : "transparent",
              border: "none", borderLeft: activeSection === s.id ? "2px solid #61afef" : "2px solid transparent",
              cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                color: activeSection === s.id ? "#61afef" : "#636d83",
                minWidth: 16,
              }}>{s.icon}</span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                color: activeSection === s.id ? "#d7dae0" : "#848b98",
                fontWeight: activeSection === s.id ? 600 : 400,
              }}>{s.label}</span>
            </button>
          ))}
        </div>

        <div style={{
          padding: "12px 16px", borderTop: "1px solid #1e2228",
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
          color: "#636d83",
        }}>
          150 min budget
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main ref={mainRef} style={{
        flex: 1, overflowY: "auto", padding: "32px 48px 120px",
        maxWidth: 860, margin: "0 auto",
      }}>

        {/* ═══ ORIENTATION ═══ */}
        <div ref={regRef("orientation")}>
          <div style={{
            fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800,
            color: "#d7dae0", letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>The WhatsApp Webhook Monster</div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#636d83",
            marginTop: 6, letterSpacing: "0.03em",
          }}>Discovery, Debugging & Characterization Testing Worksheet</div>

          <div style={{
            background: "#e06c750a", border: "1px solid #e06c7522",
            borderRadius: 8, padding: "16px 18px", marginTop: 20,
          }}>
            <P style={{ color: "#e06c75", fontWeight: 600, fontSize: 13, margin: "0 0 8px" }}>
              Why this exists
            </P>
            <P style={{ margin: 0 }}>
              The WhatsAppFSMProject refactor proved that <strong style={{ color: "#d7dae0" }}>structural correctness ≠ performance</strong>. 
              That version compiled cleanly, passed its tests, and ran identically to the monolith — because the tests measured 
              wiring (method signatures, call counts, argument shapes), not behaviour. When the structure changed, the tests broke.
            </P>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16,
          }}>
            {[
              { n: "1", t: "Defend every classification", d: "Name CAT-x, name the SOLID violation, state what the test proves" },
              { n: "2", t: "Debugger is primary", d: "Most exercises cannot be completed by reading code — observe live state" },
              { n: "3", t: "Behavioural ≠ structural", d: "Behavioural tests survive restructuring. Structural tests break when wiring moves" },
            ].map(({ n, t, d }) => (
              <div key={n} style={{
                background: "#141820", border: "1px solid #2d313a",
                borderRadius: 8, padding: "14px",
              }}>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800,
                  color: "#61afef22",
                }}>{n}</div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                  color: "#d7dae0", fontWeight: 600, marginBottom: 4,
                }}>{t}</div>
                <div style={{ fontSize: 12, color: "#636d83", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 16, padding: "12px 16px", background: "#e5c07b0a",
            border: "1px solid #e5c07b22", borderRadius: 8,
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5,
            color: "#e5c07b",
          }}>
            WARNING: The system is in production. Do NOT modify <code style={{ background: "#1a1d23", padding: "1px 6px", borderRadius: 3 }}>app/main.py</code> until every test in Part 2 is green.
          </div>
        </div>

        {/* ═══ PRE-PROMPT CHECKLIST ═══ */}
        <div ref={regRef("pre-prompt")}>
          <H2>Pre-Prompt Checklist — DT-METHOD-1</H2>
          <P>Run this before writing any test scaffold. If you cannot answer all three, do not proceed.</P>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#61afef", fontWeight: 700, marginBottom: 10 }}>
                1. CAT-x CATEGORY
              </div>
              {Object.entries(CAT_DEFS).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <CatBadge cat={k} />
                  <span style={{ fontSize: 11, color: "#636d83" }}>{v.desc}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", fontWeight: 700, marginBottom: 10 }}>
                2. OOP / SOLID LABEL
              </div>
              {Object.entries(SOLID_DEFS).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <SolidBadge label={k} />
                  <span style={{ fontSize: 11, color: "#636d83", marginLeft: 6 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", fontWeight: 700, marginBottom: 10 }}>
                3. TEST TEMPLATE
              </div>
              {Object.entries(TEMPLATES).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <TemplateBadge tmpl={k} />
                  <span style={{ fontSize: 11, color: "#636d83", marginLeft: 6 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ SETUP ═══ */}
        <div ref={regRef("setup")}>
          <H2>Initial Setup</H2>
          <P style={{ color: "#636d83", fontStyle: "italic" }}>Run config already created — verify Redis and the pipeline.</P>

          <Checkbox id="setup_redis" label="redis-cli ping returns PONG" checks={checks} setChecks={setChecks} />

          <CodeBlock title="Step 1 — Verify Redis" code={`redis-cli ping\n# Expected: PONG\n# If not: redis-server --daemonize yes`} />

          <Checkbox id="setup_uvicorn" label="Uvicorn running confirmed in PyCharm console" checks={checks} setChecks={setChecks} />

          <H3>Step 3 — Verify the Pipeline</H3>
          <CodeBlock title="Smoke test curl" code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=hello" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM_SETUP_001"`} />
          <CodeBlock title="Check Redis" code={`redis-cli get "whatsapp:+447700000000"`} />
          <Checkbox id="setup_curl" label="Setup curl returns HTTP 200; Redis key exists" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q1 — whatsapp_webhook() ═══ */}
        <div ref={regRef("q1")}>
          <H2>Q1 — Classify <code style={{ color: "#61afef" }}>whatsapp_webhook()</code></H2>

          <InterviewDialog
            question="whatsapp_webhook() is decorated with @app.post('/webhook'). What is its CAT-x category? Name every distinct operation before answering."
            context="A function that coordinates session retrieval, FSM dispatch, AI processing, and Twilio dispatch is a CAT-6. But a CAT-6 that also performs Redis reads/writes directly, constructs FSM state, and formats Twilio payloads is a SOLID-SRP violation."
            hint="Count every distinct operation. If it does more than one thing from different categories, name each one separately."
          />

          <CodeBlock title="grep the body first" code={`grep -n "session_repo\\|fsm\\|client\\.messages\\|process_with_ai\\|icecream\\|ic(" app/main.py | head -40`} />

          <H3>Name the six concerns</H3>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>
                Distinct operation {n}:
              </div>
              <AnswerField id={`q1_op${n}`} placeholder={`Concern ${n}...`} checks={checks} setChecks={setChecks} />
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#61afef", marginBottom: 4 }}>CAT-x classification:</div>
              <AnswerField id="q1_cat" placeholder="CAT-?" checks={checks} setChecks={setChecks} />
            </div>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>SOLID label:</div>
              <AnswerField id="q1_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>One-sentence summary:</div>
            <AnswerField id="q1_summary" placeholder="What it does..." checks={checks} setChecks={setChecks} />
          </div>

          <DebuggerExercise title="Q1: Observe the Six Concerns Live">
            <P>Set a breakpoint on the first line of <code style={{ color: "#61afef" }}>whatsapp_webhook</code>:</P>
            <CodeBlock code={`input_data = await get_webhook_input(request)`} lang="python" />
            <P>Send the setup curl. PyCharm halts. Step over (F8) through each distinct operation. <strong style={{ color: "#e5c07b" }}>Do not read ahead. Observe only the Variables panel.</strong></P>

            <StackTrace frames={[
              { file: "app/main.py", line: "~L1200", fn: "whatsapp_webhook" },
              { file: "app/main.py", line: "~L85", fn: "get_webhook_input" },
              { file: "app/redis_helper.py", line: "~L12", fn: "get_session" },
              { file: "app/fsm.py", line: "~L45", fn: "WhatsAppFSM.from_dict" },
              { file: "app/main.py", line: "~L150", fn: "handle_special_commands" },
            ]} />

            {[
              { id: "q1d_input", q: "After get_webhook_input — input_data keys present:" },
              { id: "q1d_session", q: "After session_repo.get_session — did it raise ValueError?" },
              { id: "q1d_fsm", q: "After WhatsAppFSM.from_dict — fsm.state value:" },
              { id: "q1d_special", q: "After handle_special_commands — return value True or False?" },
              { id: "q1d_handle", q: "Which handle_* function was last called before return?" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="Observed value..." checks={checks} setChecks={setChecks} />
              </div>
            ))}

            <InterviewDialog
              question="A colleague says whatsapp_webhook() is CAT-3 (Command) because it sends a Twilio message. Explain in one sentence why they are wrong."
              hint="Use the CAT-6 definition: coordinates multiple CAT-x operations. CAT-3 is a single external IO operation."
            />
            <AnswerField id="q1d_defend" placeholder="They are wrong because..." checks={checks} setChecks={setChecks} multiline />
          </DebuggerExercise>

          <Checkbox id="q1_done" label="Q1 complete — six operations named, CAT-x and SOLID label written, debugger exercise done" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q2 — Redis Client ═══ */}
        <div ref={regRef("q2")}>
          <H2>Q2 — Synchronous Redis in Async Handler</H2>

          <InterviewDialog
            question="session_repo.get_session() is called inside an async def handler. Open redis_helper.py and find the Redis client it wraps. What happens to every other coroutine while this call runs?"
            context="Calling redis.StrictRedis inside async def blocks the event loop entirely. The await keyword only yields to the event loop at actual async suspension points. A synchronous Redis call is not one."
          />

          <CodeBlock title="Find every Redis client" code={`grep -n "StrictRedis\\|redis\\.Redis\\|redis\\.asyncio" app/redis_helper.py app/main.py app/turbo_diesel_ai.py`} />

          <H3>Redis client inventory</H3>
          {[1,2,3].map(n => (
            <div key={n} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <AnswerField id={`q2_file${n}`} placeholder={`File ${n}...`} checks={checks} setChecks={setChecks} />
              <AnswerField id={`q2_type${n}`} placeholder={`Client type...`} checks={checks} setChecks={setChecks} />
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>SOLID label for three separate clients targeting the same keyspace:</div>
            <AnswerField id="q2_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} />
          </div>

          <InterviewDialog
            question="If two customers message simultaneously and Customer A's handler is executing redis_client.get() synchronously, what happens to Customer B's request?"
            hint="Use the event loop model — not intuition. asyncio runs one coroutine at a time. Synchronous calls don't yield."
          />
          <AnswerField id="q2_blocking" placeholder="Customer B experiences..." checks={checks} setChecks={setChecks} multiline />

          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", marginBottom: 4 }}>Exact import path for the fix:</div>
            <AnswerField id="q2_fix" placeholder="redis.asyncio.Redis or..." checks={checks} setChecks={setChecks} />
          </div>

          <DebuggerExercise title="Q2: Confirm the Synchronous Client">
            <P>Set a breakpoint in <code style={{ color: "#61afef" }}>session_repo.get_session()</code> on the first Redis call. Send the setup curl.</P>
            <P><strong style={{ color: "#e5c07b" }}>Evaluate Expression</strong> (Alt+F8):</P>
            <CodeBlock code={`type(redis_client)\nimport inspect\ninspect.iscoroutinefunction(redis_client.get)`} lang="python" />
            <P>While paused, send a second curl from a different number:</P>
            <CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447711111111" \\\n  -d "Body=hello" \\\n  -d "MessageSid=SM_CONCURRENT_001"`} />

            {[
              { id: "q2d_type", q: "type(redis_client) result:" },
              { id: "q2d_iscoro", q: "inspect.iscoroutinefunction(redis_client.get) result:" },
              { id: "q2d_blocked", q: "Did the second curl respond before you pressed F9? Yes / No" },
              { id: "q2d_label", q: "Guide label for this violation:" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </DebuggerExercise>

          <Checkbox id="q2_done" label="Q2 complete — three Redis clients found, concurrent curl observed, CONC-3 confirmed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q3 — .keys() ═══ */}
        <div ref={regRef("q3")}>
          <H2>Q3 — The <code style={{ color: "#e06c75" }}>.keys()</code> Time Bomb</H2>

          <InterviewDialog
            question="Find every .keys() call in the live codebase. At what key count does this become a production incident?"
            context="redis.StrictRedis.keys(pattern) performs an O(N) full-keyspace scan and blocks the Redis event loop until it completes. It is a CAT-1 Query that behaves like a CAT-3 Command under load."
            hint="This is a DT-METHOD-1 category mismatch — the function's category changes under load."
          />

          <CodeBlock title="Find all .keys() and scan_iter usage" code={`grep -n "\\.keys(" app/main.py app/redis_helper.py app/turbo_diesel_ai.py\ngrep -n "scan_iter" app/main.py app/redis_helper.py app/turbo_diesel_ai.py`} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {[
              { id: "q3_keys_total", q: "Total .keys( calls in live code:" },
              { id: "q3_keys_async", q: "Calls inside async def functions:" },
              { id: "q3_scaniter", q: "Occurrences of scan_iter:" },
              { id: "q3_customer", q: "Customer experience during .keys() with 50k keys:" },
            ].map(({ id, q }) => (
              <div key={id}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </div>

          <InterviewDialog
            question="What is the O() complexity of scan_iter vs keys()? Which guide label describes the violation and why does the category label matter for choosing the test template?"
          />
          <AnswerField id="q3_defend" placeholder="Defend your classification..." checks={checks} setChecks={setChecks} multiline />

          <Checkbox id="q3_done" label="Q3 complete — all .keys() calls counted, scan_iter occurrences confirmed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q4 — Decorator ═══ */}
        <div ref={regRef("q4")}>
          <H2>Q4 — <code style={{ color: "#c678dd" }}>@handle_whatsapp_errors</code> Layer Collapse</H2>

          <InterviewDialog
            question="The decorator finds the Request object by scanning *args. Name two failure modes, then explain which SOLID principle is violated when this decorator is applied to an internal domain method."
            context="handle_whatsapp_errors is an HTTP-layer decorator — it belongs only on CAT-6 Orchestration endpoints. Applying it to validate_state collapses two layers that must stay separate."
          />

          <CodeBlock title="Find all usages" code={`grep -rn "@handle_whatsapp_errors" app/`} />

          <CodeBlock title="The problematic pattern" lang="python" code={`request = next(arg for arg in args if isinstance(arg, Request))`} />

          {[
            { id: "q4_nonendpoint", q: "Does @handle_whatsapp_errors appear on any non-endpoint function? Paste grep result:" },
            { id: "q4_fail1", q: "Failure mode 1 (keyword arg):" },
            { id: "q4_fail2", q: "Failure mode 2 (exception before form_data parsed):" },
            { id: "q4_oop", q: "OOP label for the layer collapse:" },
          ].map(({ id, q }) => (
            <div key={id} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}

          <InterviewDialog
            question="Applying this decorator to validate_state means the decorator reaches across a layer boundary it should never cross. Which SOLID principle is violated and why?"
            hint="What does the decorator depend on that validate_state should never know about?"
          />
          <AnswerField id="q4_defend" placeholder="SOLID principle and why..." checks={checks} setChecks={setChecks} multiline />

          <DebuggerExercise title="Q4: Trigger the Decorator's Error Path">
            <P>Temporarily add as the <strong style={{ color: "#e5c07b" }}>first line</strong> of <code style={{ color: "#61afef" }}>whatsapp_webhook</code>:</P>
            <CodeBlock lang="python" code={`raise WhatsAppException("debug test", status_code=400)`} />
            <P>Set a breakpoint inside the <code style={{ color: "#61afef" }}>except WhatsAppException</code> block in the decorator. Restart the debugger. Send the setup curl.</P>
            {[
              { id: "q4d_from", q: "from_number value in the except block:" },
              { id: "q4d_twilio", q: "Does client.messages.create() succeed or raise?" },
              { id: "q4d_status", q: "What HTTP status code does Twilio receive?" },
              { id: "q4d_retry", q: "What does Twilio do when it receives a non-200 from a webhook?" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
            <div style={{ background: "#e06c750d", border: "1px solid #e06c7522", borderRadius: 6, padding: "10px 14px", marginTop: 10 }}>
              <span style={{ color: "#e06c75", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>REMOVE the temporary raise before proceeding.</span>
            </div>
          </DebuggerExercise>

          <Checkbox id="q4_done" label="Q4 complete — grep run, error path triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q5 — State.ERROR ═══ */}
        <div ref={regRef("q5")}>
          <H2>Q5 — <code style={{ color: "#e06c75" }}>State.ERROR</code> Tuple Bug</H2>

          <div style={{
            background: "#e06c750d", border: "1px solid #e06c7533",
            borderRadius: 8, padding: "16px 18px", margin: "14px 0",
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#e06c75", fontWeight: 700, marginBottom: 8 }}>
              CRITICAL — LIVE PRODUCTION BUG
            </div>
            <P style={{ margin: 0 }}>
              The trailing comma makes the value a <code style={{ color: "#e5c07b" }}>tuple</code>. 
              <code style={{ color: "#c678dd" }}>State.ERROR.value</code> returns <code style={{ color: "#d19a66" }}>('Error',)</code>, not <code style={{ color: "#98c379" }}>'Error'</code>. 
              Any customer whose session lands in <code style={{ color: "#e06c75" }}>State.ERROR</code> is <strong style={{ color: "#d7dae0" }}>permanently stuck</strong>.
            </P>
          </div>

          <CodeBlock title="The bug" lang="python" code={`ERROR = ("Error",)    # ← trailing comma = tuple\n# State.ERROR.value → ("Error",) not "Error"\n# State("Error") → ValueError (no member matches)`} />

          <StackTrace frames={[
            { file: "app/main.py", line: "~L1250", fn: "process_with_ai" },
            { file: "app/fsm.py", line: "~L78", fn: "transition_to(State.ERROR)" },
            { file: "app/redis_helper.py", line: "~L35", fn: "save_session → to_dict()" },
            { file: "app/fsm.py", line: "~L22", fn: "from_dict → State('Error') → CRASH" },
          ]} />

          {[
            { id: "q5_value", q: "State.ERROR.value — what does it return?" },
            { id: "q5_raises", q: 'State("Error") — what does it raise and why?' },
            { id: "q5_redis", q: 'What gets written to Redis "state" field after transition_to(State.ERROR)?' },
            { id: "q5_crash", q: "Where exactly does from_dict() crash on next message?" },
            { id: "q5_recoverable", q: "Is the customer recoverable without manual Redis intervention?" },
            { id: "q5_fix", q: "One-character fix:" },
            { id: "q5_label", q: "Guide label — ERR-x, FT-x, or SOLID? Justify:" },
          ].map(({ id, q }) => (
            <div key={id} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}

          <DebuggerExercise title="Q5: Lock a Customer in the Error State">
            <P>Temporarily add to the first line of <code style={{ color: "#61afef" }}>process_with_ai()</code>:</P>
            <CodeBlock lang="python" code={`raise Exception("simulated error")`} />
            <P>Navigate to <code style={{ color: "#61afef" }}>new_inquiry</code> state (hello → sales → new inquiry), then send <code style={{ color: "#d19a66" }}>I need 3 x 452-0427</code>.</P>
            <CodeBlock code={`redis-cli get "whatsapp:+447700000000"`} />
            {[
              { id: "q5d_field", q: "fsm_state.state field written to Redis (exact value):" },
              { id: "q5d_crash", q: "Send another hello — does from_dict crash? Exception and line:" },
              { id: "q5d_stuck", q: "Is the customer permanently stuck?" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
            <div style={{ background: "#e06c750d", border: "1px solid #e06c7522", borderRadius: 6, padding: "10px 14px", marginTop: 10 }}>
              <span style={{ color: "#e06c75", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>REMOVE the temporary raise before proceeding.</span>
            </div>
          </DebuggerExercise>

          <Checkbox id="q5_done" label="Q5 complete — tuple confirmed, from_dict crash triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q6 — Observations ═══ */}
        <div ref={regRef("q6")}>
          <H2>Q6 — Observe Before You Assert</H2>
          <P>Run every curl in sequence. Read Redis after each one. These observations become your test assertions.</P>

          {[
            { id: "SM001", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=hello" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM001"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM001 — brand new customer" },
            { id: "SM002", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=salesid1" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM002"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM002 — Sales Inquiries button" },
            { id: "SM003", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"current_reference_id"\\|"state"'`, label: "SM003 — New Sales Inquiry button" },
            { id: "SM004", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=I need 3 x 452-0427" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM004"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM004 — parts inquiry (Claude fires)" },
            { id: "SM005", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=this is not a valid command" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM005"`, check: null, label: "SM005 — unknown text" },
          ].map(({ id, cmd, check, label }) => (
            <Collapsible key={id} title={label} accent="#56b6c2" icon="▸">
              <CodeBlock title={`Send ${id}`} code={cmd} />
              {check && <CodeBlock title="Check Redis" code={check} />}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2", marginBottom: 4 }}>
                  After {id} — fsm_state.state and observations:
                </div>
                <AnswerField id={`q6_${id}`} placeholder={`State after ${id}...`} checks={checks} setChecks={setChecks} />
              </div>
              <Checkbox id={`q6_${id}_done`} label={`${id} run and recorded`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}

          <H3>Record unexpected behaviour</H3>
          <AnswerField id="q6_unexpected" placeholder="One thing you did not expect..." checks={checks} setChecks={setChecks} multiline />

          <InterviewDialog
            question="SM005 behaves differently depending on whether SM003 already ran. Name the guide pattern that describes this behaviour."
            hint="PAT-x — the same input producing different outputs depending on state."
          />
          <AnswerField id="q6_defend" placeholder="Pattern label and explanation..." checks={checks} setChecks={setChecks} multiline />

          <DebuggerExercise title="Q6: The Four Concern Breakpoints">
            <P>Set breakpoints at <strong style={{ color: "#d7dae0" }}>all four simultaneously</strong>:</P>
            <CodeBlock lang="python" title="Four concerns to observe" code={`# CONCERN 1 — Session load\nuser_session = session_repo.get_session(input_data["from_number"])\n\n# CONCERN 2 — FSM transition\nfsm.transition_to(State.SALES_INQUIRIES)\n\n# CONCERN 3 — AI call\nmessage = anthropic_client.messages.create(...)\n\n# CONCERN 4 — Twilio dispatch\nclient.messages.create(from_=f"whatsapp:{TWILIO_PHONE_NUMBER}", ...)`} />

            {[
              { id: "q6d_c1", q: "At Concern 1 — fsm.state and inquiry_in_progress:" },
              { id: "q6d_c2_before", q: "At Concern 2 — fsm.state BEFORE transition:" },
              { id: "q6d_c2_after", q: "At Concern 2 — fsm.state AFTER transition:" },
              { id: "q6d_c2_redis", q: "Is Redis updated yet at Concern 2? Why not?" },
              { id: "q6d_c3", q: "At Concern 3 — how many ic() calls fire before anthropic_client?" },
              { id: "q6d_c4", q: "At Concern 4 — is current_reference_id non-null?" },
              { id: "q6d_rw", q: "Which concern reads from Redis? Which writes? How many write calls total?" },
              { id: "q6d_both", q: "Is there a concern that both reads AND writes? SOLID label:" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </DebuggerExercise>

          <Checkbox id="q6_done" label="Q6 complete — all five curls run, Redis recorded, four-concern breakpoints set" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q7 — Production Failure ═══ */}
        <div ref={regRef("q7")}>
          <H2>Q7 — Single Biggest Production Concern</H2>

          <InterviewDialog
            question="What is your single biggest production concern? Classify → blast radius → detection signal → fix pattern."
            context="The previous refactor fixed the architecture but not this concern. Explain why structural correctness alone does not resolve it."
          />

          {[
            { id: "q7_scenario", q: "Scenario:" },
            { id: "q7_impact", q: "Impact (how many customers, what they experience):" },
            { id: "q7_detection", q: "Detection signal in current logs (given only print() and ic()):" },
            { id: "q7_fix", q: "Fix pattern (guide label):" },
          ].map(({ id, q }) => (
            <div key={id} style={{ marginBottom: 8 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>DEFEND YOUR CHOICE:</div>
            <AnswerField id="q7_defend" placeholder="Why structural correctness alone doesn't fix this..." checks={checks} setChecks={setChecks} multiline />
          </div>

          <DebuggerExercise title="Q7: Trigger Your Chosen Failure Mode">
            <P>Choose one scenario and trigger it in the debugger. Document what you observe.</P>

            <Collapsible title="If: Synchronous Redis blocking" accent="#e5c07b">
              <P>Set a breakpoint on <code style={{ color: "#61afef" }}>session_repo.get_session(...)</code>. Send a message. While paused, send a second curl from a different number.</P>
              <AnswerField id="q7d_redis" placeholder="Did the second request respond before F9? What the customer experiences..." checks={checks} setChecks={setChecks} multiline />
            </Collapsible>

            <Collapsible title="If: State.ERROR bug" accent="#e5c07b">
              <P>Use the Q5 debugger exercise. Document the Redis state after the bug fires.</P>
              <AnswerField id="q7d_error" placeholder="Redis state after bug, customer stuck..." checks={checks} setChecks={setChecks} multiline />
            </Collapsible>

            <Collapsible title="If: No idempotency on Twilio retries" accent="#e5c07b">
              <P>Re-run SM003 curl twice with identical data:</P>
              <CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`} />
              <AnswerField id="q7d_idempotent" placeholder="Does reference_id change? Second interaction node?" checks={checks} setChecks={setChecks} multiline />
            </Collapsible>
          </DebuggerExercise>

          <Checkbox id="q7_done" label="Q7 complete — chosen failure mode triggered, temporary code removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ FAILURE MATRIX ═══ */}
        <div ref={regRef("failure-matrix")}>
          <H2>Production Failure Matrix</H2>
          <P>Classify each scenario. The fix pattern is given — your job is to explain what happens without it.</P>

          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse", fontSize: 12.5,
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #2d313a" }}>
                  {["Scenario", "Fix Pattern", "FSM Corrupted?", "Recoverable?"].map(h => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: "left",
                      color: "#636d83", fontWeight: 600, fontSize: 11,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAILURE_SCENARIOS.map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1e2228" }}>
                    <td style={{ padding: "10px 12px", color: "#d7dae0", maxWidth: 280 }}>{f.scenario}</td>
                    <td style={{ padding: "10px 12px" }}><SolidBadge label={f.fix} /></td>
                    <td style={{ padding: "10px 12px", color: f.corrupt === "?" ? "#e5c07b" : "#abb2bf" }}>{f.corrupt}</td>
                    <td style={{ padding: "10px 12px", color: f.recoverable === "No" ? "#e06c75" : f.recoverable === "?" ? "#e5c07b" : "#98c379" }}>{f.recoverable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ TESTS LEVEL 1 ═══ */}
        <div ref={regRef("tests-l1")}>
          <H2>Part 2 — Level 1: Pure Functions</H2>
          <P>These functions are in <code style={{ color: "#61afef" }}>app/main.py</code> today. Test them here. When the refactor moves them, the tests travel unchanged.</P>

          <div style={{
            background: "#98c3790a", border: "1px solid #98c37922",
            borderRadius: 8, padding: "12px 16px", margin: "14px 0",
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", fontWeight: 700 }}>
              RULE: </span>
            <span style={{ fontSize: 13, color: "#abb2bf" }}>
              Test current behaviour — not ideal behaviour. If the system does something wrong but consistently, that is your assertion. No <code style={{ color: "#e06c75" }}>assert_called_with</code>. No <code style={{ color: "#e06c75" }}>call_count</code>.
            </span>
          </div>

          <CodeBlock title="Pre-Prompt Gate — write this at the top of every test" lang="python" code={`# CAT-x:     (e.g., CAT-8 Computation)\n# OOP/SOLID: (e.g., SOLID-SRP violation — function does both computation and formatting)\n# Template:  (e.g., A.1 Pure Function)`} />

          {PURE_FUNCTIONS.map((f, i) => (
            <Collapsible key={i} title={f.fn} accent={CAT_DEFS[f.cat]?.color || "#61afef"} icon="fn">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <CatBadge cat={f.cat} />
                <TemplateBadge tmpl={f.template} />
              </div>
              <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6 }}>
                <strong style={{ color: "#d7dae0" }}>Edge cases: </strong>{f.edges}
              </div>
              <div style={{ marginTop: 10 }}>
                <Checkbox id={`l1_${f.fn}`} label={`${f.fn} — tests written with edge cases`} checks={checks} setChecks={setChecks} />
              </div>
            </Collapsible>
          ))}
        </div>

        {/* ═══ TESTS LEVEL 2 ═══ */}
        <div ref={regRef("tests-l2")}>
          <H2>Part 2 — Level 2: FSM State Transitions</H2>
          <P>Test <code style={{ color: "#61afef" }}>WhatsAppFSM</code> from <code style={{ color: "#61afef" }}>app/fsm.py</code> directly. No HTTP. No Redis. No Twilio.</P>

          {FSM_TESTS.map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "10px 0", borderBottom: i < FSM_TESTS.length - 1 ? "1px solid #1e2228" : "none",
            }}>
              <Checkbox id={`l2_${i}`} label="" checks={checks} setChecks={setChecks} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#d7dae0", fontWeight: 600 }}>{t.test}</span>
                  <TemplateBadge tmpl={t.template} />
                  <SolidBadge label={t.label} />
                </div>
                <div style={{ fontSize: 12, color: "#636d83", lineHeight: 1.5 }}>{t.assertion}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ TESTS LEVEL 3 ═══ */}
        <div ref={regRef("tests-l3")}>
          <H2>Part 2 — Level 3: Webhook Behaviour</H2>
          <P>Functional tests that hit the webhook endpoint. Assert from the outside.</P>

          <Collapsible title="conftest.py — fixtures" accent="#c678dd" defaultOpen={false}>
            <CodeBlock title="tests/functional/conftest.py" lang="python" code={`import json\nimport pytest\nimport redis\nfrom fastapi.testclient import TestClient\nfrom app.main import app, session_repo, initialize_user_session\n\nTEST_NUMBER = "whatsapp:+447700000000"\n_redis = redis.StrictRedis(host="localhost", port=6379, db=0, decode_responses=True)\n\n@pytest.fixture(autouse=True)\ndef clean_redis():\n    _redis.delete(TEST_NUMBER)\n    yield\n    _redis.delete(TEST_NUMBER)\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n@pytest.fixture\ndef mock_twilio(monkeypatch):\n    sent = []\n    def fake_create(**kwargs):\n        sent.append(kwargs)\n        return type("Msg", (), {"sid": "SM_test_001"})()\n    monkeypatch.setattr("app.main.client.messages.create", fake_create)\n    return sent\n\n@pytest.fixture\ndef mock_claude(monkeypatch):\n    monkeypatch.setattr(\n        "app.main.anthropic_client.messages.create",\n        lambda **kwargs: type("Resp", (), {\n            "content": [type("C", (), {\n                "text": "<response>3 x 452-0427 confirmed.</response>"\n            })()]\n        })()\n    )`} />
          </Collapsible>

          <div style={{
            background: "#56b6c20a", border: "1px solid #56b6c222",
            borderRadius: 8, padding: "12px 16px", margin: "14px 0",
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2", fontWeight: 700 }}>
              ASSERT IN EVERY WEBHOOK TEST: </span>
            <span style={{ fontSize: 12.5, color: "#abb2bf" }}>
              response.status_code == 200 · Redis parseable after every call · mock_twilio count + to field verified · <strong style={{ color: "#d7dae0" }}>assert the absence</strong> when no message should fire
            </span>
          </div>

          {WEBHOOK_SCENARIOS.map((s, i) => (
            <div key={i} style={{
              background: "#141820", border: "1px solid #2d313a",
              borderRadius: 8, padding: "14px", margin: "8px 0",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Checkbox id={`l3_${i}`} label="" checks={checks} setChecks={setChecks} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: 13,
                    color: "#d7dae0", fontWeight: 600, marginBottom: 6,
                  }}>{s.scenario}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{
                      background: "#21252b", padding: "2px 8px", borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83",
                    }}>seed: {s.seed}</span>
                    <span style={{
                      background: "#21252b", padding: "2px 8px", borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2",
                    }}>{s.input}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#abb2bf", lineHeight: 1.6 }}>{s.assertions}</div>
                </div>
              </div>
            </div>
          ))}

          <TemplateBadge tmpl="B.1.9" />
          <span style={{ fontSize: 12, color: "#636d83", marginLeft: 8 }}>All scenarios use the Orchestration template</span>
        </div>

        {/* ═══ COMPLETION CHECKLIST ═══ */}
        <div ref={regRef("checklist")}>
          <H2>Completion Checklist</H2>

          <H3>Setup</H3>
          <Checkbox id="final_redis" label="redis-cli ping returns PONG" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_debug" label="PyCharm debug configuration created; Uvicorn running confirmed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_curl" label="Setup curl returns HTTP 200; Redis key exists" checks={checks} setChecks={setChecks} />

          <H3>Discovery Phase</H3>
          <Checkbox id="final_q1" label="Q1 — six operations named; CAT-x and SOLID label written; debugger stepped through each" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q2" label="Q2 — three Redis clients found; inspect.iscoroutinefunction run; concurrent curl observed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q3" label="Q3 — all .keys() calls counted; scan_iter occurrences confirmed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q4" label="Q4 — @handle_whatsapp_errors grep run; error path triggered; temporary raise removed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q5" label="Q5 — State.ERROR tuple confirmed; from_dict crash path triggered; temporary raise removed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q6" label="Q6 — all five curl commands run; Redis output recorded; four-concern breakpoints set" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q7" label="Q7 — chosen failure mode triggered; temporary code removed" checks={checks} setChecks={setChecks} />

          <H3>Defend Phase (cannot be skipped)</H3>
          <Checkbox id="final_defend1" label="Every Q has a DEFEND block completed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_defend2" label="Every test has the three-line CAT-x / OOP/SOLID / Template comment" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_defend3" label="No test uses assert_called_with, call_count, or argument shape assertions" checks={checks} setChecks={setChecks} />

          <H3>Testing Phase</H3>
          <Checkbox id="final_l1" label="tests/unit/ — all six pure functions covered with edge cases; A.1 template used" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l2" label="tests/integration/ — all FSM transitions; State.ERROR bug documented as characterization" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_conftest" label="tests/functional/conftest.py — fixtures created; scope='function' on all mutable fixtures" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_scenarios" label="All eight webhook scenarios written; absence of mock_twilio asserted where applicable" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_green" label="All tests pass against the current monolith" checks={checks} setChecks={setChecks} />

          {/* ── KEY TAKEAWAYS ── */}
          <div style={{
            marginTop: 32, background: "#141820", border: "1px solid #2d313a",
            borderRadius: 8, padding: "20px 24px",
          }}>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700,
              color: "#d7dae0", marginBottom: 16,
            }}>Key Takeaways</div>
            {[
              { icon: "—", text: "Name the category before writing the method. CAT-6 orchestrating CAT-3 commands is correct. CAT-6 directly performing Redis reads/writes is SOLID-SRP." },
              { icon: "—", text: "The debugger is not optional. You cannot characterize behaviour you have not observed." },
              { icon: "—", text: "DEFEND every classification. If you cannot justify the label in one sentence, you are not ready to test." },
              { icon: "!", text: "State.ERROR is a live production bug. Fix it before anything else in the refactor." },
              { icon: "!", text: "Three Redis clients is a contamination graph, not three architectural choices." },
              { icon: "!", text: "Synchronous Redis in async handlers is the performance pathology the previous refactor failed to fix." },
              { icon: "—", text: "Test real behaviour, not ideal behaviour. If the bug is consistent, characterize it." },
              { icon: "—", text: "Behavioural tests survive restructuring. Structural tests break when wiring moves." },
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, minWidth: 16,
                  color: t.icon === "!" ? "#e06c75" : "#636d83",
                }}>{t.icon}</span>
                <span style={{ fontSize: 13, color: "#abb2bf", lineHeight: 1.6 }}>{t.text}</span>
              </div>
            ))}
          </div>

          {/* ── WHAT'S NEXT ── */}
          <div style={{
            marginTop: 24, background: "#61afef08", border: "1px solid #61afef22",
            borderRadius: 8, padding: "20px 24px",
          }}>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700,
              color: "#61afef", marginBottom: 12,
            }}>What's Next → Module 02: Extraction Strategy</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {[
                    ["redis.StrictRedis → redis.asyncio.Redis", "app/infrastructure/redis.py", "SOLID-DIP, CONC-3"],
                    ["session_repo.get_session / save_session", "app/repositories/session.py", "PRT-2 Repository"],
                    ["process_with_ai() + Claude call", "app/services/ai.py", "SOLID-SRP"],
                    ["All client.messages.create() calls", "app/services/message.py", "SOLID-SRP"],
                    ["whatsapp_webhook() → thin orchestrator", "app/api/routes/webhook.py", "CAT-6, SOLID-SRP"],
                    ["All .keys() calls", "scan_iter throughout", "CONC-3"],
                    ["ic() calls", "structlog", "LOG-1"],
                    ["TEMP_IMAGE_FOLDER hardcoded path", "app/config.py env vars", "CFG-1"],
                  ].map(([what, target, label], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1e2228" }}>
                      <td style={{ padding: "8px 10px", color: "#d7dae0", fontFamily: "'IBM Plex Mono', monospace" }}>{what}</td>
                      <td style={{ padding: "8px 10px", color: "#636d83" }}>{target}</td>
                      <td style={{ padding: "8px 10px" }}><SolidBadge label={label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
