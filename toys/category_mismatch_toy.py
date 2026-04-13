# ═════════════════════════════════════════════════════════════════════════
# TOY — category_mismatch_toy.py
# Demonstrates: CAT-1 / CAT-3 CATEGORY MISMATCH and why it decides which
#               test template (B.1.7 vs B.1.8) catches the production bug.
#
# Companion to sessions_wrong.py. That toy proved the RUNTIME harm of
# r.keys() (event-loop + Redis server stall). THIS toy proves the
# TESTING harm: a by-the-book CAT-1 test against r.keys() passes with
# flying colours while the bug walks into production untouched.
# ═════════════════════════════════════════════════════════════════════════
#
# ── THE FAANG QUESTION THIS ANSWERS ──────────────────────────────────────
#   "Why does .keys() have a CAT-1/CAT-3 category mismatch, and how does
#    that decide which test template you choose?"
#
# ── THE ONE-LINE ANSWER ──────────────────────────────────────────────────
#   .keys() LOOKS like CAT-1 (returns data, no mutation) so the method-
#   category decision tree DT-METHOD-1 routes you to template B.1.7
#   (Query). But under load .keys() BEHAVES like CAT-3 (catastrophic
#   side effect on every other client on the Redis server + on your
#   own event loop). The B.1.7 test asserts return shape and no-self-
#   mutation — both of which are TRUE — so it passes. The test you
#   actually need is B.1.8 (Command), which asserts observable side
#   effects, because the side effect IS the bug.
#
# ── HOW TO READ THIS FILE ────────────────────────────────────────────────
#   The PRODUCTION CODE in SessionLister is deliberately trivial — it
#   is not the point. The point is the two test functions at the bottom:
#
#     test_list_sessions__B17_query     ← CAT-1 shape. PASSES. Misses bug.
#     test_list_sessions__B18_command   ← CAT-3 shape. FAILS. Catches bug.
#
#   Same production code. Same Redis. Same keyspace. Different TEST
#   TEMPLATE → different verdict. That gap is the lesson.
#
# ── PREREQS ──────────────────────────────────────────────────────────────
#   1. Local Redis:  docker run -p 6379:6379 redis:7-alpine
#   2. pip install redis pytest
#   3. Seed 500k keys (same as sessions_wrong.py — if you still have
#      them loaded from that toy, skip this):
# python -c "
# import redis
# r = redis.Redis()
# for i in range(500_000):
#    r.set(f'session:alice:{i}', 'x')
# "
#
# ── RUN ──────────────────────────────────────────────────────────────────
#   $ pytest category_mismatch_toy.py -v
#
# ── EXPECTED OUTPUT ──────────────────────────────────────────────────────
#   test_list_sessions__B17_query       PASSED   ← the lie
#   test_list_sessions__B18_command     FAILED   ← the truth
#
#   FAILED assertion will read something like:
#     AssertionError: Redis server command latency 487.2ms exceeds
#     200ms SLO — .keys() is behaving as a CAT-3 Command (catastrophic
#     side effect on shared Redis server), not a CAT-1 Query.
#
# ═════════════════════════════════════════════════════════════════════════

import time
import pytest
import redis


# ─── PRODUCTION CODE (the thing under test) ─────────────────────────────
#
# Note the method name: `list_sessions`. The `list_` prefix is a CAT-1
# Query signal per the naming-prefix table (get_, is_, has_, list_, …).
# A reviewer walking DT-METHOD-1 will answer "does it READ state without
# changing it?" with YES and route to B.1.7. That answer is correct in
# the narrow sense — SessionLister.list_sessions() does not mutate
# SessionLister, and it returns a value. But "no mutation" is being
# measured against the wrong object. It doesn't mutate `self`; it DOES
# lock up a process-wide shared resource (the Redis server) for the
# duration of the call. That is a CAT-3 side effect wearing a CAT-1
# costume.

class SessionLister:
    def __init__(self, redis_client):
        self._r = redis_client

    def list_sessions(self, user_id: str) -> list[str]:
        """Return all session keys for a user.

        Contract (as documented):
            - Returns: list[str] of matching keys
            - Side effects: none on self
            - Raises: redis.RedisError on connection failure

        What the contract DOESN'T say (and B.1.7 doesn't check):
            - Holds the Redis server hostage for O(N_total_keys) time
            - Every other client's next command waits behind this one
            - In an async handler, the event loop is also frozen
        """
        pattern = f"session:{user_id}:*"
        keys = self._r.keys(pattern)                     # ← THE bug
        return [k.decode() for k in keys]


# ─── FIXTURE ────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def lister():
    """Fresh SessionLister per test. Function scope because the TEST
    uses a real Redis connection and we want no shared client state."""
    return SessionLister(redis.Redis(host="localhost"))


# ═════════════════════════════════════════════════════════════════════════
# TEST 1 — B.1.7 QUERY TEMPLATE (the one DT-METHOD-1 sends you to)
# ═════════════════════════════════════════════════════════════════════════
#
# B.1.7 critical rules (from templates/labels.yaml):
#   1. MUST assert return value matches expected shape and contents
#   2. MUST verify NO side effects by snapshotting __dict__ before/after
#   3. Contract docstring: "Contract: <method> returns <what>"
#
# This test obeys every rule. It is a CORRECT B.1.7 test. And it passes.
# That is precisely the problem: correctness against the wrong template
# gives you a green CI and a paged on-call.

