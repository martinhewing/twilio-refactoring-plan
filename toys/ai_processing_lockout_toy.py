# ═════════════════════════════════════════════════════════════════════════
# TOY — ai_processing_lockout_toy.py
# Demonstrates:
#   FM-1 — non-transactional ordering: AI_PROCESSING committed to Redis
#          BEFORE the fallible API call. Exception leaves state durable.
#   FM-2 — recovery handler refuses to recover: handle_ai_processing_state
#          short-circuits before the AI dispatch, so no inbound message
#          ever re-triggers the processing path.
#   EXC-6 / DEC-ERR-2 — missing Retry Pattern. Transient Anthropic
#          failures (rate limit, 529 overload, brief timeout) recover in
#          seconds — but the code gives up on the first raise.
#   + the downstream production harms:
#     – customer permanently stuck in "still processing" loop
#     – silent failure: HTTP 200 every time, dashboards stay green
#     – asymmetric conversation history (user msg, no AI reply)
#     – every stuck customer requires manual Redis surgery
#
# Plain async script. Run or debug directly — no pytest, no FastAPI.
#   $ python ai_processing_lockout_toy.py
#   PyCharm: right-click → Run / Debug
# ═════════════════════════════════════════════════════════════════════════
#
# ── WHAT YOU LEARN BY JUST RUNNING IT ──────────────────────────────────
#
# Seven demos print a complete narrative. The FakeRedis records every
# write so you can SEE the durable AI_Processing commit happen BEFORE
# the API raises — not just read about it.
#
# Expected output shape (excerpt):
#
#   ── PASS 2: API timeout — state already committed ─────────
#     ✓ APITimeoutError raised: simulated APITimeoutError
#     Redis writes since reset: 1
#       write → state='AI_Processing'
#     Redis state field: 'AI_Processing'   ← DURABLE despite the raise
#
#   ── PASS 3: next message hits lockout ──────────────────────
#     Customer reply: 'Still processing your previous message...'
#     AI calls (should be 0): 0
#     Redis state field: 'AI_Processing'
#
#   ── PASS 4: permanence — 5 more messages all locked out ───
#     Sent 5 messages. AI calls triggered: 0
#     Customer is permanently stuck.
#
#   ── PASS 6: proper fix — EXC-6 retry survives transient ───
#     Customer reply: 'Quote: $1,500'
#     AI: 2 retries before success
#     Redis state field: 'Quote_Ready'
#
# ── COMPARISON WITH Q5 ──────────────────────────────────────────────────
# Q5 (tuple bug) crashes from_dict on every inbound — HARD failure, 500
# response, surfaces in dashboards immediately. Q6 (this toy) succeeds
# at from_dict and politely lies — SOFT failure, 200 response forever,
# only visible via session-age metrics. Q6 is operationally worse: the
# stuck customers accumulate silently.
#
# ═════════════════════════════════════════════════════════════════════════
# DEBUGGER GUIDE (optional — only for seeing the durability in the stack)
# ═════════════════════════════════════════════════════════════════════════
#
# Notation:
#   🔴 BP-n     Gutter breakpoint.
#   Wn         Watch expression.
#   ⛔ XB-n     Exception Breakpoint. IMPORTANT: tick "Ignore library
#              files" or PyCharm pauses in asyncio internals.
#
# Watches (add once, use across passes):
#   W1  fsm.state
#   W2  redis.store.get(CUSTOMER)
#   W3  anthropic_client.failure_count
#   W4  type(__exception__).__name__
#
# Exception breakpoints to configure once:
#   ⛔ XB-1  APITimeoutError   On raise, Ignore library files
#   ⛔ XB-2  RateLimitError    On raise, Ignore library files
#
# Passes (enable only the listed breakpoints per pass):
#
# PASS 2 — durable commit before raise:
#   BPs: BP-1, BP-2, XB-1
#   At BP-1 (transition_to): W1=NEW_INQUIRY, W2=None.
#   F8 step over save_session. Now W2 contains the AI_Processing JSON
#   blob. The write happened. There is no going back from this line.
#   F9 to XB-1 firing inside anthropic_client.create. Frame stack shows
#   process_with_ai → create. Redis already holds AI_Processing.
#
# PASS 3 — the lockout dispatch:
#   BPs: BP-2 only.
#   BP-2 hits at HANDLERS[fsm.state] inside whatsapp_webhook.
#   Inspect: fsm.state = State.AI_PROCESSING — loaded from Redis.
#   Step into → handle_ai_processing_state. Note: NO call into
#   process_with_ai. NO transition. NO recovery path.
#
# PASS 6 — retry recovers:
#   BPs: BP-3 only (inside the retry decorator).
#   BP-3 hits 3 times. On hits 1 and 2, except APITimeoutError fires;
#   on hit 3, the call returns. fsm.state then transitions to
#   QUOTE_READY. The transient failure self-heals.
#
# ── GREP AUDIT ─────────────────────────────────────────────────────────
#   $ grep -n "transition_to(State.AI_PROCESSING)" ai_processing_lockout_toy.py
#   Three hits: process_with_ai (BUGGY), v2 (PARTIAL), v3 (FIXED).
#   In v3, the line is followed by a try/except that rolls the
#   transition back if the API call exhausts its retries.
#
# ═════════════════════════════════════════════════════════════════════════

