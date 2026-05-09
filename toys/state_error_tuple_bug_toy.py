# ═════════════════════════════════════════════════════════════════════════
# TOY — state_error_tuple_bug_toy.py
# Demonstrates:
#   FM-1 — trailing comma turns a string into a tuple. State.ERROR.value
#          returns ('Error',), not 'Error'. Quiet, only visible if you
#          inspect .value or compare to the string.
#   FM-2 — State("Error") raises ValueError. The reverse-lookup that
#          every from_dict() relies on is broken for ERROR, and ONLY
#          for ERROR. Every other member round-trips fine.
#   FM-3 — JSON serialisation of the tuple becomes a JSON array.
#          to_dict() writes ["Error"] to Redis. from_dict() reads it
#          back as a Python list. State(["Error"]) raises ValueError.
#   + the downstream production harms:
#     – customer permanently locked out: every subsequent message
#       crashes at from_dict() with HTTP 500
#     – noisy hard failure (unlike Q6's silent soft-failure) — but the
#       on-call engineer Googles the ValueError and lands on
#       Enum-lookup explainers, not on a one-character bug
#     – manual Redis surgery per stuck customer
#     – the bug survives every refactor that doesn't test .value
#       directly. Two prior refactors carried it forward unchanged.
#
# Plain script. Run or debug directly — no pytest, no Redis, no FastAPI.
#   $ python state_error_tuple_bug_toy.py
#   PyCharm: right-click → Run / Debug
# ═════════════════════════════════════════════════════════════════════════
#
# ── WHAT YOU LEARN BY JUST RUNNING IT ──────────────────────────────────
#
# Eight demos walk from the language-level cause (one trailing comma)
# down to the production symptom (locked-out customer). The FakeRedis
# records every set() so you can SEE the JSON array land in storage —
# not just read about it.
#
# Expected output shape (excerpt):
#
#   ── PASS 1: prove the type asymmetry ──────────────────────
#     State.NEW_INQUIRY.value:  type=str    repr='New_Inquiry'
#     State.SALES.value:        type=str    repr='Sales'
#     State.ERROR.value:        type=tuple  repr=('Error',)
#     ↑ ONE of these is not like the others. Find the trailing comma.
#
#   ── PASS 4: write ERROR to Redis — see what lands in the blob ─
#     to_dict() output:  {'state': ('Error',), 'history': []}
#     JSON serialised:   '{"state": ["Error"], "history": []}'
#     ↑ tuple becomes JSON array. Once persisted, this is unrecoverable
#     from Python's side without surgery.
#
#   ── PASS 5: read ERROR back — from_dict crashes ───────────
#     ✗ ValueError: ['Error'] is not a valid State
#     Frame: from_dict → State(state_value)  (state_value is a list)
#
#   ── PASS 6: customer lockout — 5 inbound messages all crash ─
#     msg 1: ✗ ValueError
#     msg 2: ✗ ValueError
#     msg 3: ✗ ValueError
#     msg 4: ✗ ValueError
#     msg 5: ✗ ValueError
#     Customer received 5 × HTTP 500 for 5 × hello.
#
# ── TRAILING COMMA NOTE ─────────────────────────────────────────────────
# In Python, ("Error",) is a single-element tuple; ("Error") is just
# the string in parens. The trailing comma is what makes the difference.
# Auto-formatters and linters do NOT flag this — both forms are
# syntactically valid, and the author's intent is genuinely ambiguous
# from one line of code. Type checkers (mypy, pyright) would catch it
# IF the Enum declaration had explicit type annotations on the values,
# which it almost never does. The bug is invisible at the IDE level.
#
# ── COMPARISON WITH Q6 ──────────────────────────────────────────────────
# Q5 (this toy) is a HARD failure: every locked-out message crashes
# at from_dict() with HTTP 500. Q6 (AI_PROCESSING lockout) is a SOFT
# failure: locked-out messages return HTTP 200 with a polite "still
# processing" lie. Q5 surfaces in error dashboards immediately. Q6
# is silent and only visible via session-age metrics. Q5 is operationally
# easier to detect; Q6 is operationally easier to ignore.
#
# ═════════════════════════════════════════════════════════════════════════
# DEBUGGER GUIDE (optional — only for seeing the masking in the stack)
# ═════════════════════════════════════════════════════════════════════════
#
# Notation:
#   🔴 BP-n     Gutter breakpoint.
#   Wn         Watch expression.
#   ⛔ XB-n     Exception Breakpoint. IMPORTANT: tick "Ignore library
#              files" or you'll pause inside enum.py on every member
#              construction at module import.
#
# Watches (add once, use across passes):
#   W1  type(State.ERROR.value).__name__
#   W2  State.ERROR.value
#   W3  state_value
#   W4  type(state_value).__name__
#
# Exception breakpoints to configure once:
#   ⛔ XB-1  ValueError   On raise, Ignore library files
#
# Passes (enable only the listed breakpoints per pass):
#
# PASS 2 — reverse-lookup ValueError:
#   BPs: XB-1
#   The first time XB-1 fires is inside enum.py during State("Error").
#   Frame stack ends at demo_reverse_lookup. Variables panel shows
#   the lookup value 'Error' arrived as a string but no member's
#   .value matches — because State.ERROR.value is the tuple ('Error',).
#   F9 to continue. The next XB-1 firing is the State(('Error',))
#   path that DOES succeed — exception breakpoint pauses on raise
#   inside the lookup loop, but the constructor catches it and
#   continues to find the matching member.
#
# PASS 5 — from_dict crashes:
#   BPs: BP-1, XB-1
#   At BP-1 (inside from_dict), inspect W3 = state_value. It is a
#   LIST ['Error'], not a string. F8 step over the State() call
#   triggers XB-1. Frame stack:
#     from_dict       ← our code, line 1 of the call
#     __new__         ← enum.py, lookup machinery
#     <listcomp>      ← enum.py, scanning members for match
#   __exception__.__context__ is None — the bug masks nothing here
#   because there's no prior exception. The crash is direct.
#
# PASS 6 — every inbound crashes the same way:
#   BPs: XB-1, hit-count = ignore first 0 (so it pauses every time)
#   Send 5 messages. XB-1 fires 5 times at the same line of from_dict.
#   Same stack every time. The bug has no recovery path.
#
# ── GREP AUDIT ─────────────────────────────────────────────────────────
#   $ grep -n "= (\"" state_error_tuple_bug_toy.py
#   One hit on the buggy enum line. Any tuple-valued enum member is
#   suspect. Real-world variant:
#   $ grep -nE "= \(.*,\s*\)$" app/fsm.py
#   Catches single-element tuples on RHS of assignment. Add to CI.
#
# ═════════════════════════════════════════════════════════════════════════

