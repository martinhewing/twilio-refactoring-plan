# ═════════════════════════════════════════════════════════════════════════
# TOY — decorator_layer_violation_toy.py
# Demonstrates: DEC-ERR-1 layer violation (SOLID-DIP) + the two failure
#               modes of the @handle_whatsapp_errors decorator's
#               args-scanning pattern.
#
# This is a PLAIN SCRIPT, not a pytest file. Run it with:
#   $ python decorator_layer_violation_toy.py
# Or in PyCharm: right-click → Run / Debug. No special configuration,
# no asyncio mode, no test discovery — just a normal script with a
# main() guard. Set breakpoints in the gutter and the debugger pauses.
# ═════════════════════════════════════════════════════════════════════════
#
# ── PEP 479 NOTE ────────────────────────────────────────────────────────
# Since Python 3.7, StopIteration that escapes a coroutine is auto-
# converted to RuntimeError. So FM-1 surfaces as:
#
#   RuntimeError: coroutine raised StopIteration
#
# That is a SHARPER lesson than "the handler raises StopIteration":
# the original ValueError is masked TWICE — once by the handler
# crashing, once by PEP 479 transmuting at the coroutine boundary.
# An on-call engineer Googling that string lands on PEP 479 articles,
# not on "your decorator is broken."
#
# ── HOW TO USE ──────────────────────────────────────────────────────────
#
#   🔴 BP-n [PASS k]    Inline gutter breakpoint. Set in numeric order.
#   Wn                  Watch expression — paste into Watches panel.
#   En                  Evaluate Expression (Alt+F8) — paste at pause.
#   ⛔ XB-n              Exception Breakpoint — Run → View Breakpoints
#                       → + → Python Exception Breakpoint.
#
# ── WATCHES ─────────────────────────────────────────────────────────────
#   W1  args
#   W2  kwargs
#   W3  any(isinstance(a, Request) for a in args)
#   W4  type(e).__name__
#   W5  e.__context__
#
# ── EVALUATE EXPRESSION ─────────────────────────────────────────────────
#   E1  next((a for a in args if isinstance(a, Request)), "MISSING")
#   E2  await request.form()
#   E3  e.__cause__ or e.__context__
#
# ── EXCEPTION BREAKPOINTS ───────────────────────────────────────────────
#   ⛔ XB-1  StopIteration  "On raise"  — fires inside except on FM-1
#   ⛔ XB-2  ValueError     "On raise"  — fires at the original domain
#                                         error in PASS 3, BEFORE the
#                                         decorator masks it
#
# ── PROCEDURE ───────────────────────────────────────────────────────────
#
# PASS 1 — "FM-1: kwarg invocation crashes the error handler"
#   1. Set BP-1, BP-2. Configure XB-1.
#   2. W1, W2, W3 in Watches.
#   3. Debug-run this script. main() calls demo_fm1() first.
#   4. At BP-1: W1 empty, W2 contains the Request, W3 = False.
#      That alone predicts the crash.
#   5. F9. XB-1 fires inside the except block. Run E1 → "MISSING".
#   6. F9 again. PEP 479 transmutes at the boundary. The script's
#      try/except around demo_fm1() catches RuntimeError and prints it.
#
# PASS 2 — "FM-2: body unreadable when except tries to parse it"
#   1. Disable BP-1, BP-2. Set BP-3.
#   2. Debug-run. main() proceeds to demo_fm2().
#   3. At BP-3 (the await request.form() inside except):
#      run E2 — form() raises because receive() is broken.
#      run E3 — original ValueError still chained on __context__.
#
# PASS 3 — "Layer collapse: same decorator on an internal domain method"
#   1. Disable all BPs. Configure XB-2.
#   2. Debug-run. main() proceeds to demo_layer_violation().
#   3. XB-2 fires inside validate_state. FRAME STACK shows:
#
#        validate_state           ← domain layer
#        wrapper                  ← decorator (HTTP layer)
#        demo_layer_violation     ← background-job-shaped caller
#        main                     ← script entry
#
#      The HTTP-layer wrapper sits BETWEEN the caller and the domain
#      method. Layer inversion made visible in the call stack.
#
# ── GREP AUDIT ──────────────────────────────────────────────────────────
#   $ grep -n "@handle_whatsapp_errors" decorator_layer_violation_toy.py
#
#   Two hits expected — one on whatsapp_webhook (endpoint, OK), one on
#   validate_state (domain method, DEC-ERR-1 violation).
#
# ═════════════════════════════════════════════════════════════════════════

import asyncio
from functools import wraps
from typing import Protocol
from fastapi import Request


# ═════════════════════════════════════════════════════════════════════════
# THE DECORATOR UNDER AUDIT
# ═════════════════════════════════════════════════════════════════════════