# ═════════════════════════════════════════════════════════════════════════
# GLOSSARY — every moving part, one entry each.
# Shape: name · signature · one-sentence behaviour · the gotcha.
# ═════════════════════════════════════════════════════════════════════════
#
# ── Python language features ───────────────────────────────────────────
#
# Enum         — class C(str, Enum): MEMBER = "value"
#                Named constants with .value lookup. str-mixin makes
#                values JSON-serialisable directly.
#                Gotcha: Q5's bug is in this exact construct — a
#                trailing comma turns the value into a tuple. This toy
#                uses str values explicitly; the lockout is orthogonal.
#
# @dataclass   — (cls) -> cls with __init__/__repr__/__eq__ generated
#                Reduces boilerplate for value/state holders.
#                Gotcha: mutable defaults must use field(default_factory=...)
#                or every instance shares the same list/dict.
#
# @wraps       — (func) -> (wrapper -> wrapper)
#                Copies __name__/__doc__ from func onto wrapper so
#                introspection and tracebacks report the original.
#                Gotcha: without it, retry-decorated functions show
#                'wrapper' in stack traces — debugging gets harder.
#
# async def    — declares a coroutine function; calling returns a
#                Coroutine object you must `await` to run.
#                Gotcha: an exception raised in the body propagates up
#                the await chain like a normal exception — but only the
#                CALLER's frames appear, not the asyncio runner's.
#
# raise        — re-raises the current exception with original traceback
#                Used in v2 and v3 after the FSM rollback to let the
#                webhook layer translate to HTTP 500.
#                Gotcha: bare `raise` only works inside an except block;
#                outside, it raises RuntimeError("No active exception").
#
# 2 ** n       — exponential backoff base — 1, 2, 4, 8, ...
#                Standard exponent in retry strategies.
#                Gotcha: without a max cap, the 10th retry waits 1024×
#                the base. Production code should cap at ~30-60s.
#
# ── External system semantics (not Python — the Anthropic contract) ───
#
# APITimeoutError      — raised by anthropic SDK after default timeout
#                        (~600s) or sooner if `timeout=` kwarg is set.
#                        Gotcha: 600s is far longer than the Twilio
#                        webhook timeout (~15s). The customer sees a
#                        500 from the webhook BEFORE the SDK gives up.
#
# RateLimitError       — raised on 429 from Anthropic API.
#                        Gotcha: typically transient — Anthropic publishes
#                        retry-after headers. Worth retrying with
#                        exponential backoff.
#
# 529 overload         — temporary "API overloaded" response.
#                        Gotcha: distinct from 429. Hit during traffic
#                        spikes. Same fix: retry with backoff.
#
# default SDK timeout  — anthropic-python defaults to ~600s read timeout
#                        Gotcha: relying on the default is the bug. Set
#                        timeout= explicitly. 15s is a reasonable webhook
#                        budget.
#
# ── Objects in this toy ────────────────────────────────────────────────
#
# State                 — Enum: NEW_INQUIRY | AI_PROCESSING | QUOTE_READY
#                         The FSM states the toy cares about.
#                         Gotcha: real system has ~12 states; the lockout
#                         pattern applies to any state with a "wait" handler.
#
# FakeRedis             — @dataclass with .store dict + .writes log
#                         Records every set() so the demos can prove the
#                         AI_Processing write happened before the raise.
#                         Gotcha: real Redis doesn't have an audit log
#                         like this. The .writes list is a test affordance.
#
# FakeAnthropicClient   — @dataclass with .n_failures_before_success
#                         The dial. n=999 → always fail. n=2 → fail twice
#                         then succeed (lets PASS 6 prove retry works).
#                         Gotcha: failure_count persists across calls
#                         until _reset() — set the dial AFTER calling reset.
#
# WhatsAppFSM           — @dataclass with .state and .history
#                         The thing whose .state field gets corrupted.
#                         transition_to() appends to history and updates
#                         state — but does NOT persist. Persistence is
#                         the caller's job, which is where the bug lives.
#                         Gotcha: in-memory transition is reversible. Once
#                         save_session() commits, only another save undoes it.
#
# SessionRepository     — @dataclass wrapping FakeRedis
#                         get_session()/save_session() — the boundary
#                         between the FSM and durable storage.
#                         Gotcha: there is no "transactional" save. If
#                         you save state X then need to revert, you must
#                         explicitly save state Y. This is what FM-1 fails to do.
#
# process_with_ai       — (customer_id, inquiry) -> str, raises on API error
#                         The function under audit. Three lines: transition,
#                         save, await create. The bug is in the ORDER
#                         (save before await) and the MISSING (no try/except).
#                         Gotcha: looks fine in isolation. Only the
#                         interaction between persistence and a fallible
#                         downstream call exposes the bug.
#
# handle_ai_processing  — (customer_id, inquiry) -> str
#                         The state handler reached when fsm.state is
#                         AI_PROCESSING. Returns "still processing" and
#                         does nothing else — NO retry, NO transition.
#                         Gotcha: this is FM-2. The handler assumes the
#                         AI call is genuinely in flight. If it isn't —
#                         because process_with_ai already raised — there
#                         is no path back to a working state.
#
# whatsapp_webhook      — (customer_id, inquiry) -> str
#                         Entry point. Loads session, dispatches via
#                         HANDLERS table by current state.
#                         Gotcha: dispatch is the lockout mechanism. Once
#                         state is AI_PROCESSING, every inbound goes to
#                         handle_ai_processing — bypassing process_with_ai
#                         entirely. The AI is never called again.
#
# process_with_ai_v2    — three-line fix: try/except + rollback
#                         Better than the original (state recovers) but
#                         still no retry — first transient failure makes
#                         the customer re-send.
#                         Gotcha: the FAANG anti-answer. Looks complete,
#                         leaves the retry story unwritten.
#
# process_with_ai_v3    — proper fix: @retry + try/except + rollback
#                         EXC-6 (Retry Pattern) + DEC-ERR-2 (@retry).
#                         Survives transient failures automatically;
#                         only rolls back if ALL retries exhaust.
#                         Gotcha: retry HAPPENS INSIDE the try block.
#                         The except runs only after the retry decorator
#                         has given up.
#
# retry                 — (attempts, exceptions, backoff) -> decorator
#                         DEC-ERR-2 implementation. Exponential backoff:
#                         backoff * 2**(attempt-1).
#                         Gotcha: catches ONLY the exceptions you list.
#                         A bare retry(exceptions=(Exception,)) would
#                         retry on ValueError, TypeError, etc. — masking bugs.
#
# ── Debugger machinery ─────────────────────────────────────────────────
#
# Gutter breakpoint     — click gutter next to line → red dot
#                         Pauses BEFORE that line executes.
#                         Gotcha: to see the line's effect on Redis,
#                         step over (F8) and re-inspect W2.
#
# Exception breakpoint  — Run → View Breakpoints → + → Python Exception
#                         Pauses whenever given exception type is raised.
#                         Gotcha: tick "Ignore library files" or you'll
#                         pause hundreds of times in asyncio internals.
#
# Watches               — Debug panel → Watches → + → Python expression
#                         Re-evaluated on every pause.
#                         Gotcha: W2 (redis.store.get(CUSTOMER)) returns
#                         a JSON string, not a dict. Use json.loads()
#                         in Evaluate Expression to inspect fields.
#
# __exception__         — available at exception-BP pauses only
#                         The in-flight exception.
#                         Gotcha: doesn't exist at gutter-BP pauses —
#                         only at exception-breakpoint pauses.
#
# ═════════════════════════════════════════════════════════════════════════