# ═════════════════════════════════════════════════════════════════════════
# GLOSSARY — every moving part, one entry each.
# Shape: name · signature · one-sentence behaviour · the gotcha.
# ═════════════════════════════════════════════════════════════════════════
#
# ── Python language features ───────────────────────────────────────────
#
# (x,)         — single-element tuple literal
#                The trailing comma is what makes this a tuple. Without
#                it, the parens are grouping, not tuple construction.
#                Gotcha: ("Error") is the string "Error". ("Error",) is
#                the tuple containing that string. Whole bug lives here.
#
# (x)          — parenthesised expression, NOT a tuple
#                Just syntactic grouping. Type is whatever x is.
#                Gotcha: easy to write ("Error") thinking it's a tuple.
#                It isn't. The Enum library happily accepts either —
#                producing very different members.
#
# Enum         — class C(Enum): MEMBER = value
#                Each member has a .name (str) and .value (any).
#                Gotcha: .value's type is whatever you wrote on the RHS.
#                There is no implicit string conversion. ERROR = ("Error",)
#                gives a member whose .value is a tuple.
#
# (str, Enum)  — Enum subclass mixed with str
#                Members behave as both Enum members AND strings. .value
#                IS the string. JSON serialises directly without .value.
#                Gotcha: this toy uses PLAIN Enum to keep the bug pure.
#                Real-world WhatsAppFSMProject uses (str, Enum) — same
#                bug appears, slightly different masking. With (str, Enum)
#                the trailing-comma tuple rejects str-mixin entirely
#                and you get a TypeError at class definition, not a
#                silent corruption. Plain Enum is the worst case.
#
# Enum(value)  — reverse lookup: find member by .value
#                Class-call syntax. Returns the matching member or
#                raises ValueError if no member matches.
#                Gotcha: comparison is == against each member's .value.
#                State("Error") fails because no member's .value equals
#                the string "Error" — ERROR's value is ('Error',).
#
# json.dumps   — (obj) -> str
#                Serialises Python objects to JSON. tuple → JSON array.
#                set → TypeError. None → null.
#                Gotcha: tuples and lists serialise IDENTICALLY to JSON.
#                There is no way to recover the original type on read.
#                ('Error',) and ['Error'] both become ["Error"] on the wire.
#
# json.loads   — (str) -> obj
#                Deserialises. JSON array → Python list (always).
#                Gotcha: even if the producer wrote a tuple, the
#                consumer reads a list. State(['Error']) raises
#                because lists are unhashable AND no member matches.
#
# ValueError   — raised by Enum reverse-lookup on no match
#                Standard exception. Message includes the offending
#                value: "['Error'] is not a valid State".
#                Gotcha: the message points at the symptom, not the
#                cause. The cause is one trailing comma in the enum
#                definition, hundreds of lines away.
#
# ── Objects in this toy ────────────────────────────────────────────────
#
# State              — Enum: NEW_INQUIRY | SALES | NEW_INQUIRY | ERROR
#                      ERROR = ("Error",) is THE BUG. Every other member
#                      uses a bare string and round-trips fine.
#                      Gotcha: the asymmetry is the diagnostic. Any
#                      test that round-trips ALL members would catch this.
#                      Tests that only round-trip the happy-path members
#                      let it through. Both prior refactors did exactly that.
#
# State_v2           — Enum: same members, ERROR = "Error" (no comma)
#                      The one-character fix. Demonstrated in PASS 8.
#                      Gotcha: changing this in production requires
#                      Redis migration of every existing stuck session,
#                      because the corrupted ["Error"] blobs predate the fix.
#
# WhatsAppFSM        — @dataclass with .state and .history
#                      Mirror of the production class. to_dict() calls
#                      .value (which returns the tuple); from_dict()
#                      calls State(value) (which crashes on the list).
#                      Gotcha: to_dict() succeeds. from_dict() fails.
#                      Asymmetric persistence — write succeeds, read crashes.
#                      Customer locks themselves in by the act of
#                      reaching State.ERROR.
#
# FakeRedis          — @dataclass with .store dict
#                      Records every set() so the demos can show the
#                      JSON array landing in storage.
#                      Gotcha: real Redis behaves identically here. The
#                      bug is at the JSON layer, not Redis. Migrating to
#                      a different store wouldn't fix it.
#
# whatsapp_webhook   — (customer_id, inquiry) -> str | raises
#                      Entry point. Loads session via from_dict, dispatches.
#                      Gotcha: from_dict is the crash site, not the
#                      handler. The customer can never reach a handler
#                      once their stored state is corrupted.
#
# manual_redis_fix   — (customer_id) -> None
#                      The redis-cli del equivalent. The only escape.
#                      Gotcha: this is what ops does for every stuck
#                      customer. It scales O(stuck_customers).
#
# ── Debugger machinery ─────────────────────────────────────────────────
#
# Gutter breakpoint     — click gutter next to line → red dot
#                         Pauses BEFORE that line executes.
#                         Gotcha: BP-1 inside from_dict pauses BEFORE
#                         State() is called. Inspect state_value here
#                         to see the list before the crash.
#
# Exception breakpoint  — Run → View Breakpoints → + → Python Exception
#                         Pauses whenever given exception type is raised.
#                         Gotcha: enum.py raises ValueError internally
#                         during normal lookups too — tick "Ignore library
#                         files" or you'll pause hundreds of times at import.
#
# Hit count             — right-click breakpoint → Hit Count
#                         Skip the first N hits before pausing.
#                         Gotcha: useful for PASS 6 where you want to
#                         pause on the 5th crash, not the 1st.
#
# Watches               — Debug panel → Watches → + → Python expression
#                         Re-evaluated on every pause.
#                         Gotcha: W4 = type(state_value).__name__ is
#                         the diagnostic. If it prints 'list', you've
#                         found the corruption.
#
# Evaluate Expression   — ⌥F8 → modal dialog, one-shot evaluation
#                         Run any expression in the current frame.
#                         Gotcha: at a from_dict pause, try
#                         State(tuple(state_value)) — converts the list
#                         back to a tuple and the lookup succeeds. That's
#                         a hot-patch, not a fix. The fix is the comma.
#
# ═════════════════════════════════════════════════════════════════════════

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ═════════════════════════════════════════════════════════════════════════
# THE ENUM UNDER AUDIT
# ═════════════════════════════════════════════════════════════════════════