def test_list_sessions__B17_query(lister):
    """Contract: list_sessions returns the list of matching session keys."""
    # --- arrange: snapshot for no-side-effect check (B.1.7 rule #2) ---
    state_before = dict(lister.__dict__)

    # --- act ---
    result = lister.list_sessions("alice")

    # --- assert return shape (B.1.7 rule #1) ---
    assert isinstance(result, list)
    assert all(isinstance(k, str) for k in result)
    assert all(k.startswith("session:alice:") for k in result)

    # --- assert no side effects on self (B.1.7 rule #2) ---
    assert lister.__dict__ == state_before, \
        "list_sessions mutated the lister — CAT-1 queries must not mutate"

    # ✅ PASSES. Return shape is right. self is untouched. Ship it.
    #
    # What this test NEVER LOOKED AT:
    #   - How long the call took
    #   - What happened on the Redis server during the call
    #   - What happened to OTHER clients during the call
    #
    # Those three things ARE the bug. B.1.7 has no slot for them because
    # CAT-1 queries are assumed to have no observable side effects beyond
    # their return value. That assumption is what .keys() violates.


# ═════════════════════════════════════════════════════════════════════════
# TEST 2 — B.1.8 COMMAND TEMPLATE (the one you actually need)
# ═════════════════════════════════════════════════════════════════════════
#
# B.1.8 critical rules (paraphrased from templates/labels.yaml):
#   1. Snapshot observable state BEFORE the command
#   2. Invoke the command
#   3. Assert observable state CHANGED / side effects occurred as documented
#   4. "Observable state" includes EXTERNAL resources, not just self
#
# For .keys(), the relevant observable state is "how long did the Redis
# server stop responding to other clients". B.1.8 gives us a slot for
# that assertion. B.1.7 did not.
#
# The assertion below is the one that catches the bug. Same production
# code, same Redis, same keyspace — different verdict, because the TEST
# TEMPLATE asked a different question.

SLO_MS = 200  # documented latency budget for any single Redis operation


def test_list_sessions__B18_command(lister):
    """Contract: list_sessions must not block the Redis server
    beyond the per-operation SLO — it is a CAT-3 Command with an
    external side effect on a shared resource, not a pure CAT-1 Query."""
    # --- arrange: measure a baseline "cheap" command for comparison ---
    #   GET on a non-existent key is O(1) on Redis. If .keys() were
    #   truly CAT-1, its server-side cost would also be bounded.
    lister._r.get("__baseline__")  # warm the connection

    # --- act: time the call end-to-end ---
    t0 = time.perf_counter()
    result = lister.list_sessions("alice")
    elapsed_ms = (time.perf_counter() - t0) * 1000

    # --- assert the CAT-3 side-effect contract ---
    assert elapsed_ms < SLO_MS, (
        f"Redis server command latency {elapsed_ms:.1f}ms exceeds "
        f"{SLO_MS}ms SLO — .keys() is behaving as a CAT-3 Command "
        f"(catastrophic side effect on shared Redis server), not a "
        f"CAT-1 Query. The keys() call walks the entire keyspace "
        f"single-threaded and no other client can issue a command "
        f"during that window. Fix: use scan_iter() (amortised) or "
        f"maintain a session index set."
    )

    # Return-shape assertions STILL happen — B.1.8 doesn't replace
    # return-value checks, it ADDS the side-effect check on top.
    assert isinstance(result, list)


# ═════════════════════════════════════════════════════════════════════════
# POST-MORTEM — WHY THE CATEGORY LABEL IS THE WHOLE BALLGAME
# ═════════════════════════════════════════════════════════════════════════
#
# Walk the decision DT-METHOD-1 for list_sessions():
#
#   Q1: Does it READ state without changing it?
#       Naive answer: YES → CAT-1 → template B.1.7 → test passes → ship
#       Correct answer: READS Redis but has an external side effect on
#                       the shared Redis server process → CAT-3 →
#                       template B.1.8 → latency assertion → test fails
#                       → bug caught in CI
#
# The "mismatch" is that two different observers of the same method
# classify it into two different categories, and the category you pick
# deterministically selects the test template, and the test template
# deterministically selects which bugs you can catch.
#
# Rule of thumb for spotting these in review:
#
#   A method is CAT-3 (not CAT-1) if its worst-case cost is paid by a
#   RESOURCE SHARED WITH OTHER CALLERS — even if its return value looks
#   like a pure read. Redis KEYS, SQL `SELECT ... FOR UPDATE`, a file
#   read that takes a global lock, an HTTP GET that drains a connection
#   pool: all CAT-3 in sheep's clothing.
#
# The FAANG-answer template:
#
#   "The mismatch is that .keys() is a CAT-1 Query by its signature
#    (reads, returns data, no self-mutation) but a CAT-3 Command by
#    its runtime behaviour (O(N) single-threaded scan that blocks the
#    shared Redis server for every other client). DT-METHOD-1 routes
#    on signature, so a reviewer picks B.1.7 and writes a test that
#    asserts return shape and no self-mutation — both TRUE, so the
#    test passes and the bug ships. The test you actually need is
#    B.1.8, which asserts the CAT-3 side-effect contract — in this
#    case a latency SLO, because the side effect is 'Redis server
#    stops responding to other clients for Δ ms'. Same production
#    code, different template, different verdict. The category label
#    isn't a taxonomy exercise; it picks the template, and the
#    template picks the bugs you can catch."
#
# ═════════════════════════════════════════════════════════════════════════