import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
from typing import Callable, Optional


# ═════════════════════════════════════════════════════════════════════════
# STATE ENUM
# ═════════════════════════════════════════════════════════════════════════

class State(str, Enum):
    NEW_INQUIRY = "New_Inquiry"
    AI_PROCESSING = "AI_Processing"
    QUOTE_READY = "Quote_Ready"


# ═════════════════════════════════════════════════════════════════════════
# FAKE REDIS
# Records every set() call so the demos can prove the AI_Processing
# write became durable BEFORE the API raised.
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


# ═════════════════════════════════════════════════════════════════════════
# FAKE ANTHROPIC CLIENT
# Mirrors anthropic.APITimeoutError and anthropic.RateLimitError.
# Set n_failures_before_success to control the failure pattern:
#   0   = always succeed
#   2   = fail twice, then succeed (proves retry works)
#   999 = always fail (proves the lockout)
# ═════════════════════════════════════════════════════════════════════════

class APITimeoutError(Exception):
    """Mirror of anthropic.APITimeoutError."""


class RateLimitError(Exception):
    """Mirror of anthropic.RateLimitError."""


@dataclass
class FakeAnthropicClient:
    n_failures_before_success: int = 0
    failure_type: type = APITimeoutError
    failure_count: int = 0
    success_count: int = 0

    async def create(self, *, model: str, messages: list, **kw) -> dict:
        if self.failure_count < self.n_failures_before_success:
            self.failure_count += 1
            raise self.failure_type(f"simulated {self.failure_type.__name__}")
        self.success_count += 1
        return {"content": [{"text": "Quote: $1,500"}]}


