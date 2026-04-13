import asyncio
import time
import redis  # ← SYNCHRONOUS client (the bug)

r = redis.Redis()


async def handle(customer):
    print(f"[{customer}] step 1: handler entered")  # ⬛ BP1
    value = r.get(f"session:{customer}")  # ⬛ BP2  ← blocks thread
    print(f"[{customer}] step 2: redis returned {value}")  # ⬛ BP3
    await asyncio.sleep(0)  # ⬛ BP4  ← yields
    print(f"[{customer}] step 3: done")  # ⬛ BP5


async def main():
    task_a = asyncio.create_task(handle("A"), name="handler-A")
    task_b = asyncio.create_task(handle("B"), name="handler-B")
    await asyncio.gather(task_a, task_b)


asyncio.run(main())