class State(Enum):
    NEW_INQUIRY = "New_Inquiry"
    SALES = "Sales"
    QUOTE_READY = "Quote_Ready"
    ERROR = ("Error",)         # ← THE BUG. Trailing comma → tuple.


# ═════════════════════════════════════════════════════════════════════════
# FAKE REDIS
# Records every set() so the demos can show the JSON array landing in
# storage — the durable corruption.
# ═════════════════════════════════════════════════════════════════════════

@dataclass
class FakeRedis:
    store: dict[str, str] = field(default_factory=dict)
    writes: list[tuple[str, str]] = field(default_factory=list)

    def get(self, key: str) -> Optional[str]:
        return self.store.get(key)

    def set(self, key: str, value: str) -> None:
        self.store[key] = value
        self.writes.append((key, value))

    def delete(self, key: str) -> None:
        self.store.pop(key, None)


redis = FakeRedis()


# ═════════════════════════════════════════════════════════════════════════
# THE FSM AND ITS PERSISTENCE LAYER
# ═════════════════════════════════════════════════════════════════════════

@dataclass
class WhatsAppFSM:
    state: State = State.NEW_INQUIRY
    history: list[dict] = field(default_factory=list)

    def transition_to(self, new_state: State) -> None:
        self.history.append({"from": self.state.name, "to": new_state.name})
        self.state = new_state

    def to_dict(self) -> dict:
        return {
            "state": self.state.value,    # ← FM-1: tuple for ERROR, str for everything else
            "history": self.history,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WhatsAppFSM":
        state_value = data["state"]            # 🔴 BP-1  W3 W4
        return cls(
            state=State(state_value),          # ← XB-1 raise site for ERROR
            history=data.get("history", []),
        )


def save_session(customer_id: str, fsm: WhatsAppFSM) -> None:
    redis.set(customer_id, json.dumps(fsm.to_dict()))


def load_session(customer_id: str) -> Optional[WhatsAppFSM]:
    raw = redis.get(customer_id)
    return WhatsAppFSM.from_dict(json.loads(raw)) if raw else None


# ═════════════════════════════════════════════════════════════════════════
# THE WEBHOOK
# ═════════════════════════════════════════════════════════════════════════

def whatsapp_webhook(customer_id: str, inquiry: str) -> str:
    """Entry point. Loads session, returns reply. Crashes at from_dict
    if the stored state is corrupted."""
    fsm = load_session(customer_id) or WhatsAppFSM()
    return f"State={fsm.state.name}, processing: {inquiry!r}"


# ═════════════════════════════════════════════════════════════════════════
# DEMOS
# ═════════════════════════════════════════════════════════════════════════

CUSTOMER = "whatsapp:+447700000ALICE"


def _reset() -> None:
    redis.store.clear()
    redis.writes.clear()


def demo_value_asymmetry():
    """PASS 1 — language-level cause. ONE member is not like the others."""
    print("\n── PASS 1: prove the type asymmetry ───────────────────────")
    for member in State:
        v = member.value
        print(f"  State.{member.name:<12} value: "
              f"type={type(v).__name__:<6} repr={v!r}")
    print("  ↑ ONE of these is not like the others. Find the trailing comma.")


def demo_reverse_lookup():
    """PASS 2 — Enum reverse-lookup. The string fails; the tuple succeeds."""
    print("\n── PASS 2: reverse lookup — string fails, tuple succeeds ──")
    try:
        State("Error")
    except ValueError as e:
        print(f"  ✗ State('Error') raises ValueError: {e}")
    member = State(("Error",))
    print(f"  ✓ State(('Error',)) returns: {member}")
    print("  ↑ from_dict passes the string. That's why it crashes.")


def demo_happy_round_trip():
    """PASS 3 — non-broken state survives Redis round-trip."""
    print("\n── PASS 3: round-trip NEW_INQUIRY (works fine) ────────────")
    _reset()
    fsm = WhatsAppFSM(state=State.NEW_INQUIRY)
    save_session(CUSTOMER, fsm)
    print(f"  Wrote: {redis.writes[-1][1]!r}")
    loaded = load_session(CUSTOMER)
    print(f"  Read back: state={loaded.state}")
    print("  ✓ string-valued members round-trip fine.")


def demo_error_serialisation():
    """PASS 4 — write ERROR. See what JSON serialisation does to the tuple."""
    print("\n── PASS 4: write ERROR — see what lands in the blob ───────")
    _reset()
    fsm = WhatsAppFSM(state=State.ERROR)
    print(f"  to_dict() output:  {fsm.to_dict()}")
    save_session(CUSTOMER, fsm)
    print(f"  JSON serialised:   {redis.writes[-1][1]!r}")
    print("  ↑ tuple → JSON array. Persistence succeeded. Corruption durable.")


def demo_error_round_trip_crash():
    """PASS 5 — read ERROR back. from_dict crashes on the list."""
    print("\n── PASS 5: read ERROR back — from_dict crashes ────────────")
    # Storage still has the corrupt blob from PASS 4.
    raw = redis.get(CUSTOMER)
    parsed = json.loads(raw)
    print(f"  Loaded JSON:        {parsed}")
    print(f"  state field type:   {type(parsed['state']).__name__}")
    try:
        load_session(CUSTOMER)
    except ValueError as e:
        print(f"  ✗ ValueError: {e}")
        print("  Frame: from_dict → State(state_value) "
              "(state_value is a list)")


def demo_customer_lockout():
    """PASS 6 — every subsequent inbound crashes at the same place."""
    print("\n── PASS 6: customer lockout — 5 inbound messages all crash ─")
    # Storage still corrupt.
    for i in range(1, 6):
        try:
            whatsapp_webhook(CUSTOMER, "hello")
        except ValueError:
            print(f"  msg {i}: ✗ ValueError")
    print(f"  Customer received 5 × HTTP 500 for 5 × hello.")
    print("  No self-healing path. Every inbound crashes identically.")


def demo_manual_recovery():
    """PASS 7 — what ops does for every stuck customer in production."""
    print("\n── PASS 7: manual recovery (redis-cli del equivalent) ─────")
    print(f"  $ redis-cli del '{CUSTOMER}'")
    redis.delete(CUSTOMER)
    reply = whatsapp_webhook(CUSTOMER, "hello again")
    print(f"  After del + new message: {reply!r}")
    print("  → Recovered. Now multiply by every customer who hit ERROR.")


# ═════════════════════════════════════════════════════════════════════════
# THE ONE-CHARACTER FIX
# ═════════════════════════════════════════════════════════════════════════

class State_v2(Enum):
    NEW_INQUIRY = "New_Inquiry"
    SALES = "Sales"
    QUOTE_READY = "Quote_Ready"
    ERROR = "Error"            # ← FIXED. No trailing comma.


@dataclass
class WhatsAppFSM_v2:
    state: State_v2 = State_v2.NEW_INQUIRY

    def to_dict(self) -> dict:
        return {"state": self.state.value}

    @classmethod
    def from_dict(cls, data: dict) -> "WhatsAppFSM_v2":
        return cls(state=State_v2(data["state"]))


def demo_one_character_fix():
    """PASS 8 — State_v2 with the comma removed. Round-trips fine."""
    print("\n── PASS 8: one-character fix — State_v2 round-trips fine ──")
    print(f"  State_v2.ERROR.value: type=str  repr={State_v2.ERROR.value!r}")
    fsm = WhatsAppFSM_v2(state=State_v2.ERROR)
    serialised = json.dumps(fsm.to_dict())
    print(f"  JSON: {serialised!r}")
    loaded = WhatsAppFSM_v2.from_dict(json.loads(serialised))
    print(f"  Round-tripped: state={loaded.state}")
    print("  ✓ One character. Bug eliminated.")
    print("  But: existing stuck customers still need Redis surgery —")
    print("  the corrupt ['Error'] blobs in production predate the fix.")


# ═════════════════════════════════════════════════════════════════════════
# THE FAANG-ANSWER TEMPLATE
# ═════════════════════════════════════════════════════════════════════════
#
# One trailing comma. State.ERROR = ("Error",) is a single-element
# tuple, not a string. State.ERROR.value is therefore the tuple
# ('Error',). Three failure modes cascade. FM-1: any introspection
# that compares .value to a string fails silently — visible only if
# you happen to test it. FM-2: Enum reverse-lookup State("Error")
# raises ValueError because no member's value equals the string —
# breaks every from_dict() that reads ERROR back from storage. FM-3:
# JSON serialisation of the tuple becomes a JSON array; round-tripping
# through Redis turns ('Error',) into ['Error'], and State(['Error'])
# raises ValueError as well. The combination is permanent customer
# lockout: any session that reaches State.ERROR successfully writes
# a corrupted blob to Redis, and every subsequent inbound message
# crashes at from_dict() with HTTP 500.
#
# The classification is BUG, not ERR-x and not SOLID. The design is
# correct (enum member with string value); the implementation has a
# one-character syntax error. The fix is to remove the trailing comma:
# ERROR = "Error". Existing stuck sessions require manual Redis
# surgery — the corrupt blobs predate the fix.
#
# Verification: grep for tuple-valued enum members across the codebase:
#   $ grep -rnE "= \(.*,\s*\)$" app/
# Add to CI as a lint rule. Better: write a characterisation test
# that round-trips EVERY State member through to_dict/from_dict.
# Both prior refactors carried this bug forward because their tests
# only round-tripped the happy-path members.
#
# ═════════════════════════════════════════════════════════════════════════

def main():
    demo_value_asymmetry()
    demo_reverse_lookup()
    demo_happy_round_trip()
    demo_error_serialisation()
    demo_error_round_trip_crash()
    demo_customer_lockout()
    demo_manual_recovery()
    demo_one_character_fix()
    print("\n── done ───────────────────────────────────────────────────")


if __name__ == "__main__":
    main()