# ═════════════════════════════════════════════════════════════════════════
# FSM + SESSION REPOSITORY
# ═════════════════════════════════════════════════════════════════════════

@dataclass
class WhatsAppFSM:
    state: State = State.NEW_INQUIRY
    history: list[dict] = field(default_factory=list)

    def transition_to(self, new_state: State) -> None:
        self.history.append({"from": self.state.value, "to": new_state.value})
        self.state = new_state

    def to_dict(self) -> dict:
        return {"state": self.state.value, "history": self.history}

    @classmethod
    def from_dict(cls, data: dict) -> "WhatsAppFSM":
        return cls(state=State(data["state"]), history=data.get("history", []))


@dataclass
class SessionRepository:
    redis: FakeRedis

    def get_session(self, customer_id: str) -> Optional[WhatsAppFSM]:
        raw = self.redis.get(customer_id)
        return WhatsAppFSM.from_dict(json.loads(raw)) if raw else None

    def save_session(self, customer_id: str, fsm: WhatsAppFSM) -> None:
        self.redis.set(customer_id, json.dumps(fsm.to_dict()))


# ── Module-level instances. Production code under audit relies on globals;
# the toy faithfully reproduces that smell to keep the demo realistic.
redis = FakeRedis()
session_repo = SessionRepository(redis)
anthropic_client = FakeAnthropicClient()


