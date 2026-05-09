import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// THEME — warm-paper editorial palette, mirrors app/visual_theme.py.
// Terracotta is reserved for attention-demanding things only.
// Everything else lives on the warm-grey scale.
// ═══════════════════════════════════════════════════════════════════

const T = {
  paper: "#FAF9F6", surface_1: "#F5F2EC", surface_2: "#EBE6DB",
  border_soft: "#E8E4DB", border_med: "#D9D4C7", border_strong: "#8A8276",
  ink_1: "#2B2826", ink_2: "#5A5550", ink_3: "#7A7368", ink_ghost: "#C0BAB0",
  acc_fill: "#F5E8DF", acc_border: "#C96E4A", acc_ink: "#8A3D1F",
  // Muted semantic tones — only for category differentiation; never compete with terracotta.
  slate: "#6B7B8E", slate_fill: "#EAECEF",
  plum:  "#8E6B8E", plum_fill:  "#EFE9EF",
  sage:  "#7A8E6B", sage_fill:  "#ECEFE7",
  ochre: "#B89461", ochre_fill: "#F1ECDF",
  teal:  "#5E8E91", teal_fill:  "#E7EDED",
  clay:  "#A37857", clay_fill:  "#F0E9E2",
};

const FONT_SERIF = "'Iowan Old Style', 'Palatino', 'Georgia', serif";
const FONT_SANS  = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
const FONT_MONO  = "'Menlo', 'Consolas', 'Courier New', monospace";

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════

const CAT_DEFS = {
  "CAT-1": { label: "Query",         color: T.slate,      fill: T.slate_fill, desc: "Returns data, no side effects" },
  "CAT-2": { label: "Mutation",      color: T.plum,       fill: T.plum_fill,  desc: "Changes internal state, returns nothing" },
  "CAT-3": { label: "Command",       color: T.acc_border, fill: T.acc_fill,   desc: "Triggers external IO" },
  "CAT-4": { label: "Factory",       color: T.sage,       fill: T.sage_fill,  desc: "Creates and returns a new object" },
  "CAT-5": { label: "Validation",    color: T.ochre,      fill: T.ochre_fill, desc: "Raises on bad input, no return value" },
  "CAT-6": { label: "Orchestration", color: T.teal,       fill: T.teal_fill,  desc: "Coordinates multiple CAT-x operations" },
  "CAT-8": { label: "Computation",   color: T.clay,       fill: T.clay_fill,  desc: "Pure calculation, no IO, no state" },
};

const SOLID_DEFS = {
  "SOLID-SRP": "Class has more than one reason to change",
  "SOLID-DIP": "Depends on concrete, not abstraction",
  "OOP-ENCAP": "Internal state exposed to callers",
  "CONC-3":    "Synchronous call inside async handler",
  "PRT-2":     "No Protocol at an IO boundary",
};

const TEMPLATES = {
  "A.1":   "Pure function, no fixtures",
  "B.1.1": "Factory, verify no side effects",
  "B.1.4": "State mutation, before/after assertion",
  "B.1.9": "Orchestration, real Redis, monkeypatched IO",
};

const SECTIONS = [
  { id: "orientation",    label: "Orientation",        icon: "◈" },
  { id: "pre-prompt",     label: "DT-METHOD-1",        icon: "◆" },
  { id: "setup",          label: "Setup",              icon: "›" },
  { id: "q1",             label: "Q1 · webhook()",     icon: "①" },
  { id: "q2",             label: "Q2 · Redis Client",  icon: "②" },
  { id: "q3",             label: "Q3 · .keys() Scan",  icon: "③" },
  { id: "q4",             label: "Q4 · Decorator",     icon: "④" },
  { id: "q5",             label: "Q5 · State.ERROR",   icon: "⑤" },
  { id: "q6",             label: "Q6 · Observations",  icon: "⑥" },
  { id: "q7",             label: "Q7 · Prod Failure",  icon: "⑦" },
  { id: "failure-matrix", label: "Failure Matrix",     icon: "!" },
  { id: "tests-l1",       label: "Tests · L1 Pure",    icon: "▸" },
  { id: "tests-l2",       label: "Tests · L2 FSM",     icon: "▸" },
  { id: "tests-l3",       label: "Tests · L3 Webhook", icon: "▸" },
  { id: "checklist",      label: "Completion",         icon: "✓" },
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
  { fn: "generate_departmental_reference_id", cat: "CAT-4", template: "B.1.1", edges: "sal_, adm_, log_ prefixes; two calls differ; missing team_type fallback",
    pseudo: `# CAT-x:     CAT-4 Factory
# OOP/SOLID: N/A
# Template:  B.1.1 Factory

class Test<FunctionName>:
    """B.1.1 Factory: <description>."""

    @pytest.mark.parametrize("<input_param>,<expected_constraint>", [...])
    def test_<primary_contract>(self, <input_param>, <expected_constraint>):
        # ARRANGE — construct <session_dict> with known <input_param>
        # ACT     — result = <function>(<session_dict>)
        # ASSERT  — result starts with <expected_constraint>

    def test_<uniqueness>(self):
        # ARRANGE — same <session_dict>
        # ACT     — call <function> twice
        # ASSERT  — result_1 != result_2`,
    cases: [
      { input: '{"team_type": "sales"}', expected: 'starts with "sal_"', type: "happy" },
      { input: '{"team_type": "admin"}', expected: 'starts with "adm_"', type: "happy" },
      { input: '{"team_type": "logistics"}', expected: 'starts with "log_"', type: "happy" },
      { input: "call twice, same session", expected: "ref_1 ≠ ref_2", type: "uniqueness" },
      { input: "{} (empty session)", expected: "KeyError or fallback prefix", type: "edge" },
      { input: '{"team_type": "sales"}', expected: 'matches r"^sal_[a-f0-9]{6,}$"', type: "format" },
    ] },
  { fn: "map_country_code_to_currency", cat: "CAT-1", template: "A.1", edges: "+44→GBP, +1→USD, +49→EUR, whatsapp: prefix stripped, unknown→USD",
    pseudo: `# CAT-x:     CAT-1 Query
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure function: deterministic, no side effects."""

    @pytest.mark.parametrize("<input_param>,<expected_output>", [...])
    def test_<primary_contract>(self, <input_param>, <expected_output>):
        result_1 = <function>(<input_param>)
        result_2 = <function>(<input_param>)
        assert result_1 == <expected_output>
        assert result_1 == result_2  # A.1 idempotence`,
    cases: [
      { input: '"whatsapp:+447700000000"', expected: '"GBP"', type: "happy" },
      { input: '"whatsapp:+12025551234"', expected: '"USD"', type: "happy" },
      { input: '"whatsapp:+4915112345678"', expected: '"EUR"', type: "happy" },
      { input: '"whatsapp:+99912345"', expected: '"USD" (fallback)', type: "edge" },
      { input: 'same input twice', expected: "identical result both calls", type: "idempotence" },
    ] },
  { fn: "extract_part_qty_pairs", cat: "CAT-8", template: "A.1", edges: '"3 x 452-0427", "2x1234-56", "no parts", "" — assert tuple contents',
    pseudo: `# CAT-x:     CAT-8 Computation
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure computation: <input_type> --> <output_type>."""

    @pytest.mark.parametrize("<input_param>,<expected_count>", [...])
    def test_<count_contract>(self, <input_param>, <expected_count>):
        result = <function>(<input_param>)
        assert len(result) == <expected_count>`,
    cases: [
      { input: '"3 x 452-0427"', expected: '[{"quantity": 3, "part number": "452-0427"}]', type: "happy" },
      { input: '"2x1234-56789"', expected: '[{"quantity": 2, "part number": "1234-56789"}]', type: "no space" },
      { input: '"452-0427 2"', expected: '[{"quantity": 2, "part number": "452-0427"}]', type: "reversed" },
      { input: '"3 x 452-0427 and 1 x 789-12345"', expected: "2 pairs", type: "multi" },
      { input: '"no parts here"', expected: "[]", type: "no match" },
      { input: '""', expected: "[]", type: "empty" },
    ] },
  { fn: "extract_department_transfer", cat: "CAT-8", template: "A.1", edges: '"speak to sales team", "transfer to admin", "logistics", "no transfer"',
    pseudo: `# CAT-x:     CAT-8 Computation
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure computation: <input_type> --> <output_type> or None."""

    @pytest.mark.parametrize("<input_param>,<expected_output>", [...])
    def test_<primary_contract>(self, <input_param>, <expected_output>):
        result = <function>(<input_param>)
        assert result == <expected_output>`,
    cases: [
      { input: '"speak to sales team"', expected: '"sales"', type: "happy" },
      { input: '"transfer to admin"', expected: '"admin"', type: "happy" },
      { input: '"logistics please"', expected: '"logistics"', type: "happy" },
      { input: '"no transfer intent here"', expected: "None", type: "no match" },
      { input: '"hello"', expected: "None", type: "greeting" },
    ] },
  { fn: "is_button_press", cat: "CAT-1", template: "A.1", edges: "every string in ALL_BUTTONS; one that is not; case sensitivity",
    pseudo: `# CAT-x:     CAT-1 Query
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure query: <input_type> --> bool."""

    @pytest.mark.parametrize("<input_param>", [...])
    def test_<membership_true>(self, <input_param>):
        assert <function>(<input_param>) is True`,
    cases: [
      { input: '"salesid1"', expected: "True", type: "happy" },
      { input: '"new_inquiry"', expected: "True", type: "happy" },
      { input: '"admin_support"', expected: "True", type: "happy" },
      { input: '"hello world"', expected: "False", type: "freeform" },
      { input: '"I need 3 x 452-0427"', expected: "False", type: "parts text" },
      { input: '"SALESID1"', expected: "True or False — characterize", type: "case edge" },
    ] },
  { fn: "normalize_whitespace", cat: "CAT-8", template: "A.1", edges: "tabs, multiple spaces, leading/trailing, None",
    pseudo: `# CAT-x:     CAT-8 Computation
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure computation: <input_type> --> <output_type>."""

    def test_<idempotence>(self):
        # ACT     — call <function>(<same_input>) twice
        # ASSERT  — result_1 == result_2`,
    cases: [
      { input: '"  hello  world  "', expected: '"hello world"', type: "inner + edges" },
      { input: '"hello\\tworld"', expected: '"hello world"', type: "tabs" },
      { input: '"multiple   spaces"', expected: '"multiple spaces"', type: "multi" },
      { input: '"already clean"', expected: '"already clean"', type: "no-op" },
      { input: "None", expected: '""', type: "null" },
      { input: '""', expected: '""', type: "empty" },
    ] },
];

