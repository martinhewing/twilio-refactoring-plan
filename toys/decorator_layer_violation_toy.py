# ═════════════════════════════════════════════════════════════════════════
# TOY — decorator_layer_violation_toy.py
# Demonstrates:
#   FM-1 — kwarg invocation crashes the handler (PEP 479 transmutation)
#   FM-2 — unreadable body when except tries to parse it
#   DIP  — HTTP-layer decorator applied to a domain method
#   + the downstream production harms:
#     – what status code Twilio actually receives
#     – Twilio's retry behaviour on non-2xx (up to 3 retries, exp backoff)
#     – duplicate customer notifications when the handler has side effects
#
# Plain async script. Run or debug directly — no pytest, no config.
#   $ python decorator_layer_violation_toy.py
#   PyCharm: right-click → Run / Debug
# ═════════════════════════════════════════════════════════════════════════
#
# ── WHAT YOU LEARN BY JUST RUNNING IT ──────────────────────────────────
#
# Five demos print a complete narrative. The FakeTwilioClient records
# every .messages.create() call so you can SEE the duplicate-send
# amplification — not just read about it.
#
# Expected output shape (excerpt):
#
#   ── PASS 4: what Twilio receives + retries ─────────────────
#     Twilio webhook response: HTTP 500 (RuntimeError)
#     Twilio will retry: yes (non-2xx)
#     Retry schedule: attempt 1 (immediate), attempt 2 (+1s),
#                     attempt 3 (+2s), attempt 4 (+4s)
#
#   ── PASS 5: duplicate notification amplification ───────────
#     Fake Twilio calls recorded: 4
#       1. to=+15550000ALICE  body='Sorry: downstream call failed'
#       2. to=+15550000ALICE  body='Sorry: downstream call failed'
#       3. to=+15550000ALICE  body='Sorry: downstream call failed'
#       4. to=+15550000ALICE  body='Sorry: downstream call failed'
#     Customer received 4 identical "sorry" messages for 1 failure.
#
# ── PEP 479 NOTE ────────────────────────────────────────────────────────
# StopIteration escaping a coroutine → RuntimeError at the boundary.
# Original ValueError masked twice — once by the handler crashing, once
# by PEP 479's transmutation. On-call engineer Googles the RuntimeError
# message and lands on PEP 479 explainers, not on the real cause.
#
# ═════════════════════════════════════════════════════════════════════════
# DEBUGGER GUIDE (optional — only for seeing the masking in the stack)
# ═════════════════════════════════════════════════════════════════════════
#
# Notation:
#   🔴 BP-n     Gutter breakpoint.
#   Wn         Watch expression.
#   ⛔ XB-n     Exception Breakpoint. IMPORTANT: tick "Ignore library
#              files" or you'll pause in framework startup hundreds
#              of times.
#
# Watches (add once, use across passes):
#   W1  args
#   W2  kwargs
#   W3  any(isinstance(a, Request) for a in args)
#   W4  type(e).__name__
#
# Exception breakpoints to configure once:
#   ⛔ XB-1  StopIteration  On raise, Ignore library files
#   ⛔ XB-2  RuntimeError   On raise, Ignore library files
#   ⛔ XB-3  ValueError     On raise, Ignore library files
#
# Passes (enable only the listed breakpoints per pass):
#
# PASS 1 — FM-1 kwarg:
#   BPs: BP-1, BP-2, XB-1
#   At BP-1: W1=(), W2={'request': ...}, W3=False — predicts the crash.
#   F9 to BP-2, F9 to XB-1 firing on next() inside except.
#   F9 past the transmutation boundary; demo catches RuntimeError.
#
# PASS 2 — FM-2 unreadable body:
#   BPs: XB-2 only.
#   RuntimeError fires inside receive() — the helper that simulates the
#   body being unreadable. Frame stack shows the decorator's
#   `await request.form()` as the caller. Variables panel's
#   __exception__ has __context__ set to the masked ValueError.
#
# PASS 3 — layer collapse:
#   BPs: XB-3 only.
#   ValueError fires inside validate_state. FRAME STACK:
#     validate_state         ← domain
#     wrapper                ← decorator (HTTP)
#     demo_layer_violation   ← non-HTTP caller
#     main
#   The HTTP-layer wrapper sits BETWEEN a non-HTTP caller and a domain
#   method. DIP inversion visible in the stack.
#
# PASSES 4–5 don't need the debugger — the narrative and the
# FakeTwilioClient call log are the evidence.
#
# ── GREP AUDIT ─────────────────────────────────────────────────────────
#   $ grep -n "@handle_whatsapp_errors" decorator_layer_violation_toy.py
#   Two hits: whatsapp_webhook (OK), validate_state (DEC-ERR-1).
#
# ═════════════════════════════════════════════════════════════════════════