# ═════════════════════════════════════════════════════════════════════════
# THE FUNCTIONS UNDER AUDIT
# ═════════════════════════════════════════════════════════════════════════

async def process_with_ai(customer_id: str, inquiry: str) -> str:
    """The bug. State transition committed BEFORE the API call.
    No timeout, no retry, no except."""
    fsm = session_repo.get_session(customer_id) or WhatsAppFSM()

    fsm.transition_to(State.AI_PROCESSING)         # 🔴 BP-1  W1 W2
    session_repo.save_session(customer_id, fsm)    # ← FM-1: durable BEFORE API call

    response = await anthropic_client.create(      # ← XB-1 raise site (APITimeoutError)
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": inquiry}],
    )

    fsm.transition_to(State.QUOTE_READY)           # ← never reached on failure
    session_repo.save_session(customer_id, fsm)
    return response["content"][0]["text"]


async def handle_new_inquiry(customer_id: str, inquiry: str) -> str:
    """Routes to AI processing. The path the customer SHOULD reach."""
    return await process_with_ai(customer_id, inquiry)


async def handle_ai_processing_state(customer_id: str, inquiry: str) -> str:
    """FM-2: refuses to recover. No retry, no transition, no AI dispatch.
    Assumes the AI call is genuinely in flight. If it isn't — because
    process_with_ai already raised — there is no path back."""
    return "Still processing your previous message, please wait..."


# Dispatch table — webhook routes by current state.
HANDLERS: dict[State, Callable] = {
    State.NEW_INQUIRY: handle_new_inquiry,
    State.AI_PROCESSING: handle_ai_processing_state,
    State.QUOTE_READY: handle_new_inquiry,
}


async def whatsapp_webhook(customer_id: str, inquiry: str) -> str:
    """Entry point. Loads session, dispatches by current state."""
    fsm = session_repo.get_session(customer_id) or WhatsAppFSM()
    handler = HANDLERS[fsm.state]                  # 🔴 BP-2  W1
    return await handler(customer_id, inquiry)


# ═════════════════════════════════════════════════════════════════════════
# DEMOS
# ═════════════════════════════════════════════════════════════════════════

CUSTOMER = "whatsapp:+447700000ALICE"


def _reset() -> None:
    redis.store.clear()
    redis.writes.clear()
    anthropic_client.failure_count = 0
    anthropic_client.success_count = 0
    anthropic_client.n_failures_before_success = 0


def _print_redis_state() -> None:
    raw = redis.get(CUSTOMER)
    if raw is None:
        print("    Redis state field: <empty>")
    else:
        data = json.loads(raw)
        print(f"    Redis state field: {data['state']!r}")


async def demo_happy_path():
    """PASS 1 — sanity check. API succeeds, state ends QUOTE_READY."""
    print("\n── PASS 1: happy path (API succeeds) ──────────────────────")
    _reset()
    reply = await whatsapp_webhook(CUSTOMER, "I need 3 x 452-0427")
    print(f"  Customer reply: {reply!r}")
    _print_redis_state()
    print(f"  AI calls: {anthropic_client.success_count}")


async def demo_api_failure():
    """PASS 2 — FM-1: state already committed when API raises."""
    print("\n── PASS 2: API timeout — state already committed ──────────")
    _reset()
    anthropic_client.n_failures_before_success = 999  # always fail
    try:
        await whatsapp_webhook(CUSTOMER, "I need 3 x 452-0427")
    except APITimeoutError as e:
        print(f"  ✓ APITimeoutError raised: {e}")
    print(f"  Redis writes since reset: {len(redis.writes)}")
    for k, v in redis.writes:
        data = json.loads(v)
        print(f"    write → state={data['state']!r}")
    _print_redis_state()
    print("  ↑ DURABLE despite the raise. There is no rollback.")