const FSM_TESTS = [
  { test: "MAIN_MENU → SALES_INQUIRIES", template: "B.1.4", assertion: "state before=MAIN_MENU, after=SALES_INQUIRIES, history+1", label: "PAT-8",
    pseudo: `# CAT-x:     CAT-2 Mutation
# OOP/SOLID: PAT-8 State Pattern
# Template:  B.1.4 State Mutation

def test_<from_state>_to_<to_state>(self):
    # ARRANGE — <fsm> = <FSMClass>() → default <initial_state>
    # ASSERT  — precondition: <fsm>.state == <from_state>
    # ACT     — <fsm>.transition_to(<to_state>)
    # ASSERT  — <fsm>.state == <to_state>; len(history) +1`,
    cases: [{ pre: "State.MAIN_MENU", action: "transition_to(State.SALES_INQUIRIES)", post: "State.SALES_INQUIRIES", history: "+1" }] },
  { test: "MAIN_MENU → ADMIN_SUPPORT", template: "B.1.4", assertion: "same pattern", label: "PAT-8",
    pseudo: `# Same B.1.4 pattern — only <to_state> differs`,
    cases: [{ pre: "State.MAIN_MENU", action: "transition_to(State.ADMIN_SUPPORT)", post: "State.ADMIN_SUPPORT", history: "+1" }] },
  { test: "MAIN_MENU → TRACK_ORDER", template: "B.1.4", assertion: "same pattern", label: "PAT-8",
    pseudo: `# Same B.1.4 pattern — only <to_state> differs`,
    cases: [{ pre: "State.MAIN_MENU", action: "transition_to(State.TRACK_ORDER)", post: "State.TRACK_ORDER", history: "+1" }] },
  { test: "SALES → NEW_SALES_INQUIRY", template: "B.1.4", assertion: "state change + history from/to values", label: "PAT-8",
    pseudo: `# B.1.4 two-step: navigate to <precondition_state> first

def test_<from_state>_to_<to_state>(self):
    # ARRANGE — <fsm> at <initial_state>, transition to <precondition_state>
    # ACT     — <fsm>.transition_to(<to_state>)
    # ASSERT  — <fsm>.history[-1]["from_state"] == <precondition_state_value>
    #           <fsm>.history[-1]["to_state"] == <to_state_value>`,
    cases: [{ pre: "State.SALES_INQUIRIES", action: "transition_to(State.NEW_SALES_INQUIRY)", post: "State.NEW_SALES_INQUIRY", history: 'from="Sales Inquiries" to="New Sales Inquiry"' }] },
  { test: "Invalid transition raises", template: "A.1", assertion: "transition_to(QUOTE_SENT) from MAIN_MENU raises ValueError", label: "CAT-5",
    pseudo: `# CAT-x:     CAT-5 Validation
# Template:  A.2 Validation — pytest.raises

def test_<invalid_transition>_raises(self):
    # ACT + ASSERT — pytest.raises(<ExceptionType>):
    #                   <fsm>.transition_to(<illegal_target_state>)
    # ASSERT — <fsm>.state still == <from_state> (unchanged)`,
    cases: [
      { pre: "State.MAIN_MENU", action: "transition_to(State.QUOTE_SENT)", post: "ValueError raised, state unchanged", history: "no entry added" },
      { pre: "State.MAIN_MENU", action: "transition_to(State.AI_PROCESSING)", post: "ValueError raised", history: "no entry added" },
    ] },
  { test: "State.ERROR tuple bug documented", template: "A.1", assertion: 'assert State.ERROR.value == ("Error",) — IS the bug', label: "BUG",
    pseudo: `# Template:  TST-5 Characterization
# This test MUST PASS against current code; FAILS after the fix.

@pytest.mark.characterization
def test_<enum_member>_value_is_<wrong_type>_BUG(self):
    # ASSERT — <EnumClass>.<MEMBER>.value == <wrong_value>
    # ASSERT — isinstance(<EnumClass>.<MEMBER>.value, <wrong_type>)`,
    cases: [
      { input: "State.ERROR.value", expected: '("Error",) — tuple, not string', type: "BUG" },
      { input: "isinstance(State.ERROR.value, tuple)", expected: "True", type: "BUG" },
      { input: 'State("Error")', expected: "raises ValueError", type: "crash path" },
    ] },
  { test: "to_dict() / from_dict() round-trip", template: "B.1.4+B.1.1", assertion: "all fields preserved", label: "OOP-ENCAP",
    pseudo: `# CAT-x:     CAT-1 Query (to_dict) + CAT-4 Factory (from_dict)
# Template:  B.1.4 + B.1.1

def test_<round_trip>_preserves_all_fields(self):
    # ARRANGE — <fsm> with <transitions_applied> + <context_set>
    # ACT     — data = fsm.to_dict(); restored = FSMClass.from_dict(data)
    # ASSERT  — all fields equal across instances`,
    cases: [
      { input: "fsm after 2 transitions + context", expected: "all fields identical after round-trip", type: "happy" },
      { input: "to_dict() output", expected: 'keys: "state", "context", "history", "function_calls"', type: "shape" },
      { input: "from_dict({})", expected: "defaults to State.MAIN_MENU", type: "defaults" },
    ] },
  { test: 'from_dict() with "state":"Error"', template: "A.1", assertion: "raises ValueError — characterization", label: "BUG",
    pseudo: `# Template:  TST-5 Characterization — crash path

@pytest.mark.characterization
def test_<from_dict>_with_<corrupt_value>_crashes_BUG(self):
    # ACT + ASSERT — pytest.raises(ValueError):
    #                   FSMClass.from_dict(corrupt_data)`,
    cases: [
      { input: '{"state": "Error"}', expected: "raises ValueError", type: "BUG crash" },
      { input: '{"state": ["Error"]}', expected: "raises ValueError (JSON round-trip variant)", type: "BUG crash" },
    ] },
  { test: "Full sales happy path", template: "B.1.9", assertion: "MAIN→SALES→NEW→AI_PROC→AI_DONE", label: "PAT-8",
    pseudo: `# CAT-x:     CAT-6 Orchestration
# Template:  B.1.9 Collaboration

def test_<full_workflow>(self):
    # ACT — transition through each <state> in sequence
    # ASSERT — fsm.state correct after EACH step
    #          len(history) == total_transitions`,
    cases: [
      { step: "1", action: "transition_to(SALES_INQUIRIES)", expected: "State.SALES_INQUIRIES" },
      { step: "2", action: "transition_to(NEW_SALES_INQUIRY)", expected: "State.NEW_SALES_INQUIRY" },
      { step: "3", action: "transition_to(AI_PROCESSING)", expected: "State.AI_PROCESSING" },
      { step: "4", action: "transition_to(AI_PROCESSING_DONE)", expected: "State.AI_PROCESSING_DONE" },
    ] },
];

const WEBHOOK_SCENARIOS = [
  { scenario: "First message from unknown", seed: "None", input: "Body=hello", assertions: "HTTP 200; Redis key created; state=='Main Menu'; mock_twilio called once",
    pseudo: `# CAT-x:     CAT-6 Orchestration
# Template:  B.1.9 Collaboration

def test_<scenario>(self, client, mock_twilio):
    # ARRANGE — Redis clean (autouse fixture)
    # ACT     — client.post(endpoint, data={...})
    # ASSERT  — resp.status_code == 200
    #           Redis key created and parseable
    #           session["fsm_state"]["state"] == "Main Menu"
    #           len(mock_twilio) >= 1
    #           mock_twilio[0]["to"] == TEST_NUMBER`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "Redis key created", field: '_redis.get(TEST_NUMBER)', expected: "non-null JSON" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"Main Menu"' },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
      { assert: "Twilio target", field: 'mock_twilio[0]["to"]', expected: "TEST_NUMBER" },
    ] },
  { scenario: "salesid1 button", seed: "menu=main", input: "Body=salesid1", assertions: "HTTP 200; state=='Sales Inquiries'; sales submenu dispatched",
    pseudo: `def test_<scenario>(self, client, mock_twilio):
    # ARRANGE — seed session at seeded_state
    # ASSERT  — session["fsm_state"]["state"] == target_state`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"Sales Inquiries"' },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
    ] },
  { scenario: "new_inquiry button", seed: "menu=sales", input: "Body=new_inquiry", assertions: "HTTP 200; state=='New Sales Inquiry'; reference_id starts sal_",
    pseudo: `def test_<scenario>(self, client, mock_twilio):
    # ASSERT — session["current_reference_id"].startswith("sal_")`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"New Sales Inquiry"' },
      { assert: "Ref ID prefix", field: 'session["current_reference_id"]', expected: 'startswith("sal_")' },
    ] },
  { scenario: "Parts inquiry + mock_claude", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200/202; AI template dispatched; requested_quotes non-empty",
    pseudo: `def test_<scenario>(self, client, mock_twilio, mock_claude):
    # ARRANGE — seed session at inquiry_state; mock_claude active
    # ASSERT  — resp.status_code in (200, 202); len(mock_twilio) >= 1`,
    cases: [
      { assert: "HTTP success", field: "resp.status_code", expected: "200 or 202" },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
    ] },
  { scenario: "Unknown button payload", seed: "menu=main", input: "Body=notabutton", assertions: "HTTP 200; no crash; state unchanged",
    pseudo: `def test_<scenario>(self, client, mock_twilio):
    # ASSERT — session["fsm_state"]["state"] == state_before (unchanged)`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "State unchanged", field: 'session["fsm_state"]["state"]', expected: '"Main Menu"' },
    ] },
  { scenario: "all my messages special command", seed: "any", input: "Body=all my messages", assertions: "HTTP 200; handled before menu routing; cooldown key set",
    pseudo: `def test_<scenario>(self, client, mock_twilio):
    # ASSERT — _redis.exists(f"cooldown:all_messages:{TEST_NUMBER}") == True`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "Cooldown set", field: '_redis.exists(f"cooldown:all_messages:{TEST_NUMBER}")', expected: "True" },
    ] },
  { scenario: "process_with_ai raises", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200 (not 500); state not left as AI_PROCESSING",
    pseudo: `def test_<scenario>(self, client, mock_twilio, monkeypatch):
    # ARRANGE — monkeypatch dependency to raise
    # ASSERT  — resp.status_code == 200 (NOT 500)
    #           session["fsm_state"]["state"] != stuck_state`,
    cases: [
      { assert: "Graceful", field: "resp.status_code", expected: "200 (not 500)" },
      { assert: "Not stuck", field: 'session["fsm_state"]["state"]', expected: '≠ "AI Processing"' },
    ] },
  { scenario: "SM003 re-sent (Twilio retry)", seed: "menu=sales", input: "identical SM003", assertions: "HTTP 200; reference_id unchanged; no second interaction node",
    pseudo: `# Template:  TST-5 Characterization — documents idempotency_bug

@pytest.mark.characterization
def test_<duplicate_request>_BUG(self, client, mock_twilio):
    # ACT — send payload twice via client.post
    # ASSERT — both return 200; ref_1 != ref_2 (BUG: no dedup)`,
    cases: [
      { assert: "Both succeed", field: "resp_1 + resp_2 status", expected: "200 + 200" },
      { assert: "Ref ID stable?", field: "ref_1 vs ref_2", expected: "BUG: ref_1 ≠ ref_2 (no dedup)" },
    ] },
];

// ═══════════════════════════════════════════════════════════════════
// MODEL ANSWERS — reference answers for every field
// ═══════════════════════════════════════════════════════════════════

