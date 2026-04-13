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
  { fn: "generate_departmental_reference_id", cat: "CAT-4", template: "B.1.1", edges: "sal_, adm_, log_ prefixes; two calls differ; missing team_type fallback",
    pseudo: `# CAT-x:     CAT-4 Factory
# OOP/SOLID: N/A
# Template:  B.1.1 Factory

class Test<FunctionName>:
    """
    B.1.1 Factory: <description>.

    Contract:
    - Returns <return_type> with <prefix_constraint>
    - Non-deterministic: each call produces unique result
    - No side effects
    """

    @pytest.mark.parametrize(
        "<input_param>,<expected_constraint>",
        [
            # populate from TEST CASE DATA table below
        ],
        ids=[<test_ids_from_case_data>],
    )
    def test_<primary_contract>(self, <input_param>, <expected_constraint>):
        """Contract: <function>(<session>) --> <prefixed_id>."""
        # ARRANGE — construct <session_dict> with known <input_param>
        # ACT     — result = <function>(<session_dict>)
        # ASSERT  — result starts with <expected_constraint>

    def test_<uniqueness>(self):
        """Contract: non-deterministic — two calls differ."""
        # ARRANGE — same <session_dict>
        # ACT     — call <function> twice
        # ASSERT  — result_1 != result_2

    def test_<format>(self):
        """Contract: result matches <regex_pattern>."""
        # ARRANGE — valid <session_dict>
        # ACT     — result = <function>(<session_dict>)
        # ASSERT  — re.match(<pattern>, result)

    def test_<edge_missing_key>(self):
        """Edge: <missing_input> — characterize crash or fallback."""
        # ARRANGE — <empty_or_incomplete_input>
        # ACT + ASSERT — characterize: raises <exception>? returns <default>?`,
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
# OOP/SOLID: N/A
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """
    A.1 Pure function: deterministic, no side effects.

    Contract:
    - Same input --> same output (determinism)
    - No observable state mutation
    - No external I/O
    """

    @pytest.mark.parametrize(
        "<input_param>,<expected_output>",
        [
            # populate from TEST CASE DATA table below
        ],
        ids=[<test_ids_from_case_data>],
    )
    def test_<primary_contract>(self, <input_param>, <expected_output>):
        """Contract: <function>(<input>) --> <currency_string>."""
        # ACT
        result_1 = <function>(<input_param>)
        result_2 = <function>(<input_param>)
        # ASSERT — correctness
        assert result_1 == <expected_output>
        # ASSERT — idempotence (A.1 determinism check)
        assert result_1 == result_2

    def test_<edge_unknown_input>(self):
        """Edge: unrecognized <input> --> <fallback_value>."""
        # ACT     — <function>(<unrecognized_input>)
        # ASSERT  — result == <fallback_value>`,
    cases: [
      { input: '"whatsapp:+447700000000"', expected: '"GBP"', type: "happy" },
      { input: '"whatsapp:+12025551234"', expected: '"USD"', type: "happy" },
      { input: '"whatsapp:+4915112345678"', expected: '"EUR"', type: "happy" },
      { input: '"whatsapp:+99912345"', expected: '"USD" (fallback)', type: "edge" },
      { input: 'same input twice', expected: "identical result both calls", type: "idempotence" },
    ] },
  { fn: "extract_part_qty_pairs", cat: "CAT-8", template: "A.1", edges: '"3 x 452-0427", "2x1234-56", "no parts", "" — assert tuple contents',
    pseudo: `# CAT-x:     CAT-8 Computation
# OOP/SOLID: N/A
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """
    A.1 Pure computation: <input_type> --> <output_type>.

    Contract:
    - Deterministic
    - Returns list of dicts with <key_1> and <key_2>
    """

    @pytest.mark.parametrize(
        "<input_param>,<expected_count>",
        [
            # populate from TEST CASE DATA table below
        ],
        ids=[<test_ids_from_case_data>],
    )
    def test_<count_contract>(self, <input_param>, <expected_count>):
        """Contract: correct number of <items> extracted."""
        # ACT     — result = <function>(<input_param>)
        # ASSERT  — len(result) == <expected_count>

    def test_<value_contract>(self):
        """Contract: extracted <item> has correct <field_1> and <field_2>."""
        # ACT     — result = <function>(<known_input>)
        # ASSERT  — result[0][<key_1>] == <expected_value_1>
        # ASSERT  — result[0][<key_2>] == <expected_value_2>

    def test_<multi_match>(self):
        """Edge: multiple <items> in single <input>."""
        # ACT     — result = <function>(<multi_input>)
        # ASSERT  — len(result) == <expected_multi_count>`,
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
# OOP/SOLID: N/A
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure computation: <input_type> --> <output_type> or None."""

    @pytest.mark.parametrize(
        "<input_param>,<expected_output>",
        [
            # populate from TEST CASE DATA table below
        ],
        ids=[<test_ids_from_case_data>],
    )
    def test_<primary_contract>(self, <input_param>, <expected_output>):
        """Contract: recognized <phrases> --> <department_string>."""
        # ACT     — result = <function>(<input_param>)
        # ASSERT  — result == <expected_output>`,
    cases: [
      { input: '"speak to sales team"', expected: '"sales"', type: "happy" },
      { input: '"transfer to admin"', expected: '"admin"', type: "happy" },
      { input: '"logistics please"', expected: '"logistics"', type: "happy" },
      { input: '"no transfer intent here"', expected: "None", type: "no match" },
      { input: '"hello"', expected: "None", type: "greeting" },
    ] },
  { fn: "is_button_press", cat: "CAT-1", template: "A.1", edges: "every string in ALL_BUTTONS; one that is not; case sensitivity",
    pseudo: `# CAT-x:     CAT-1 Query
# OOP/SOLID: N/A
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """A.1 Pure query: <input_type> --> bool."""

    @pytest.mark.parametrize("<input_param>", [
        # populate from <CONSTANT_SET>
    ])
    def test_<membership_true>(self, <input_param>):
        """Contract: every member of <CONSTANT_SET> --> True."""
        # ACT + ASSERT — <function>(<input_param>) is True

    def test_<non_member_false>(self):
        """Contract: <non_member_input> --> False."""
        # ACT + ASSERT — <function>(<non_member>) is False

    def test_<case_sensitivity_edge>(self):
        """Edge: characterize case-sensitive or insensitive matching."""
        # ACT     — compare <function>(<lowercase>) vs <function>(<uppercase>)
        # ASSERT  — document actual behaviour`,
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
# OOP/SOLID: N/A
# Template:  A.1 Pure Function

class Test<FunctionName>:
    """
    A.1 Pure computation: <input_type> --> <output_type>.

    Contract:
    - Same input --> same output (determinism)
    - No observable state mutation
    """

    @pytest.mark.parametrize(
        "<input_param>,<expected_output>",
        [
            # populate from TEST CASE DATA table below
        ],
        ids=[<test_ids_from_case_data>],
    )
    def test_<primary_contract>(self, <input_param>, <expected_output>):
        """Contract: <transformation_description>."""
        # ACT     — result = <function>(<input_param>)
        # ASSERT  — result == <expected_output>

    def test_<idempotence>(self):
        """A.1 determinism: calling twice --> identical result."""
        # ACT     — call <function>(<same_input>) twice
        # ASSERT  — result_1 == result_2`,
    cases: [
      { input: '"  hello  world  "', expected: '"hello world"', type: "inner + edges" },
      { input: '"hello\tworld"', expected: '"hello world"', type: "tabs" },
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
    """B.1.4: assert state BEFORE and AFTER transition."""
    # ARRANGE — <fsm> = <FSMClass>() → default <initial_state>
    # ASSERT  — precondition: <fsm>.state == <from_state>
    #           <history_length_before> = len(<fsm>.history)
    # ACT     — <fsm>.transition_to(<to_state>)
    # ASSERT  — <fsm>.state == <to_state>
    #           len(<fsm>.history) == <history_length_before> + 1`,
    cases: [
      { pre: "State.MAIN_MENU", action: "transition_to(State.SALES_INQUIRIES)", post: "State.SALES_INQUIRIES", history: "+1" },
    ] },
  { test: "MAIN_MENU → ADMIN_SUPPORT", template: "B.1.4", assertion: "same pattern", label: "PAT-8",
    pseudo: `# Same B.1.4 pattern — only <to_state> differs
# ARRANGE → ASSERT precondition → ACT → ASSERT postcondition`,
    cases: [
      { pre: "State.MAIN_MENU", action: "transition_to(State.ADMIN_SUPPORT)", post: "State.ADMIN_SUPPORT", history: "+1" },
    ] },
  { test: "MAIN_MENU → TRACK_ORDER", template: "B.1.4", assertion: "same pattern", label: "PAT-8",
    pseudo: `# Same B.1.4 pattern — only <to_state> differs`,
    cases: [
      { pre: "State.MAIN_MENU", action: "transition_to(State.TRACK_ORDER)", post: "State.TRACK_ORDER", history: "+1" },
    ] },
  { test: "SALES → NEW_SALES_INQUIRY", template: "B.1.4", assertion: "state change + history from/to values", label: "PAT-8",
    pseudo: `# B.1.4 two-step: navigate to <precondition_state> first

def test_<from_state>_to_<to_state>(self):
    """B.1.4: verify history entry records from/to states."""
    # ARRANGE — <fsm> at <initial_state>, transition to <precondition_state>
    # ASSERT  — precondition: <fsm>.state == <precondition_state>
    # ACT     — <fsm>.transition_to(<to_state>)
    # ASSERT  — <fsm>.state == <to_state>
    #           <fsm>.history[-1]["from_state"] == <precondition_state_value>
    #           <fsm>.history[-1]["to_state"] == <to_state_value>`,
    cases: [
      { pre: "State.SALES_INQUIRIES", action: "transition_to(State.NEW_SALES_INQUIRY)", post: "State.NEW_SALES_INQUIRY", history: 'from="Sales Inquiries" to="New Sales Inquiry"' },
    ] },
  { test: "Invalid transition raises", template: "A.1", assertion: "transition_to(QUOTE_SENT) from MAIN_MENU raises ValueError", label: "CAT-5",
    pseudo: `# CAT-x:     CAT-5 Validation
# Template:  A.2 Validation — pytest.raises

def test_<invalid_transition>_raises(self):
    """A.2: illegal transition --> <ExceptionType>, state unchanged."""
    # ARRANGE — <fsm> at <from_state>
    # ACT + ASSERT — pytest.raises(<ExceptionType>, match=<pattern>):
    #                   <fsm>.transition_to(<illegal_target_state>)
    # ASSERT — <fsm>.state still == <from_state> (unchanged)`,
    cases: [
      { pre: "State.MAIN_MENU", action: "transition_to(State.QUOTE_SENT)", post: "ValueError raised, state unchanged", history: "no entry added" },
      { pre: "State.MAIN_MENU", action: "transition_to(State.AI_PROCESSING)", post: "ValueError raised", history: "no entry added" },
    ] },
  { test: "State.ERROR tuple bug documented", template: "A.1", assertion: 'assert State.ERROR.value == ("Error",) — IS the bug', label: "BUG",
    pseudo: `# Template:  TST-5 Characterization
# This test MUST PASS against current code.
# It FAILS after the fix is applied.

@pytest.mark.characterization
def test_<enum_member>_value_is_<wrong_type>_BUG(self):
    """TST-5: document current broken behaviour."""
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
    """B.1.4+B.1.1: serialize --> deserialize preserves all fields."""
    # ARRANGE — <fsm> with <transitions_applied> + <context_set>
    # ACT     — <data> = <fsm>.to_dict()
    #           <restored> = <FSMClass>.from_dict(<data>)
    # ASSERT  — <restored>.state == <fsm>.state
    #           <restored>.history == <fsm>.history
    #           <restored>.context == <fsm>.context
    #           <restored>.<field_n> == <fsm>.<field_n>`,
    cases: [
      { input: "fsm after 2 transitions + context", expected: "all fields identical after round-trip", type: "happy" },
      { input: "to_dict() output", expected: 'keys: "state", "context", "history", "function_calls"', type: "shape" },
      { input: "from_dict({})", expected: "defaults to State.MAIN_MENU", type: "defaults" },
    ] },
  { test: 'from_dict() with "state":"Error"', template: "A.1", assertion: "raises ValueError — characterization", label: "BUG",
    pseudo: `# Template:  TST-5 Characterization — crash path

@pytest.mark.characterization
def test_<from_dict>_with_<corrupt_value>_crashes_BUG(self):
    """TST-5: <from_dict>(<corrupt_data>) --> <ExceptionType>.
    <consequence_description>."""
    # ARRANGE — <data_dict> mimicking what <storage> would contain
    # ACT + ASSERT — pytest.raises(<ExceptionType>):
    #                   <FSMClass>.from_dict(<data_dict>)`,
    cases: [
      { input: '{"state": "Error"}', expected: "raises ValueError", type: "BUG crash" },
      { input: '{"state": ["Error"]}', expected: "raises ValueError (JSON round-trip variant)", type: "BUG crash" },
    ] },
  { test: "Full sales happy path", template: "B.1.9", assertion: "MAIN→SALES→NEW→AI_PROC→AI_DONE", label: "PAT-8",
    pseudo: `# CAT-x:     CAT-6 Orchestration
# Template:  B.1.9 Collaboration

def test_<full_workflow>(self):
    """B.1.9: <state_1> --> <state_2> --> ... --> <state_n>."""
    # ARRANGE — <fsm> at <initial_state>
    # ACT     — transition through each <state> in sequence
    # ASSERT  — <fsm>.state correct after EACH step
    #           len(<fsm>.history) == <total_transitions>`,
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
# Template:  B.1.9 Collaboration — real <storage>, monkeypatched <IO>

def test_<scenario>(self, <client>, <mock_IO>):
    """B.1.9: <precondition_description> --> <expected_outcome>."""
    # ARRANGE — <storage> clean (<autouse_fixture>)
    #           assert <storage>.get(<key>) is None
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code == <expected_status>
    #           <storage> key created and parseable
    #           <session>[<state_field>] == <expected_state>
    #           len(<mock_IO>) >= <expected_call_count>
    #           <mock_IO>[0][<target_field>] == <expected_target>`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "Redis key created", field: '_redis.get(TEST_NUMBER)', expected: "non-null JSON" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"Main Menu"' },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
      { assert: "Twilio target", field: 'mock_twilio[0]["to"]', expected: "TEST_NUMBER" },
    ] },
  { scenario: "salesid1 button", seed: "menu=main", input: "Body=salesid1", assertions: "HTTP 200; state=='Sales Inquiries'; sales submenu dispatched",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>):
    """B.1.9: <button_input> from <seeded_state> --> <target_state>."""
    # ARRANGE — seed <session> at <seeded_state>
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code == <expected_status>
    #           <session>[<state_field>] == <target_state>
    #           len(<mock_IO>) >= <expected_call_count>`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"Sales Inquiries"' },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
    ] },
  { scenario: "new_inquiry button", seed: "menu=sales", input: "Body=new_inquiry", assertions: "HTTP 200; state=='New Sales Inquiry'; reference_id starts sal_",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>):
    """B.1.9: <button_input> --> <generated_field> with <prefix>."""
    # ARRANGE — seed <session> at <seeded_state>
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — <session>[<state_field>] == <target_state>
    #           <session>[<generated_field>].startswith(<expected_prefix>)`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "FSM state", field: 'session["fsm_state"]["state"]', expected: '"New Sales Inquiry"' },
      { assert: "Ref ID prefix", field: 'session["current_reference_id"]', expected: 'startswith("sal_")' },
    ] },
  { scenario: "Parts inquiry + mock_claude", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200/202; AI template dispatched; requested_quotes non-empty",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>, <mock_AI>):
    """B.1.9: <input_with_data> --> <AI_service> called --> <IO> dispatches."""
    # ARRANGE — seed <session> at <inquiry_state>
    #           <mock_AI> fixture active
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code in (<success_codes>)
    #           len(<mock_IO>) >= <expected_call_count>`,
    cases: [
      { assert: "HTTP success", field: "resp.status_code", expected: "200 or 202" },
      { assert: "Twilio fired", field: "len(mock_twilio)", expected: "≥ 1" },
    ] },
  { scenario: "Unknown button payload", seed: "menu=main", input: "Body=notabutton", assertions: "HTTP 200; no crash; state unchanged",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>):
    """B.1.9: unrecognized <input> --> no crash, <state> preserved."""
    # ARRANGE — seed <session> at <seeded_state>
    #           <state_before> = <seeded_state>
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code == <expected_status>
    #           <session>[<state_field>] == <state_before> (unchanged)`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "State unchanged", field: 'session["fsm_state"]["state"]', expected: '"Main Menu"' },
    ] },
  { scenario: "all my messages special command", seed: "any", input: "Body=all my messages", assertions: "HTTP 200; handled before menu routing; cooldown key set",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>):
    """B.1.9: <special_command> --> handled before <routing>, <side_effect>."""
    # ARRANGE — any valid <session>
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code == <expected_status>
    #           <storage>.exists(<side_effect_key>) == True`,
    cases: [
      { assert: "HTTP 200", field: "resp.status_code", expected: "200" },
      { assert: "Cooldown set", field: '_redis.exists(f"cooldown:all_messages:{TEST_NUMBER}")', expected: "True" },
    ] },
  { scenario: "process_with_ai raises", seed: "inquiry_in_progress=True", input: "Body=I need 3 x 452-0427", assertions: "HTTP 200 (not 500); state not left as AI_PROCESSING",
    pseudo: `def test_<scenario>(self, <client>, <mock_IO>, monkeypatch):
    """B.1.9: <dependency> crash --> graceful <status>, <state> not stuck."""
    # ARRANGE — seed <session> at <inquiry_state>
    #           monkeypatch <dependency> to raise <ExceptionType>
    # ACT     — <client>.post(<endpoint>, data={<webhook_payload>})
    # ASSERT  — resp.status_code == <graceful_status> (NOT <error_status>)
    #           <session>[<state_field>] != <stuck_state>`,
    cases: [
      { assert: "Graceful", field: "resp.status_code", expected: "200 (not 500)" },
      { assert: "Not stuck", field: 'session["fsm_state"]["state"]', expected: '≠ "AI Processing"' },
    ] },
  { scenario: "SM003 re-sent (Twilio retry)", seed: "menu=sales", input: "identical SM003", assertions: "HTTP 200; reference_id unchanged; no second interaction node",
    pseudo: `# Template:  TST-5 Characterization — documents <idempotency_bug>

@pytest.mark.characterization
def test_<duplicate_request>_BUG(self, <client>, <mock_IO>):
    """TST-5: duplicate <request_id> --> characterize (no dedup)."""
    # ARRANGE — seed <session> at <seeded_state>
    #           <payload> = {<identical_webhook_data>}
    # ACT     — send <payload> twice via <client>.post
    #           capture <generated_field> after each call
    # ASSERT  — both return <expected_status>
    #           <generated_field_1> != <generated_field_2> (BUG: no dedup)`,
    cases: [
      { assert: "Both succeed", field: "resp_1 + resp_2 status", expected: "200 + 200" },
      { assert: "Ref ID stable?", field: "ref_1 vs ref_2", expected: "BUG: ref_1 ≠ ref_2 (no dedup)" },
    ] },
];

// ═══════════════════════════════════════════════════════════════════
// MODEL ANSWERS — FAANG-level reference answers for every field
// ═══════════════════════════════════════════════════════════════════

const M = {
  // ── Q1: whatsapp_webhook() classification ──
  q1_op1: "HTTP request parsing — extracts form data from the Starlette Request object (from_number, body, profile_name, message_sid) via get_webhook_input()",
  q1_op2: "Session retrieval — loads or initializes the customer session from Redis via session_repo.get_session(), including JSON deserialization. When redis.get() returns None, get_session() raises ValueError, caught by get_user_session() which calls initialize_user_session() to create a default session dict",
  q1_op3: "FSM state hydration — reconstructs a WhatsAppFSM instance from the persisted dict via WhatsAppFSM.from_dict(), mapping string state values back to State enum members",
  q1_op4: "Special command routing — checks for meta-commands ('all my messages', 'reset', 'cooldown') via handle_special_commands() before FSM dispatch, short-circuiting the main flow",
  q1_op5: "Menu/state dispatch — routes to the correct handle_* function based on current FSM state (handle_main_menu_selection, handle_sales_inquiries, etc.), triggering FSM transitions",
  q1_op6: "Twilio response dispatch — formats and sends WhatsApp messages via client.messages.create(), including template selection, content variable assembly, and media URL attachment",
  q1_cat: "CAT-6 Orchestration — it coordinates session retrieval (CAT-1), FSM transitions (CAT-2), AI processing (CAT-3), and Twilio dispatch (CAT-3) across multiple concerns",
  q1_solid: "SOLID-SRP — six distinct reasons to change: request parsing format, session storage mechanism, FSM transition rules, special command set, menu routing logic, Twilio API contract",
  q1_summary: "whatsapp_webhook() is a CAT-6 orchestrator that directly performs operations from at least four other categories (parsing, session IO, FSM mutation, external dispatch) instead of delegating to single-responsibility collaborators, violating SRP with six distinct reasons to change.",

  // ── Q1 Debugger ──
  q1d_input: "Dict with keys: from_number (str, e.g. 'whatsapp:+447700000000'), body (str, 'hello'), profile_name (str, 'Test User'), message_sid (str, 'SM_SETUP_001'). from_number is already a string at this point, not bytes.",
  q1d_session: "Yes — for a new customer, redis.get(key) returns None (not a KeyError). SessionRepository.get_session() checks if not session_data and explicitly raises ValueError(\"No session found for {key}\"). This is caught by the except ValueError: block in get_user_session(), which calls initialize_user_session() to create a default session dict.",
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
// EXAMINER — Claude API assessment + stage gating
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

const GATE_ORDER = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];
const GATE_FIELDS = {
  q1: "q1d_defend", q2: "q2_blocking", q3: "q3_defend",
  q4: "q4_defend", q5: "q5_label", q6: "q6_defend", q7: "q7_defend",
};
function isSectionUnlocked(sid, checks) {
  return true;
}

const lockedStyle = { opacity: 0.06, pointerEvents: "none", maxHeight: 120, overflow: "hidden" };

function LockBanner({ prev }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center", background: "#0d1117",
      borderRadius: 8, border: "1px solid #1e2228", margin: "0 0 20px",
    }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, color: "#2d313a", marginBottom: 8, letterSpacing: "0.1em" }}>▪ LOCKED ▪</div>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
        color: "#3e4451", letterSpacing: "0.04em",
      }}>DEFEND your answer in <span style={{ color: "#61afef" }}>{prev}</span> to unlock</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TTS — browser speechSynthesis for examiner voice
// ═══════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════
// CONCEPTS — tracked across test examinations
// ═══════════════════════════════════════════════════════════════════

const CONCEPTS = {
  cat_classification:       { label: "CAT-x Classification", color: "#61afef" },
  factory_vs_computation:   { label: "Factory vs Computation", color: "#98c379" },
  a1_idempotence:           { label: "A.1 Idempotence", color: "#61afef" },
  edge_case_reasoning:      { label: "Edge Case Reasoning", color: "#e5c07b" },
  parametrize_strategy:     { label: "Parametrize Strategy", color: "#98c379" },
  characterization_testing: { label: "TST-5 Characterization", color: "#c678dd" },
  mutation_testing_b14:     { label: "B.1.4 Mutation", color: "#c678dd" },
  postcondition_reasoning:  { label: "Postcondition Reasoning", color: "#56b6c2" },
  invariant_preservation:   { label: "Invariant Preservation", color: "#e06c75" },
  validation_testing_a2:    { label: "A.2 Validation", color: "#e5c07b" },
  round_trip_testing:       { label: "Round-Trip Testing", color: "#d19a66" },
  fixture_strategy:         { label: "Fixture Strategy", color: "#98c379" },
  orchestration_testing:    { label: "B.1.9 Orchestration", color: "#56b6c2" },
  behavioural_assertion:    { label: "Behavioural Assertion", color: "#61afef" },
  mock_verification:        { label: "Mock Verification", color: "#d19a66" },
  seed_reasoning:           { label: "Seed Reasoning", color: "#98c379" },
  test_level_separation:    { label: "Test Level Separation", color: "#e5c07b" },
  absence_assertion:        { label: "Absence Assertion", color: "#56b6c2" },
  test_limitation:          { label: "Test Limitation Awareness", color: "#e06c75" },
  idempotency:              { label: "Idempotency", color: "#d19a66" },
};

// ═══════════════════════════════════════════════════════════════════
// EXAM PROMPTS — per-test examination questions + model answers
// ═══════════════════════════════════════════════════════════════════

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
    q: "Your test case data includes both '3 x 452-0427' and '452-0427 2'. Why do you need both directions, and what does it tell you about the regex?",
    a: "The function uses regex to extract quantity-part pairs. The two patterns test different match groups: qty-before-part and part-before-qty. If only one direction were tested, a regex that only matches QTY PART order would pass, but customers type parts both ways. Testing both directions documents the actual extraction capability.",
    concepts: ["edge_case_reasoning", "parametrize_strategy"],
  },
  l1_extract_department_transfer: {
    q: "Your None cases test both 'no transfer intent here' and 'hello'. Why do you need both?",
    a: "'no transfer intent here' contains words like 'transfer' that could trigger a false positive in a naive substring match. 'hello' has no overlapping words at all. Testing both distinguishes between correctly ignoring partial keyword matches and returning None for completely unrelated input.",
    concepts: ["edge_case_reasoning"],
  },
  l1_is_button_press: {
    q: "Your case sensitivity edge says 'characterize'. Why can you not decide the expected value in advance, and what does TST-5 characterization mean here?",
    a: "We do not know whether the function does case-insensitive matching until we observe it in the debugger. A characterization test documents current behaviour. We assert what it actually does, not what we think it should do. This test will break if someone changes the behaviour, which is exactly the safety net needed before refactoring.",
    concepts: ["characterization_testing"],
  },
  l1_normalize_whitespace: {
    q: "Your test case data includes None as an input. What does the current code actually do with None, and what regression does your test catch?",
    a: "normalize_whitespace uses re.sub with 'text or empty string'. None is falsy, so it falls through to empty string, and strip returns empty string. The test documents this. If someone removes the 'or empty string' guard during refactoring, re.sub raises TypeError on None, and this test catches the regression.",
    concepts: ["edge_case_reasoning", "characterization_testing"],
  },
  l2_0: {
    q: "Your test asserts history length increased by 1. Why is the history assertion necessary — what bug would it catch that the state assertion alone would miss?",
    a: "A broken implementation could update self.state directly without appending to self.history. The state assertion would pass but the audit trail would be missing. In production this means you lose the ability to debug state transitions. The history assertion catches implementations that mutate state without recording the transition.",
    concepts: ["mutation_testing_b14", "postcondition_reasoning"],
  },
  l2_1: { q: "Same B.1.4 pattern — skip to the next unique test.", a: "Same as above.", concepts: ["mutation_testing_b14"] },
  l2_2: { q: "Same B.1.4 pattern — skip to the next unique test.", a: "Same as above.", concepts: ["mutation_testing_b14"] },
  l2_3: {
    q: "Your test checks history[-1] from_state and to_state values. Why assert the history entry content, not just the history length?",
    a: "Length only proves an entry was added. Content proves the correct entry was added. A bug that always appends a hardcoded from/to pair would pass a length check but fail a content check. The from/to values are what the admin dashboard uses to reconstruct the customer journey.",
    concepts: ["mutation_testing_b14", "postcondition_reasoning"],
  },
  l2_4: {
    q: "After the ValueError, your test asserts fsm.state is still MAIN_MENU. Why is this state-unchanged assertion necessary?",
    a: "Without it, a broken implementation could mutate state first, then check validity, then raise. The exception fires but the FSM is now in an illegal state. The unchanged assertion proves the implementation checks validity before mutating. This is an invariant preservation test layered onto A.2 validation.",
    concepts: ["invariant_preservation", "validation_testing_a2"],
  },
  l2_5: {
    q: "This is a TST-5 characterization test that MUST PASS. What happens when someone removes the trailing comma and reruns your test?",
    a: "Removing the comma changes ERROR = ('Error',) to ERROR = 'Error'. Now State.ERROR.value is the string 'Error', not a tuple. The test asserts isinstance tuple — this fails. The test goes RED. That is exactly the point: the characterization test documents current broken behaviour so the fix is measurable.",
    concepts: ["characterization_testing"],
  },
  l2_6: {
    q: "Your round-trip test transitions the FSM twice before serializing. Why not test with a fresh FSM?",
    a: "A fresh FSM has default values for everything. The round-trip would pass even if from_dict ignored every field and returned a fresh instance. By applying transitions first, the FSM has non-default state, non-empty history, and populated context. If from_dict drops any of these, the equality assertions fail.",
    concepts: ["round_trip_testing", "fixture_strategy"],
  },
  l2_7: {
    q: "Your test case data has two crash variants: state as string 'Error' and state as list ['Error']. Why test both?",
    a: "The tuple ('Error',) takes different forms depending on serialization. In Python, to_dict returns the tuple directly. JSON serialization converts tuples to arrays: json.dumps produces ['Error']. Redis stores JSON, so from_dict reads ['Error'] not ('Error',). Both crash, but for different reasons. Testing both documents both paths.",
    concepts: ["edge_case_reasoning", "characterization_testing"],
  },
  l2_8: {
    q: "This test asserts state after every intermediate step, not just the final state. Why?",
    a: "Asserting only the final state would pass if the FSM jumped directly from MAIN_MENU to AI_PROCESSING_DONE, skipping required intermediates. Step-by-step assertions prove the exact sequence. This is a B.1.9 collaboration test — the collaboration is between the four transitions, and skipping any one means the workflow is broken.",
    concepts: ["orchestration_testing", "postcondition_reasoning"],
  },
  l3_0: {
    q: "Your test asserts mock_twilio[0].to equals TEST_NUMBER. Why verify the target, not just that Twilio was called?",
    a: "A bug could send the menu to the wrong customer. Verifying length proves Twilio was called. Verifying the to field proves it was called with the correct recipient. In a concurrent system, sending the menu to the wrong number means one customer gets two menus and another gets none.",
    concepts: ["behavioural_assertion", "mock_verification"],
  },
  l3_1: {
    q: "Your seed puts the session at Main Menu. What happens if you forget to seed and the test still passes?",
    a: "If it passes without seeding, the webhook creates a new session on every call. The test is accidentally testing the new-customer scenario, not the button-from-existing-session scenario. The seed is what makes this a different test from scenario 1. Without it, two tests prove the same thing.",
    concepts: ["fixture_strategy", "seed_reasoning"],
  },
  l3_2: {
    q: "You assert current_reference_id startswith sal_. Why not assert the exact ID value?",
    a: "The reference ID contains a random hex suffix from a CAT-4 non-deterministic factory. Asserting an exact value would make the test brittle and non-repeatable. startswith sal_ proves the prefix contract without coupling to the random component. This is a behavioural assertion: assert what matters, ignore what is random.",
    concepts: ["behavioural_assertion", "factory_vs_computation"],
  },
  l3_3: {
    q: "Your test uses mock_claude but only asserts len mock_twilio >= 1. What are you NOT testing, and why is that acceptable at L3?",
    a: "You are not testing that Claude received the correct prompt, that the AI response was parsed correctly, or that parts were extracted. Those are L1 concerns (extract_part_qty_pairs) and L2 concerns. L3 tests the orchestration: does the full pipeline produce a Twilio message? The internal wiring is tested at lower levels.",
    concepts: ["test_level_separation", "orchestration_testing"],
  },
  l3_4: {
    q: "Your test asserts state is unchanged. Why is the absence of a state change the assertion, rather than testing a specific error message?",
    a: "The system does not send an error for unknown input — it re-sends the menu or ignores it. Asserting state unchanged is an absence assertion: the system did NOT crash, did NOT transition to an invalid state, did NOT corrupt the session. This tests resilience, not error handling.",
    concepts: ["absence_assertion", "behavioural_assertion"],
  },
  l3_5: {
    q: "Your test asserts the cooldown key exists in Redis. Why is the cooldown the thing to test, not the message content?",
    a: "The message content is handled by format_all_customer_messages — an L1 concern. At L3 we test the orchestration side effect: did the webhook set the rate-limit key? The cooldown prevents abuse. Testing the cooldown key proves the webhook rate-limiting behaviour.",
    concepts: ["test_level_separation", "behavioural_assertion"],
  },
  l3_6: {
    q: "Your test monkeypatches Claude to raise and asserts state is not AI Processing. What does this NOT prove about error recovery?",
    a: "It proves the FSM is not stuck, but not that the customer received an error message, that the session is usable for the next message, or that the error was logged. A test asserting state != AI Processing would pass if the error handler transitioned to State.ERROR — which due to the tuple bug permanently locks the customer.",
    concepts: ["absence_assertion", "test_limitation"],
  },
  l3_7: {
    q: "This is a TST-5 characterization marked as BUG. What would an idempotent system do differently, and how would your test change?",
    a: "An idempotent system would check the MessageSid against a dedup store before processing. The second POST with the same MessageSid would return 200 but skip all side effects. The test would change from asserting ref_1 != ref_2 (documenting the bug) to asserting ref_1 == ref_2 (documenting correct behaviour). The characterization test becomes a regression test after the fix.",
    concepts: ["characterization_testing", "idempotency"],
  },
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

// ═══════════════════════════════════════════════════════════════════
// PATCHED AnswerField — probe DEFEND supports N attempts
// ═══════════════════════════════════════════════════════════════════

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
    width: "100%", background: confirmed ? "#98c37908" : "#1a1d23",
    border: "1px solid " + (confirmed ? "#98c37944" : "#2d313a"),
    borderRadius: 6, color: "#abb2bf", fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5, padding: "10px 12px", resize: "vertical", outline: "none",
    boxSizing: "border-box", minHeight: multiline ? 100 : undefined,
  };

  const hasSR = typeof window !== "undefined" && navigator.mediaDevices;
  const toggleVoice = async () => {
    if (recording) {
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();
        recRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setRecording(false);
      return;
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
        } catch (e) { /* transcription failed silently */ }
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
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
      // Guard against oversized input from long voice transcriptions
      const trimmedAns = ans.length > 3000 ? ans.slice(0, 3000) + "..." : ans;
      const assessReference = isProbe
        ? `The candidate was asked this follow-up probe after a PARTIAL on the original question.\n\nORIGINAL QUESTION:\n${question || placeholder || id}\n\nMODEL ANSWER:\n${modelAnswer}\n\nPROBE QUESTION:\n${q}\n\nJudge whether the candidate's probe answer demonstrates understanding of the concept in the model answer.`
        : modelAnswer;

      const r = await assessAnswer(assessQuestion, trimmedAns, assessReference);
      const partialKey = "partial_count_" + id;
      const currentCount = checks[partialKey] || 0;

      if (isProbe) {
        // ── PROBE DEFEND ──
        if (r.verdict === "CONFIRMED") {
          // Probe confirmed → promote the whole field to CONFIRMED
          setChecks(p => ({ ...p,
            ["verdict_" + id]: "CONFIRMED",
            ["feedback_" + id]: r.feedback || "",
          }));
        } else {
          // Probe not confirmed → show feedback, evolve probe if examiner gave a new one
          const newProbe = r.probe || null;
          setChecks(p => ({
            ...p,
            ["probe_feedback_" + id]: r.feedback || "Try to be more specific about the underlying concept.",
            // If examiner gave a new probe, use it (evolving question); otherwise keep current
            ["probe_" + id]: newProbe || p["probe_" + id] || probe,
            [partialKey]: (p[partialKey] || 0) + 1,
            // If probe evolved to a new question, clear old answer; otherwise keep it
            ...(newProbe ? { ["answer_probe_" + id]: "" } : {}),
          }));
        }
      } else {
        // ── MAIN DEFEND ──
        if (r.verdict === "NOT_MET" && currentCount < 10) {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: "PARTIAL",
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
            ["probe_feedback_" + id]: "",
            ["answer_probe_" + id]: "",
            [partialKey]: currentCount + 1,
          }));
        } else if (r.verdict === "PARTIAL") {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: r.verdict,
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
            ["probe_feedback_" + id]: "",
            ["answer_probe_" + id]: "",
            [partialKey]: currentCount + 1,
          }));
        } else {
          setChecks(p => ({ ...p,
            ["verdict_" + id]: r.verdict,
            ["feedback_" + id]: r.feedback || "",
            ["probe_" + id]: r.probe || "",
          }));
        }
      }
    } catch (e) {
      if (isProbe) {
        setChecks(p => ({ ...p, ["probe_feedback_" + id]: "Error: " + e.message }));
      } else {
        setChecks(p => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
      }
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
      setProbeRecording(false);
      return;
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
        } catch (e) { /* transcription failed silently */ }
      };
      mr.start();
      probeRecRef.current = mr;
      setProbeRecording(true);
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

  const vc = { CONFIRMED: "#98c379", PARTIAL: "#e5c07b", NOT_MET: "#e06c75", ERROR: "#e06c75" };

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
            <button onClick={toggleVoice} style={{
              background: recording ? "#e06c7522" : "#21252b", border: "1px solid " + (recording ? "#e06c75" : "#3e4451"),
              borderRadius: 4, color: recording ? "#e06c75" : "#636d83", cursor: "pointer", fontSize: 10, padding: "6px 8px",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap",
            }}>{recording ? "■ STOP" : "● REC"}</button>
          )}
          {modelAnswer && !confirmed && (
            <button onClick={() => defend(val)} disabled={assessing || !val.trim()} style={{
              background: assessing ? "#21252b" : "#c678dd18", border: "1px solid #c678dd44", borderRadius: 4,
              color: assessing ? "#636d83" : "#c678dd", cursor: assessing || !val.trim() ? "default" : "pointer",
              fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
              letterSpacing: "0.04em", opacity: !val.trim() ? 0.4 : 1, whiteSpace: "nowrap",
            }}>{assessing ? "..." : "DEFEND"}</button>
          )}
          {confirmed && <span style={{ color: "#98c379", fontSize: 14, textAlign: "center" }}>✓</span>}
        </div>
      </div>

      {verdict && verdict !== "ERROR" && (
        <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 6, background: vc[verdict] + "08", border: "1px solid " + vc[verdict] + "33", borderLeft: "3px solid " + vc[verdict] }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.06em" }}>{verdict}</span>
            {confirmed && <span style={{ color: "#98c379", fontSize: 12 }}>✓</span>}
            {verdict === "PARTIAL" && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#636d83", marginLeft: "auto" }}>
                attempt {partialCount}/10
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6, marginTop: 4 }}>{feedback}</div>
        </div>
      )}
      {verdict === "ERROR" && <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 6, background: "#e06c7508", border: "1px solid #e06c7533", fontSize: 12, color: "#e06c75" }}>{feedback}</div>}

      {verdict === "PARTIAL" && probe && (
        <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, background: "#e5c07b08", border: "1px solid #e5c07b22", borderLeft: "3px solid #e5c07b44" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#e5c07b", fontWeight: 700, letterSpacing: "0.06em" }}>FOLLOW-UP</span>
            <button onClick={speakProbe} style={{
              background: probeSpeaking ? "#e5c07b18" : "#21252b",
              border: "1px solid " + (probeSpeaking ? "#e5c07b" : "#3e4451"),
              borderRadius: 4, color: probeSpeaking ? "#e5c07b" : "#636d83",
              cursor: "pointer", fontSize: 10, padding: "3px 6px",
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
              whiteSpace: "nowrap", marginLeft: "auto",
            }}>{probeSpeaking ? "■" : "▶"}</button>
          </div>
          <div style={{ fontSize: 13, color: "#d7dae0", lineHeight: 1.6, marginBottom: 8, fontStyle: "italic" }}>"{probe}"</div>
          {checks["probe_feedback_" + id] && (
            <div style={{ fontSize: 12, color: "#e5c07b", lineHeight: 1.5, marginBottom: 8, padding: "6px 10px", background: "#e5c07b08", border: "1px solid #e5c07b22", borderRadius: 4 }}>
              {checks["probe_feedback_" + id]}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks(p => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hasSR && (
                <button onClick={toggleProbeVoice} style={{
                  background: probeRecording ? "#e06c7522" : "#21252b", border: "1px solid " + (probeRecording ? "#e06c75" : "#3e4451"),
                  borderRadius: 4, color: probeRecording ? "#e06c75" : "#636d83", cursor: "pointer", fontSize: 10, padding: "6px 8px",
                  fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, whiteSpace: "nowrap",
                }}>{probeRecording ? "■ STOP" : "● REC"}</button>
              )}
              <button onClick={() => defend(probeVal, probe, true)} disabled={assessing || !probeVal.trim()} style={{
                background: "#e5c07b18", border: "1px solid #e5c07b44", borderRadius: 4, color: "#e5c07b",
                cursor: "pointer", fontSize: 10, padding: "6px 8px", fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700, opacity: !probeVal.trim() ? 0.4 : 1, whiteSpace: "nowrap",
              }}>{assessing ? "..." : "DEFEND"}</button>
            </div>
          </div>
        </div>
      )}

      {modelAnswer && (
        <div style={{ marginTop: 4 }}>
          <button onClick={() => setShowModel(!showModel)} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: showModel ? "#56b6c2" : "#3e4451", fontWeight: 600, letterSpacing: "0.05em" }}>{showModel ? "HIDE" : "REVEAL"} MODEL ANSWER</span>
            <span style={{ color: showModel ? "#56b6c2" : "#3e4451", fontSize: 10, transform: showModel ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>{showModel ? "▾" : "▸"}</span>
          </button>
          {showModel && (
            <div style={{ background: "#56b6c206", border: "1px solid #56b6c218", borderLeft: "3px solid #56b6c244", borderRadius: "0 6px 6px 0", padding: "10px 14px", marginTop: 4 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#56b6c266", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>MODEL ANSWER</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8fbcbb", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
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
  const [speaking, setSpeaking] = useState(false);
  const speak = async () => {
    if (speaking) { setSpeaking(false); return; }
    setSpeaking(true);
    await speakText(question);
    setSpeaking(false);
  };
  return (
    <div style={{
      background: "linear-gradient(135deg, #e06c7508, #c678dd08)",
      border: "1px solid #e06c7533", borderRadius: 8, padding: "16px 18px",
      margin: "14px 0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          background: "#e06c7522", color: "#e06c75", padding: "2px 8px",
          borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
        }}>FAANG INTERVIEW</span>
        <button onClick={speak} style={{
          background: speaking ? "#e06c7518" : "#21252b",
          border: "1px solid " + (speaking ? "#e06c75" : "#3e4451"),
          borderRadius: 4, color: speaking ? "#e06c75" : "#636d83",
          cursor: "pointer", fontSize: 10, padding: "3px 6px",
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
          whiteSpace: "nowrap", marginLeft: "auto",
        }}>{speaking ? "■" : "▶"}</button>
      </div>
      <p style={{
        color: "#d7dae0", fontSize: 14, lineHeight: 1.6, margin: 0,
        fontWeight: 500, fontStyle: "italic",
      }}>"{question}"</p>
      {context && (
        <p style={{ color: "#636d83", fontSize: 12.5, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>{context}</p>
      )}
      {hint && (
        <div style={{
          marginTop: 10, padding: "8px 12px", background: "#1a1d23",
          borderRadius: 6, borderLeft: "3px solid #e5c07b",
        }}>
          <span style={{ color: "#e5c07b", fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>HINT: </span>
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
        <span style={{ color: "#636d83", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>— {title}</span>
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

function ConceptPills({ concepts }) {
  if (!concepts || concepts.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
      {concepts.map(cid => {
        const c = CONCEPTS[cid];
        if (!c) return null;
        return (
          <span key={cid} style={{
            background: c.color + "12", border: "1px solid " + c.color + "33",
            borderRadius: 3, padding: "1px 6px", fontSize: 9,
            fontFamily: "'IBM Plex Mono', monospace", color: c.color,
            fontWeight: 600, letterSpacing: "0.03em",
          }}>{c.label}</span>
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
    setSpeaking(true);
    await speakText(exam.q);
    setSpeaking(false);
  };

  return (
    <div style={{
      marginTop: 12, padding: "12px 14px", borderRadius: 6,
      background: "linear-gradient(135deg, #c678dd06, #61afef06)",
      border: "1px solid #c678dd22",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
          color: "#c678dd", fontWeight: 700, letterSpacing: "0.06em",
          background: "#c678dd18", padding: "2px 6px", borderRadius: 3,
          whiteSpace: "nowrap", marginTop: 1,
        }}>EXAMINE</span>
        <div style={{ flex: 1, fontSize: 13, color: "#d7dae0", lineHeight: 1.6, fontStyle: "italic" }}>
          "{exam.q}"
        </div>
        <button onClick={speak} style={{
          background: speaking ? "#c678dd18" : "#21252b",
          border: "1px solid " + (speaking ? "#c678dd" : "#3e4451"),
          borderRadius: 4, color: speaking ? "#c678dd" : "#636d83",
          cursor: "pointer", fontSize: 10, padding: "4px 7px",
          fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
          whiteSpace: "nowrap",
        }}>{speaking ? "■" : "▶"}</button>
      </div>
      <AnswerField
        id={"exam_" + examKey}
        placeholder="Explain your reasoning..."
        checks={checks}
        setChecks={setChecks}
        multiline
        question={exam.q}
        modelAnswer={exam.a}
      />
      <ConceptPills concepts={exam.concepts} />
    </div>
  );
}

function TestCaseData({ cases, title }) {
  if (!cases || cases.length === 0) return null;
  const keys = Object.keys(cases[0]);
  return (
    <div style={{
      background: "#98c37906", border: "1px solid #98c37918",
      borderLeft: "3px solid #98c37944", borderRadius: "0 6px 6px 0",
      padding: "10px 14px", marginTop: 10,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 9,
        color: "#98c37966", fontWeight: 700, letterSpacing: "0.06em",
        marginBottom: 8,
      }}>TEST CASE DATA{title ? ` — ${title}` : ""}</div>
      <table style={{
        width: "100%", borderCollapse: "collapse", fontSize: 11.5,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #98c37933" }}>
            {keys.map(k => (
              <th key={k} style={{
                padding: "4px 8px", textAlign: "left",
                color: "#98c379", fontWeight: 600, fontSize: 10,
                letterSpacing: "0.04em",
              }}>{k.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #1e2228" }}>
              {keys.map(k => (
                <td key={k} style={{
                  padding: "5px 8px", color: "#abb2bf", lineHeight: 1.5,
                  verticalAlign: "top",
                }}>{c[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
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
      // Back up the corrupt blob so it can be recovered manually instead of lost
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
    // Skip the first save — if load failed and state is {}, we must NOT clobber storage
    if (!didMount.current) { didMount.current = true; return; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [checks]);

  const resetProgress = () => {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    setChecks({});
    localStorage.removeItem(STORAGE_KEY);
  };

  const checkCount = useMemo(() => {
    let d = 0;
    const ckeys = Object.keys(checks).filter(k => !k.startsWith("answer_"));
    d = ckeys.filter(k => checks[k] === true).length;
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
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#d7dae0", letterSpacing: "-0.02em" }}>MODULE 01</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#636d83", marginTop: 2, letterSpacing: "0.04em" }}>WEBHOOK MONSTER</div>
          <div style={{ marginTop: 12 }}><ProgressRing total={checkCount.total} done={checkCount.done} /></div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "#636d83", letterSpacing: "0.06em", marginBottom: 6 }}>CONCEPTS</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {Object.entries(CONCEPTS).map(([cid, c]) => {
                const cConfirmed = Object.keys(checks).some(k =>
                  k.startsWith("verdict_exam_") && checks[k] === "CONFIRMED" &&
                  EXAM[k.replace("verdict_exam_", "")]?.concepts?.includes(cid)
                );
                return (
                  <div key={cid} style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: cConfirmed ? c.color : "#1e2228",
                    border: "1px solid " + (cConfirmed ? c.color + "66" : "#2d313a"),
                    transition: "all 0.3s",
                  }} title={c.label + (cConfirmed ? " ✓" : "")} />
                );
              })}
            </div>
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
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: activeSection === s.id ? "#61afef" : "#636d83", minWidth: 16 }}>{s.icon}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: activeSection === s.id ? "#d7dae0" : "#848b98", fontWeight: activeSection === s.id ? 600 : 400 }}>{s.label}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e2228" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#636d83", marginBottom: 8 }}>150 min budget</div>
          <button onClick={resetProgress} style={{
            width: "100%", padding: "6px 0", background: "none",
            border: "1px solid #e06c7533", borderRadius: 4,
            color: "#e06c75", cursor: "pointer", fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
            letterSpacing: "0.04em", transition: "all 0.15s",
          }}>RESET PROGRESS</button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "32px 48px 120px", maxWidth: 860, margin: "0 auto" }}>

        {/* ═══ ORIENTATION ═══ */}
        <div ref={regRef("orientation")}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 800, color: "#d7dae0", letterSpacing: "-0.03em", lineHeight: 1.2 }}>The WhatsApp Webhook Monster</div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#636d83", marginTop: 6, letterSpacing: "0.03em" }}>Discovery, Debugging & Characterization Testing Worksheet</div>

          <div style={{ background: "#e06c750a", border: "1px solid #e06c7522", borderRadius: 8, padding: "16px 18px", marginTop: 20 }}>
            <P style={{ color: "#e06c75", fontWeight: 600, fontSize: 13, margin: "0 0 8px" }}>Why this exists</P>
            <P style={{ margin: 0 }}>
              The WhatsAppFSMProject refactor proved that <strong style={{ color: "#d7dae0" }}>structural correctness ≠ performance</strong>.
              That version compiled cleanly, passed its tests, and ran identically to the monolith — because the tests measured
              wiring (method signatures, call counts, argument shapes), not behaviour. When the structure changed, the tests broke.
            </P>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
            {[
              { n: "1", t: "Defend every classification", d: "Name CAT-x, name the SOLID violation, state what the test proves" },
              { n: "2", t: "Debugger is primary", d: "Most exercises cannot be completed by reading code — observe live state" },
              { n: "3", t: "Behavioural ≠ structural", d: "Behavioural tests survive restructuring. Structural tests break when wiring moves" },
            ].map(({ n, t, d }) => (
              <div key={n} style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 800, color: "#61afef22" }}>{n}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#d7dae0", fontWeight: 600, marginBottom: 4 }}>{t}</div>
                <div style={{ fontSize: 12, color: "#636d83", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: "12px 16px", background: "#e5c07b0a", border: "1px solid #e5c07b22", borderRadius: 8, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#e5c07b" }}>
            WARNING: The system is in production. Do NOT modify <code style={{ background: "#1a1d23", padding: "1px 6px", borderRadius: 3 }}>app/main.py</code> until every test in Part 2 is green.
          </div>
        </div>

        {/* ═══ PRE-PROMPT CHECKLIST ═══ */}
        <div ref={regRef("pre-prompt")}>
          <H2>Pre-Prompt Checklist — DT-METHOD-1</H2>
          <P>Run this before writing any test scaffold. If you cannot answer all three, do not proceed.</P>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#61afef", fontWeight: 700, marginBottom: 10 }}>1. CAT-x CATEGORY</div>
              {Object.entries(CAT_DEFS).map(([k, v]) => (<div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><CatBadge cat={k} /><span style={{ fontSize: 11, color: "#636d83" }}>{v.desc}</span></div>))}
            </div>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", fontWeight: 700, marginBottom: 10 }}>2. OOP / SOLID LABEL</div>
              {Object.entries(SOLID_DEFS).map(([k, v]) => (<div key={k} style={{ marginBottom: 6 }}><SolidBadge label={k} /><span style={{ fontSize: 11, color: "#636d83", marginLeft: 6 }}>{v}</span></div>))}
            </div>
            <div style={{ background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "14px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", fontWeight: 700, marginBottom: 10 }}>3. TEST TEMPLATE</div>
              {Object.entries(TEMPLATES).map(([k, v]) => (<div key={k} style={{ marginBottom: 6 }}><TemplateBadge tmpl={k} /><span style={{ fontSize: 11, color: "#636d83", marginLeft: 6 }}>{v}</span></div>))}
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
          <InterviewDialog question="whatsapp_webhook() is decorated with @app.post('/webhook'). What is its CAT-x category? Name every distinct operation before answering." context="A function that coordinates session retrieval, FSM dispatch, AI processing, and Twilio dispatch is a CAT-6. But a CAT-6 that also performs Redis reads/writes directly, constructs FSM state, and formats Twilio payloads is a SOLID-SRP violation." hint="Count every distinct operation. If it does more than one thing from different categories, name each one separately." />
          <CodeBlock title="grep the body first" code={`grep -n "session_repo\\|fsm\\|client\\.messages\\|process_with_ai\\|icecream\\|ic(" app/main.py | head -40`} />
          <H3>Name the six concerns</H3>
          {[1,2,3,4,5,6].map(n => (<div key={n} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>Distinct operation {n}:</div><AnswerField id={`q1_op${n}`} placeholder={`Concern ${n}...`} checks={checks} setChecks={setChecks} /></div>))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#61afef", marginBottom: 4 }}>CAT-x classification:</div><AnswerField id="q1_cat" placeholder="CAT-?" checks={checks} setChecks={setChecks} /></div>
            <div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>SOLID label:</div><AnswerField id="q1_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} /></div>
          </div>
          <div style={{ marginTop: 12 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>One-sentence summary:</div><AnswerField id="q1_summary" placeholder="What it does..." checks={checks} setChecks={setChecks} /></div>
          <DebuggerExercise title="Q1: Observe the Six Concerns Live">
            <P>Set a breakpoint on the first line of <code style={{ color: "#61afef" }}>whatsapp_webhook</code>:</P>
            <CodeBlock code={`input_data = await get_webhook_input(request)`} lang="python" />
            <P>Send the setup curl. PyCharm halts. Step over (F8) through each distinct operation. <strong style={{ color: "#e5c07b" }}>Do not read ahead. Observe only the Variables panel.</strong></P>
            <StackTrace frames={[{ file: "app/main.py", line: "~L1200", fn: "whatsapp_webhook" },{ file: "app/main.py", line: "~L85", fn: "get_webhook_input" },{ file: "app/redis_helper.py", line: "~L12", fn: "get_session" },{ file: "app/fsm.py", line: "~L45", fn: "WhatsAppFSM.from_dict" },{ file: "app/main.py", line: "~L150", fn: "handle_special_commands" }]} />
            {[{ id: "q1d_input", q: "After get_webhook_input — input_data keys present:" },{ id: "q1d_session", q: "After session_repo.get_session — did it raise ValueError?" },{ id: "q1d_fsm", q: "After WhatsAppFSM.from_dict — fsm.state value:" },{ id: "q1d_special", q: "After handle_special_commands — return value True or False?" },{ id: "q1d_handle", q: "Which handle_* function was last called before return?" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="Observed value..." checks={checks} setChecks={setChecks} /></div>))}
            <InterviewDialog question="A colleague says whatsapp_webhook() is CAT-3 (Command) because it sends a Twilio message. Explain in one sentence why they are wrong." hint="Use the CAT-6 definition: coordinates multiple CAT-x operations. CAT-3 is a single external IO operation." />
            <AnswerField id="q1d_defend" placeholder="They are wrong because..." checks={checks} setChecks={setChecks} multiline />
          </DebuggerExercise>
          <Checkbox id="q1_done" label="Q1 complete — six operations named, CAT-x and SOLID label written, debugger exercise done" checks={checks} setChecks={setChecks} />
        </div>

        {/* ═══ Q2 — Redis Client ═══ */}
        <div ref={regRef("q2")}>{!isSectionUnlocked("q2", checks) && <LockBanner prev="Q1" />}<div style={!isSectionUnlocked("q2", checks) ? lockedStyle : undefined}>
          <H2>Q2 — Synchronous Redis in Async Handler</H2>
          <InterviewDialog question="session_repo.get_session() is called inside an async def handler. Open redis_helper.py and find the Redis client it wraps. What happens to every other coroutine while this call runs?" context="Calling redis.StrictRedis inside async def blocks the event loop entirely. The await keyword only yields to the event loop at actual async suspension points. A synchronous Redis call is not one." />
          <CodeBlock title="Find every Redis client" code={`grep -n "StrictRedis\\|redis\\.Redis\\|redis\\.asyncio" app/redis_helper.py app/main.py app/turbo_diesel_ai.py`} />
          <H3>Redis client inventory</H3>
          {[1,2,3].map(n => (<div key={n} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}><AnswerField id={`q2_file${n}`} placeholder={`File ${n}...`} checks={checks} setChecks={setChecks} /><AnswerField id={`q2_type${n}`} placeholder={`Client type...`} checks={checks} setChecks={setChecks} /></div>))}
          <div style={{ marginTop: 12 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>SOLID label for three separate clients targeting the same keyspace:</div><AnswerField id="q2_solid" placeholder="SOLID-?" checks={checks} setChecks={setChecks} /></div>
          <InterviewDialog question="If two customers message simultaneously and Customer A's handler is executing redis_client.get() synchronously, what happens to Customer B's request?" hint="Use the event loop model — not intuition. asyncio runs one coroutine at a time. Synchronous calls don't yield." />
          <AnswerField id="q2_blocking" placeholder="Customer B experiences..." checks={checks} setChecks={setChecks} multiline />
          <div style={{ marginTop: 12 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", marginBottom: 4 }}>Exact import path for the fix:</div><AnswerField id="q2_fix" placeholder="redis.asyncio.Redis or..." checks={checks} setChecks={setChecks} /></div>
          <DebuggerExercise title="Q2: Confirm the Synchronous Client">
            <P>Set a breakpoint in <code style={{ color: "#61afef" }}>session_repo.get_session()</code> on the first Redis call. Send the setup curl.</P>
            <P><strong style={{ color: "#e5c07b" }}>Evaluate Expression</strong> (Alt+F8):</P>
            <CodeBlock code={`type(redis_client)\nimport inspect\ninspect.iscoroutinefunction(redis_client.get)`} lang="python" />
            <P>While paused, send a second curl from a different number:</P>
            <CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447711111111" \\\n  -d "Body=hello" \\\n  -d "MessageSid=SM_CONCURRENT_001"`} />
            {[{ id: "q2d_type", q: "type(redis_client) result:" },{ id: "q2d_iscoro", q: "inspect.iscoroutinefunction(redis_client.get) result:" },{ id: "q2d_blocked", q: "Did the second curl respond before you pressed F9? Yes / No" },{ id: "q2d_label", q: "Guide label for this violation:" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          </DebuggerExercise>
          <Checkbox id="q2_done" label="Q2 complete — three Redis clients found, concurrent curl observed, CONC-3 confirmed" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ Q3 — .keys() ═══ */}
        <div ref={regRef("q3")}>{!isSectionUnlocked("q3", checks) && <LockBanner prev="Q2" />}<div style={!isSectionUnlocked("q3", checks) ? lockedStyle : undefined}>
          <H2>Q3 — The <code style={{ color: "#e06c75" }}>.keys()</code> Time Bomb</H2>
          <InterviewDialog question="Find every .keys() call in the live codebase. At what key count does this become a production incident?" context="redis.StrictRedis.keys(pattern) performs an O(N) full-keyspace scan and blocks the Redis event loop until it completes. It is a CAT-1 Query that behaves like a CAT-3 Command under load." hint="This is a DT-METHOD-1 category mismatch — the function's category changes under load." />
          <CodeBlock title="Find all .keys() and scan_iter usage" code={`grep -n "\\.keys(" app/main.py app/redis_helper.py app/turbo_diesel_ai.py\ngrep -n "scan_iter" app/main.py app/redis_helper.py app/turbo_diesel_ai.py`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            {[{ id: "q3_keys_total", q: "Total .keys( calls in live code:" },{ id: "q3_keys_async", q: "Calls inside async def functions:" },{ id: "q3_scaniter", q: "Occurrences of scan_iter:" },{ id: "q3_customer", q: "Customer experience during .keys() with 50k keys:" }].map(({ id, q }) => (<div key={id}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          </div>
          <InterviewDialog question="What is the O() complexity of scan_iter vs keys()? Which guide label describes the violation and why does the category label matter for choosing the test template?" />
          <AnswerField id="q3_defend" placeholder="Defend your classification..." checks={checks} setChecks={setChecks} multiline />
          <Checkbox id="q3_done" label="Q3 complete — all .keys() calls counted, scan_iter occurrences confirmed" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ Q4 — Decorator ═══ */}
        <div ref={regRef("q4")}>{!isSectionUnlocked("q4", checks) && <LockBanner prev="Q3" />}<div style={!isSectionUnlocked("q4", checks) ? lockedStyle : undefined}>
          <H2>Q4 — <code style={{ color: "#c678dd" }}>@handle_whatsapp_errors</code> Layer Collapse</H2>
          <InterviewDialog question="The decorator finds the Request object by scanning *args. Name two failure modes, then explain which SOLID principle is violated when this decorator is applied to an internal domain method." context="handle_whatsapp_errors is an HTTP-layer decorator — it belongs only on CAT-6 Orchestration endpoints. Applying it to validate_state collapses two layers that must stay separate." />
          <CodeBlock title="Find all usages" code={`grep -rn "@handle_whatsapp_errors" app/`} />
          <CodeBlock title="The problematic pattern" lang="python" code={`request = next(arg for arg in args if isinstance(arg, Request))`} />
          {[{ id: "q4_nonendpoint", q: "Does @handle_whatsapp_errors appear on any non-endpoint function? Paste grep result:" },{ id: "q4_fail1", q: "Failure mode 1 (keyword arg):" },{ id: "q4_fail2", q: "Failure mode 2 (exception before form_data parsed):" },{ id: "q4_oop", q: "OOP label for the layer collapse:" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          <InterviewDialog question="Applying this decorator to validate_state means the decorator reaches across a layer boundary it should never cross. Which SOLID principle is violated and why?" hint="What does the decorator depend on that validate_state should never know about?" />
          <AnswerField id="q4_defend" placeholder="SOLID principle and why..." checks={checks} setChecks={setChecks} multiline />
          <DebuggerExercise title="Q4: Trigger the Decorator's Error Path">
            <P>Temporarily add as the <strong style={{ color: "#e5c07b" }}>first line</strong> of <code style={{ color: "#61afef" }}>whatsapp_webhook</code>:</P>
            <CodeBlock lang="python" code={`raise WhatsAppException("debug test", status_code=400)`} />
            <P>Set a breakpoint inside the <code style={{ color: "#61afef" }}>except WhatsAppException</code> block in the decorator. Restart the debugger. Send the setup curl.</P>
            {[{ id: "q4d_from", q: "from_number value in the except block:" },{ id: "q4d_twilio", q: "Does client.messages.create() succeed or raise?" },{ id: "q4d_status", q: "What HTTP status code does Twilio receive?" },{ id: "q4d_retry", q: "What does Twilio do when it receives a non-200 from a webhook?" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
            <div style={{ background: "#e06c750d", border: "1px solid #e06c7522", borderRadius: 6, padding: "10px 14px", marginTop: 10 }}><span style={{ color: "#e06c75", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>REMOVE the temporary raise before proceeding.</span></div>
          </DebuggerExercise>
          <Checkbox id="q4_done" label="Q4 complete — grep run, error path triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ Q5 — State.ERROR ═══ */}
        <div ref={regRef("q5")}>{!isSectionUnlocked("q5", checks) && <LockBanner prev="Q4" />}<div style={!isSectionUnlocked("q5", checks) ? lockedStyle : undefined}>
          <H2>Q5 — <code style={{ color: "#e06c75" }}>State.ERROR</code> Tuple Bug</H2>
          <div style={{ background: "#e06c750d", border: "1px solid #e06c7533", borderRadius: 8, padding: "16px 18px", margin: "14px 0" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#e06c75", fontWeight: 700, marginBottom: 8 }}>CRITICAL — LIVE PRODUCTION BUG</div>
            <P style={{ margin: 0 }}>The trailing comma makes the value a <code style={{ color: "#e5c07b" }}>tuple</code>. <code style={{ color: "#c678dd" }}>State.ERROR.value</code> returns <code style={{ color: "#d19a66" }}>('Error',)</code>, not <code style={{ color: "#98c379" }}>'Error'</code>. Any customer whose session lands in <code style={{ color: "#e06c75" }}>State.ERROR</code> is <strong style={{ color: "#d7dae0" }}>permanently stuck</strong>.</P>
          </div>
          <CodeBlock title="The bug" lang="python" code={`ERROR = ("Error",)    # ← trailing comma = tuple\n# State.ERROR.value → ("Error",) not "Error"\n# State("Error") → ValueError (no member matches)`} />
          <StackTrace frames={[{ file: "app/main.py", line: "~L1250", fn: "process_with_ai" },{ file: "app/fsm.py", line: "~L78", fn: "transition_to(State.ERROR)" },{ file: "app/redis_helper.py", line: "~L35", fn: "save_session → to_dict()" },{ file: "app/fsm.py", line: "~L22", fn: "from_dict → State('Error') → CRASH" }]} />
          {[{ id: "q5_value", q: "State.ERROR.value — what does it return?" },{ id: "q5_raises", q: 'State("Error") — what does it raise and why?' },{ id: "q5_redis", q: 'What gets written to Redis "state" field after transition_to(State.ERROR)?' },{ id: "q5_crash", q: "Where exactly does from_dict() crash on next message?" },{ id: "q5_recoverable", q: "Is the customer recoverable without manual Redis intervention?" },{ id: "q5_fix", q: "One-character fix:" },{ id: "q5_label", q: "Guide label — ERR-x, FT-x, or SOLID? Justify:" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          <DebuggerExercise title="Q5: Lock a Customer in the Error State">
            <P>Temporarily add to the first line of <code style={{ color: "#61afef" }}>process_with_ai()</code>:</P>
            <CodeBlock lang="python" code={`raise Exception("simulated error")`} />
            <P>Navigate to <code style={{ color: "#61afef" }}>new_inquiry</code> state (hello → sales → new inquiry), then send <code style={{ color: "#d19a66" }}>I need 3 x 452-0427</code>.</P>
            <CodeBlock code={`redis-cli get "whatsapp:+447700000000"`} />
            {[{ id: "q5d_field", q: "fsm_state.state field written to Redis (exact value):" },{ id: "q5d_crash", q: "Send another hello — does from_dict crash? Exception and line:" },{ id: "q5d_stuck", q: "Is the customer permanently stuck?" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
            <div style={{ background: "#e06c750d", border: "1px solid #e06c7522", borderRadius: 6, padding: "10px 14px", marginTop: 10 }}><span style={{ color: "#e06c75", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>REMOVE the temporary raise before proceeding.</span></div>
          </DebuggerExercise>
          <Checkbox id="q5_done" label="Q5 complete — tuple confirmed, from_dict crash triggered, temporary raise removed" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ Q6 — Observations ═══ */}
        <div ref={regRef("q6")}>{!isSectionUnlocked("q6", checks) && <LockBanner prev="Q5" />}<div style={!isSectionUnlocked("q6", checks) ? lockedStyle : undefined}>
          <H2>Q6 — Observe Before You Assert</H2>
          <P>Run every curl in sequence. Read Redis after each one. These observations become your test assertions.</P>
          {[{ id: "SM001", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=hello" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM001"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM001 — brand new customer" },{ id: "SM002", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=salesid1" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM002"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM002 — Sales Inquiries button" },{ id: "SM003", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"current_reference_id"\\|"state"'`, label: "SM003 — New Sales Inquiry button" },{ id: "SM004", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=I need 3 x 452-0427" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM004"`, check: `redis-cli get "whatsapp:+447700000000" | python3 -m json.tool | grep '"state"'`, label: "SM004 — parts inquiry (Claude fires)" },{ id: "SM005", cmd: `curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=this is not a valid command" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM005"`, check: null, label: "SM005 — unknown text" }].map(({ id, cmd, check, label }) => (
            <Collapsible key={id} title={label} accent="#56b6c2" icon="▸">
              <CodeBlock title={`Send ${id}`} code={cmd} />
              {check && <CodeBlock title="Check Redis" code={check} />}
              <div style={{ marginTop: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2", marginBottom: 4 }}>After {id} — fsm_state.state and observations:</div><AnswerField id={`q6_${id}`} placeholder={`State after ${id}...`} checks={checks} setChecks={setChecks} /></div>
              <Checkbox id={`q6_${id}_done`} label={`${id} run and recorded`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
          <H3>Record unexpected behaviour</H3>
          <AnswerField id="q6_unexpected" placeholder="One thing you did not expect..." checks={checks} setChecks={setChecks} multiline />
          <InterviewDialog question="SM005 behaves differently depending on whether SM003 already ran. Name the guide pattern that describes this behaviour." hint="PAT-x — the same input producing different outputs depending on state." />
          <AnswerField id="q6_defend" placeholder="Pattern label and explanation..." checks={checks} setChecks={setChecks} multiline />
          <DebuggerExercise title="Q6: The Four Concern Breakpoints">
            <P>Set breakpoints at <strong style={{ color: "#d7dae0" }}>all four simultaneously</strong>:</P>
            <CodeBlock lang="python" title="Four concerns to observe" code={`# CONCERN 1 — Session load\nuser_session = session_repo.get_session(input_data["from_number"])\n\n# CONCERN 2 — FSM transition\nfsm.transition_to(State.SALES_INQUIRIES)\n\n# CONCERN 3 — AI call\nmessage = anthropic_client.messages.create(...)\n\n# CONCERN 4 — Twilio dispatch\nclient.messages.create(from_=f"whatsapp:{TWILIO_PHONE_NUMBER}", ...)`} />
            {[{ id: "q6d_c1", q: "At Concern 1 — fsm.state and inquiry_in_progress:" },{ id: "q6d_c2_before", q: "At Concern 2 — fsm.state BEFORE transition:" },{ id: "q6d_c2_after", q: "At Concern 2 — fsm.state AFTER transition:" },{ id: "q6d_c2_redis", q: "Is Redis updated yet at Concern 2? Why not?" },{ id: "q6d_c3", q: "At Concern 3 — how many ic() calls fire before anthropic_client?" },{ id: "q6d_c4", q: "At Concern 4 — is current_reference_id non-null?" },{ id: "q6d_rw", q: "Which concern reads from Redis? Which writes? How many write calls total?" },{ id: "q6d_both", q: "Is there a concern that both reads AND writes? SOLID label:" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e5c07b", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          </DebuggerExercise>
          <Checkbox id="q6_done" label="Q6 complete — all five curls run, Redis recorded, four-concern breakpoints set" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ Q7 — Production Failure ═══ */}
        <div ref={regRef("q7")}>{!isSectionUnlocked("q7", checks) && <LockBanner prev="Q6" />}<div style={!isSectionUnlocked("q7", checks) ? lockedStyle : undefined}>
          <H2>Q7 — Single Biggest Production Concern</H2>
          <InterviewDialog question="What is your single biggest production concern? Classify → blast radius → detection signal → fix pattern." context="The previous refactor fixed the architecture but not this concern. Explain why structural correctness alone does not resolve it." />
          {[{ id: "q7_scenario", q: "Scenario:" },{ id: "q7_impact", q: "Impact (how many customers, what they experience):" },{ id: "q7_detection", q: "Detection signal in current logs (given only print() and ic()):" },{ id: "q7_fix", q: "Fix pattern (guide label):" }].map(({ id, q }) => (<div key={id} style={{ marginBottom: 8 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83", marginBottom: 4 }}>{q}</div><AnswerField id={id} placeholder="..." checks={checks} setChecks={setChecks} /></div>))}
          <div style={{ marginTop: 12 }}><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#e06c75", marginBottom: 4 }}>DEFEND YOUR CHOICE:</div><AnswerField id="q7_defend" placeholder="Why structural correctness alone doesn't fix this..." checks={checks} setChecks={setChecks} multiline /></div>
          <DebuggerExercise title="Q7: Trigger Your Chosen Failure Mode">
            <P>Choose one scenario and trigger it in the debugger. Document what you observe.</P>
            <Collapsible title="If: Synchronous Redis blocking" accent="#e5c07b"><P>Set a breakpoint on <code style={{ color: "#61afef" }}>session_repo.get_session(...)</code>. Send a message. While paused, send a second curl from a different number.</P><AnswerField id="q7d_redis" placeholder="Did the second request respond before F9? What the customer experiences..." checks={checks} setChecks={setChecks} multiline /></Collapsible>
            <Collapsible title="If: State.ERROR bug" accent="#e5c07b"><P>Use the Q5 debugger exercise. Document the Redis state after the bug fires.</P><AnswerField id="q7d_error" placeholder="Redis state after bug, customer stuck..." checks={checks} setChecks={setChecks} multiline /></Collapsible>
            <Collapsible title="If: No idempotency on Twilio retries" accent="#e5c07b"><P>Re-run SM003 curl twice with identical data:</P><CodeBlock code={`curl -X POST http://localhost:8000/webhook \\\n  -d "From=whatsapp:+447700000000" \\\n  -d "Body=new_inquiry" \\\n  -d "ProfileName=Test User" \\\n  -d "MessageSid=SM003"`} /><AnswerField id="q7d_idempotent" placeholder="Does reference_id change? Second interaction node?" checks={checks} setChecks={setChecks} multiline /></Collapsible>
          </DebuggerExercise>
          <Checkbox id="q7_done" label="Q7 complete — chosen failure mode triggered, temporary code removed" checks={checks} setChecks={setChecks} />
        </div></div>

        {/* ═══ FAILURE MATRIX ═══ */}
        <div ref={regRef("failure-matrix")}>
          <H2>Production Failure Matrix</H2>
          <P>Classify each scenario. The fix pattern is given — your job is to explain what happens without it.</P>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead><tr style={{ borderBottom: "2px solid #2d313a" }}>{["Scenario", "Fix Pattern", "FSM Corrupted?", "Recoverable?"].map(h => (<th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#636d83", fontWeight: 600, fontSize: 11 }}>{h}</th>))}</tr></thead>
              <tbody>{FAILURE_SCENARIOS.map((f, i) => (<tr key={i} style={{ borderBottom: "1px solid #1e2228" }}><td style={{ padding: "10px 12px", color: "#d7dae0", maxWidth: 280 }}>{f.scenario}</td><td style={{ padding: "10px 12px" }}><SolidBadge label={f.fix} /></td><td style={{ padding: "10px 12px", color: f.corrupt === "?" ? "#e5c07b" : "#abb2bf" }}>{f.corrupt}</td><td style={{ padding: "10px 12px", color: f.recoverable === "No" ? "#e06c75" : f.recoverable === "?" ? "#e5c07b" : "#98c379" }}>{f.recoverable}</td></tr>))}</tbody>
            </table>
          </div>
        </div>

        {/* ═══ TESTS LEVEL 1 ═══ */}
        <div ref={regRef("tests-l1")}>
          <H2>Part 2 — Level 1: Pure Functions</H2>
          <P>These functions are in <code style={{ color: "#61afef" }}>app/main.py</code> today. Test them here. When the refactor moves them, the tests travel unchanged.</P>
          <div style={{ background: "#98c3790a", border: "1px solid #98c37922", borderRadius: 8, padding: "12px 16px", margin: "14px 0" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#98c379", fontWeight: 700 }}>RULE: </span>
            <span style={{ fontSize: 13, color: "#abb2bf" }}>Test current behaviour — not ideal behaviour. If the system does something wrong but consistently, that is your assertion. No <code style={{ color: "#e06c75" }}>assert_called_with</code>. No <code style={{ color: "#e06c75" }}>call_count</code>.</span>
          </div>
          <CodeBlock title="Pre-Prompt Gate — write this at the top of every test" lang="python" code={`# CAT-x:     (e.g., CAT-8 Computation)\n# OOP/SOLID: (e.g., SOLID-SRP violation — function does both computation and formatting)\n# Template:  (e.g., A.1 Pure Function)`} />
          {PURE_FUNCTIONS.map((f, i) => (
            <Collapsible key={i} title={f.fn} accent={CAT_DEFS[f.cat]?.color || "#61afef"} icon="fn">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}><CatBadge cat={f.cat} /><TemplateBadge tmpl={f.template} /></div>
              <div style={{ fontSize: 12.5, color: "#abb2bf", lineHeight: 1.6 }}><strong style={{ color: "#d7dae0" }}>Edge cases: </strong>{f.edges}</div>
              {f.pseudo && <CodeBlock title={`${f.template} Template — ${f.fn}`} lang="python" code={f.pseudo} />}
              {f.cases && <TestCaseData title={f.fn} cases={f.cases} />}
              <ExamSection examKey={`l1_${f.fn}`} checks={checks} setChecks={setChecks} />
              <div style={{ marginTop: 10 }}><Checkbox id={`l1_${f.fn}`} label={`${f.fn} — tests written with edge cases`} checks={checks} setChecks={setChecks} /></div>
            </Collapsible>
          ))}
        </div>

        {/* ═══ TESTS LEVEL 2 ═══ */}
        <div ref={regRef("tests-l2")}>
          <H2>Part 2 — Level 2: FSM State Transitions</H2>
          <P>Test <code style={{ color: "#61afef" }}>WhatsAppFSM</code> from <code style={{ color: "#61afef" }}>app/fsm.py</code> directly. No HTTP. No Redis. No Twilio.</P>
          {FSM_TESTS.map((t, i) => (
            <Collapsible key={i} title={t.test} accent="#c678dd" icon={t.label === "BUG" ? "!" : "▸"}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}><TemplateBadge tmpl={t.template} /><SolidBadge label={t.label} /></div>
              <div style={{ fontSize: 12, color: "#636d83", lineHeight: 1.5, marginBottom: 8 }}>{t.assertion}</div>
              {t.pseudo && <CodeBlock title={`${t.template} Template`} lang="python" code={t.pseudo} />}
              {t.cases && <TestCaseData title={t.test} cases={t.cases} />}
              <ExamSection examKey={`l2_${i}`} checks={checks} setChecks={setChecks} />
              <Checkbox id={`l2_${i}`} label={`${t.test} — test written`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
        </div>

        {/* ═══ TESTS LEVEL 3 ═══ */}
        <div ref={regRef("tests-l3")}>
          <H2>Part 2 — Level 3: Webhook Behaviour</H2>
          <P>Functional tests that hit the webhook endpoint. Assert from the outside.</P>
          <Collapsible title="conftest.py — fixtures" accent="#c678dd" defaultOpen={false}>
            <CodeBlock title="tests/functional/conftest.py" lang="python" code={`import json\nimport pytest\nimport redis\nfrom fastapi.testclient import TestClient\nfrom app.main import app, session_repo, initialize_user_session\n\nTEST_NUMBER = "whatsapp:+447700000000"\n_redis = redis.StrictRedis(host="localhost", port=6379, db=0, decode_responses=True)\n\n@pytest.fixture(autouse=True)\ndef clean_redis():\n    _redis.delete(TEST_NUMBER)\n    yield\n    _redis.delete(TEST_NUMBER)\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n@pytest.fixture\ndef mock_twilio(monkeypatch):\n    sent = []\n    def fake_create(**kwargs):\n        sent.append(kwargs)\n        return type("Msg", (), {"sid": "SM_test_001"})()\n    monkeypatch.setattr("app.main.client.messages.create", fake_create)\n    return sent\n\n@pytest.fixture\ndef mock_claude(monkeypatch):\n    monkeypatch.setattr(\n        "app.main.anthropic_client.messages.create",\n        lambda **kwargs: type("Resp", (), {\n            "content": [type("C", (), {\n                "text": "<response>3 x 452-0427 confirmed.</response>"\n            })()]\n        })()\n    )`} />
          </Collapsible>
          <div style={{ background: "#56b6c20a", border: "1px solid #56b6c222", borderRadius: 8, padding: "12px 16px", margin: "14px 0" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2", fontWeight: 700 }}>ASSERT IN EVERY WEBHOOK TEST: </span>
            <span style={{ fontSize: 12.5, color: "#abb2bf" }}>response.status_code == 200 · Redis parseable after every call · mock_twilio count + to field verified · <strong style={{ color: "#d7dae0" }}>assert the absence</strong> when no message should fire</span>
          </div>
          {WEBHOOK_SCENARIOS.map((s, i) => (
            <Collapsible key={i} title={s.scenario} accent="#56b6c2" icon="▸">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ background: "#21252b", padding: "2px 8px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#636d83" }}>seed: {s.seed}</span>
                <span style={{ background: "#21252b", padding: "2px 8px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#56b6c2" }}>{s.input}</span>
                <TemplateBadge tmpl="B.1.9" />
              </div>
              <div style={{ fontSize: 12, color: "#abb2bf", lineHeight: 1.6, marginBottom: 8 }}>{s.assertions}</div>
              {s.pseudo && <CodeBlock title="B.1.9 Template" lang="python" code={s.pseudo} />}
              {s.cases && <TestCaseData title={s.scenario} cases={s.cases} />}
              <ExamSection examKey={`l3_${i}`} checks={checks} setChecks={setChecks} />
              <Checkbox id={`l3_${i}`} label={`${s.scenario} — test written`} checks={checks} setChecks={setChecks} />
            </Collapsible>
          ))}
          <TemplateBadge tmpl="B.1.9" /><span style={{ fontSize: 12, color: "#636d83", marginLeft: 8 }}>All scenarios use the Orchestration template</span>
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

          <div style={{ marginTop: 32, background: "#141820", border: "1px solid #2d313a", borderRadius: 8, padding: "20px 24px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#d7dae0", marginBottom: 16 }}>Key Takeaways</div>
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
                <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, minWidth: 16, color: t.icon === "!" ? "#e06c75" : "#636d83" }}>{t.icon}</span>
                <span style={{ fontSize: 13, color: "#abb2bf", lineHeight: 1.6 }}>{t.text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, background: "#61afef08", border: "1px solid #61afef22", borderRadius: 8, padding: "20px 24px" }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 17, fontWeight: 700, color: "#61afef", marginBottom: 12 }}>What's Next → Module 02: Extraction Strategy</div>
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