async def demo_lockout():
    """PASS 3 — FM-2: next message hits handle_ai_processing_state.
    AI is never called. Customer receives the lockout reply."""
    print("\n── PASS 3: next message hits lockout ──────────────────────")
    # State is still AI_Processing from PASS 2 (we did NOT reset).
    anthropic_client.n_failures_before_success = 0  # would succeed if called
    pre_calls = anthropic_client.success_count

    reply = await whatsapp_webhook(CUSTOMER, "hello?")
    print(f"  Customer reply: {reply!r}")
    print(f"  AI calls (should be 0): "
          f"{anthropic_client.success_count - pre_calls}")
    _print_redis_state()


async def demo_permanence():
    """PASS 4 — five more messages. All locked out. Permanent."""
    print("\n── PASS 4: permanence — 5 more messages all locked out ───")
    pre_calls = anthropic_client.success_count
    for i in range(5):
        await whatsapp_webhook(CUSTOMER, f"message {i}")
    print(f"  Sent 5 messages. AI calls triggered: "
          f"{anthropic_client.success_count - pre_calls}")
    print("  Customer is permanently stuck.")
    _print_redis_state()


# ═════════════════════════════════════════════════════════════════════════
# THE THREE-LINE FIX (PARTIAL)
# Better than the original — state recovers — but no retry. First
# transient failure forces the customer to re-send.
# ═════════════════════════════════════════════════════════════════════════

async def process_with_ai_v2(customer_id: str, inquiry: str) -> str:
    """Three-line fix: try/except + rollback. The FAANG anti-answer:
    looks complete, leaves the retry story unwritten."""
    fsm = session_repo.get_session(customer_id) or WhatsAppFSM()
    fsm.transition_to(State.AI_PROCESSING)
    session_repo.save_session(customer_id, fsm)

    try:
        response = await anthropic_client.create(
            model="claude-sonnet-4-6",
            messages=[{"role": "user", "content": inquiry}],
        )
    except (APITimeoutError, RateLimitError):
        fsm.transition_to(State.NEW_INQUIRY)       # rollback
        session_repo.save_session(customer_id, fsm)
        raise

    fsm.transition_to(State.QUOTE_READY)
    session_repo.save_session(customer_id, fsm)
    return response["content"][0]["text"]


async def demo_three_line_fix():
    """PASS 5 — partial fix. State rolls back; customer must re-send."""
    print("\n── PASS 5: three-line fix — gives up on first error ───────")
    _reset()
    anthropic_client.n_failures_before_success = 1  # fails once, then OK

    try:
        await process_with_ai_v2(CUSTOMER, "I need 3 x 452-0427")
    except APITimeoutError:
        print("  ✗ first attempt failed; customer must re-send.")
    print(f"  AI: {anthropic_client.failure_count} fail, "
          f"{anthropic_client.success_count} success")
    _print_redis_state()
    print("  → State rolled back, but transient failure not auto-recovered.")


# ═════════════════════════════════════════════════════════════════════════
# THE PROPER FIX — EXC-6 + DEC-ERR-2
# Retry inside the try block. Rollback only if all retries exhaust.
# ═════════════════════════════════════════════════════════════════════════