const M = {
  q1_op1: "HTTP request parsing — extracts form data from the Starlette Request object (from_number, body, profile_name, message_sid) via get_webhook_input()",
  q1_op2: "Session retrieval — loads or initializes the customer session from Redis via session_repo.get_session(), including JSON deserialization. When redis.get() returns None, get_session() raises ValueError, caught by get_user_session() which calls initialize_user_session() to create a default session dict",
  q1_op3: "FSM state hydration — reconstructs a WhatsAppFSM instance from the persisted dict via WhatsAppFSM.from_dict(), mapping string state values back to State enum members",
  q1_op4: "Special command routing — checks for meta-commands ('all my messages', 'reset', 'cooldown') via handle_special_commands() before FSM dispatch, short-circuiting the main flow",
  q1_op5: "Menu/state dispatch — routes to the correct handle_* function based on current FSM state (handle_main_menu_selection, handle_sales_inquiries, etc.), triggering FSM transitions",
  q1_op6: "Twilio response dispatch — formats and sends WhatsApp messages via client.messages.create(), including template selection, content variable assembly, and media URL attachment",
  q1_cat: "CAT-6 Orchestration — it coordinates session retrieval (CAT-1), FSM transitions (CAT-2), AI processing (CAT-3), and Twilio dispatch (CAT-3) across multiple concerns",
  q1_solid: "SOLID-SRP — six distinct reasons to change: request parsing format, session storage mechanism, FSM transition rules, special command set, menu routing logic, Twilio API contract",
  q1_summary: "whatsapp_webhook() is a CAT-6 orchestrator that directly performs operations from at least four other categories (parsing, session IO, FSM mutation, external dispatch) instead of delegating to single-responsibility collaborators, violating SRP with six distinct reasons to change.",

  q1d_input: "Dict with keys: from_number (str, e.g. 'whatsapp:+447700000000'), body (str, 'hello'), profile_name (str, 'Test User'), message_sid (str, 'SM_SETUP_001'). from_number is already a string at this point, not bytes.",
  q1d_session: "Yes — for a new customer, redis.get(key) returns None (not a KeyError). SessionRepository.get_session() checks if not session_data and explicitly raises ValueError(\"No session found for {key}\"). This is caught by the except ValueError: block in get_user_session(), which calls initialize_user_session() to create a default session dict.",
  q1d_fsm: "State.MAIN_MENU — the default state assigned by initialize_user_session(). The FSM is pure in-memory at this point; from_dict() only reads the dict passed to it, it does not touch Redis.",
  q1d_special: "False — 'hello' is not in the special commands set ('all my messages', 'reset', etc.), so handle_special_commands() returns False and execution continues to the main menu dispatch.",
  q1d_handle: "handle_main_menu_selection() — because fsm.state is MAIN_MENU. For the 'hello' body which is not a recognized button ID, this function sends the main menu template via Twilio.",
  q1d_defend: "CAT-3 describes a method with a single external side effect (e.g. payment.charge()). whatsapp_webhook() coordinates session retrieval, FSM hydration, state-dependent routing, AI processing, and Twilio dispatch — five distinct operations spanning four CAT-x categories. That is the definition of CAT-6 Orchestration: it coordinates multiple CAT-x operations, it does not perform a single external command.",

  q2_file1: "app/redis_helper.py",
  q2_type1: "redis.StrictRedis (synchronous)",
  q2_file2: "app/main.py",
  q2_type2: "redis.StrictRedis (synchronous) — second independent instance",
  q2_file3: "app/turbo_diesel_ai.py",
  q2_type3: "redis.StrictRedis (synchronous) — third independent instance",
  q2_solid: "SOLID-DIP — three concrete instances of the same synchronous client, each instantiated directly rather than injected through a shared abstraction. Also SOLID-SRP: the same keyspace is accessed from three separate modules with no single owner.",
  q2_blocking: "Customer B's coroutine is queued in the asyncio event loop but cannot execute. asyncio is single-threaded and cooperative — it only switches between coroutines at explicit await suspension points. redis.StrictRedis.get() is a synchronous blocking call that never yields to the event loop. The entire thread is held until the Redis round-trip completes. Customer B's request sits unprocessed in the socket buffer.",
  q2_fix: "redis.asyncio.Redis (import path: redis.asyncio) — drop-in replacement that makes every Redis call an awaitable coroutine, yielding to the event loop during network IO so other customers' requests can be processed concurrently.",

  q2d_type: "<class 'redis.client.StrictRedis'> — confirms this is the synchronous client, not redis.asyncio.Redis",
  q2d_iscoro: "False — redis.StrictRedis.get is a regular synchronous method, not a coroutine function. This proves that calling it inside async def will block the event loop.",
  q2d_blocked: "No — the second curl hangs in the terminal with no response. It cannot be processed because the event loop is blocked at the breakpoint. Only after pressing F9 does the second request begin processing.",
  q2d_label: "CONC-3 — synchronous call inside async handler blocks the event loop. The minimum fix is replacing redis.StrictRedis with redis.asyncio.Redis and awaiting every call.",

  q3_keys_total: "Count from grep — typically 2-4 calls across main.py and redis_helper.py. Each one is a full O(N) keyspace scan.",
  q3_keys_async: "All of them — they are all called from within async def handlers, meaning every .keys() call blocks the entire event loop for the duration of the scan.",
  q3_scaniter: "0 — scan_iter is never used anywhere in the codebase. Every key enumeration uses the blocking .keys() method.",
  q3_customer: "Complete service freeze. With 50k keys, .keys() takes ~50-200ms depending on value sizes. During that time the Redis server is single-threaded and cannot serve any other commands. Combined with the synchronous Python client (CONC-3), the asyncio event loop is also blocked. Every customer connected to the system experiences a stall.",
  q3_defend: "keys() is O(N) where N is the total number of keys in the database. scan_iter uses SCAN which is O(1) per call, iterating in batches of ~10 keys with a cursor. The guide labels are CONC-3 and CAT-1/CAT-3 category mismatch: .keys() is classified as a CAT-1 Query (returns data) but under load it behaves as a CAT-3 Command (catastrophic side effect on all other clients). This matters for test template selection because a CAT-1 test (A.1 — assert return value) would pass, but it would not catch the production failure.",

  q4_nonendpoint: "Verify via grep — check whether @handle_whatsapp_errors is applied to any function that is not an @app.post/@app.get endpoint. If it appears on internal methods like validate_state or process_with_ai, that confirms DEC-ERR-1 layer violation.",
  q4_fail1: "If the Request object is passed as a keyword argument (request=request) instead of a positional argument, next(arg for arg in args if isinstance(arg, Request)) raises StopIteration because args contains no Request. The decorator crashes before it can handle the actual error.",
  q4_fail2: "If the decorated function raises before the Request's form_data has been parsed, the except block tries to read from_number from form data that does not exist yet, raising a second exception that masks the original error. The customer gets a generic 500 instead of the intended error message.",
  q4_oop: "SOLID-DIP — the decorator depends on the concrete Starlette Request type (an HTTP-layer object). Any domain method it decorates now implicitly depends on HTTP infrastructure it should never know about. This is also OOP-ENCAP: the decorator reaches into the transport layer to extract from_number, breaking the boundary between HTTP handling and domain logic.",
  q4_defend: "SOLID-DIP (Dependency Inversion Principle) is violated because the decorator depends on a concrete HTTP-layer type (starlette.requests.Request) and forces that dependency onto every function it decorates. When applied to validate_state — a pure domain method — the domain layer now transitively depends on the HTTP layer. DIP says high-level modules (domain logic) should not depend on low-level modules (HTTP framework). The decorator should only exist on the outermost endpoint function.",

  q4d_from: "Either the correct from_number extracted from the Request's form data, or undefined/raises if the exception fired before form_data was populated. Check the Variables panel — if from_number is None or the except block itself raises, this confirms failure mode 2.",
  q4d_twilio: "It depends on whether from_number was successfully extracted. If from_number is valid, client.messages.create() will attempt to send an error notification — this may succeed or fail depending on Twilio credentials. If from_number is None, the create() call itself raises, masking the original error.",
  q4d_status: "The decorator returns a Response with status_code from the WhatsAppException (400 in this case). Twilio receives HTTP 400.",
  q4d_retry: "Twilio retries webhook delivery on any non-2xx response. It will retry up to 3 times with exponential backoff (1s, 2s, 4s). Each retry sends the same webhook payload, potentially triggering the same error handler three more times.",

  q5_value: '("Error",) — a tuple containing the string "Error", not the string "Error" itself. The trailing comma in ERROR = ("Error",) creates a single-element tuple.',
  q5_raises: 'ValueError: "Error" is not a valid State — because State("Error") looks for a member whose .value equals the string "Error", but State.ERROR.value is the tuple ("Error",), not the string. No member matches.',
  q5_redis: 'The to_dict() method calls self.state.value, which for State.ERROR returns ("Error",). JSON serialization writes this as ["Error"] (a JSON array). The "state" field in Redis becomes the array ["Error"] instead of the string "Error".',
  q5_crash: "from_dict() reads the state field and calls State(state_value). If the stored value is the list [\"Error\"], State([\"Error\"]) raises ValueError because no State member has a list as its value. This crashes at the State() constructor call inside from_dict(), approximately line 22 of fsm.py.",
  q5_recoverable: "No — the customer is permanently stuck. Every subsequent message triggers from_dict() which crashes on the corrupted state value. The only fix is manual Redis intervention.",
  q5_fix: "Remove the trailing comma: ERROR = \"Error\" instead of ERROR = (\"Error\",). One character deletion converts the tuple back to a string.",
  q5_label: "This is a BUG, not an ERR-x or SOLID violation. It does not fit the exception handling taxonomy because the system is not mishandling an exception — it is producing a corrupt value. It is not a SOLID violation because the design pattern is correct (enum member with string value); the implementation has a syntax error. The characterization test must assert the current broken behaviour.",

  q5d_field: 'The exact value depends on JSON serialization of the tuple. Expect either ["Error"] (JSON array) or ("Error",) as a string — either way it is not the plain string "Error" that from_dict() expects.',
  q5d_crash: "Yes — from_dict crashes with ValueError at the State(state_value) call. The exception message is approximately: '(\"Error\",) is not a valid State' or '['Error'] is not a valid State'.",
  q5d_stuck: "Yes — permanently. Every message from this customer now triggers from_dict() which immediately crashes. There is no self-healing path.",

  q6_SM001: 'fsm_state.state = "Main Menu". Redis key created with full session object. Main menu template sent via Twilio.',
  q6_SM002: 'fsm_state.state = "Sales Inquiries". State changed from "Main Menu" to "Sales Inquiries". FSM history now has one entry. Sales submenu template dispatched.',
  q6_SM003: 'fsm_state.state = "New Sales Inquiry". current_reference_id is now non-null, starting with "sal_". inquiry_in_progress = true. System ready to accept a parts inquiry.',
  q6_SM004: 'State may transition through "AI Processing" to "AI Processing Done" during the handler. If Claude API call succeeds, client.messages.create() is called to send the AI response.',
  q6_SM005: 'Behaviour depends on current state. After SM004, state is in AI_PROCESSING_DONE. The unknown text is likely routed to process_with_ai() (treated as a follow-up inquiry). If the state were MAIN_MENU, this text would trigger the default menu re-send.',
  q6_unexpected: "SM005 does not crash — it routes through the current state's handler. The same input produces completely different behaviour depending on which state the FSM is in.",
  q6_defend: "PAT-8 (State Pattern) — the same input produces different outputs depending on the object's internal state. The FSM's current state determines which handler processes the message. Characterization tests must seed the FSM to a known state before sending input.",

  q6d_c1: "fsm.state = State.NEW_SALES_INQUIRY (after SM003). inquiry_in_progress = True. The session was loaded from Redis and the FSM hydrated from the persisted dict.",
  q6d_c2_before: "fsm.state = whatever state the handler is transitioning from (depends on which handle_* function runs). Capture the exact value from the Variables panel.",
  q6d_c2_after: "fsm.state = the target state after transition_to(). The FSM object's internal state has changed in memory.",
  q6d_c2_redis: "No — Redis is NOT updated at this point. The transition only mutates the in-memory FSM object. Redis is only written when session_repo.save_session() is called later. This means if the process crashes between transition and save, the state change is lost.",
  q6d_c3: "Multiple ic() calls fire before the anthropic_client call — typically 3-8 depending on the code path. In production this means every customer message generates multiple lines of debug noise with no log level control. This is LOG-1.",
  q6d_c4: "Yes — current_reference_id should be non-null (e.g. 'sal_abc123') because it was set when the new_inquiry button was pressed in SM003.",
  q6d_rw: "Concern 1 (session load) reads from Redis. Concern 4 area writes to Redis via session_repo.save_session(). Typically 1-2 write calls across the full SM004 flow.",
  q6d_both: "session_repo is the concern that both reads (get_session) and writes (save_session). SOLID-SRP violation: a single object performing both read and write IO in the same request cycle, with the orchestrator manually coordinating the timing.",

  q7_scenario: "Synchronous Redis (CONC-3) blocking the asyncio event loop — every redis.StrictRedis call in every handler blocks all concurrent requests.",
  q7_impact: "All customers are affected simultaneously. When any single customer's request triggers a Redis call, every other customer's coroutine is blocked until that call completes. Under load spikes or combined with .keys() scans, the entire service queues. Customers experience delayed or timed-out responses.",
  q7_detection: "No detection signal exists in current logging. print() and ic() do not capture request latency, queue depth, or event loop blocking time. A customer experiencing 5s delays would be invisible in logs.",
  q7_fix: "CONC-3 — replace redis.StrictRedis with redis.asyncio.Redis across all three files. The structural fix is SOLID-DIP: inject a single async Redis client through a Protocol interface so all three modules share one connection pool.",
  q7_defend: "The previous refactor reorganised the code into clean modules but did not change the Redis client from synchronous to asynchronous. Structural correctness (SOLID-SRP) does not resolve a concurrency pathology (CONC-3). You can have perfectly separated concerns that all independently block the event loop. The fix requires changing the runtime behaviour (sync → async), not the code organisation.",

  q7d_redis: "No — the second request did not receive a response before pressing F9. This proves that the synchronous Redis call blocks the entire asyncio event loop. While one coroutine is waiting for Redis, no other coroutine can run.",
  q7d_error: "After the simulated error, Redis contains the session with fsm_state.state set to the tuple-serialised value of State.ERROR. The customer's next message triggers from_dict() which reads the corrupted state value and raises ValueError. The customer is permanently stuck.",
  q7d_idempotent: "Yes — current_reference_id changes on the second call because generate_departmental_reference_id() is called again. This confirms the system has no idempotency check — it does not inspect MessageSid to detect Twilio retries.",
};

// ═══════════════════════════════════════════════════════════════════
// EXAMINER + TTS
// ═══════════════════════════════════════════════════════════════════

async function assessAnswer(question, devAnswer, modelAnswer) {
  const response = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer: devAnswer, model_answer: modelAnswer }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "API error" }));
    throw new Error(err.detail || "Assessment failed");
  }
  return response.json();
}

async function speakText(text) {
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92; u.pitch = 0.85; u.lang = "en-GB";
        window.speechSynthesis.speak(u);
      }
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
  } catch (e) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92; u.pitch = 0.85; u.lang = "en-GB";
      window.speechSynthesis.speak(u);
    }
  }
}

const CONCEPTS = {
  cat_classification:       { label: "CAT-x Classification",      color: T.slate },
  factory_vs_computation:   { label: "Factory vs Computation",    color: T.sage },
  a1_idempotence:           { label: "A.1 Idempotence",           color: T.slate },
  edge_case_reasoning:      { label: "Edge Case Reasoning",       color: T.ochre },
  parametrize_strategy:     { label: "Parametrize Strategy",      color: T.sage },
  characterization_testing: { label: "TST-5 Characterization",    color: T.plum },
  mutation_testing_b14:     { label: "B.1.4 Mutation",            color: T.plum },
  postcondition_reasoning:  { label: "Postcondition Reasoning",   color: T.teal },
  invariant_preservation:   { label: "Invariant Preservation",    color: T.acc_border },
  validation_testing_a2:    { label: "A.2 Validation",            color: T.ochre },
  round_trip_testing:       { label: "Round-Trip Testing",        color: T.clay },
  fixture_strategy:         { label: "Fixture Strategy",          color: T.sage },
  orchestration_testing:    { label: "B.1.9 Orchestration",       color: T.teal },
  behavioural_assertion:    { label: "Behavioural Assertion",     color: T.slate },
  mock_verification:        { label: "Mock Verification",         color: T.clay },
  seed_reasoning:           { label: "Seed Reasoning",            color: T.sage },
  test_level_separation:    { label: "Test Level Separation",     color: T.ochre },
  absence_assertion:        { label: "Absence Assertion",         color: T.teal },
  test_limitation:          { label: "Test Limitation Awareness", color: T.acc_border },
  idempotency:              { label: "Idempotency",               color: T.clay },
};