# ═════════════════════════════════════════════════════════════════════════
# GLOSSARY — every moving part, one entry each.
# Shape: name · signature · one-sentence behaviour · the gotcha.
# ═════════════════════════════════════════════════════════════════════════
#
# ── Python language features ───────────────────────────────────────────
#
# *args         — `def f(*args)` → args is tuple[Any, ...]
#                 Collects positional arguments into a tuple named args.
#                 Gotcha: kwargs never appear here — they go to **kwargs.
#                 The whole FM-1 bug lives in this asymmetry.
#
# **kwargs      — `def f(**kwargs)` → kwargs is dict[str, Any]
#                 Collects keyword arguments into a dict named kwargs.
#                 Gotcha: the decorator never inspects this dict, so a
#                 Request passed as kwarg is invisible to its scan.
#
# next(it, d)   — (iter, default=...) -> item | default
#                 Pulls next item from an iterator; raises StopIteration
#                 on exhaustion unless default is given.
#                 Gotcha: this toy does NOT pass a default — empty args →
#                 exhausted generator → StopIteration. That's FM-1.
#
# (x for x in)  — generator expression, lazy iterator
#                 Produces items one at a time, evaluated on demand.
#                 Gotcha: next() on one with no matching items raises
#                 StopIteration immediately — not a friendly error.
#
# isinstance    — (obj, cls | tuple[cls, ...]) -> bool
#                 True if obj is an instance of cls or any subclass.
#                 Gotcha: when used inside decorators to find framework
#                 types (Request), it creates hidden cross-layer coupling.
#
# @decorator    — (func) -> func (or wrapper)
#                 Sugar: `@d\ndef f():` is exactly `f = d(f)`.
#                 Gotcha: decorator that returns a different-shaped
#                 function silently changes the decoratee's contract.
#
# @wraps        — (func) -> (wrapper -> wrapper)
#                 Copies __name__/__doc__ from func onto wrapper so
#                 introspection reports the original.
#                 Gotcha: without it, tracebacks and IDEs show wrapper
#                 names instead of the real function — harder debugging.
#
# async def     — declares a coroutine function; calling it returns a
#                 Coroutine object you must `await` to run.
#                 Gotcha: StopIteration escaping a coroutine is auto-
#                 transmuted to RuntimeError (PEP 479). Masks the cause.
#
# __context__   — exc.__context__: Exception | None
#                 Set automatically when one exception raises while
#                 another is being handled.
#                 Gotcha: None at the original raise site; only populates
#                 when a second exception fires during handling.
#
# Protocol      — from typing import Protocol — structural subtype base
#                 Declares an interface by method signatures alone.
#                 Gotcha: the domain-layer port in the fix. Domain depends
#                 on shape without knowing about concrete HTTP adapters.
#
# ── FastAPI / Starlette ────────────────────────────────────────────────
#
# Request                — starlette.requests.Request
#                          ASGI request; exposes .headers, .form(),
#                          .body(), .json(), .query_params.
#                          Gotcha: .form() and .body() are async and read
#                          from ASGI receive() lazily. Body readable once.
#
# Request(scope, receive) — (dict, Callable[[], Awaitable[dict]]) -> Request
#                          Build Request from raw ASGI primitives.
#                          Gotcha: if receive raises or returns garbage,
#                          any body read will propagate that failure —
#                          that's how _fake_request_unreadable_body
#                          triggers FM-2.
#
# await request.form()   — () -> FormData (async multi-dict)
#                          Parses body as form-encoded or multipart.
#                          Gotcha: if body already consumed or receive
#                          raises, this raises a FRESH exception — which
#                          is exactly what masks the original in FM-2.
#
# @app.exception_handler — (ExcType) -> (handler -> handler)
#                          FastAPI's native error-translation hook.
#                          Framework passes the Request in properly.
#                          Gotcha: this IS the idiomatic fix. Reach for
#                          this before building a decorator like the one
#                          under audit.
#
# ── Twilio retry semantics (not Python — a webhook contract) ──────────
#
# Retry rule          — non-2xx or connection error → up to 3 retries
#                       with exponential backoff: +1s, +2s, +4s.
#                       Gotcha: 400 is not 2xx. Returning 400 from your
#                       error handler INVITES retries.
#
# Amplification       — each retry re-runs the handler, including any
#                       side effects (Twilio messages, DB writes, etc).
#                       Gotcha: 1 failure → up to 4 identical "sorry"
#                       messages to the same customer.
#
# ── Objects in this toy ────────────────────────────────────────────────
#
# FakeTwilioClient        — @dataclass with .calls + .should_raise
#                           Test double. Records every .messages.create()
#                           call; flip should_raise=True to simulate
#                           Twilio API failure.
#                           Gotcha: module-level instance (`twilio`) so
#                           decorator sees it without DI. Deliberate
#                           minor DIP smell, orthogonal to the main one.
#
# handle_whatsapp_errors  — (async_func) -> async_wrapper
#                           The decorator under audit. Try/except that
#                           scans args for a Request, reads form body,
#                           sends apology via Twilio, returns 400.
#                           Gotcha: three bugs in ~8 lines. FM-1 (kwarg),
#                           FM-2 (body unreadable), DIP (depends on
#                           Request, propagates to every decoratee).
#
# whatsapp_webhook        — (Request) -> raises ValueError
#                           Stand-in endpoint. Always raises so the
#                           decorator's except path is exercised.
#                           Gotcha: the bug is in the decorator, not the
#                           endpoint. Any endpoint breaks the same way.
#
# validate_state          — (dict) -> bool, raises ValueError if invalid
#                           Stand-in domain method. No HTTP, no Request,
#                           no framework concerns.
#                           Gotcha: the @handle_whatsapp_errors decoration
#                           IS the DIP violation. Method itself is clean.
#
# simulate_twilio_...     — (Callable, Request) -> list[(attempt, status)]
#                           Invokes endpoint up to 4 times per Twilio's
#                           retry schedule. Status 0 = raised. Stops on 2xx.
#                           Gotcha: backoff sleeps compressed to sleep(0);
#                           real durations (1s/2s/4s) printed only.
#
# _fake_readable_request  — (bytes) -> Request
#                           Request whose receive() returns the body as a
#                           single ASGI chunk. Used when body IS readable.
#                           Gotcha: ASGI bodies consume-once; second read
#                           returns empty.
#
# _fake_request_unreadable_body
#                         — () -> Request
#                           Request whose receive() raises RuntimeError.
#                           Used to trigger FM-2.
#                           Gotcha: raise fires only when something reads
#                           the body — so it fires INSIDE request.form(),
#                           which is inside the decorator's except block.
#
# ── Debugger machinery ─────────────────────────────────────────────────
#
# Gutter breakpoint       — click gutter next to line → red dot
#                           Pauses before that line executes.
#                           Gotcha: to see the line's effect, F8 step over.
#
# Exception breakpoint    — Run → View Breakpoints → + → Python Exception
#                           Pauses whenever given exception type is raised.
#                           Gotcha: tick "Ignore library files" or you'll
#                           pause hundreds of times in framework startup.
#
# Watches                 — Debug panel → Watches → + → Python expression
#                           Re-evaluated on every pause.
#                           Gotcha: expression must be valid in the CURRENT
#                           frame. `args` doesn't exist if you're not
#                           inside a function that takes *args.
#
# Evaluate Expression     — ⌥F8 → modal dialog, one-shot evaluation
#                           Gotcha: synchronous only. Can't run `await ...`.
#                           For async probing, use an exception breakpoint
#                           at the expected raise site instead.
#
# __exception__           — available at exception-BP pauses only
#                           The in-flight exception; has .__context__ for
#                           the masked original.
#                           Gotcha: doesn't exist at normal gutter-BP
#                           pauses — only at exception-breakpoint pauses.
#
# ═════════════════════════════════════════════════════════════════════════