def retry(*, attempts: int = 3,
          exceptions: tuple = (Exception,),
          backoff: float = 0.1):
    """DEC-ERR-2 — exponential backoff. Catches ONLY listed exceptions."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, attempts + 1):
                try:
                    return await func(*args, **kwargs)        # 🔴 BP-3
                except exceptions as e:
                    last_exc = e
                    if attempt < attempts:
                        await asyncio.sleep(backoff * (2 ** (attempt - 1)))
            raise last_exc
        return wrapper
    return decorator


@retry(attempts=3,
       exceptions=(APITimeoutError, RateLimitError),
       backoff=0.01)  # compressed; production would use ~1.0
async def _call_anthropic(inquiry: str) -> dict:
    return await anthropic_client.create(
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": inquiry}],
    )


async def process_with_ai_v3(customer_id: str, inquiry: str) -> str:
    """EXC-6 retry + transactional rollback. The proper fix."""
    fsm = session_repo.get_session(customer_id) or WhatsAppFSM()
    fsm.transition_to(State.AI_PROCESSING)
    session_repo.save_session(customer_id, fsm)

    try:
        response = await _call_anthropic(inquiry)              # ← retries inside
    except (APITimeoutError, RateLimitError):
        fsm.transition_to(State.NEW_INQUIRY)                   # rollback last resort
        session_repo.save_session(customer_id, fsm)
        raise

    fsm.transition_to(State.QUOTE_READY)
    session_repo.save_session(customer_id, fsm)
    return response["content"][0]["text"]


async def demo_proper_fix():
    """PASS 6 — proper fix. Survives 2 transient failures, succeeds on 3rd."""
    print("\n── PASS 6: proper fix — EXC-6 retry survives transient ───")
    _reset()
    anthropic_client.n_failures_before_success = 2  # fail, fail, succeed

    reply = await process_with_ai_v3(CUSTOMER, "I need 3 x 452-0427")
    print(f"  Customer reply: {reply!r}")
    print(f"  AI: {anthropic_client.failure_count} retries before success")
    _print_redis_state()
    print("  → Transient failure recovered automatically. No customer impact.")


async def demo_manual_recovery():
    """PASS 7 — what ops has to do for every stuck customer in production."""
    print("\n── PASS 7: manual recovery (redis-cli del equivalent) ────")
    _reset()
    anthropic_client.n_failures_before_success = 999
    try:
        await whatsapp_webhook(CUSTOMER, "I need 3 x 452-0427")
    except APITimeoutError:
        pass
    print("  Stuck state reproduced.")
    _print_redis_state()

    print(f"  $ redis-cli del '{CUSTOMER}'")
    redis.delete(CUSTOMER)
    _print_redis_state()

    anthropic_client.n_failures_before_success = 0
    reply = await whatsapp_webhook(CUSTOMER, "hello again")
    print(f"  After del + new message: {reply!r}")
    print("  → Recovered. Now multiply by every stuck customer in production.")


# ═════════════════════════════════════════════════════════════════════════
# THE FAANG-ANSWER TEMPLATE
# ═════════════════════════════════════════════════════════════════════════
#
# Two failure modes. FM-1: non-transactional ordering. The FSM commits
# AI_PROCESSING to Redis BEFORE the fallible Anthropic call. When the
# call raises, the in-memory FSM goes out of scope but the durable
# state remains. There is no implicit rollback. FM-2: the recovery
# path refuses to recover. Inbound messages from a customer in
# AI_PROCESSING are routed to handle_ai_processing_state, which
# returns a "still processing" string and does nothing else — no
# retry, no transition. The combination is permanent customer
# lockout: every subsequent message produces the same polite lie
# forever, with HTTP 200 the whole way through. Dashboards stay green.
#
# The classification is EXC-6 (Retry Pattern) plus DEC-ERR-2 (@retry).
# Not a BUG, not a SOLID violation — the design is reasonable, the
# code is syntactically correct. The flaw is a missing exception-
# handling strategy for an unreliable collaborator. The three-line
# fix (try/except + rollback) is necessary but not sufficient: it
# rolls the FSM back so the next message can be processed, but it
# gives up on the first transient failure. The proper fix retries
# 2-3 times with exponential backoff INSIDE the try block, and only
# rolls back if all retries exhaust. The rollback is the safety net;
# the retry is the fix.
#
# Verification: grep -rn "transition_to(State.AI_PROCESSING)" app/ —
# every hit must be immediately followed by a try-block that wraps
# the await on the API call and a rollback in the except handler.
# The await must be on a function decorated with @retry (or use
# anthropic SDK's built-in max_retries kwarg, set to >= 2).
#
# ═════════════════════════════════════════════════════════════════════════

# ─── entry point ────────────────────────────────────────────────────────

async def main():
    await demo_happy_path()
    await demo_api_failure()
    await demo_lockout()
    await demo_permanence()
    await demo_three_line_fix()
    await demo_proper_fix()
    await demo_manual_recovery()
    print("\n── done ───────────────────────────────────────────────────")


if __name__ == "__main__":
    asyncio.run(main())