const EXAM = {
  l1_generate_departmental_reference_id: {
    q: "This is classified as CAT-4 Factory, not CAT-8 Computation. What makes it non-deterministic, and how does your uniqueness test prove that?",
    a: "CAT-4 Factory creates and returns a new object each time. It is non-deterministic because it uses secrets or random to generate the hex suffix — same input produces different output. The uniqueness test calls the function twice with identical input and asserts the results differ, which would fail on a deterministic CAT-8 function.",
    concepts: ["cat_classification", "factory_vs_computation"],
  },
  l1_map_country_code_to_currency: {
    q: "Your test calls the function twice with the same input and asserts both results are equal. What does this idempotence check prove, and what would its failure tell you?",
    a: "The A.1 idempotence check proves the function is a pure query with no hidden state mutation between calls. If it failed, the function has a side effect: modifying global state, caching with mutation, or reading from an external source that changes. For a CAT-1 Query, idempotence failure means the classification is wrong.",
    concepts: ["a1_idempotence", "cat_classification"],
  },
  l1_extract_part_qty_pairs: {
    q: "Your test case data includes both '3 x 452-0427' and '452-0427 2'. Why do you need both directions?",
    a: "The function uses regex to extract quantity-part pairs. The two patterns test different match groups: qty-before-part and part-before-qty. If only one direction were tested, a regex that only matches QTY PART order would pass, but customers type parts both ways.",
    concepts: ["edge_case_reasoning", "parametrize_strategy"],
  },
  l1_extract_department_transfer: {
    q: "Your None cases test both 'no transfer intent here' and 'hello'. Why do you need both?",
    a: "'no transfer intent here' contains words like 'transfer' that could trigger a false positive in a naive substring match. 'hello' has no overlapping words at all. Testing both distinguishes between correctly ignoring partial keyword matches and returning None for completely unrelated input.",
    concepts: ["edge_case_reasoning"],
  },
  l1_is_button_press: {
    q: "Your case sensitivity edge says 'characterize'. Why can you not decide the expected value in advance?",
    a: "We do not know whether the function does case-insensitive matching until we observe it in the debugger. A characterization test documents current behaviour. We assert what it actually does, not what we think it should do. This test will break if someone changes the behaviour, which is exactly the safety net needed before refactoring.",
    concepts: ["characterization_testing"],
  },
  l1_normalize_whitespace: {
    q: "Your test case data includes None as an input. What does the current code actually do with None, and what regression does your test catch?",
    a: "normalize_whitespace uses re.sub with 'text or empty string'. None is falsy, so it falls through to empty string, and strip returns empty string. If someone removes the 'or empty string' guard during refactoring, re.sub raises TypeError on None, and this test catches the regression.",
    concepts: ["edge_case_reasoning", "characterization_testing"],
  },
  l2_0: {
    q: "Your test asserts history length increased by 1. Why is the history assertion necessary — what bug would it catch that the state assertion alone would miss?",
    a: "A broken implementation could update self.state directly without appending to self.history. The state assertion would pass but the audit trail would be missing. The history assertion catches implementations that mutate state without recording the transition.",
    concepts: ["mutation_testing_b14", "postcondition_reasoning"],
  },
  l2_1: { q: "Same B.1.4 pattern — skip to the next unique test.", a: "Same as above.", concepts: ["mutation_testing_b14"] },
  l2_2: { q: "Same B.1.4 pattern — skip to the next unique test.", a: "Same as above.", concepts: ["mutation_testing_b14"] },
  l2_3: {
    q: "Your test checks history[-1] from_state and to_state values. Why assert the history entry content, not just the history length?",
    a: "Length only proves an entry was added. Content proves the correct entry was added. A bug that always appends a hardcoded from/to pair would pass a length check but fail a content check.",
    concepts: ["mutation_testing_b14", "postcondition_reasoning"],
  },
  l2_4: {
    q: "After the ValueError, your test asserts fsm.state is still MAIN_MENU. Why is this state-unchanged assertion necessary?",
    a: "Without it, a broken implementation could mutate state first, then check validity, then raise. The exception fires but the FSM is now in an illegal state. The unchanged assertion proves the implementation checks validity before mutating.",
    concepts: ["invariant_preservation", "validation_testing_a2"],
  },
  l2_5: {
    q: "This is a TST-5 characterization test that MUST PASS. What happens when someone removes the trailing comma and reruns your test?",
    a: "Removing the comma changes ERROR = ('Error',) to ERROR = 'Error'. Now State.ERROR.value is the string 'Error', not a tuple. The test asserts isinstance tuple — this fails. The test goes RED. That is exactly the point: the characterization test documents current broken behaviour so the fix is measurable.",
    concepts: ["characterization_testing"],
  },
  l2_6: {
    q: "Your round-trip test transitions the FSM twice before serializing. Why not test with a fresh FSM?",
    a: "A fresh FSM has default values for everything. The round-trip would pass even if from_dict ignored every field. By applying transitions first, the FSM has non-default state, non-empty history, and populated context. If from_dict drops any of these, the equality assertions fail.",
    concepts: ["round_trip_testing", "fixture_strategy"],
  },
  l2_7: {
    q: "Your test case data has two crash variants: state as string 'Error' and state as list ['Error']. Why test both?",
    a: "The tuple ('Error',) takes different forms depending on serialization. In Python, to_dict returns the tuple directly. JSON serialization converts tuples to arrays: json.dumps produces ['Error']. Redis stores JSON, so from_dict reads ['Error'] not ('Error',). Both crash, but for different reasons.",
    concepts: ["edge_case_reasoning", "characterization_testing"],
  },
  l2_8: {
    q: "This test asserts state after every intermediate step, not just the final state. Why?",
    a: "Asserting only the final state would pass if the FSM jumped directly from MAIN_MENU to AI_PROCESSING_DONE, skipping required intermediates. Step-by-step assertions prove the exact sequence.",
    concepts: ["orchestration_testing", "postcondition_reasoning"],
  },
  l3_0: {
    q: "Your test asserts mock_twilio[0].to equals TEST_NUMBER. Why verify the target, not just that Twilio was called?",
    a: "A bug could send the menu to the wrong customer. Verifying length proves Twilio was called. Verifying the to field proves it was called with the correct recipient. In a concurrent system, sending the menu to the wrong number means one customer gets two menus and another gets none.",
    concepts: ["behavioural_assertion", "mock_verification"],
  },
  l3_1: {
    q: "Your seed puts the session at Main Menu. What happens if you forget to seed and the test still passes?",
    a: "If it passes without seeding, the webhook creates a new session on every call. The test is accidentally testing the new-customer scenario, not the button-from-existing-session scenario. The seed is what makes this a different test from scenario 1.",
    concepts: ["fixture_strategy", "seed_reasoning"],
  },
  l3_2: {
    q: "You assert current_reference_id startswith sal_. Why not assert the exact ID value?",
    a: "The reference ID contains a random hex suffix from a CAT-4 non-deterministic factory. Asserting an exact value would make the test brittle. startswith sal_ proves the prefix contract without coupling to the random component.",
    concepts: ["behavioural_assertion", "factory_vs_computation"],
  },
  l3_3: {
    q: "Your test uses mock_claude but only asserts len mock_twilio >= 1. What are you NOT testing, and why is that acceptable at L3?",
    a: "You are not testing that Claude received the correct prompt, that the AI response was parsed correctly, or that parts were extracted. Those are L1 concerns and L2 concerns. L3 tests the orchestration: does the full pipeline produce a Twilio message?",
    concepts: ["test_level_separation", "orchestration_testing"],
  },
  l3_4: {
    q: "Your test asserts state is unchanged. Why is the absence of a state change the assertion?",
    a: "The system does not send an error for unknown input — it re-sends the menu or ignores it. Asserting state unchanged is an absence assertion: the system did NOT crash, did NOT transition to an invalid state, did NOT corrupt the session.",
    concepts: ["absence_assertion", "behavioural_assertion"],
  },
  l3_5: {
    q: "Your test asserts the cooldown key exists in Redis. Why is the cooldown the thing to test, not the message content?",
    a: "The message content is handled by format_all_customer_messages — an L1 concern. At L3 we test the orchestration side effect: did the webhook set the rate-limit key? Testing the cooldown key proves the webhook rate-limiting behaviour.",
    concepts: ["test_level_separation", "behavioural_assertion"],
  },
  l3_6: {
    q: "Your test monkeypatches Claude to raise and asserts state is not AI Processing. What does this NOT prove about error recovery?",
    a: "It proves the FSM is not stuck, but not that the customer received an error message, that the session is usable for the next message, or that the error was logged. A test asserting state != AI Processing would pass if the error handler transitioned to State.ERROR — which due to the tuple bug permanently locks the customer.",
    concepts: ["absence_assertion", "test_limitation"],
  },
  l3_7: {
    q: "This is a TST-5 characterization marked as BUG. What would an idempotent system do differently?",
    a: "An idempotent system would check the MessageSid against a dedup store before processing. The second POST with the same MessageSid would return 200 but skip all side effects. The test would change from asserting ref_1 != ref_2 (documenting the bug) to asserting ref_1 == ref_2 (documenting correct behaviour).",
    concepts: ["characterization_testing", "idempotency"],
  },
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const lockedStyle = { opacity: 0.06, pointerEvents: "none", maxHeight: 120, overflow: "hidden" };
function isSectionUnlocked(_sid, _checks) { return true; }

function LockBanner({ prev }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: T.surface_1, borderRadius: 6, border: `1px solid ${T.border_soft}`, margin: "0 0 20px" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: T.ink_ghost, marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>· Locked ·</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_3, letterSpacing: "0.04em" }}>Defend your answer in <span style={{ color: T.acc_ink, fontWeight: 600 }}>{prev}</span> to unlock</div>
    </div>
  );
}

function CatBadge({ cat }) {
  const def = CAT_DEFS[cat];
  if (!def) return <span style={{ color: T.ink_2, fontFamily: FONT_MONO, fontSize: 11 }}>{cat}</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: def.fill, border: `1px solid ${def.color}55`, borderRadius: 3, padding: "2px 8px", fontFamily: FONT_MONO, fontSize: 10.5, color: def.color, fontWeight: 700, letterSpacing: "0.04em" }}>
      {cat} <span style={{ color: def.color, fontWeight: 500, opacity: 0.85 }}>{def.label}</span>
    </span>
  );
}

function SolidBadge({ label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.acc_fill, border: `1px solid ${T.acc_border}`, borderRadius: 3, padding: "2px 8px", fontFamily: FONT_MONO, fontSize: 10.5, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.04em" }}>
      {label}
    </span>
  );
}

function TemplateBadge({ tmpl }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.sage_fill, border: `1px solid ${T.sage}66`, borderRadius: 3, padding: "2px 8px", fontFamily: FONT_MONO, fontSize: 10.5, color: T.sage, fontWeight: 700, letterSpacing: "0.04em" }}>
      {tmpl}
    </span>
  );
}

function CodeBlock({ code, lang = "bash", title }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div style={{ background: T.surface_1, borderRadius: 6, border: `1px solid ${T.border_soft}`, overflow: "hidden", margin: "12px 0" }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 14px", background: T.surface_2, borderBottom: `1px solid ${T.border_soft}` }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, letterSpacing: "0.03em" }}>{title}</span>
          <button onClick={copy} style={{ background: copied ? T.sage_fill : T.paper, border: `1px solid ${copied ? T.sage : T.border_med}`, borderRadius: 3, color: copied ? T.sage : T.ink_3, cursor: "pointer", fontSize: 10.5, fontFamily: FONT_MONO, padding: "2px 8px", fontWeight: 600, letterSpacing: "0.03em" }}>{copied ? "✓ copied" : "copy"}</button>
        </div>
      )}
      <pre style={{ margin: 0, padding: "14px", overflowX: "auto", fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.65, color: T.ink_1, tabSize: 2 }}>{code}</pre>
    </div>
  );
}

