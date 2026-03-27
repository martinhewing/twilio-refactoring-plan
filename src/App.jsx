import { useState, useEffect, useCallback, useRef } from "react";

// ─── DATA ──────────────────────────────────────────────────────────────────

const MODULES = [
  {
    id: "00",
    title: "Module 00",
    subtitle: "Environment Setup",
    color: "#f59e0b",
    weeks: "Gate 1",
    description: "Get the full stack running locally. The gate is simple: debugger halts on a breakpoint inside whatsapp_webhook() and curl returns 200. Do not proceed to Module 01 until both are true.",
    sections: [
      {
        id: "00-A",
        title: "Environment Setup",
        description: "Every step is a hard prerequisite for the next. Do not skip.",
        tasks: [
          {
            id: "00-A-1",
            label: "Clone the repository",
            subtasks: [
              { id: "00-A-1a", label: "git clone git@github.com:martinhewing/twilio.git" },
              { id: "00-A-1b", label: "cd twilio" },
              { id: "00-A-1c", label: "git log --oneline -10 — read the recent commit history" },
            ],
          },
          {
            id: "00-A-2",
            label: "Create and activate virtual environment",
            subtasks: [
              { id: "00-A-2a", label: "python3 -m venv .venv" },
              { id: "00-A-2b", label: "source .venv/bin/activate  (Windows: .venv\\Scripts\\activate)" },
              { id: "00-A-2c", label: "Confirm terminal prompt shows (.venv)" },
            ],
          },
          {
            id: "00-A-3",
            label: "Install dependencies",
            subtasks: [
              { id: "00-A-3a", label: "pip install -r requirements.txt" },
              { id: "00-A-3b", label: "pip install pytest pytest-asyncio httpx" },
              { id: "00-A-3c", label: "python -c 'import fastapi, redis, twilio, anthropic' — must import clean with no errors" },
            ],
          },
          {
            id: "00-A-4",
            label: "Configure environment variables",
            subtasks: [
              { id: "00-A-4a", label: "cp .env.example .env" },
              { id: "00-A-4b", label: "Populate TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER" },
              { id: "00-A-4c", label: "Populate ANTHROPIC_API_KEY" },
              { id: "00-A-4d", label: "Populate REDIS_URL (local: redis://localhost:6379)" },
              { id: "00-A-4e", label: "Confirm .env is listed in .gitignore" },
              { id: "00-A-4f", label: "SECURITY GATE: git log --all -S 'TWILIO_AUTH_TOKEN' | wc -l — must return 0. If not, rotate credentials now." },
            ],
          },
          {
            id: "00-A-5",
            label: "Confirm Redis is running",
            subtasks: [
              { id: "00-A-5a", label: "redis-cli ping — must return PONG" },
              { id: "00-A-5b", label: "If not: brew services start redis (macOS) or sudo systemctl start redis (Linux)" },
            ],
          },
          {
            id: "00-A-6",
            label: "Run the FastAPI server",
            subtasks: [
              { id: "00-A-6a", label: "Confirm .venv is active — prompt shows (.venv)" },
              { id: "00-A-6b", label: "uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" },
              { id: "00-A-6c", label: "Confirm 'Uvicorn running on http://0.0.0.0:8000' in terminal" },
              { id: "00-A-6d", label: "curl http://localhost:8000/health — must return 200" },
              { id: "00-A-6e", label: "Open http://localhost:8000/docs — Swagger UI must load" },
            ],
          },
          {
            id: "00-A-7",
            label: "Configure PyCharm debugger",
            subtasks: [
              { id: "00-A-7a", label: "which uvicorn — must return .venv/bin/uvicorn, not /usr/local/bin/uvicorn" },
              { id: "00-A-7b", label: "Run -> Edit Configurations -> + -> Python" },
              { id: "00-A-7c", label: "Script path: the .venv/bin/uvicorn path from above" },
              { id: "00-A-7d", label: "Parameters: app.main:app --host 0.0.0.0 --port 8000" },
              { id: "00-A-7e", label: "Working directory: project root" },
              { id: "00-A-7f", label: "Environment variables: copy all entries from .env" },
              { id: "00-A-7g", label: "Click Debug (bug icon) — confirm server starts in PyCharm console" },
              { id: "00-A-7h", label: "Open app/main.py — set a breakpoint on the first line inside whatsapp_webhook()" },
              { id: "00-A-7i", label: "Confirm breakpoint dot is solid red (hollow = file not on interpreter path)" },
            ],
          },
          {
            id: "00-A-8",
            label: "Configure ngrok and Twilio webhook",
            subtasks: [
              { id: "00-A-8a", label: "Open a second terminal: ngrok http 8000" },
              { id: "00-A-8b", label: "Copy the https://xxxxx.ngrok.io forwarding URL" },
              { id: "00-A-8c", label: "Twilio Console -> Messaging -> Senders -> WhatsApp -> your sandbox number" },
              { id: "00-A-8d", label: "Set webhook URL to https://xxxxx.ngrok.io/whatsapp-webhook, method POST, save" },
            ],
          },
          {
            id: "00-A-9",
            label: "Verify the full pipeline — GATE",
            subtasks: [
              { id: "00-A-9a", label: "Send 'hello' from your personal WhatsApp to the Twilio sandbox number" },
              { id: "00-A-9b", label: "Confirm ngrok terminal shows POST /whatsapp-webhook 200" },
              { id: "00-A-9c", label: "Confirm PyCharm debugger halts on the breakpoint inside whatsapp_webhook()" },
              { id: "00-A-9d", label: "GATE PASSED. Both conditions met. Proceed to Module 01." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "01",
    title: "Module 01",
    subtitle: "Discovery, Debugging & Characterization Tests",
    color: "#3b82f6",
    weeks: "Gate 2",
    description: "Observe before asserting. Classify before refactoring. Every observation in Section B must be recorded before writing a single test in Section C.",
    sections: [
      {
        id: "01-A",
        title: "Section A — Code Discovery & Classification",
        description: "Read the source. Classify every violation using guide taxonomy. Do not modify any code.",
        tasks: [
          {
            id: "01-A-1",
            label: "Mandatory pre-reading",
            subtasks: [
              { id: "01-A-1a", label: "Read docs/diagrams/redis-contamination.md in full" },
              { id: "01-A-1b", label: "Read all files in docs/fix-records/" },
              { id: "01-A-1c", label: "Read app/main.py from line 1 to EOF without skipping" },
              { id: "01-A-1d", label: "Read app/fsm.py in full -- map every State enum value and every VALID_TRANSITION entry" },
              { id: "01-A-1e", label: "Read app/exceptions.py -- note handle_whatsapp_errors and InvalidStateError" },
              { id: "01-A-1f", label: "Read app/redis_helper.py -- count how many StrictRedis instantiations exist" },
              { id: "01-A-1g", label: "Read app/turbo_diesel_ai.py -- count how many StrictRedis instantiations exist" },
            ],
          },
          {
            id: "01-A-2",
            label: "Q1 — Classify whatsapp_webhook() (CAT-6 Orchestration)",
            subtasks: [
              { id: "01-A-2a", label: "Write one sentence: what does this function do? (no jargon)" },
              { id: "01-A-2b", label: "Identify Concern 1: session retrieval (PRT-2 violation -- no repository)" },
              { id: "01-A-2c", label: "Identify Concern 2: FSM state transition (PAT-8 -- should be in FSM layer only)" },
              { id: "01-A-2d", label: "Identify Concern 3: AI processing (AIService -- should be behind Protocol)" },
              { id: "01-A-2e", label: "Identify Concern 4: Twilio message dispatch (MessageService -- should be behind Protocol)" },
              { id: "01-A-2f", label: "Label the function as CAT-6. Confirm all four concerns are present." },
              { id: "01-A-2g", label: "Debugger step: set breakpoint at first line of whatsapp_webhook(). Step Over (F8) through each concern. Note which lines belong to each." },
            ],
          },
          {
            id: "01-A-3",
            label: "Q2 — Map inputs and outputs (SOLID-SRP violation)",
            subtasks: [
              { id: "01-A-3a", label: "List all inputs: Form field from Twilio (Body, From, To, ...)" },
              { id: "01-A-3b", label: "List all outputs: Redis session write, Twilio message send, HTTP PlainTextResponse" },
              { id: "01-A-3c", label: "Count the outputs. More than one output = more than one responsibility = SRP violation." },
              { id: "01-A-3d", label: "Debugger step: Evaluate Expression (Ctrl+Alt+F8) on request.form() at the breakpoint. Record every key." },
              { id: "01-A-3e", label: "Note which form keys are used and which are discarded. Discarded keys are tech debt candidates." },
            ],
          },
          {
            id: "01-A-4",
            label: "Q3 — Trace a new customer journey (CAT-4 Factory check)",
            subtasks: [
              { id: "01-A-4a", label: "Starting from whatsapp_webhook(), list every function called in order for a brand new customer sending 'sales inquiries'" },
              { id: "01-A-4b", label: "At initialize_user_session(): is this a CAT-4 Factory? Does it create-and-return without side effects?" },
              { id: "01-A-4c", label: "If initialize_user_session() writes to Redis -- it is NOT a factory. Note the violation." },
              { id: "01-A-4d", label: "Debugger step: set breakpoint inside initialize_user_session(). Step Through. Watch Variables panel. Does Redis get written?" },
              { id: "01-A-4e", label: "Record the full call stack from whatsapp_webhook() to first Twilio send." },
            ],
          },
          {
            id: "01-A-5",
            label: "Q4 — Document the session object shape (OOP-ENCAP violation)",
            subtasks: [
              { id: "01-A-5a", label: "After a new sales inquiry, paste live list(session_data.keys()) from the debugger" },
              { id: "01-A-5b", label: "Document: from_number, menu, current_reference_id, reference_ids, inquiry_in_progress, team_type, ai_enabled" },
              { id: "01-A-5c", label: "Document fsm_state sub-dict: state, history, function_calls, context" },
              { id: "01-A-5d", label: "Document interactions sub-dict: messages, system_logs, requested_quotes, timestamp, team_type, status" },
              { id: "01-A-5e", label: "Document conversation_list sub-dict: head, tail, current" },
              { id: "01-A-5f", label: "grep -n 'session\\[' app/main.py | wc -l -- count all raw dict writes. Each one is an encapsulation violation." },
              { id: "01-A-5g", label: "This dict becomes the entity domain model in Phase 2. The full documented shape is the specification." },
            ],
          },
        ],
      },
      {
        id: "01-B",
        title: "Section B — Bug Hunt & Live Observation",
        description: "Read docs/diagrams/redis-contamination.md first. Then use the debugger to observe each bug live. Record observations BEFORE writing any test.",
        tasks: [
          {
            id: "01-B-0",
            label: "Debugger environment confirmed (prerequisite)",
            subtasks: [
              { id: "01-B-0a", label: "PyCharm debug config is running (from Module 00 Part A)" },
              { id: "01-B-0b", label: "ngrok is forwarding to localhost:8000" },
              { id: "01-B-0c", label: "Twilio sandbox is configured to the ngrok URL" },
              { id: "01-B-0d", label: "redis-cli monitor running in a separate terminal (shows all Redis commands live)" },
            ],
          },
          {
            id: "01-B-1",
            label: "Bug 1 — CONC-3: sync Redis inside async handler",
            subtasks: [
              { id: "01-B-1a", label: "grep -n 'StrictRedis\\|redis.Redis' app/main.py app/redis_helper.py app/turbo_diesel_ai.py -- count all instances" },
              { id: "01-B-1b", label: "Confirm every instance is synchronous (redis.StrictRedis, not redis.asyncio.Redis)" },
              { id: "01-B-1c", label: "Write in your own words: what does a synchronous Redis call do to an async FastAPI handler?" },
              { id: "01-B-1d", label: "Debugger step: set breakpoint on a Redis get() call inside async whatsapp_webhook(). Check Evaluate Expression: inspect.iscoroutinefunction(redis_client.get)" },
              { id: "01-B-1e", label: "Confirm False -- this is the CONC-3 bug. Every request serialises the event loop." },
              { id: "01-B-1f", label: "Write: what is the customer-visible symptom under 10 concurrent users?" },
              { id: "01-B-1g", label: "SOLID label: DIP violation -- bound to redis.StrictRedis concrete, not a Protocol" },
            ],
          },
          {
            id: "01-B-2",
            label: "Bug 2 — Three-client Redis problem (PRT-2 violation)",
            subtasks: [
              { id: "01-B-2a", label: "Locate redis client instantiations: app/main.py, app/redis_helper.py, app/turbo_diesel_ai.py" },
              { id: "01-B-2b", label: "Confirm all three target the same keyspace (same REDIS_URL)" },
              { id: "01-B-2c", label: "Write: what happens if main.py writes session['state'] and turbo_diesel_ai.py reads it 10ms later with no transaction context?" },
              { id: "01-B-2d", label: "Write: which client wins if save_and_debug_user_session() and session_repo.save_session() both write simultaneously?" },
              { id: "01-B-2e", label: "Debugger step: set breakpoints in both save functions. Send two rapid WhatsApp messages. Observe which fires last." },
              { id: "01-B-2f", label: "SOLID label: SRP violation at module level -- each file owns a connection it should not have" },
            ],
          },
          {
            id: "01-B-3",
            label: "Bug 3 — .keys() O(N) scan (performance pathology)",
            subtasks: [
              { id: "01-B-3a", label: "grep -n '\\.keys(' app/main.py app/redis_helper.py -- count occurrences" },
              { id: "01-B-3b", label: "redis-cli monitor: watch for KEYS * command when a webhook fires" },
              { id: "01-B-3c", label: "Write: what does redis.keys('whatsapp:*') do to a live Redis instance with 50,000 session keys?" },
              { id: "01-B-3d", label: "Debugger step: Evaluate Expression: import time; t=time.time(); redis_client.keys('whatsapp:*'); time.time()-t -- record the time" },
              { id: "01-B-3e", label: "Write: what is the correct replacement? (redis SCAN with cursor iteration)" },
              { id: "01-B-3f", label: "Severity: Critical. Blocks ALL Redis operations while scanning." },
            ],
          },
          {
            id: "01-B-4",
            label: "Bug 4 — Regex NoneType crash (DT-EXC-1 violation)",
            subtasks: [
              { id: "01-B-4a", label: "Locate: re.search(r'yes, to (\\w+)', lower).group(1) in main.py" },
              { id: "01-B-4b", label: "Write: what happens when re.search returns None and .group(1) is called?" },
              { id: "01-B-4c", label: "Write: which customer message would trigger this? (hint: a transfer confirmation that doesn't match the pattern)" },
              { id: "01-B-4d", label: "Debugger step: use Set Value in Variables panel to set lower to 'yes please' (no department name). Step Over. Observe." },
              { id: "01-B-4e", label: "Write: what does the customer receive when this crashes? (check handle_whatsapp_errors decorator)" },
              { id: "01-B-4f", label: "Fix pattern (do not implement yet): re.search(...) result = match.group(1) if match else None -- then guard against None" },
            ],
          },
          {
            id: "01-B-5",
            label: "Bug 5 — State.ERROR tuple (silent customer stranding)",
            subtasks: [
              { id: "01-B-5a", label: "Locate State.ERROR in app/fsm.py -- is it a tuple or a scalar?" },
              { id: "01-B-5b", label: "Check VALID_TRANSITIONS -- is State.ERROR listed as a valid source state for any transition?" },
              { id: "01-B-5c", label: "Write: if a customer lands in State.ERROR, can they ever exit without a session reset?" },
              { id: "01-B-5d", label: "Debugger step: use Set Value to set fsm.state = State.ERROR. Attempt a transition. Observe InvalidStateError." },
              { id: "01-B-5e", label: "Write: how many customers in production are potentially stuck in this state right now?" },
              { id: "01-B-5f", label: "Write: what is the recovery path today? (manual Redis key deletion?)" },
            ],
          },
          {
            id: "01-B-6",
            label: "Bug 6 — TwiML in WhatsApp responses (protocol mismatch)",
            subtasks: [
              { id: "01-B-6a", label: "grep -n 'text/xml\\|MessagingResponse\\|twiml' app/main.py | head -20" },
              { id: "01-B-6b", label: "Write: what does Twilio's WhatsApp channel do when it receives a TwiML XML response?" },
              { id: "01-B-6c", label: "Write: what is the correct response for WhatsApp webhooks? (PlainTextResponse('', 200) + client.messages.create())" },
              { id: "01-B-6d", label: "Identify every route that returns TwiML when it should return PlainTextResponse" },
              { id: "01-B-6e", label: "Note: this bug causes silent message failures -- Twilio logs show 200 but the customer gets nothing" },
            ],
          },
          {
            id: "01-B-7",
            label: "Observation record (complete before Section C)",
            subtasks: [
              { id: "01-B-7a", label: "Bug 1 observed live: YES / NO" },
              { id: "01-B-7b", label: "Bug 2 observed live: YES / NO" },
              { id: "01-B-7c", label: "Bug 3 .keys() timing recorded: ___ms" },
              { id: "01-B-7d", label: "Bug 4 crash reproduced via Set Value: YES / NO" },
              { id: "01-B-7e", label: "Bug 5 stuck state confirmed: YES / NO" },
              { id: "01-B-7f", label: "Bug 6 TwiML routes identified: ___ routes" },
              { id: "01-B-7g", label: "Checkpoint: ALL rows above must be filled before writing a single test in Section C." },
            ],
          },
        ],
      },
      {
        id: "01-C",
        title: "Section C — Characterization Tests",
        description: "Write tests that pin current behaviour. These tests survive the refactor because they assert what the system does, not how it is wired.",
        tasks: [
          {
            id: "01-C-0",
            label: "Test infrastructure setup",
            subtasks: [
              { id: "01-C-0a", label: "mkdir -p tests/unit tests/integration tests/functional" },
              { id: "01-C-0b", label: "Create tests/conftest.py with fixtures: clean_redis, mock_twilio, mock_claude" },
              { id: "01-C-0c", label: "clean_redis: scope=function, flush the test keyspace before each test" },
              { id: "01-C-0d", label: "mock_twilio: monkeypatch twilio.rest.Client.messages.create to return a fake SID" },
              { id: "01-C-0e", label: "mock_claude: monkeypatch anthropic.Anthropic to return a fake completion" },
              { id: "01-C-0f", label: "Create FastAPI TestClient: from fastapi.testclient import TestClient; client = TestClient(app)" },
              { id: "01-C-0g", label: "pytest tests/ -x -- all zero tests must PASS before writing any" },
            ],
          },
          {
            id: "01-C-1",
            label: "Level 1 — Pure function unit tests (no HTTP, no Redis, no Twilio)",
            subtasks: [
              { id: "01-C-1a", label: "normalize_whitespace(): None -> '', empty -> '', tabs -> single space, multiple spaces -> single space" },
              { id: "01-C-1b", label: "is_button_press(): known button strings -> True, unknown text -> False, case variants" },
              { id: "01-C-1c", label: "extract_part_numbers(): valid part patterns -> list, noise input -> [], mixed input -> only valid parts" },
              { id: "01-C-1d", label: "extract_part_qty_pairs_customer(): all 5 supported formats + edge cases (no qty, zero qty, large qty)" },
              { id: "01-C-1e", label: "map_country_code_to_currency(): UK -> GBP, US -> USD, Canada -> CAD, EU -> EUR, unknown -> None or default" },
              { id: "01-C-1f", label: "generate_departmental_reference_id(): sales -> 'sal_', admin -> 'adm_', logistics -> 'log_' prefix confirmed" },
              { id: "01-C-1g", label: "extract_department_transfer(): 'yes, to sales' -> 'sales', no match -> None, case variants" },
              { id: "01-C-1h", label: "format_conversation(): with messages -> formatted string, with quotes -> quotes included, empty interaction -> empty string" },
              { id: "01-C-1i", label: "format_all_customer_messages(): single interaction, multiple interactions, empty session dict" },
              { id: "01-C-1j", label: "All Level 1 tests use scope=function fixtures. No mock.assert_called_with anywhere." },
              { id: "01-C-1k", label: "pytest tests/unit/ -v -- all pass" },
            ],
          },
          {
            id: "01-C-2",
            label: "Level 2 — FSM integration tests (no HTTP, no Redis, no Twilio)",
            subtasks: [
              { id: "01-C-2a", label: "Full sales happy path: IDLE -> MAIN_MENU -> SALES_MENU -> SALES_INQUIRY -> WAITING_RESPONSE -> INQUIRY_COMPLETE" },
              { id: "01-C-2b", label: "Each transition: assert fsm.state == expected_state after transition call" },
              { id: "01-C-2c", label: "to_dict() / from_dict() round-trip: WhatsAppFSM -> dict -> WhatsAppFSM, assert state preserved" },
              { id: "01-C-2d", label: "log_function_call() capped at 5 entries: add 6, assert len(fsm.function_calls) == 5" },
              { id: "01-C-2e", label: "populate_context_from_session(): assert all expected context keys present after call" },
              { id: "01-C-2f", label: "simulate_sales_flow(): run full simulation, assert terminal state reached" },
              { id: "01-C-2g", label: "simulate_admin_flow(): run full simulation, assert terminal state reached" },
              { id: "01-C-2h", label: "simulate_logistics_flow(): run full simulation, assert terminal state reached" },
              { id: "01-C-2i", label: "State.ERROR test: transition to ERROR state, attempt recovery transition, assert InvalidStateError raised" },
              { id: "01-C-2j", label: "pytest tests/integration/ -v -- all pass" },
            ],
          },
          {
            id: "01-C-3",
            label: "Level 3 — Webhook characterization tests (full stack, mocked externals)",
            subtasks: [
              { id: "01-C-3a", label: "Scenario 1 — New customer: POST /whatsapp-webhook with new number -> response 200, Redis key created, main menu text sent" },
              { id: "01-C-3b", label: "Assert: redis_client.exists('whatsapp:+447700000000') == 1 after request" },
              { id: "01-C-3c", label: "Assert: session['fsm_state']['state'] == 'MAIN_MENU' after request" },
              { id: "01-C-3d", label: "Scenario 2 — Sales button press: existing session in MAIN_MENU, POST 'sales' -> state transitions to SALES_MENU" },
              { id: "01-C-3e", label: "Assert: session['menu'] == 'sales' after request" },
              { id: "01-C-3f", label: "Scenario 3 — Part number inquiry: session in SALES_INQUIRY, POST with part number -> AI called, state -> WAITING_RESPONSE" },
              { id: "01-C-3g", label: "Assert: mock_claude called once (use mock.called, not mock.assert_called_with)" },
              { id: "01-C-3h", label: "Scenario 4 — Unknown input: session in MAIN_MENU, POST 'xyzzy' -> 200 response, state unchanged, help text sent" },
              { id: "01-C-3i", label: "Assert: response.status_code == 200 (server does not 500 on unknown input)" },
              { id: "01-C-3j", label: "Scenario 5 — Department transfer: session in SALES_INQUIRY, POST 'yes, to logistics' -> state TRANSFER_INITIATED" },
              { id: "01-C-3k", label: "Scenario 6 — Regex NoneType (Bug 4): session in SALES_INQUIRY, POST 'yes please' (no department) -> 200, no crash" },
              { id: "01-C-3l", label: "Mark Bug 4 test as @pytest.mark.xfail(reason='Bug 4: regex NoneType crash not yet fixed') if it crashes" },
              { id: "01-C-3m", label: "Scenario 7 — Returning customer: second POST with same number -> existing session loaded from Redis, not reinitialised" },
              { id: "01-C-3n", label: "Assert: session['reference_ids'] has length 0 still (no new inquiry created on second message)" },
              { id: "01-C-3o", label: "Scenario 8 — TwiML bug (Bug 6): assert response.headers['content-type'] is NOT 'text/xml' for WhatsApp routes" },
              { id: "01-C-3p", label: "Mark Bug 6 test as @pytest.mark.xfail if content-type is text/xml (documents the bug)" },
              { id: "01-C-3q", label: "Scenario 9 — State persistence: POST -> Redis session -> second POST reads same session state" },
              { id: "01-C-3r", label: "pytest tests/functional/ -v -- all pass (xfail is still a pass)" },
            ],
          },
          {
            id: "01-C-4",
            label: "Module 01 completion gate",
            subtasks: [
              { id: "01-C-4a", label: "pytest tests/ -v -- full suite passes with 0 errors (xfail counts as pass)" },
              { id: "01-C-4b", label: "pytest tests/ --co -q | wc -l -- at least 40 test items collected" },
              { id: "01-C-4c", label: "git add tests/ && git commit -m 'feat: Module 01 characterization test suite'" },
              { id: "01-C-4d", label: "Comprehension gate: state the CAT-x for every method you touched" },
              { id: "01-C-4e", label: "Comprehension gate: explain why every xfail test is marked xfail rather than deleted" },
              { id: "01-C-4f", label: "Comprehension gate: explain what would break in Module 02 if you had used assert_called_with" },
              { id: "01-C-4g", label: "GATE PASSED: you may proceed to Module 02 (Phase 1 security + Phase 2 repository layer)" },
            ],
          },
        ],
      },
    ],
  },
];

// ─── STORAGE ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "twilio-module-plan-00-01-v1";

const storage = {
  get: (key) => {
    try {
      const v = localStorage.getItem(key);
      return v ? { value: v } : null;
    } catch { return null; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, val); return true; } catch { return null; }
  },
  delete: (key) => {
    try { localStorage.removeItem(key); return true; } catch { return null; }
  },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function countTasks(sections) {
  let total = 0, done = 0;
  for (const sec of sections) {
    for (const task of sec.tasks) {
      for (const st of task.subtasks) {
        total++;
        if (st.done) done++;
      }
    }
  }
  return { total, done };
}

function initModules() {
  return MODULES.map(mod => ({
    ...mod,
    sections: mod.sections.map(sec => ({
      ...sec,
      tasks: sec.tasks.map(task => ({
        ...task,
        subtasks: task.subtasks.map(st => ({ ...st, done: false })),
      })),
    })),
  }));
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const font = "'IBM Plex Mono', 'Fira Code', monospace";
const fontSans = "'IBM Plex Sans', system-ui, sans-serif";

const S = {
  root: {
    minHeight: "100vh",
    background: "#080808",
    color: "#e4e4e7",
    fontFamily: fontSans,
    fontSize: 14,
  },
  header: {
    borderBottom: "1px solid #1c1c1e",
    padding: "20px 32px 16px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    position: "sticky",
    top: 0,
    background: "#080808",
    zIndex: 10,
  },
  titleBlock: { flex: 1 },
  title: { fontFamily: font, fontSize: 15, fontWeight: 600, color: "#fff", letterSpacing: "0.02em" },
  sub: { fontSize: 12, color: "#52525b", marginTop: 2 },
  body: { display: "flex", minHeight: "calc(100vh - 65px)" },
  sidebar: { width: 240, borderRight: "1px solid #1c1c1e", padding: "16px 0", flexShrink: 0, position: "sticky", top: 65, alignSelf: "flex-start", height: "calc(100vh - 65px)", overflowY: "auto" },
  main: { flex: 1, padding: "28px 36px", overflowY: "auto" },
  modBtn: (active, color) => ({
    width: "100%",
    textAlign: "left",
    background: active ? "#111" : "transparent",
    border: "none",
    borderLeft: active ? `3px solid ${color}` : "3px solid transparent",
    padding: "10px 18px",
    cursor: "pointer",
    color: active ? "#fff" : "#52525b",
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    transition: "all 0.12s",
  }),
  secBtn: (active) => ({
    width: "100%",
    textAlign: "left",
    background: active ? "#0d0d0d" : "transparent",
    border: "none",
    borderLeft: active ? "2px solid #3f3f46" : "2px solid transparent",
    padding: "7px 18px 7px 28px",
    cursor: "pointer",
    color: active ? "#a1a1aa" : "#3f3f46",
    fontFamily: fontSans,
    fontSize: 12,
    transition: "all 0.12s",
  }),
  card: {
    background: "#0f0f0f",
    border: "1px solid #1c1c1e",
    borderRadius: 8,
    padding: "20px 24px",
    marginBottom: 14,
  },
  taskRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #111",
    cursor: "pointer",
  },
  subtaskRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "5px 0 5px 18px",
    cursor: "pointer",
  },
  check: (done, color) => ({
    width: 15,
    height: 15,
    borderRadius: 3,
    border: done ? "none" : `1px solid ${color || "#3f3f46"}`,
    background: done ? (color || "#3b82f6") : "transparent",
    flexShrink: 0,
    marginTop: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.1s",
  }),
  pill: (color) => ({
    display: "inline-flex",
    alignItems: "center",
    background: color + "18",
    border: `1px solid ${color}40`,
    color: color,
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 11,
    fontFamily: font,
    fontWeight: 600,
  }),
  progress: (pct, color) => ({
    height: 3,
    borderRadius: 2,
    background: "#1c1c1e",
    overflow: "hidden",
    position: "relative",
    marginTop: 6,
  }),
  progressFill: (pct, color) => ({
    position: "absolute",
    left: 0,
    top: 0,
    height: "100%",
    width: `${pct}%`,
    background: color,
    borderRadius: 2,
    transition: "width 0.3s",
  }),
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }) {
  return (
    <div style={S.progress(pct, color)}>
      <div style={S.progressFill(pct, color)} />
    </div>
  );
}

function Tick({ done, color }) {
  return (
    <div style={S.check(done, color)}>
      {done && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── APP ────────────────────────────────────────────────────────────────────

export default function App() {
  const [modules, setModules] = useState(initModules);
  const [activeModId, setActiveModId] = useState("00");
  const [activeSectionId, setActiveSectionId] = useState("00-A");
  const [loaded, setLoaded] = useState(false);
  const saveRef = useRef(null);

  // Load persisted state
  useEffect(() => {
    const saved = storage.get(STORAGE_KEY);
    if (saved?.value) {
      try {
        const parsed = JSON.parse(saved.value);
        setModules(prev => prev.map(mod => {
          const sm = parsed.find(x => x.id === mod.id);
          if (!sm) return mod;
          return {
            ...mod,
            sections: mod.sections.map(sec => {
              const ss = sm.sections?.find(x => x.id === sec.id);
              if (!ss) return sec;
              return {
                ...sec,
                tasks: sec.tasks.map(task => {
                  const st = ss.tasks?.find(x => x.id === task.id);
                  if (!st) return task;
                  return {
                    ...task,
                    subtasks: task.subtasks.map(sub => {
                      const found = st.subtasks?.find(x => x.id === sub.id);
                      return found ? { ...sub, done: found.done } : sub;
                    }),
                  };
                }),
              };
            }),
          };
        }));
      } catch {}
    }
    setLoaded(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      const slim = modules.map(mod => ({
        id: mod.id,
        sections: mod.sections.map(sec => ({
          id: sec.id,
          tasks: sec.tasks.map(task => ({
            id: task.id,
            subtasks: task.subtasks.map(sub => ({ id: sub.id, done: sub.done })),
          })),
        })),
      }));
      storage.set(STORAGE_KEY, JSON.stringify(slim));
    }, 400);
  }, [modules, loaded]);

  const toggleSubtask = useCallback((modId, secId, taskId, subId) => {
    setModules(prev => prev.map(mod =>
      mod.id !== modId ? mod : {
        ...mod,
        sections: mod.sections.map(sec =>
          sec.id !== secId ? sec : {
            ...sec,
            tasks: sec.tasks.map(task =>
              task.id !== taskId ? task : {
                ...task,
                subtasks: task.subtasks.map(sub =>
                  sub.id !== subId ? sub : { ...sub, done: !sub.done }
                ),
              }
            ),
          }
        ),
      }
    ));
  }, []);

  const resetAll = useCallback(() => {
    if (!window.confirm("Reset all progress? This cannot be undone.")) return;
    setModules(initModules());
    storage.delete(STORAGE_KEY);
  }, []);

  const activeMod = modules.find(m => m.id === activeModId) || modules[0];
  const activeSection = activeMod.sections.find(s => s.id === activeSectionId) || activeMod.sections[0];

  // Totals
  const allStats = modules.map(mod => ({ ...countTasks(mod.sections), color: mod.color, id: mod.id }));
  const grand = allStats.reduce((acc, s) => ({ total: acc.total + s.total, done: acc.done + s.done }), { total: 0, done: 0 });
  const grandPct = grand.total ? Math.round((grand.done / grand.total) * 100) : 0;

  const modStats = (mod) => countTasks(mod.sections);
  const secStats = (sec) => {
    let total = 0, done = 0;
    for (const task of sec.tasks) {
      for (const sub of task.subtasks) {
        total++;
        if (sub.done) done++;
      }
    }
    return { total, done };
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titleBlock}>
          <div style={S.title}>twilio / refactoring-plan</div>
          <div style={S.sub}>Module 00 Environment Gate  •  Module 01 Discovery & Characterization Tests  •  {grandPct}% complete  •  {grand.done}/{grand.total} sub-tasks</div>
          <ProgressBar pct={grandPct} color="#3b82f6" />
        </div>
        <button onClick={resetAll} style={{ background: "transparent", border: "1px solid #27272a", color: "#52525b", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: fontSans }}>
          Reset
        </button>
      </div>

      <div style={S.body}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          {modules.map(mod => {
            const ms = modStats(mod);
            const mPct = ms.total ? Math.round((ms.done / ms.total) * 100) : 0;
            return (
              <div key={mod.id}>
                <button
                  style={S.modBtn(activeModId === mod.id, mod.color)}
                  onClick={() => { setActiveModId(mod.id); setActiveSectionId(mod.sections[0].id); }}
                >
                  <div style={{ fontFamily: font, fontSize: 11, color: mod.color, marginBottom: 1 }}>MODULE {mod.id}</div>
                  <div style={{ fontSize: 12 }}>{mod.subtitle}</div>
                  <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>{ms.done}/{ms.total} done</div>
                  <ProgressBar pct={mPct} color={mod.color} />
                </button>
                {activeModId === mod.id && mod.sections.map(sec => {
                  const ss = secStats(sec);
                  return (
                    <button key={sec.id} style={S.secBtn(activeSectionId === sec.id)} onClick={() => setActiveSectionId(sec.id)}>
                      {sec.title.split(" — ")[0]}
                      <span style={{ color: "#27272a", marginLeft: 6 }}>{ss.done}/{ss.total}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Main */}
        <div style={S.main}>
          {/* Section header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={S.pill(activeMod.color)}>MODULE {activeMod.id}</span>
              <span style={{ fontFamily: font, fontSize: 13, color: "#a1a1aa" }}>{activeSection.title}</span>
            </div>
            <div style={{ fontSize: 13, color: "#52525b", lineHeight: 1.6, maxWidth: 640 }}>{activeSection.description}</div>
          </div>

          {/* Tasks */}
          {activeSection.tasks.map(task => {
            const taskDone = task.subtasks.every(s => s.done);
            const taskPct = task.subtasks.length ? Math.round(task.subtasks.filter(s => s.done).length / task.subtasks.length * 100) : 0;
            return (
              <div key={task.id} style={S.card}>
                {/* Task header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: taskDone ? activeMod.color : "transparent",
                    border: taskDone ? "none" : `1px solid ${activeMod.color}50`,
                    flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {taskDone && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5L4.5 8L9 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontFamily: font, fontSize: 12, fontWeight: 600, color: taskDone ? activeMod.color : "#e4e4e7" }}>
                    {task.label}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#3f3f46", fontFamily: font }}>
                    {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                  </span>
                </div>
                <ProgressBar pct={taskPct} color={activeMod.color} />

                {/* Subtasks */}
                <div style={{ marginTop: 10 }}>
                  {task.subtasks.map(sub => (
                    <div
                      key={sub.id}
                      style={{ ...S.subtaskRow, opacity: sub.done ? 0.5 : 1 }}
                      onClick={() => toggleSubtask(activeMod.id, activeSection.id, task.id, sub.id)}
                    >
                      <Tick done={sub.done} color={activeMod.color} />
                      <span style={{
                        fontSize: 12,
                        color: sub.done ? "#52525b" : "#a1a1aa",
                        textDecoration: sub.done ? "line-through" : "none",
                        fontFamily: sub.label.includes("pytest") || sub.label.startsWith("grep") || sub.label.startsWith("mkdir") || sub.label.startsWith("git") || sub.label.startsWith("redis") || sub.label.startsWith("pip") || sub.label.startsWith("docker") || sub.label.startsWith("uvicorn") || sub.label.startsWith("python") || sub.label.startsWith("curl") ? font : fontSans,
                        lineHeight: 1.5,
                      }}>
                        {sub.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