def handle_whatsapp_errors(func):
    """HTTP-edge error decorator. Two failure modes baked in."""
    @wraps(func)
    async def wrapper(*args, **kwargs):                # 🔴 BP-1 [PASS 1] W1 W2 W3
        try:
            return await func(*args, **kwargs)
        except Exception as e:                         # 🔴 BP-2 [PASS 1] ⛔ XB-1 W4 W5
            request = next(arg for arg in args         # ← FM-1: StopIteration if kwarg
                           if isinstance(arg, Request))
            form = await request.form()                # 🔴 BP-3 [PASS 2]  ← FM-2: raises if body unread
            from_number = form.get("From")
            return {"to": from_number, "body": f"Sorry: {e}", "channel": "whatsapp"}
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
    """Internal domain method. No Request in scope. Should not know
    HTTP exists — let alone WhatsApp."""
    if "user_id" not in state:
        raise ValueError("state missing user_id")    # ⛔ XB-2 fires here
    return True


# ═════════════════════════════════════════════════════════════════════════
# DEMOS — each one triggers exactly one failure mode or violation.
# main() runs them in order with try/except so you see all three.
# ═════════════════════════════════════════════════════════════════════════

async def demo_fm1():
    """PASS 1 — Request passed as kwarg. Decorator crashes on next()."""
    print("\n── PASS 1: FM-1 (kwarg breaks args scan) ──────────────────")
    req = _fake_readable_request(form_body=b"From=%2B15550000ALICE")
    try:
        result = await whatsapp_webhook(request=req)  # kwarg, not positional
        print(f"  unexpected success: {result}")
    except RuntimeError as e:
        print(f"  ✓ surfaced as RuntimeError (PEP 479 transmuted): {e}")
        print(f"    original masked: {e.__context__!r}")
    except Exception as e:
        print(f"  ✗ unexpected: {type(e).__name__}: {e}")


async def demo_fm2():
    """PASS 2 — body unreadable. except block raises a SECOND exception."""
    print("\n── PASS 2: FM-2 (body unreadable in except handler) ───────")
    req = _fake_request_unreadable_body()
    try:
        result = await whatsapp_webhook(req)
        print(f"  unexpected success: {result}")
    except ValueError as e:
        print(f"  ✗ original ValueError leaked through (FM-2 not triggered): {e}")
    except Exception as e:
        print(f"  ✓ surfaced as {type(e).__name__}: {e}")
        print(f"    original masked: {e.__context__!r}")


async def demo_layer_violation():
    """PASS 3 — internal domain method has no Request. Same crash."""
    print("\n── PASS 3: layer collapse (decorator on domain method) ────")
    try:
        result = await validate_state({})  # no Request anywhere
        print(f"  unexpected success: {result}")
    except RuntimeError as e:
        print(f"  ✓ domain ValueError masked by HTTP-layer decorator")
        print(f"    surfaced: {type(e).__name__}: {e}")
        print(f"    masked:   {e.__context__!r}")
    except Exception as e:
        print(f"  ✗ unexpected: {type(e).__name__}: {e}")


async def demo_clean_fix():
    """The fix: domain method with no decorator. Plain ValueError."""
    print("\n── FIX: clean domain method, no HTTP decorator ────────────")
    try:
        await validate_state_clean({})
    except ValueError as e:
        print(f"  ✓ plain ValueError surfaces cleanly: {e}")


# ═════════════════════════════════════════════════════════════════════════
# THE FIX (Protocol port, applied at the edge only)
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
# Two failure modes. FM-1: if the Request is passed as a keyword
# argument (request=req) instead of positionally, args contains no
# Request, next() raises StopIteration inside the except handler, and
# PEP 479 transmutes that into RuntimeError at the coroutine boundary.
# Original error masked twice. FM-2: if the request body is unreadable
# when the except block runs `await request.form()` — body already
# consumed by middleware, stream closed, or exception fired before the
# body was ever read — the form() call raises a fresh exception,
# masking the original.
#
# SOLID violation: DIP. The decorator depends on the concrete
# starlette.requests.Request type — an HTTP-layer object. Decorating
# validate_state forces the domain layer to transitively depend on the
# HTTP framework. High-level modules must not depend on low-level
# modules. Fix: ErrorTranslator Protocol injected at the HTTP edge;
# domain raises plain domain exceptions; transport layer translates.
#
# Verification: `grep -rn "@handle_whatsapp_errors" app/` — every hit
# must be on a function whose first positional arg is `request:
# Request` AND whose module sits in the HTTP layer. Anything else is
# DEC-ERR-1 by construction.
#
# ═════════════════════════════════════════════════════════════════════════


# ─── helpers ────────────────────────────────────────────────────────────

def _fake_readable_request(form_body: bytes) -> Request:
    """ASGI Request whose body CAN be read on demand."""
    body_iter = iter([{"type": "http.request", "body": form_body, "more_body": False}])

    async def receive():
        return next(body_iter)

    scope = {
        "type": "http",
        "method": "POST",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    return Request(scope, receive=receive)


def _fake_request_unreadable_body() -> Request:
    """Request whose body CANNOT be read — receive() raises."""
    async def receive():
        raise RuntimeError("body stream already consumed")

    scope = {
        "type": "http",
        "method": "POST",
        "headers": [(b"content-type", b"application/x-www-form-urlencoded")],
    }
    return Request(scope, receive=receive)


# ─── entry point ────────────────────────────────────────────────────────

async def main():
    await demo_fm1()
    await demo_fm2()
    await demo_layer_violation()
    await demo_clean_fix()
    print("\n── done ───────────────────────────────────────────────────")


if __name__ == "__main__":
    asyncio.run(main())