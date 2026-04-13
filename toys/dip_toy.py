
"""
Experiment: Dependency Inversion Principle (DIP)
Question:   Does injecting one shared client through a Protocol eliminate the
            three-independent-pools problem we have in redis_helper.py,
            main.py, and turbo_diesel_ai.py?
Worksheet:  Q2 / SOLID-DIP — three concrete instances of the same client

Run: python experiments/dip_toy.py

DEBUGGER: PyCharm → Run → Debug 'dip_toy'
  🔴 N = breakpoint number N (hit in this order as you press F9 / Resume)
  👁️   = add to Watches panel
  F7  = step into, F8 = step over, F9 = resume, Alt+F8 = evaluate expression

EXECUTION ORDER:
  GOOD path:  BP1 → BP2 → BP3 → BP4 → BP5 → BP6 → BP7
  BAD path:   BP8 → BP9 → BP10 → BP11 → BP12 → BP13

WATCHES TO ADD before running:
  • FakeRedis._instance_count        (the headline counter)
  • shared_client                     (good path — should appear once)
  • bad_sessions.redis                (bad path — pool A)
  • bad_queues.redis                  (bad path — pool B, different object)
"""

from typing import Protocol


# ── SETUP ──────────────────────────────────────────────────

class FakeRedis:
    """Stand-in for redis.Redis. Counts instances so pools are visible."""
    _instance_count = 0

    def __init__(self, host: str = "localhost", port: int = 6379):
        FakeRedis._instance_count += 1                  # 👁️ FakeRedis._instance_count → ticks every construction. Each tick = one new connection pool.
        self.id = FakeRedis._instance_count
        self.host = host
        self.port = port
        self.store: dict[str, str] = {}                 # 👁️ self.store → each instance gets its OWN dict. Keyspace fragmentation in miniature.

    def get(self, key: str) -> str | None:
        return self.store.get(key)

    def set(self, key: str, value: str) -> None:
        self.store[key] = value


class RedisClient(Protocol):
    """The abstraction. Says WHAT methods exist, nothing about WHO implements them."""
    def get(self, key: str) -> str | None: ...
    def set(self, key: str, value: str) -> None: ...


# Two flavours of the same repo. Identical behaviour, different dependency style.

class BadSessionRepo:
    def __init__(self):
        self.redis = FakeRedis()                        # welded to FakeRedis. Constructor reaches out and builds its own pool.

    def save(self, user: str, data: str) -> None:
        self.redis.set(f"session:{user}", data)


class BadQueueRepo:
    def __init__(self):
        self.redis = FakeRedis()                        # second pool, same server, no relationship to the first.

    def enqueue(self, msg: str) -> None:
        self.redis.set("queue:latest", msg)


class GoodSessionRepo:
    def __init__(self, redis: RedisClient):             # depends on the Protocol, not the class. Receives whatever it's handed.
        self.redis = redis

    def save(self, user: str, data: str) -> None:
        self.redis.set(f"session:{user}", data)


class GoodQueueRepo:
    def __init__(self, redis: RedisClient):             # same Protocol, same injection pattern.
        self.redis = redis

    def enqueue(self, msg: str) -> None:
        self.redis.set("queue:latest", msg)


# ── PROVE IT ───────────────────────────────────────────────

FakeRedis._instance_count = 0                           # reset counter for a clean baseline

shared_client = FakeRedis()                             # 🔴 1  ONE pool created. F7 to step into FakeRedis.__init__ — watch _instance_count tick from 0 → 1. This is the only FakeRedis() call in the good path.

good_sessions = GoodSessionRepo(shared_client)          # 🔴 2  F7 into GoodSessionRepo.__init__ — notice the constructor just stores the reference. NO new FakeRedis is built. _instance_count stays at 1.

good_queues = GoodQueueRepo(shared_client)              # 🔴 3  F7 into GoodQueueRepo.__init__ — same story. Reference stored, no construction. _instance_count STILL 1.

good_sessions.save("alice", "logged_in")                # 🔴 4  F7 in to watch the write land in shared_client.store via the injected reference.

good_queues.enqueue("hello world")                      # 🔴 5  F7 in — write goes to the SAME shared_client.store. Both keys now coexist in one dict.

assert FakeRedis._instance_count == 1                   # 🔴 6  👁️ FakeRedis._instance_count → 1. Two repos, one pool. Proven.

assert good_sessions.redis is good_queues.redis         # 🔴 7  👁️ Evaluate (Alt+F8): `good_sessions.redis is good_queues.redis` → True. Literally the same object in memory — not two equal objects, ONE object with two references.

assert good_sessions.redis.store == {
    "session:alice": "logged_in",
    "queue:latest": "hello world",
}


# ── BREAK IT ───────────────────────────────────────────────

FakeRedis._instance_count = 0                           # reset to make the bad path's damage obvious

bad_sessions = BadSessionRepo()                         # 🔴 8  F7 into BadSessionRepo.__init__ → F7 again into FakeRedis.__init__. Watch _instance_count tick to 1. Stack is now 3 deep: <module> → BadSessionRepo.__init__ → FakeRedis.__init__.

bad_queues = BadQueueRepo()                             # 🔴 9  F7 into BadQueueRepo.__init__ → F7 again into FakeRedis.__init__. Watch _instance_count tick to 2. A SECOND FakeRedis is born — distinct object, distinct store dict.

bad_sessions.save("alice", "logged_in")                 # 🔴 10  F7 in — write lands in pool A's store only.

bad_queues.enqueue("hello world")                       # 🔴 11  F7 in — write lands in pool B's store only. Pool A has no idea this happened.

assert FakeRedis._instance_count == 2                   # 🔴 12  👁️ FakeRedis._instance_count → 2. Two repos, two pools. Wasteful AND incorrect.

assert bad_sessions.redis is not bad_queues.redis       # 🔴 13  👁️ Evaluate: `bad_sessions.redis is bad_queues.redis` → False. Two distinct objects. Compare with BP7 — that was True. This is the whole difference.

# The damning evidence: alice's session is invisible to the queue repo's keyspace,
# even though both "live in Redis". They're talking to different pools.
assert bad_sessions.redis.store == {"session:alice": "logged_in"}
assert bad_queues.redis.store == {"queue:latest": "hello world"}

# This is your bug at scale: a write through one pool is invisible to a read through another.
# In real Redis they'd land on the same server, but with no shared transaction context,
# no pipeline coordination, and no single owner of the keyspace.


if __name__ == "__main__":
    print("\n✅ All assertions passed.")