import asyncio
from dataclasses import dataclass, field
from functools import wraps
from typing import Callable, Protocol
from fastapi import Request


# ═════════════════════════════════════════════════════════════════════════
# FAKE TWILIO CLIENT
# Records every .messages.create() call. Can be switched between
# "succeed" and "raise" modes. The call log is how the duplicate-send
# amplification becomes visible.
# ═════════════════════════════════════════════════════════════════════════

@dataclass
class FakeTwilioClient:
    calls: list[dict] = field(default_factory=list)
    should_raise: bool = False

    class _Messages:
        def __init__(self, outer):
            self._outer = outer

        def create(self, *, to: str, body: str, **kw) -> dict:
            if self._outer.should_raise:
                raise RuntimeError("Twilio API error: invalid from_number")
            record = {"to": to, "body": body, **kw}
            self._outer.calls.append(record)
            return record

    @property
    def messages(self):
        return self._Messages(self)


# Module-level instance so the decorator can see it without DI ceremony.
# (The decorator's coupling to a module-level client is itself a smell —
# another DIP micro-violation, but not the one the toy is about.)
twilio = FakeTwilioClient()


# ═════════════════════════════════════════════════════════════════════════
# THE DECORATOR UNDER AUDIT
# ═════════════════════════════════════════════════════════════════════════