function AnswerField({ id, placeholder, checks, setChecks, multiline = false, question = "", modelAnswer: modelAnswerProp }) {
  const val = checks["answer_" + id] || "";
  const set = (v) => setChecks(p => ({ ...p, ["answer_" + id]: v }));
  const [showModel, setShowModel] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [probeSpeaking, setProbeSpeaking] = useState(false);
  const [probeRecording, setProbeRecording] = useState(false);
  const probeRecRef = useRef(null);
  const recRef = useRef(null);
  const modelAnswer = modelAnswerProp || M[id];
  const verdict = checks["verdict_" + id];
  const feedback = checks["feedback_" + id] || "";
  const probe = checks["probe_" + id] || "";
  const probeVal = checks["answer_probe_" + id] || "";
  const confirmed = verdict === "CONFIRMED";
  const partialCount = checks["partial_count_" + id] || 0;

  const sty = {
    width: "100%", background: confirmed ? T.sage_fill : T.paper,
    border: `1px solid ${confirmed ? T.sage : T.border_med}`,
    borderRadius: 4, color: T.ink_1, fontFamily: FONT_SANS, fontSize: 14,
    padding: "9px 12px", resize: "vertical", outline: "none",
    boxSizing: "border-box", minHeight: multiline ? 100 : undefined, lineHeight: 1.6,
  };

  const hasSR = typeof window !== "undefined" && navigator.mediaDevices;
  const toggleVoice = async () => {
    if (recording) {
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();
        recRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setRecording(false); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "answer.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.transcript) set(val ? val + " " + data.transcript : data.transcript);
          }
        } catch (e) {}
      };
      mr.start(); recRef.current = mr; setRecording(true);
    } catch (e) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true; rec.interimResults = false; rec.lang = "en-GB";
        rec.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " ";
          if (t.trim()) set(val ? val + " " + t.trim() : t.trim());
        };
        rec.onerror = () => setRecording(false);
        rec.onend = () => setRecording(false);
        rec.start(); recRef.current = rec; setRecording(true);
      }
    }
  };

  const defend = async (ans, q, isProbe = false) => {
    if (!ans?.trim() || !modelAnswer) return;
    setAssessing(true);
    try {
      const assessQuestion = q || question || placeholder || id;
      const trimmedAns = ans.length > 3000 ? ans.slice(0, 3000) + "..." : ans;
      const assessReference = isProbe
        ? `The candidate was asked this follow-up probe after a PARTIAL on the original question.\n\nORIGINAL QUESTION:\n${question || placeholder || id}\n\nMODEL ANSWER:\n${modelAnswer}\n\nPROBE QUESTION:\n${q}\n\nJudge whether the candidate's probe answer demonstrates understanding of the concept in the model answer.`
        : modelAnswer;

      const r = await assessAnswer(assessQuestion, trimmedAns, assessReference);
      const partialKey = "partial_count_" + id;
      const currentCount = checks[partialKey] || 0;

      if (isProbe) {
        if (r.verdict === "CONFIRMED") {
          setChecks(p => ({ ...p, ["verdict_" + id]: "CONFIRMED", ["feedback_" + id]: r.feedback || "" }));
        } else {
          const newProbe = r.probe || null;
          setChecks(p => ({ ...p,
            ["probe_feedback_" + id]: r.feedback || "Try to be more specific about the underlying concept.",
            ["probe_" + id]: newProbe || p["probe_" + id] || probe,
            [partialKey]: (p[partialKey] || 0) + 1,
            ...(newProbe ? { ["answer_probe_" + id]: "" } : {}),
          }));
        }
      } else {
        if (r.verdict === "NOT_MET" && currentCount < 10) {
          setChecks(p => ({ ...p, ["verdict_" + id]: "PARTIAL", ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "", ["probe_feedback_" + id]: "", ["answer_probe_" + id]: "", [partialKey]: currentCount + 1 }));
        } else if (r.verdict === "PARTIAL") {
          setChecks(p => ({ ...p, ["verdict_" + id]: r.verdict, ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "", ["probe_feedback_" + id]: "", ["answer_probe_" + id]: "", [partialKey]: currentCount + 1 }));
        } else {
          setChecks(p => ({ ...p, ["verdict_" + id]: r.verdict, ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "" }));
        }
      }
    } catch (e) {
      if (isProbe) setChecks(p => ({ ...p, ["probe_feedback_" + id]: "Error: " + e.message }));
      else setChecks(p => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
    }
    setAssessing(false);
  };

  const speakProbe = async () => {
    if (probeSpeaking) { setProbeSpeaking(false); return; }
    setProbeSpeaking(true);
    await speakText(probe);
    setProbeSpeaking(false);
  };

  const toggleProbeVoice = async () => {
    if (probeRecording) {
      if (probeRecRef.current && probeRecRef.current.state !== "inactive") {
        probeRecRef.current.stop();
        probeRecRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setProbeRecording(false); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "answer.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.transcript) setChecks(p => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + data.transcript }));
          }
        } catch (e) {}
      };
      mr.start(); probeRecRef.current = mr; setProbeRecording(true);
    } catch (e) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true; rec.interimResults = false; rec.lang = "en-GB";
        rec.onresult = (ev) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript + " ";
          if (t.trim()) setChecks(p => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + t.trim() }));
        };
        rec.onerror = () => setProbeRecording(false);
        rec.onend = () => setProbeRecording(false);
        rec.start(); probeRecRef.current = rec; setProbeRecording(true);
      }
    }
  };

  const vc = { CONFIRMED: T.sage, PARTIAL: T.ochre, NOT_MET: T.acc_border, ERROR: T.acc_border };
  const vf = { CONFIRMED: T.sage_fill, PARTIAL: T.ochre_fill, NOT_MET: T.acc_fill, ERROR: T.acc_fill };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {multiline
            ? <textarea value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} rows={4} readOnly={confirmed} />
            : <input value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} readOnly={confirmed} />
          }
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
          {hasSR && !confirmed && (
            <button onClick={toggleVoice} style={{ background: recording ? T.acc_fill : T.paper, border: `1px solid ${recording ? T.acc_border : T.border_med}`, borderRadius: 3, color: recording ? T.acc_border : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{recording ? "■ STOP" : "● REC"}</button>
          )}
          {modelAnswer && !confirmed && (
            <button onClick={() => defend(val)} disabled={assessing || !val.trim()} style={{ background: assessing ? T.surface_1 : T.acc_fill, border: `1px solid ${T.acc_border}`, borderRadius: 3, color: T.acc_ink, cursor: assessing || !val.trim() ? "default" : "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, letterSpacing: "0.06em", opacity: !val.trim() ? 0.45 : 1, whiteSpace: "nowrap", textTransform: "uppercase" }}>{assessing ? "..." : "Defend"}</button>
          )}
          {confirmed && <span style={{ color: T.sage, fontSize: 16, textAlign: "center" }}>✓</span>}
        </div>
      </div>

      {verdict && verdict !== "ERROR" && (
        <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 4, background: vf[verdict], border: `1px solid ${vc[verdict]}55`, borderLeft: `3px solid ${vc[verdict]}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{verdict.toLowerCase().replace("_", " ")}</span>
            {confirmed && <span style={{ color: T.sage, fontSize: 12 }}>✓</span>}
            {verdict === "PARTIAL" && (
              <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3, marginLeft: "auto" }}>attempt {partialCount}/10</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.ink_2, lineHeight: 1.65, marginTop: 4 }}>{feedback}</div>
        </div>
      )}
      {verdict === "ERROR" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 4, background: T.acc_fill, border: `1px solid ${T.acc_border}55`, fontSize: 12.5, color: T.acc_ink }}>{feedback}</div>}

      {verdict === "PARTIAL" && probe && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 4, background: T.ochre_fill, border: `1px solid ${T.ochre}33`, borderLeft: `3px solid ${T.ochre}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ochre, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Follow-up</span>
            <button onClick={speakProbe} style={{ background: probeSpeaking ? T.ochre_fill : T.paper, border: `1px solid ${probeSpeaking ? T.ochre : T.border_med}`, borderRadius: 3, color: probeSpeaking ? T.ochre : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "3px 7px", fontFamily: FONT_MONO, fontWeight: 600, whiteSpace: "nowrap", marginLeft: "auto" }}>{probeSpeaking ? "■" : "▶"}</button>
          </div>
          <div style={{ fontSize: 14, color: T.ink_1, lineHeight: 1.65, marginBottom: 10, fontFamily: FONT_SERIF, fontStyle: "italic" }}>"{probe}"</div>
          {checks["probe_feedback_" + id] && (
            <div style={{ fontSize: 12.5, color: T.ink_2, lineHeight: 1.55, marginBottom: 10, padding: "6px 10px", background: T.paper, border: `1px solid ${T.ochre}33`, borderRadius: 3 }}>{checks["probe_feedback_" + id]}</div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks(p => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hasSR && (
                <button onClick={toggleProbeVoice} style={{ background: probeRecording ? T.acc_fill : T.paper, border: `1px solid ${probeRecording ? T.acc_border : T.border_med}`, borderRadius: 3, color: probeRecording ? T.acc_border : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{probeRecording ? "■ STOP" : "● REC"}</button>
              )}
              <button onClick={() => defend(probeVal, probe, true)} disabled={assessing || !probeVal.trim()} style={{ background: T.ochre_fill, border: `1px solid ${T.ochre}`, borderRadius: 3, color: T.ochre, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, opacity: !probeVal.trim() ? 0.45 : 1, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em" }}>{assessing ? "..." : "Defend"}</button>
            </div>
          </div>
        </div>
      )}

      {modelAnswer && (
        <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowModel(!showModel)} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: showModel ? T.teal : T.ink_3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{showModel ? "Hide" : "Reveal"} model answer</span>
            <span style={{ color: showModel ? T.teal : T.ink_3, fontSize: 10, transform: showModel ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>{showModel ? "▾" : "▸"}</span>
          </button>
          {showModel && (
            <div style={{ background: T.teal_fill, border: `1px solid ${T.teal}33`, borderLeft: `3px solid ${T.teal}`, borderRadius: "0 4px 4px 0", padding: "10px 14px", marginTop: 4 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.teal, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Model answer</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 13.5, color: T.ink_1, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
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
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "5px 0", userSelect: "none" }}>
      <div onClick={() => setChecks(p => ({ ...p, [id]: !p[id] }))} style={{ width: 17, height: 17, minWidth: 17, borderRadius: 3, marginTop: 2, border: checked ? `2px solid ${T.sage}` : `2px solid ${T.border_med}`, background: checked ? T.sage_fill : T.paper, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", cursor: "pointer" }}>
        {checked && <span style={{ color: T.sage, fontSize: 11, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ color: checked ? T.ink_3 : T.ink_2, fontSize: 14, lineHeight: 1.55, transition: "color 0.15s", textDecoration: checked ? "line-through" : "none", textDecorationColor: T.ink_ghost }}>{label}</span>
    </label>
  );
}

function Collapsible({ title, children, defaultOpen = false, accent = T.acc_border, icon }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${open ? accent + "55" : T.border_soft}`, borderRadius: 6, overflow: "hidden", margin: "10px 0", background: T.paper, transition: "border-color 0.2s" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: T.surface_1, border: "none", padding: "11px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "background 0.2s" }}>
        <span style={{ color: accent, fontSize: 11, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
        {icon && <span style={{ fontSize: 13, color: accent }}>{icon}</span>}
        <span style={{ color: T.ink_1, fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, flex: 1, letterSpacing: "0.01em" }}>{title}</span>
      </button>
      {open && <div style={{ padding: "16px", borderTop: `1px solid ${T.border_soft}`, background: T.paper }}>{children}</div>}
    </div>
  );
}

function InterviewDialog({ question, hint, context }) {
  const [speaking, setSpeaking] = useState(false);
  const speak = async () => {
    if (speaking) { setSpeaking(false); return; }
    setSpeaking(true); await speakText(question); setSpeaking(false);
  };
  return (
    <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderLeft: `3px solid ${T.acc_border}`, borderRadius: "0 6px 6px 0", padding: "16px 20px", margin: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ background: T.acc_fill, color: T.acc_ink, border: `1px solid ${T.acc_border}`, padding: "2px 9px", borderRadius: 3, fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Interview</span>
        <button onClick={speak} style={{ background: speaking ? T.acc_fill : T.paper, border: `1px solid ${speaking ? T.acc_border : T.border_med}`, borderRadius: 3, color: speaking ? T.acc_border : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "3px 7px", fontFamily: FONT_MONO, fontWeight: 600, whiteSpace: "nowrap", marginLeft: "auto" }}>{speaking ? "■" : "▶"}</button>
      </div>
      <p style={{ color: T.ink_1, fontSize: 16, lineHeight: 1.6, margin: 0, fontFamily: FONT_SERIF, fontStyle: "italic" }}>"{question}"</p>
      {context && <p style={{ color: T.ink_3, fontSize: 13, lineHeight: 1.6, marginTop: 10, marginBottom: 0, fontFamily: FONT_SERIF }}>{context}</p>}
      {hint && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: T.ochre_fill, borderRadius: 4, borderLeft: `3px solid ${T.ochre}` }}>
          <span style={{ color: T.ochre, fontSize: 10, fontFamily: FONT_MONO, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Hint  </span>
          <span style={{ color: T.ink_2, fontSize: 13 }}>{hint}</span>
        </div>
      )}
    </div>
  );
}

function DebuggerExercise({ title, children }) {
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.ochre}55`, borderRadius: 6, margin: "16px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: T.ochre_fill, borderBottom: `1px solid ${T.ochre}33` }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.paper, background: T.ochre, padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.06em" }}>DBG</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: T.ochre, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Debugger Exercise</span>
        <span style={{ color: T.ink_3, fontSize: 13, fontFamily: FONT_SERIF, fontStyle: "italic" }}>— {title}</span>
      </div>
      <div style={{ padding: "16px" }}>{children}</div>
    </div>
  );
}

function StackTrace({ frames }) {
  return (
    <div style={{ background: T.surface_1, borderRadius: 4, border: `1px solid ${T.border_soft}`, overflow: "hidden", margin: "12px 0" }}>
      <div style={{ padding: "6px 12px", background: T.surface_2, borderBottom: `1px solid ${T.border_soft}`, fontFamily: FONT_MONO, fontSize: 10, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Stack trace</div>
      {frames.map((f, i) => (
        <div key={i} style={{ padding: "6px 12px", borderBottom: i < frames.length - 1 ? `1px solid ${T.border_soft}` : "none", fontFamily: FONT_MONO, fontSize: 11.5, lineHeight: 1.5, display: "flex", gap: 8 }}>
          <span style={{ color: T.ink_3, minWidth: 20, fontWeight: 600 }}>{i}</span>
          <span style={{ color: T.slate, fontWeight: 600 }}>{f.file}</span>
          <span style={{ color: T.ink_3 }}>:</span>
          <span style={{ color: T.clay, fontWeight: 600 }}>{f.line}</span>
          <span style={{ color: T.ink_3, fontStyle: "italic" }}>in</span>
          <span style={{ color: T.ink_1, fontWeight: 600 }}>{f.fn}</span>
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
        <circle cx="18" cy="18" r={r} fill="none" stroke={T.border_soft} strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={T.acc_border} strokeWidth="3" strokeDasharray={c} strokeDashoffset={c - (c * pct / 100)} strokeLinecap="round" transform="rotate(-90 18 18)" style={{ transition: "stroke-dashoffset 0.5s" }} />
      </svg>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: pct === 100 ? T.acc_border : T.ink_3, fontWeight: 600 }}>{done}/{total}</span>
    </div>
  );
}

function ConceptPills({ concepts }) {
  if (!concepts || concepts.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
      {concepts.map(cid => {
        const c = CONCEPTS[cid]; if (!c) return null;
        return (
          <span key={cid} style={{ background: T.surface_1, border: `1px solid ${c.color}44`, borderRadius: 3, padding: "1px 7px", fontSize: 9.5, fontFamily: FONT_MONO, color: c.color, fontWeight: 600, letterSpacing: "0.04em" }}>{c.label}</span>
        );
      })}
    </div>
  );
}

function ExamSection({ examKey, checks, setChecks }) {
  const exam = EXAM[examKey];
  if (!exam) return null;
  const [speaking, setSpeaking] = useState(false);
  const speak = async () => {
    if (speaking) { setSpeaking(false); return; }
    setSpeaking(true); await speakText(exam.q); setSpeaking(false);
  };
  return (
    <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 4, background: T.surface_1, border: `1px solid ${T.border_soft}`, borderLeft: `3px solid ${T.plum}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.plum, fontWeight: 700, letterSpacing: "0.08em", background: T.plum_fill, padding: "2px 7px", borderRadius: 3, whiteSpace: "nowrap", marginTop: 2, textTransform: "uppercase", border: `1px solid ${T.plum}44` }}>Examine</span>
        <div style={{ flex: 1, fontSize: 14, color: T.ink_1, lineHeight: 1.65, fontFamily: FONT_SERIF, fontStyle: "italic" }}>"{exam.q}"</div>
        <button onClick={speak} style={{ background: speaking ? T.plum_fill : T.paper, border: `1px solid ${speaking ? T.plum : T.border_med}`, borderRadius: 3, color: speaking ? T.plum : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "4px 7px", fontFamily: FONT_MONO, fontWeight: 600, whiteSpace: "nowrap" }}>{speaking ? "■" : "▶"}</button>
      </div>
      <AnswerField id={"exam_" + examKey} placeholder="Explain your reasoning..." checks={checks} setChecks={setChecks} multiline question={exam.q} modelAnswer={exam.a} />
      <ConceptPills concepts={exam.concepts} />
    </div>
  );
}

function TestCaseData({ cases, title }) {
  if (!cases || cases.length === 0) return null;
  const keys = Object.keys(cases[0]);
  return (
    <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderLeft: `3px solid ${T.sage}`, borderRadius: "0 4px 4px 0", padding: "10px 14px", marginTop: 12 }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.sage, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>Test case data{title ? ` — ${title}` : ""}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: FONT_MONO }}>
        <thead><tr style={{ borderBottom: `1px solid ${T.sage}44` }}>
          {keys.map(k => <th key={k} style={{ padding: "5px 8px", textAlign: "left", color: T.sage, fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</th>)}
        </tr></thead>
        <tbody>{cases.map((c, i) => (
          <tr key={i} style={{ borderBottom: i < cases.length - 1 ? `1px solid ${T.border_soft}` : "none" }}>
            {keys.map(k => <td key={k} style={{ padding: "5px 8px", color: T.ink_2, lineHeight: 1.5, verticalAlign: "top" }}>{c[k]}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

export default function Module01() {
  const [activeSection, setActiveSection] = useState("orientation");
  const STORAGE_KEY = "module01_checks";

  const [checks, setChecks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localStorage.setItem(STORAGE_KEY + "_corrupt_" + Date.now(), raw);
      } catch {}
      return {};
    }
  });
  const sectionRefs = useRef({});
  const mainRef = useRef(null);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checks)); }
    catch (e) { console.error("Save failed:", e); }
  }, [checks]);

  const resetProgress = () => {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    setChecks({}); localStorage.removeItem(STORAGE_KEY);
  };

  const checkCount = useMemo(() => {
    const ckeys = Object.keys(checks).filter(k => !k.startsWith("answer_"));
    const d = ckeys.filter(k => checks[k] === true).length;
    return { total: 42, done: d };
  }, [checks]);

  const scrollTo = useCallback((id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setActiveSection(e.target.dataset.section); break; }
        }
      },
      { root: mainRef.current, rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const regRef = (id) => (el) => {
    if (el) { el.dataset.section = id; sectionRefs.current[id] = el; }
  };

  const P = ({ children, style: s }) => (
    <p style={{ color: T.ink_2, fontSize: 15, lineHeight: 1.7, margin: "10px 0", fontFamily: FONT_SERIF, ...s }}>{children}</p>
  );

  const H2 = ({ children, id }) => (
    <h2 id={id} style={{ fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700, color: T.ink_1, margin: "36px 0 16px", letterSpacing: "-0.015em", borderBottom: `1px solid ${T.border_soft}`, paddingBottom: 10 }}>{children}</h2>
  );

  const H3 = ({ children }) => (
    <h3 style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 700, color: T.ink_1, margin: "24px 0 10px", letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</h3>
  );

  const Inline = ({ children, color = T.acc_ink, bg = T.acc_fill }) => (
    <code style={{ color, background: bg, padding: "1px 6px", borderRadius: 3, fontFamily: FONT_MONO, fontSize: 13 }}>{children}</code>
  );

  const HeadingCode = ({ children }) => (
    <code style={{ color: T.acc_ink, background: T.acc_fill, padding: "2px 8px", borderRadius: 3, fontSize: 21, fontFamily: FONT_MONO, fontWeight: 600 }}>{children}</code>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: T.paper, fontFamily: FONT_SANS, color: T.ink_2 }}>

      {/* ── SIDEBAR ── */}
      <nav style={{ width: 240, minWidth: 240, background: T.surface_1, borderRight: `1px solid ${T.border_soft}`, display: "flex", flexDirection: "column", overflowY: "auto", padding: "20px 0" }}>
        <div style={{ padding: "0 18px 18px", borderBottom: `1px solid ${T.border_soft}` }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 700, color: T.ink_1, letterSpacing: "-0.015em" }}>Module 01</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, marginTop: 3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Webhook Monster</div>
          <div style={{ marginTop: 14 }}><ProgressRing total={checkCount.total} done={checkCount.done} /></div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.ink_3, letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>Concepts</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {Object.entries(CONCEPTS).map(([cid, c]) => {
                const cConfirmed = Object.keys(checks).some(k =>
                  k.startsWith("verdict_exam_") && checks[k] === "CONFIRMED" &&
                  EXAM[k.replace("verdict_exam_", "")]?.concepts?.includes(cid)
                );
                return (
                  <div key={cid} style={{ width: 8, height: 8, borderRadius: 2, background: cConfirmed ? c.color : T.surface_2, border: `1px solid ${cConfirmed ? c.color : T.border_med}`, transition: "all 0.3s" }} title={c.label + (cConfirmed ? " ✓" : "")} />
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 0", flex: 1 }}>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => scrollTo(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 18px", background: activeSection === s.id ? T.surface_2 : "transparent", border: "none", borderLeft: activeSection === s.id ? `2px solid ${T.acc_border}` : "2px solid transparent", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: activeSection === s.id ? T.acc_border : T.ink_3, minWidth: 16 }}>{s.icon}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: activeSection === s.id ? T.ink_1 : T.ink_2, fontWeight: activeSection === s.id ? 600 : 400, letterSpacing: "0.01em" }}>{s.label}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.border_soft}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, marginBottom: 8, letterSpacing: "0.04em" }}>150 min budget</div>
          <button onClick={resetProgress}
            onMouseEnter={(e) => { e.currentTarget.style.color = T.acc_ink; e.currentTarget.style.borderColor = T.acc_border; e.currentTarget.style.background = T.acc_fill; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = T.ink_3; e.currentTarget.style.borderColor = T.border_med; e.currentTarget.style.background = T.paper; }}
            style={{ width: "100%", padding: "6px 0", background: T.paper, border: `1px solid ${T.border_med}`, borderRadius: 3, color: T.ink_3, cursor: "pointer", fontSize: 10, fontFamily: FONT_MONO, fontWeight: 600, letterSpacing: "0.08em", transition: "all 0.15s", textTransform: "uppercase" }}>Reset progress</button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "40px 56px 120px", color: T.ink_2 }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* ═══ ORIENTATION ═══ */}
        <div ref={regRef("orientation")}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 38, fontWeight: 700, color: T.ink_1, letterSpacing: "-0.02em", lineHeight: 1.15 }}>The WhatsApp Webhook Monster</div>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 14, fontStyle: "italic", color: T.ink_3, marginTop: 8, letterSpacing: "0.01em" }}>Discovery, debugging &amp; characterization testing worksheet</div>

          <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderLeft: `3px solid ${T.acc_border}`, borderRadius: "0 6px 6px 0", padding: "16px 20px", marginTop: 24 }}>
            <P style={{ color: T.acc_ink, fontWeight: 700, fontSize: 11, margin: "0 0 8px", fontFamily: FONT_MONO, letterSpacing: "0.1em", textTransform: "uppercase" }}>Why this exists</P>
            <P style={{ margin: 0 }}>
              The WhatsAppFSMProject refactor proved that <strong style={{ color: T.ink_1 }}>structural correctness ≠ performance</strong>. That version compiled cleanly, passed its tests, and ran identically to the monolith — because the tests measured wiring (method signatures, call counts, argument shapes), not behaviour. When the structure changed, the tests broke.
            </P>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 20 }}>
            {[
              { n: "1", t: "Defend every classification", d: "Name CAT-x, name the SOLID violation, state what the test proves" },
              { n: "2", t: "Debugger is primary", d: "Most exercises cannot be completed by reading code — observe live state" },
              { n: "3", t: "Behavioural ≠ structural", d: "Behavioural tests survive restructuring. Structural tests break when wiring moves" },
            ].map(({ n, t, d }) => (
              <div key={n} style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 6, padding: "16px 18px" }}>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 32, fontWeight: 700, color: T.acc_border, lineHeight: 1, marginBottom: 6, opacity: 0.55 }}>{n}</div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 12, color: T.ink_1, fontWeight: 700, marginBottom: 5, letterSpacing: "0.02em", textTransform: "uppercase" }}>{t}</div>
                <div style={{ fontSize: 13, color: T.ink_2, lineHeight: 1.55, fontFamily: FONT_SERIF }}>{d}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "12px 18px", background: T.ochre_fill, border: `1px solid ${T.ochre}55`, borderRadius: 6, fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_1 }}>
            <span style={{ color: T.ochre, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 11, fontFamily: FONT_MONO, marginRight: 8 }}>Warning</span>
            The system is in production. Do not modify <Inline>app/main.py</Inline> until every test in Part 2 is green.
          </div>
        </div>

        {/* ═══ PRE-PROMPT CHECKLIST ═══ */}
        <div ref={regRef("pre-prompt")}>
          <H2>Pre-Prompt Checklist — DT-METHOD-1</H2>
          <P>Run this before writing any test scaffold. If you cannot answer all three, do not proceed.</P>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.slate, fontWeight: 700, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>1 · CAT-x category</div>
              {Object.entries(CAT_DEFS).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                  <CatBadge cat={k} />
                  <span style={{ fontSize: 11, color: T.ink_3, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{v.desc}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.acc_ink, fontWeight: 700, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>2 · OOP / SOLID label</div>
              {Object.entries(SOLID_DEFS).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <SolidBadge label={k} />
                  <span style={{ fontSize: 11, color: T.ink_3, marginLeft: 6, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: T.sage, fontWeight: 700, marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>3 · Test template</div>
              {Object.entries(TEMPLATES).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <TemplateBadge tmpl={k} />
                  <span style={{ fontSize: 11, color: T.ink_3, marginLeft: 6, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ SETUP ═══ */}
        <div ref={regRef("setup")}>
          <H2>Initial setup</H2>
          <P style={{ color: T.ink_3, fontStyle: "italic" }}>Run config already created — verify Redis and the pipeline.</P>
          <Checkbox id="setup_redis" label="redis-cli ping returns PONG" checks={checks} setChecks={setChecks} />
          <CodeBlock title="Step 1 — Verify Redis" code={`redis-cli ping\n# Expected: PONG\n# If not: redis-server --daemonize yes`} />
          <Checkbox id="setup_uvicorn" label="Uvicorn running confirmed in PyCharm console" checks={checks} setChecks={setChecks} />
          <H3>Step 3 — Verify the pipeline</H3>
          <CodeBlock title="Smoke test curl" code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=hello" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM_SETUP_001"`} />
          <CodeBlock title="Check Redis" code={`redis-cli get "whatsapp:+447700000000"`} />
          <Checkbox id="setup_curl" label="Setup curl returns HTTP 200; Redis key exists" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q1 ═══ */}
        <div ref={regRef("q1")}>
          <H2>Q1 — Classify <HeadingCode>whatsapp_webhook()</HeadingCode></H2>
          <InterviewDialog
            question="whatsapp_webhook() is decorated with @app.post('/webhook'). What is its CAT-x category? Name every distinct operation before answering."
            context="A function that coordinates session retrieval, FSM dispatch, AI processing, and Twilio dispatch is a CAT-6. But a CAT-6 that also performs Redis reads/writes directly, constructs FSM state, and formats Twilio payloads is a SOLID-SRP violation."
            hint="Count every distinct operation. If it does more than one thing from different categories, name each one separately."
          />
          <CodeBlock title="grep the body first" code={`grep -n "session_repo\\|fsm\\|client\\.messages\\|process_with_ai\\|icecream\\|ic(" app/main.py | head -40`} />
          <H3>Name the six concerns</H3>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>Distinct operation {n}:</div>
              <AnswerField id={`q1_op${n}`} placeholder={`Concern ${n}...`} checks={checks} setChecks={setChecks} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.slate, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>CAT-x classification:</div>
              <AnswerField id="q1_cat" placeholder="CAT-?" checks={checks} setChecks={setChecks} />
            </div>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.acc_ink, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>SOLID label:</div>
              <AnswerField id="q1_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>One-sentence summary:</div>
            <AnswerField id="q1_summary" placeholder="What it does..." checks={checks} setChecks={setChecks} />
          </div>
          <DebuggerExercise title="Q1: Observe the six concerns live">
            <P>Set a breakpoint on the first line of <Inline>whatsapp_webhook</Inline>:</P>
            <CodeBlock code={`input_data = await get_webhook_input(request)`} lang="python" />
            <P>Send the setup curl. PyCharm halts. Step over (F8) through each distinct operation. <strong style={{ color: T.ochre, fontFamily: FONT_MONO, fontSize: 13 }}>Do not read ahead. Observe only the Variables panel.</strong></P>
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
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ochre, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>{q}</div>
                <AnswerField id={id} placeholder="Observed value..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
            <InterviewDialog question="A colleague says whatsapp_webhook() is CAT-3 (Command) because it sends a Twilio message. Explain in one sentence why they are wrong." hint="Use the CAT-6 definition: coordinates multiple CAT-x operations. CAT-3 is a single external IO operation." />
            <AnswerField id="q1d_defend" placeholder="They are wrong because..." checks={checks} setChecks={setChecks} multiline />
          </DebuggerExercise>
          <Checkbox id="q1_done" label="Q1 complete — six operations named, CAT-x and SOLID label written, debugger exercise done" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q2 ═══ */}
        <div ref={regRef("q2")}>
          <H2>Q2 — Synchronous Redis in async handler</H2>
          <InterviewDialog
            question="session_repo.get_session() is called inside an async def handler. Open redis_helper.py and find the Redis client it wraps. What happens to every other coroutine while this call runs?"
            context="Calling redis.StrictRedis inside async def blocks the event loop entirely. The await keyword only yields to the event loop at actual async suspension points. A synchronous Redis call is not one."
          />
          <CodeBlock title="Find every Redis client" code={`grep -n "StrictRedis\\|redis\\.Redis\\|redis\\.asyncio" app/redis_helper.py app/main.py app/turbo_diesel_ai.py`} />
          <H3>Redis client inventory</H3>
          {[1,2,3].map(n => (
            <div key={n} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <AnswerField id={`q2_file${n}`} placeholder={`File ${n}...`} checks={checks} setChecks={setChecks} />
              <AnswerField id={`q2_type${n}`} placeholder="Client type..." checks={checks} setChecks={setChecks} />
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.acc_ink, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>SOLID label for three separate clients targeting the same keyspace:</div>
            <AnswerField id="q2_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} />
          </div>
          <InterviewDialog question="If two customers message simultaneously and Customer A's handler is executing redis_client.get() synchronously, what happens to Customer B's request?" hint="Use the event loop model — not intuition. asyncio runs one coroutine at a time. Synchronous calls don't yield." />
          <AnswerField id="q2_blocking" placeholder="Customer B experiences..." checks={checks} setChecks={setChecks} multiline />
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.sage, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>Exact import path for the fix:</div>
            <AnswerField id="q2_fix" placeholder="redis.asyncio.Redis or..." checks={checks} setChecks={setChecks} />
          </div>
          <DebuggerExercise title="Q2: Confirm the synchronous client">
            <P>Set a breakpoint in <Inline>session_repo.get_session()</Inline> on the first Redis call. Send the setup curl.</P>
            <P><strong style={{ color: T.ochre, fontFamily: FONT_MONO, fontSize: 13 }}>Evaluate Expression</strong> (Alt+F8):</P>
            <CodeBlock code={`type(redis_client)\nimport inspect\ninspect.iscoroutinefunction(redis_client.get)`} lang="python" />
            <P>While paused, send a second curl from a different number:</P>
            <CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447711111111" \\\n  -d "Body=hello" \\\n  -d "MessageSid=SM_CONCURRENT_001"`} />
            {[
              { id: "q2d_type", q: "type(redis_client) result:" },
              { id: "q2d_iscoro", q: "inspect.iscoroutinefunction(redis_client.get) result:" },
              { id: "q2d_blocked", q: "Did the second curl respond before you pressed F9? Yes / No" },
              { id: "q2d_label", q: "Guide label for this violation:" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ochre, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </DebuggerExercise>
          <Checkbox id="q2_done" label="Q2 complete — three Redis clients found, concurrent curl observed, CONC-3 confirmed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q3 ═══ */}
        <div ref={regRef("q3")}>
          <H2>Q3 — The <HeadingCode>.keys()</HeadingCode> time bomb</H2>
          <InterviewDialog
            question="Find every .keys() call in the live codebase. At what key count does this become a production incident?"
            context="redis.StrictRedis.keys(pattern) performs an O(N) full-keyspace scan and blocks the Redis event loop until it completes. It is a CAT-1 Query that behaves like a CAT-3 Command under load."
            hint="This is a DT-METHOD-1 category mismatch — the function's category changes under load."
          />
          <CodeBlock title="Find all .keys() and scan_iter usage" code={`grep -n "\\.keys(" app/main.py app/redis_helper.py app/turbo_diesel_ai.py\ngrep -n "scan_iter" app/main.py app/redis_helper.py app/turbo_diesel_ai.py`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            {[
              { id: "q3_keys_total", q: "Total .keys( calls in live code:" },
              { id: "q3_keys_async", q: "Calls inside async def functions:" },
              { id: "q3_scaniter", q: "Occurrences of scan_iter:" },
              { id: "q3_customer", q: "Customer experience during .keys() with 50k keys:" },
            ].map(({ id, q }) => (
              <div key={id}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </div>
          <InterviewDialog question="What is the O() complexity of scan_iter vs keys()? Which guide label describes the violation and why does the category label matter for choosing the test template?" />
          <AnswerField id="q3_defend" placeholder="Defend your classification..." checks={checks} setChecks={setChecks} multiline />
          <Checkbox id="q3_done" label="Q3 complete — all .keys() calls counted, scan_iter occurrences confirmed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q4 ═══ */}
        <div ref={regRef("q4")}>
          <H2>Q4 — <HeadingCode>@handle_whatsapp_errors</HeadingCode> layer collapse</H2>
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
            <div key={id} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}
          <InterviewDialog question="Applying this decorator to validate_state means the decorator reaches across a layer boundary it should never cross. Which SOLID principle is violated and why?" hint="What does the decorator depend on that validate_state should never know about?" />
          <AnswerField id="q4_defend" placeholder="SOLID principle and why..." checks={checks} setChecks={setChecks} multiline />
          <DebuggerExercise title="Q4: Trigger the decorator's error path">
            <P>Temporarily add as the <strong style={{ color: T.ochre, fontFamily: FONT_MONO, fontSize: 13 }}>first line</strong> of <Inline>whatsapp_webhook</Inline>:</P>
            <CodeBlock lang="python" code={`raise WhatsAppException("debug test", status_code=400)`} />
            <P>Set a breakpoint inside the <Inline>except WhatsAppException</Inline> block in the decorator. Restart the debugger. Send the setup curl.</P>
            {[
              { id: "q4d_from", q: "from_number value in the except block:" },
              { id: "q4d_twilio", q: "Does client.messages.create() succeed or raise?" },
              { id: "q4d_status", q: "What HTTP status code does Twilio receive?" },
              { id: "q4d_retry", q: "What does Twilio do when it receives a non-200 from a webhook?" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ochre, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
            <div style={{ background: T.acc_fill, border: `1px solid ${T.acc_border}55`, borderRadius: 4, padding: "10px 14px", marginTop: 12 }}>
              <span style={{ color: T.acc_ink, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Remove the temporary raise before proceeding.</span>
            </div>
          </DebuggerExercise>
          <Checkbox id="q4_done" label="Q4 complete — grep run, error path triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q5 ═══ */}
        <div ref={regRef("q5")}>
          <H2>Q5 — <HeadingCode>State.ERROR</HeadingCode> tuple bug</H2>
          <div style={{ background: T.acc_fill, border: `1px solid ${T.acc_border}`, borderRadius: 6, padding: "16px 20px", margin: "16px 0" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.acc_ink, fontWeight: 700, marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>Critical — live production bug</div>
            <P style={{ margin: 0, color: T.ink_1 }}>
              The trailing comma makes the value a <Inline>tuple</Inline>. <Inline>State.ERROR.value</Inline> returns <Inline color={T.clay} bg={T.clay_fill}>('Error',)</Inline>, not <Inline color={T.sage} bg={T.sage_fill}>'Error'</Inline>. Any customer whose session lands in <Inline>State.ERROR</Inline> is <strong style={{ color: T.ink_1 }}>permanently stuck</strong>.
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
            <div key={id} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}
          <DebuggerExercise title="Q5: Lock a customer in the error state">
            <P>Temporarily add to the first line of <Inline>process_with_ai()</Inline>:</P>
            <CodeBlock lang="python" code={`raise Exception("simulated error")`} />
            <P>Navigate to <Inline>new_inquiry</Inline> state (hello → sales → new inquiry), then send <Inline color={T.clay} bg={T.clay_fill}>I need 3 x 452-0427</Inline>.</P>
            <CodeBlock code={`redis-cli get "whatsapp:+447700000000"`} />
            {[
              { id: "q5d_field", q: "fsm_state.state field written to Redis (exact value):" },
              { id: "q5d_crash", q: "Send another hello — does from_dict crash? Exception and line:" },
              { id: "q5d_stuck", q: "Is the customer permanently stuck?" },
            ].map(({ id, q }) => (
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ochre, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
            <div style={{ background: T.acc_fill, border: `1px solid ${T.acc_border}55`, borderRadius: 4, padding: "10px 14px", marginTop: 12 }}>
              <span style={{ color: T.acc_ink, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Remove the temporary raise before proceeding.</span>
            </div>
          </DebuggerExercise>
          <Checkbox id="q5_done" label="Q5 complete — tuple confirmed, from_dict crash triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q6 ═══ */}
        <div ref={regRef("q6")}>
          <H2>Q6 — Observe before you assert</H2>
          <P>Run every curl in sequence. Read Redis after each one. These observations become your test assertions.</P>
          {[
            { id: "SM001", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=hello" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM001"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM001 — brand new customer" },
            { id: "SM002", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=salesid1" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM002"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM002 — Sales Inquiries button" },
            { id: "SM003", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"current_reference_id"\\|"state"'`, label: "SM003 — New Sales Inquiry button" },
            { id: "SM004", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=I need 3 x 452-0427" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM004"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM004 — parts inquiry (Claude fires)" },
            { id: "SM005", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=this is not a valid command" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM005"`, check: null, label: "SM005 — unknown text" },
          ].map(({ id, cmd, check, label }) => (
            <Collapsible key={id} title={label} accent={T.teal} icon="▸">
              <CodeBlock title={`Send ${id}`} code={cmd} />
              {check && <CodeBlock title="Check Redis" code={check} />}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.teal, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>After {id} — fsm_state.state and observations:</div>
                <AnswerField id={`q6_${id}`} placeholder={`State after ${id}...`} checks={checks} setChecks={setChecks} />
              </div>
              <Checkbox id={`q6_${id}_done`} label={`${id} run and recorded`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
          <H3>Record unexpected behaviour</H3>
          <AnswerField id="q6_unexpected" placeholder="One thing you did not expect..." checks={checks} setChecks={setChecks} multiline />
          <InterviewDialog question="SM005 behaves differently depending on whether SM003 already ran. Name the guide pattern that describes this behaviour." hint="PAT-x — the same input producing different outputs depending on state." />
          <AnswerField id="q6_defend" placeholder="Pattern label and explanation..." checks={checks} setChecks={setChecks} multiline />
          <DebuggerExercise title="Q6: The four concern breakpoints">
            <P>Set breakpoints at <strong style={{ color: T.ink_1, fontFamily: FONT_MONO, fontSize: 13 }}>all four simultaneously</strong>:</P>
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
              <div key={id} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ochre, marginBottom: 5, letterSpacing: "0.04em", fontWeight: 600 }}>{q}</div>
                <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
              </div>
            ))}
          </DebuggerExercise>
          <Checkbox id="q6_done" label="Q6 complete — all five curls run, Redis recorded, four-concern breakpoints set" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q7 ═══ */}
        <div ref={regRef("q7")}>
          <H2>Q7 — Single biggest production concern</H2>
          <InterviewDialog question="What is your single biggest production concern? Classify → blast radius → detection signal → fix pattern." context="The previous refactor fixed the architecture but not this concern. Explain why structural correctness alone does not resolve it." />
          {[
            { id: "q7_scenario", q: "Scenario:" },
            { id: "q7_impact", q: "Impact (how many customers, what they experience):" },
            { id: "q7_detection", q: "Detection signal in current logs (given only print() and ic()):" },
            { id: "q7_fix", q: "Fix pattern (guide label):" },
          ].map(({ id, q }) => (
            <div key={id} style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, marginBottom: 5, letterSpacing: "0.04em" }}>{q}</div>
              <AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} />
            </div>
          ))}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.acc_ink, marginBottom: 5, letterSpacing: "0.06em", fontWeight: 700, textTransform: "uppercase" }}>Defend your choice</div>
            <AnswerField id="q7_defend" placeholder="Why structural correctness alone doesn't fix this..." checks={checks} setChecks={setChecks} multiline />
          </div>
          <DebuggerExercise title="Q7: Trigger your chosen failure mode">
            <P>Choose one scenario and trigger it in the debugger. Document what you observe.</P>
            <Collapsible title="If: Synchronous Redis blocking" accent={T.ochre}>
              <P>Set a breakpoint on <Inline>session_repo.get_session(...)</Inline>. Send a message. While paused, send a second curl from a different number.</P>
              <AnswerField id="q7d_redis" placeholder="Did the second request respond before F9? What the customer experiences..." checks={checks} setChecks={setChecks} multiline />
            </Collapsible>
            <Collapsible title="If: State.ERROR bug" accent={T.ochre}>
              <P>Use the Q5 debugger exercise. Document the Redis state after the bug fires.</P>
              <AnswerField id="q7d_error" placeholder="Redis state after bug, customer stuck..." checks={checks} setChecks={setChecks} multiline />
            </Collapsible>
            <Collapsible title="If: No idempotency on Twilio retries" accent={T.ochre}>
              <P>Re-run SM003 curl twice with identical data:</P>
              <CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`} />
              <AnswerField id="q7d_idempotent" placeholder="Does reference_id change? Second interaction node?" checks={checks} setChecks={setChecks} multiline />
            </Collapsible>
          </DebuggerExercise>
          <Checkbox id="q7_done" label="Q7 complete — chosen failure mode triggered, temporary code removed" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ FAILURE MATRIX ═══ */}
        <div ref={regRef("failure-matrix")}>
          <H2>Production failure matrix</H2>
          <P>Classify each scenario. The fix pattern is given — your job is to explain what happens without it.</P>
          <div style={{ overflowX: "auto", border: `1px solid ${T.border_soft}`, borderRadius: 6, background: T.surface_1 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT_SANS }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border_med}`, background: T.surface_2 }}>
                  {["Scenario", "Fix pattern", "FSM corrupted?", "Recoverable?"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.ink_3, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: FONT_MONO }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAILURE_SCENARIOS.map((f, i) => (
                  <tr key={i} style={{ borderBottom: i < FAILURE_SCENARIOS.length - 1 ? `1px solid ${T.border_soft}` : "none" }}>
                    <td style={{ padding: "11px 14px", color: T.ink_1, maxWidth: 280, fontFamily: FONT_SERIF }}>{f.scenario}</td>
                    <td style={{ padding: "11px 14px" }}><SolidBadge label={f.fix} /></td>
                    <td style={{ padding: "11px 14px", color: f.corrupt === "?" ? T.ochre : T.ink_2, fontFamily: FONT_SERIF, fontStyle: f.corrupt === "?" ? "italic" : "normal" }}>{f.corrupt}</td>
                    <td style={{ padding: "11px 14px", color: f.recoverable === "No" ? T.acc_border : f.recoverable === "?" ? T.ochre : T.sage, fontFamily: FONT_SERIF, fontWeight: 600 }}>{f.recoverable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ TESTS L1 ═══ */}
        <div ref={regRef("tests-l1")}>
          <H2>Part 2 — Level 1: Pure functions</H2>
          <P>These functions are in <Inline>app/main.py</Inline> today. Test them here. When the refactor moves them, the tests travel unchanged.</P>
          <div style={{ background: T.sage_fill, border: `1px solid ${T.sage}55`, borderLeft: `3px solid ${T.sage}`, borderRadius: "0 6px 6px 0", padding: "12px 18px", margin: "16px 0" }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.sage, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 8 }}>Rule</span>
            <span style={{ fontSize: 14, color: T.ink_1, fontFamily: FONT_SERIF }}>Test current behaviour — not ideal behaviour. If the system does something wrong but consistently, that is your assertion. No <Inline color={T.acc_ink} bg={T.paper}>assert_called_with</Inline>. No <Inline color={T.acc_ink} bg={T.paper}>call_count</Inline>.</span>
          </div>
          <CodeBlock title="Pre-Prompt Gate — write this at the top of every test" lang="python" code={`# CAT-x:     (e.g., CAT-8 Computation)\n# OOP/SOLID: (e.g., SOLID-SRP violation — function does both computation and formatting)\n# Template:  (e.g., A.1 Pure Function)`} />
          {PURE_FUNCTIONS.map((f, i) => (
            <Collapsible key={i} title={f.fn} accent={CAT_DEFS[f.cat]?.color || T.slate} icon="ƒ">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <CatBadge cat={f.cat} />
                <TemplateBadge tmpl={f.template} />
              </div>
              <div style={{ fontSize: 13.5, color: T.ink_2, lineHeight: 1.65, fontFamily: FONT_SERIF }}>
                <strong style={{ color: T.ink_1 }}>Edge cases: </strong>{f.edges}
              </div>
              {f.pseudo && <CodeBlock title={`${f.template} Template — ${f.fn}`} lang="python" code={f.pseudo} />}
              {f.cases && <TestCaseData title={f.fn} cases={f.cases} />}
              <ExamSection examKey={`l1_${f.fn}`} checks={checks} setChecks={setChecks} />
              <div style={{ marginTop: 12 }}>
                <Checkbox id={`l1_${f.fn}`} label={`${f.fn} — tests written with edge cases`} checks={checks} setChecks={setChecks} />
              </div>
            </Collapsible>
          ))}
        </div>

        {/* ═══ TESTS L2 ═══ */}
        <div ref={regRef("tests-l2")}>
          <H2>Part 2 — Level 2: FSM state transitions</H2>
          <P>Test <Inline>WhatsAppFSM</Inline> from <Inline>app/fsm.py</Inline> directly. No HTTP. No Redis. No Twilio.</P>
          {FSM_TESTS.map((t, i) => (
            <Collapsible key={i} title={t.test} accent={t.label === "BUG" ? T.acc_border : T.plum} icon={t.label === "BUG" ? "!" : "▸"}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <TemplateBadge tmpl={t.template} />
                <SolidBadge label={t.label} />
              </div>
              <div style={{ fontSize: 13, color: T.ink_2, lineHeight: 1.6, marginBottom: 8, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{t.assertion}</div>
              {t.pseudo && <CodeBlock title={`${t.template} Template`} lang="python" code={t.pseudo} />}
              {t.cases && <TestCaseData title={t.test} cases={t.cases} />}
              <ExamSection examKey={`l2_${i}`} checks={checks} setChecks={setChecks} />
              <Checkbox id={`l2_${i}`} label={`${t.test} — test written`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
        </div>

        {/* ═══ TESTS L3 ═══ */}
        <div ref={regRef("tests-l3")}>
          <H2>Part 2 — Level 3: Webhook behaviour</H2>
          <P>Functional tests that hit the webhook endpoint. Assert from the outside.</P>
          <Collapsible title="conftest.py — fixtures" accent={T.plum} defaultOpen={false}>
            <CodeBlock title="tests/functional/conftest.py" lang="python" code={`import json\nimport pytest\nimport redis\nfrom fastapi.testclient import TestClient\nfrom app.main import app, session_repo, initialize_user_session\n\nTEST_NUMBER = "whatsapp:+447700000000"\n_redis = redis.StrictRedis(host="localhost", port=6379, db=0, decode_responses=True)\n\n@pytest.fixture(autouse=True)\ndef clean_redis():\n    _redis.delete(TEST_NUMBER)\n    yield\n    _redis.delete(TEST_NUMBER)\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n@pytest.fixture\ndef mock_twilio(monkeypatch):\n    sent = []\n    def fake_create(**kwargs):\n        sent.append(kwargs)\n        return type("Msg", (), {"sid": "SM_test_001"})()\n    monkeypatch.setattr("app.main.client.messages.create", fake_create)\n    return sent\n\n@pytest.fixture\ndef mock_claude(monkeypatch):\n    monkeypatch.setattr(\n        "app.main.anthropic_client.messages.create",\n        lambda **kwargs: type("Resp", (), {\n            "content": [type("C", (), {\n                "text": "<response>3 x 452-0427 confirmed.</response>"\n            })()]\n        })()\n    )`} />
          </Collapsible>
          <div style={{ background: T.teal_fill, border: `1px solid ${T.teal}55`, borderLeft: `3px solid ${T.teal}`, borderRadius: "0 6px 6px 0", padding: "12px 18px", margin: "16px 0" }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.teal, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 8 }}>Assert in every webhook test</span>
            <span style={{ fontSize: 13, color: T.ink_1, fontFamily: FONT_SERIF }}>response.status_code == 200 · Redis parseable after every call · mock_twilio count + to field verified · <strong style={{ color: T.ink_1 }}>assert the absence</strong> when no message should fire</span>
          </div>
          {WEBHOOK_SCENARIOS.map((s, i) => (
            <Collapsible key={i} title={s.scenario} accent={T.teal} icon="▸">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ background: T.surface_2, padding: "2px 8px", borderRadius: 3, fontFamily: FONT_MONO, fontSize: 10.5, color: T.ink_3, fontWeight: 600 }}>seed: {s.seed}</span>
                <span style={{ background: T.teal_fill, padding: "2px 8px", borderRadius: 3, fontFamily: FONT_MONO, fontSize: 10.5, color: T.teal, fontWeight: 600, border: `1px solid ${T.teal}44` }}>{s.input}</span>
                <TemplateBadge tmpl="B.1.9" />
              </div>
              <div style={{ fontSize: 13, color: T.ink_2, lineHeight: 1.6, marginBottom: 8, fontFamily: FONT_SERIF }}>{s.assertions}</div>
              {s.pseudo && <CodeBlock title="B.1.9 Template" lang="python" code={s.pseudo} />}
              {s.cases && <TestCaseData title={s.scenario} cases={s.cases} />}
              <ExamSection examKey={`l3_${i}`} checks={checks} setChecks={setChecks} />
              <Checkbox id={`l3_${i}`} label={`${s.scenario} — test written`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <TemplateBadge tmpl="B.1.9" />
            <span style={{ fontSize: 12.5, color: T.ink_3, fontFamily: FONT_SERIF, fontStyle: "italic" }}>All scenarios use the Orchestration template</span>
          </div>
        </div>

        {/* ═══ CHECKLIST ═══ */}
        <div ref={regRef("checklist")}>
          <H2>Completion checklist</H2>
          <H3>Setup</H3>
          <Checkbox id="final_redis" label="redis-cli ping returns PONG" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_debug" label="PyCharm debug configuration created; Uvicorn running confirmed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_curl" label="Setup curl returns HTTP 200; Redis key exists" checks={checks} setChecks={setChecks} />
          <H3>Discovery phase</H3>
          <Checkbox id="final_q1" label="Q1 — six operations named; CAT-x and SOLID label written; debugger stepped through each" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q2" label="Q2 — three Redis clients found; inspect.iscoroutinefunction run; concurrent curl observed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q3" label="Q3 — all .keys() calls counted; scan_iter occurrences confirmed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q4" label="Q4 — @handle_whatsapp_errors grep run; error path triggered; temporary raise removed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q5" label="Q5 — State.ERROR tuple confirmed; from_dict crash path triggered; temporary raise removed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q6" label="Q6 — all five curl commands run; Redis output recorded; four-concern breakpoints set" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_q7" label="Q7 — chosen failure mode triggered; temporary code removed" checks={checks} setChecks={setChecks} />
          <H3>Defend phase (cannot be skipped)</H3>
          <Checkbox id="final_defend1" label="Every Q has a DEFEND block completed" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_defend2" label="Every test has the three-line CAT-x / OOP/SOLID / Template comment" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_defend3" label="No test uses assert_called_with, call_count, or argument shape assertions" checks={checks} setChecks={setChecks} />
          <H3>Testing phase</H3>
          <Checkbox id="final_l1" label="tests/unit/ — all six pure functions covered with edge cases; A.1 template used" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l2" label="tests/integration/ — all FSM transitions; State.ERROR bug documented as characterization" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_conftest" label="tests/functional/conftest.py — fixtures created; scope='function' on all mutable fixtures" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_scenarios" label="All eight webhook scenarios written; absence of mock_twilio asserted where applicable" checks={checks} setChecks={setChecks} />
          <Checkbox id="final_l3_green" label="All tests pass against the current monolith" checks={checks} setChecks={setChecks} />

          <div style={{ marginTop: 36, background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 6, padding: "22px 26px" }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: T.ink_1, marginBottom: 16, letterSpacing: "-0.01em" }}>Key takeaways</div>
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
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontFamily: FONT_MONO, fontWeight: 700, minWidth: 16, color: t.icon === "!" ? T.acc_border : T.ink_3 }}>{t.icon}</span>
                <span style={{ fontSize: 14, color: T.ink_2, lineHeight: 1.65, fontFamily: FONT_SERIF }}>{t.text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, background: T.surface_1, border: `1px solid ${T.border_soft}`, borderLeft: `3px solid ${T.acc_border}`, borderRadius: "0 6px 6px 0", padding: "22px 26px" }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 700, color: T.ink_1, marginBottom: 14, letterSpacing: "-0.01em" }}>What's next → Module 02: Extraction strategy</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
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
                    <tr key={i} style={{ borderBottom: i < 7 ? `1px solid ${T.border_soft}` : "none" }}>
                      <td style={{ padding: "9px 12px", color: T.ink_1, fontFamily: FONT_MONO, fontWeight: 500 }}>{what}</td>
                      <td style={{ padding: "9px 12px", color: T.ink_3, fontFamily: FONT_SERIF, fontStyle: "italic" }}>{target}</td>
                      <td style={{ padding: "9px 12px" }}><SolidBadge label={label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        </div>
      </main>
    </div>
  );
}