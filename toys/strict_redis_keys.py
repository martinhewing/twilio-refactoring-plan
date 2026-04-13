"""
Toy: redis.keys() vs scan_iter() — CONC-3 + CAT-1/CAT-3 mismatch.

========================================================================
FORMAL EXPLANATION
========================================================================

There are TWO independent failures compounded in one line of code.

--- Failure 1: Server-side (Redis) ---
    redis.StrictRedis.keys(pattern) invokes the Redis KEYS command.
    KEYS is O(N) over the entire keyspace. Redis executes commands on a
    single-threaded event loop — while KEYS runs, NO other command from
    ANY client can be served. The Redis server is frozen for the full
    duration of the scan.

--- Failure 2: Client-side (asyncio) — CONC-3 ---
    redis.StrictRedis.keys() is a SYNCHRONOUS blocking call. When invoked
    from inside an `async def` handler, it does not yield to the event
    loop. FastAPI/uvicorn runs a single-threaded cooperative event loop
    that only switches coroutines at explicit `await` points. A sync call
    has no await. The thread is held until the Redis round-trip returns.
    Every other concurrent request is queued in the socket buffer,
    unprocessed, for the full duration.

    Label: CONC-3 — synchronous call inside async handler blocks the
    event loop. Fix: redis.asyncio.Redis + await scan_iter(...).

--- Why this matters more than the O(N) argument ---
    O(N) is a server-side performance concern — real, but scales with
    key count. The event-loop-blocking problem is a client-side concern
    that affects every concurrent user REGARDLESS of key count. Even
    with ten keys, the sync call inside `async def` serialises all
    concurrent requests. With 500k keys the two failures compound: the
    Redis server is frozen AND the application event loop is frozen,
    simultaneously, for the same window.

--- CAT-1 / CAT-3 category mismatch — DT-METHOD-1 ---
    .keys() is classified as a CAT-1 Query: "returns data, no side
    effect". Under load it behaves as a CAT-3 Command: catastrophic
    side effect on every other client on the Redis instance AND every
    other coroutine on the event loop. The function's category changes
    with load. This is why a CAT-1 test template (A.1 — assert return
    value) passes in CI and the production incident still happens: the
    test asserts the query contract, not the command side effect.

--- The fix ---
    SCAN is cursor-based. Each round-trip returns ~count keys and
    returns a cursor. Between round-trips Redis serves other commands;
    with redis.asyncio the Python event loop serves other coroutines.
    Total traversal is still O(N), but it is amortised and non-blocking
    on BOTH sides.

========================================================================
"""
import time, threading, redis

r = redis.Redis()
r.flushdb()

# --- Seed: 500k keys — enough to make KEYS visibly block ---
for i in range(500_000):
    r.set(f"k:{i}", "x")

latencies = []  # WATCH: latencies[-5:] — recent bystander GET times (ms)

def spam_gets():
    """
    Innocent bystander — a second client doing cheap O(1) GETs.
    This represents 'Customer B' from the formal explanation:
    another concurrent request arriving while Customer A runs .keys().
    """
    c = redis.Redis()
    for _ in range(60):
        t0 = time.perf_counter()
        c.get("k:1")                          # BP-1: single O(1) GET
        ms = (time.perf_counter() - t0) * 1000
        latencies.append(ms)                  # WATCH: ms — baseline <1ms
        print(f"  GET {ms:7.1f} ms")
        time.sleep(0.05)

threading.Thread(target=spam_gets).start()
time.sleep(0.3)

# =========================================================================
# BAD — Customer A calls redis.StrictRedis.keys(pattern)
# =========================================================================
# Both failures fire simultaneously here:
#   Failure 1: Redis KEYS command walks 500k keys, server-side loop frozen.
#   Failure 2: If this were inside `async def`, the Python event loop
#              would also be frozen for the same duration. In this sync
#              toy we simulate Failure 2 with a second OS thread so the
#              bystander can print — in prod asyncio, the bystander
#              coroutine would not even get scheduled.
#
# WATCH during this block:
#   latencies[-1]      → spikes from ~0.3ms to ~400ms (Customer B stalled)
#   len(keyspace)      → 500_000
#   blocking_time_s    → wall-clock of the KEYS command
# =========================================================================
print("\n--- BAD: r.keys('k:*')  [CONC-3 + CAT-1/CAT-3 mismatch] ---")
t0 = time.perf_counter()
keyspace = r.keys("k:*")                      # BP-2: THE BUG
blocking_time_s = time.perf_counter() - t0    # WATCH: blocking_time_s
print(f"--- returned {len(keyspace)} keys in {blocking_time_s:.2f}s ---")
# ^ The CAT-1 test ("did it return the keys?") PASSES here.
#   The CAT-3 side effect (bystander GETs frozen for 400ms) is the
#   production incident the test never catches.

time.sleep(1)

# =========================================================================
# GOOD — r.scan_iter(match=..., count=N)
# =========================================================================
# Cursor-based. Each iteration is one SCAN round-trip returning ~count
# keys. Between round-trips:
#   - Redis server serves other clients (fixes Failure 1)
#   - In async code, `async for` yields to the event loop between
#     batches (fixes Failure 2 — CONC-3)
#
# WATCH during this block:
#   latencies[-1]      → stays <1ms throughout (bystander unaffected)
#   scanned            → grows in batches of ~count per RTT
#   scan_time_s        → longer total wall-clock, but non-blocking
# =========================================================================
print("\n--- GOOD: r.scan_iter(match='k:*', count=500) ---")
t0 = time.perf_counter()
scanned = 0                                   # WATCH: scanned
for _ in r.scan_iter(match="k:*", count=500): # BP-3: the fix
    scanned += 1                              # each iter = one batch RTT
scan_time_s = time.perf_counter() - t0        # WATCH: scan_time_s
print(f"--- iterated {scanned} keys in {scan_time_s:.2f}s ---")

# =========================================================================
# The numbers that matter:
#
#   blocking_time_s  ≈  0.4s   ← Customer B frozen for 0.4s (INCIDENT)
#   scan_time_s      ≈  1.2s   ← longer, but Customer B never noticed
#
# CAT-1 test on both: PASSES (both return the same 500k keys).
# CAT-3 latency assertion on bystander GETs:
#     keys()     → FAILS (p99 > 100ms)
#     scan_iter  → PASSES (p99 < 1ms)
#
# This is why the guide requires a latency assertion in the test
# template for any method whose category can shift under load.
# =========================================================================