def handle_whatsapp_errors(func):
    """HTTP-edge error decorator. Two failure modes baked in."""
    @wraps(func)
    async def wrapper(*args, **kwargs):                # 🔴 BP-1  W1 W2 W3
        try:
            return await func(*args, **kwargs)
        except Exception as e:                         # 🔴 BP-2  W4
            request = next(arg for arg in args         # ← FM-1 raise site (XB-1)
                           if isinstance(arg, Request))
            form = await request.form()                # ← FM-2 raise site (XB-2)
            from_number = form.get("From")
            twilio.messages.create(                    # ← the side effect Twilio retries amplify
                to=from_number,
                body=f"Sorry: {e}",
            )
            return {"status_code": 400, "body": f"Sorry: {e}"}
    return wrapper


# ═════════════════════════════════════════════════════════════════════════
# THE FUNCTIONS UNDER AUDIT
# ═════════════════════════════════════════════════════════════════════════

@handle_whatsapp_errors
async def whatsapp_webhook(request: Request):
    """Real endpoint. Decorator belongs here."""
    raise ValueError("downstream call failed")


@handle_whatsapp_errors  # ← THE VIOLATION. Grep finds this on a non-endpoint.
async def validate_state(state: dict) -> bool:
    """Internal domain method. No Request in scope."""
    if "user_id" not in state:
        raise ValueError("state missing user_id")     # ← XB-3 raise site
    return True


# ═════════════════════════════════════════════════════════════════════════
# TWILIO RETRY SIMULATOR
# Models Twilio's real behaviour: if the webhook returns non-2xx, retry
# up to 3 times with exponential backoff (1s, 2s, 4s). In the simulator
# we compress the sleeps to near-zero so the toy runs in milliseconds;
# the timings are printed as if they were real.
# ═════════════════════════════════════════════════════════════════════════

RETRY_SCHEDULE_SECONDS = (0, 1, 2, 4)  # attempt 1 immediate, then backoff


