# ═════════════════════════════════════════════════════════════════════════
# TOY — app/sessions_wrong.py
# Demonstrates: AP-1 (sync I/O in async handler), DIP violation,
#               server-side O(N) blocking (Redis KEYS), no Protocol seam.
# ═════════════════════════════════════════════════════════════════════════
#
# ── HOW TO USE ───────────────────────────────────────────────────────────
#
# Notation:
#   🔴 BP-n [PASS k]   Inline trailing marker. Click the gutter on THAT
#                      line. Set in numeric order, only for the pass you
#                      are currently working through.
#   Wn                 Watch expression (defined in the WATCHES block
#                      below). Add to PyCharm Watches panel BEFORE you
#                      start the debugger. Watches refresh on every pause.
#   ⚠                  Time-sensitive watch (perf_counter). MUST live in
#                      the Watches panel, not as a one-shot Evaluate call.
#
# ── WATCHES ──────────────────────────────────────────────────────────────
# Add these to PyCharm Watches panel (Debugger → Watches → +) before
# starting. They persist across the whole debug session.
#
#   W1  type(r)                                  → redis.client.Redis
#   W2  asyncio.get_running_loop().is_running()  → True
#   W3  id(asyncio.current_task())               → <int> (note it)
#   W4  len(keys)                                → ~500_000
#   W5  time.perf_counter()                      → t0 at BP-2, t1 after F8 ⚠
#
# ── PREREQS ──────────────────────────────────────────────────────────────
#   1. Local Redis:  docker run -p 6379:6379 redis:7-alpine
#   2. Python deps:  pip install fastapi uvicorn redis
#   3. PyCharm Pro recommended. Two terminals: server + load generator.
#
# ── SEED ─────────────────────────────────────────────────────────────────
#   Makes the stall observable on a laptop in <1 minute.
#
#   $ python -c "
#     import redis
#     r = redis.Redis()
#     for i in range(500_000):
#         r.set(f'session:alice:{i}', 'x')
#     "
#
# ── RUN CONFIG (PyCharm: Edit Configurations → + → Python) ───────────────
#   Module name:  uvicorn
#   Parameters:   app.sessions_wrong:app --workers 1
#   ⚠ workers=1 is REQUIRED. Multiple workers mask the stall.
#
# ── PROCEDURE ────────────────────────────────────────────────────────────
# Three passes. Each answers a different question. Do them in order.
#
# PASS 1 — "Are we actually in the event loop with a sync client?"
#   1. Set ONLY BP-1 (click gutter on the `pattern = ...` line).
#   2. Confirm W1, W2, W3 are in the Watches panel.
#   3. Debug-run (Shift+F9).
#   4. Other terminal: curl http://localhost:8000/sessions/alice
#   5. At BP-1, read W1/W2/W3. Confirm sync client + running loop.
#   6. F9 (Resume) to finish the request.
#
# PASS 2 — "How long does the stall last?"
#   1. Set BP-2 (click gutter on the `keys = r.keys(...)` line).
#      Disable BP-1 (Ctrl+F8 — keeps the marker, skips it).
#   2. Re-debug. curl the endpoint.
#   3. At BP-2: read W5 → t0. Write it down.
#   4. F8 (Step Over) ONCE.
#   5. Read W5 again → t1.   Δ = t1 − t0 = event loop stall.
#   6. Read W4. Confirm KEYS returned all matches at once.
#
# PASS 3 — "Does the stall affect OTHER requests?"
#   1. Disable BP-1 and BP-2 (don't delete — needed for sessions_right.py).
#   2. Run the server NORMALLY, no debugger.
#      (The debugger perturbs timing — pass 3 must be honest.)
#   3. Terminal A:  curl http://localhost:8000/sessions/alice &
#   4. Terminal B:  ab -n 50 -c 10 http://localhost:8000/health
#   5. ab's "Longest request" for /health will be ≈ Δ from PASS 2.
#      THAT is the proof: an unrelated endpoint was held hostage.
#
# ── EXPECTED OBSERVATIONS ────────────────────────────────────────────────
#   W1  redis.client.Redis        (sync, NOT aioredis)
#   W2  True
#   W4  ~500_000
#   W5  Δ = 100ms – 2s            (laptop dependent)
#   ab  longest /health ≈ Δ       (the lesson)
#
# If W1 reads `redis.asyncio.client.Redis`, your import is wrong —
# fix that before continuing or the bug won't reproduce.
#
# ── TEARDOWN ─────────────────────────────────────────────────────────────
#   $ redis-cli FLUSHDB           ← clears THIS database only
#   ⚠ NEVER FLUSHALL — wipes every DB on the instance.
#   Stop uvicorn (Ctrl+C).
#
# ═════════════════════════════════════════════════════════════════════════

import asyncio
import time
import redis                              # ← synchronous client (red flag #1)
from fastapi import FastAPI

app = FastAPI()

r = redis.Redis(host="localhost")         # 🔴 DIP-1: handler depends on concrete low-level client; no SessionStore Protocol; not injectable; not overridable in tests


@app.get("/health")
async def health():
    """Trivial endpoint used by PASS 3 to detect cross-request stalls."""
    return {"ok": True}


@app.get("/sessions/{user_id}")
async def list_user_sessions(user_id: str):
    pattern = f"session:{user_id}:*"      # 🔴 BP-1 [PASS 1] W1 W2 W3
    keys = r.keys(pattern)                # 🔴 BP-2 [PASS 2] W4 W5 ⚠ ← THE blocking call; during Δ no other coroutine runs
    return {"count": len(keys), "keys": [k.decode() for k in keys]}