async def simulate_twilio_webhook_delivery(
    endpoint: Callable, request: Request
) -> list[tuple[int, int]]:
    """Invoke `endpoint` as Twilio would, retrying on any non-2xx or
    on any raised exception. Returns a list of (attempt, status) pairs.
    Status 0 means the endpoint raised (Twilio treats this as retriable).
    """
    outcomes: list[tuple[int, int]] = []
    for attempt, backoff in enumerate(RETRY_SCHEDULE_SECONDS, start=1):
        # Compressed; in production these are real seconds.
        await asyncio.sleep(0)

        try:
            result = await endpoint(request)
            status = result.get("status_code", 200) if isinstance(result, dict) else 200
        except Exception:
            status = 0  # raised — Twilio sees connection error, retries

        outcomes.append((attempt, status))
        if 200 <= status < 300:
            return outcomes  # success, stop retrying

    return outcomes  # all attempts exhausted


# ═════════════════════════════════════════════════════════════════════════
# DEMOS
# ═════════════════════════════════════════════════════════════════════════

async def demo_fm1():
    """PASS 1 — Request as kwarg. Decorator crashes on next()."""
    print("\n── PASS 1: FM-1 (kwarg breaks args scan) ──────────────────")
    req = _fake_readable_request(form_body=b"From=%2B15550000ALICE")
    try:
        await whatsapp_webhook(request=req)  # kwarg, not positional
    except RuntimeError as e:
        print(f"  ✓ surfaced as RuntimeError (PEP 479 transmuted): {e}")
        print(f"    original masked: {e.__context__!r}")


async def demo_fm2():
    """PASS 2 — body unreadable. except raises a SECOND exception."""
    print("\n── PASS 2: FM-2 (body unreadable in except handler) ───────")
    req = _fake_request_unreadable_body()
    try:
        await whatsapp_webhook(req)
    except Exception as e:
        print(f"  ✓ surfaced as {type(e).__name__}: {e}")
        print(f"    original masked: {e.__context__!r}")


async def demo_layer_violation():
    """PASS 3 — internal domain method has no Request. Same crash."""
    print("\n── PASS 3: layer collapse (decorator on domain method) ────")
    try:
        await validate_state({})  # no Request anywhere
    except RuntimeError as e:
        print(f"  ✓ domain ValueError masked by HTTP-layer decorator")
        print(f"    surfaced: {type(e).__name__}: {e}")
        print(f"    masked:   {e.__context__!r}")


async def demo_twilio_sees():
    """PASS 4 — what HTTP status Twilio actually receives + retries.

    The original ValueError is caught; the handler runs; in the HAPPY
    path (readable body, positional call) it returns status 400. Twilio
    sees HTTP 400 and retries up to 3 times. If the handler itself
    raises (FM-1 or FM-2), Twilio sees a connection error / 500 and
    retries anyway. Either way: retries happen, because 400 ≠ 2xx.
    """
    print("\n── PASS 4: what Twilio receives + retries ─────────────────")
    twilio.calls.clear()
    req = _fake_readable_request(form_body=b"From=%2B15550000ALICE")

    outcomes = await simulate_twilio_webhook_delivery(whatsapp_webhook, req)
    for attempt, status in outcomes:
        label = "raised" if status == 0 else f"HTTP {status}"
        backoff = RETRY_SCHEDULE_SECONDS[attempt - 1]
        print(f"    attempt {attempt}: {label}  (after +{backoff}s backoff)")
    print(f"  Twilio retries because every response was non-2xx.")
    print(f"  Total attempts delivered to the endpoint: {len(outcomes)}")


async def demo_duplicate_notifications():
    """PASS 5 — duplicate notification amplification.

    Each retry triggers the handler AGAIN. The handler has a side
    effect (twilio.messages.create — sending an apology to the
    customer). So one underlying failure produces N apologies where
    N = number of Twilio retry attempts. The customer receives
    identical 'Sorry' messages multiple times.
    """
    print("\n── PASS 5: duplicate notification amplification ───────────")
    twilio.calls.clear()
    req = _fake_readable_request(form_body=b"From=%2B15550000ALICE")

    await simulate_twilio_webhook_delivery(whatsapp_webhook, req)

    print(f"  Fake Twilio calls recorded: {len(twilio.calls)}")
    for i, call in enumerate(twilio.calls, start=1):
        print(f"    {i}. to={call['to']}  body={call['body']!r}")
    print(f"  Customer received {len(twilio.calls)} identical "
          f"'sorry' messages for 1 underlying failure.")


async def demo_clean_fix():
    """The fix: domain method with no decorator. Plain ValueError."""
    print("\n── FIX: clean domain method, no HTTP decorator ────────────")
    try:
        await validate_state_clean({})
    except ValueError as e:
        print(f"  ✓ plain ValueError surfaces cleanly: {e}")
    print("  In FastAPI, the idiomatic fix for error translation is")
    print("  @app.exception_handler — not a decorator that scans *args.")


# ═════════════════════════════════════════════════════════════════════════
# THE FIX
# ═════════════════════════════════════════════════════════════════════════

class ErrorTranslator(Protocol):
    def translate(self, exc: Exception, recipient: str) -> dict: ...


class WhatsAppErrorTranslator:
    def translate(self, exc: Exception, recipient: str) -> dict:
        return {"to": recipient, "body": f"Sorry: {exc}", "channel": "whatsapp"}


async def validate_state_clean(state: dict) -> bool:
    """No decorator. No framework imports. Raises domain exceptions."""
    if "user_id" not in state:
        raise ValueError("state missing user_id")
    return True


# ═════════════════════════════════════════════════════════════════════════
# THE FAANG-ANSWER TEMPLATE
# ═════════════════════════════════════════════════════════════════════════
#
# Two failure modes. FM-1: kwarg invocation — args contains no Request,
# next() raises StopIteration inside the except, PEP 479 transmutes it
# to RuntimeError at the coroutine boundary. Original error masked
# twice. FM-2: body unreadable when the except block runs
# `await request.form()` — form() raises a fresh exception, masking
# the original. In both cases, what Twilio actually receives is either
# a 400 (happy path of the handler) or a connection error / 500 (if the
# handler itself crashes). Neither is 2xx, so Twilio retries up to 3
# times with exponential backoff (1s, 2s, 4s). Each retry re-invokes
# the handler, which has a side effect (sending a "sorry" message to
# the customer), so one underlying failure produces up to 4 identical
# apology messages — the duplicate-notification amplification.

# ("FM-2 happens because the decorator's error handler tries to read "
#  "request.form() for the first time inside the except block, but the "
#  "exception fired before the form was ever read during normal flow — "
#  "and the request body is now in a state where form() either returns "
#  "empty or raises, which masks the original error with a second exception "
#  "about form parsing.")

# SOLID violation: DIP. The decorator depends on the concrete
# starlette.requests.Request type. Decorating validate_state forces the
# domain layer to transitively depend on the HTTP framework. Fix:
# ErrorTranslator Protocol injected at the HTTP edge, domain raises
# plain exceptions, transport translates. In FastAPI specifically, use
# @app.exception_handler — the framework's native hook — so the
# decorator mechanism is avoided entirely.
#
# Verification: grep -rn "@handle_whatsapp_errors" app/ — every hit
# must be on a function whose first positional arg is `request:
# Request` AND whose module sits in the HTTP layer.
#
# ═════════════════════════════════════════════════════════════════════════


# ─── helpers ────────────────────────────────────────────────────────────

def _fake_readable_request(form_body: bytes) -> Request:
    """ASGI Request whose body CAN be read on demand."""
    body_iter = iter([{"type": "http.request", "body": form_body, "more_body": False}])

    async def receive():
        return next(body_iter)

    scope = {
        "type": "http", "method": "POST",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    return Request(scope, receive=receive)


def _fake_request_unreadable_body() -> Request:
    """Request whose body CANNOT be read — receive() raises."""
    async def receive():
        raise RuntimeError("body stream already consumed")

    scope = {
        "type": "http", "method": "POST",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    return Request(scope, receive=receive)


# ─── entry point ────────────────────────────────────────────────────────

async def main():
    await demo_fm1()
    await demo_fm2()
    await demo_layer_violation()
    await demo_twilio_sees()
    await demo_duplicate_notifications()
    await demo_clean_fix()
    print("\n── done ───────────────────────────────────────────────────")


if __name__ == "__main__":
    asyncio.run(main())