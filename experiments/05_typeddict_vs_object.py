"""
Experiment: TypedDict vs Real Objects
Question:   Does TypedDict give us any runtime protection?
Worksheet:  Follow-up from hydration discussion

Run: python experiments/05_typeddict_vs_object.py

DEBUGGER: PyCharm → Run → Debug '05_typeddict_vs_object'
  🔴 = set breakpoint on this line
  👁️ = add to Watches panel
  F7 = step into, F8 = step over, Alt+F8 = evaluate expression
"""

from enum import Enum
from typing import TypedDict


class State(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"

class FSMData(TypedDict):
    state: str
    user_id: str

class FSMObject:
    def __init__(self, state: State, user_id: str):
        self.state = state
        self.user_id = user_id

    def is_main_menu(self) -> bool:
        return self.state == State.MAIN_MENU


# ── PROVE IT ───────────────────────────────────────────────

data: FSMData = {"state": "main_menu", "user_id": "user_1"}  # 🔴👁️ type(data) → <class 'dict'>. NOT FSMData. Just a dict.
assert type(data) is dict
print(f"1. TypedDict type:      {type(data).__name__} (just a dict)")

garbage: FSMData = {"state": 99999, "user_id": None}  # 🔴👁️ garbage["state"] → 99999. No error. TypedDict doesn't validate at runtime.
assert garbage["state"] == 99999                       #   👁️ type(garbage["state"]) → <class 'int'>. The `: str` hint did nothing.
print(f"2. Garbage accepted:    state={garbage['state']} (no runtime error)")

try:
    data.is_main_menu()                                # 🔴 F8 — lands in except. Dicts don't have custom methods.
except AttributeError as e:                            #   👁️ e → "'dict' object has no attribute 'is_main_menu'"
    print(f"3. No methods:          {e}")

try:
    bad = FSMObject(State("banana"), "user_1")         # 🔴 F7 into State("banana") — raises ValueError before __init__ even runs
except ValueError as e:                                #   👁️ e → "'banana' is not a valid State". Bad data rejected at the door.
    print(f"4. Object rejects bad:  {e}")

obj = FSMObject(State.MAIN_MENU, "user_1")             # 🔴👁️ obj.state → <State.MAIN_MENU: 'main_menu'> (enum, not string)
assert obj.is_main_menu() == True                      #   👁️ obj.is_main_menu() → True. Compare: data.is_main_menu() crashed (step 3).
print(f"5. Object has behavior: is_main_menu() = {obj.is_main_menu()}")

# 🔴 Alt+F8 evaluate all of these to see the full picture:
#   type(data)                         → <class 'dict'>
#   type(obj)                          → <class 'FSMObject'>
#   hasattr(data, 'is_main_menu')      → False
#   hasattr(obj, 'is_main_menu')       → True
#   data["state"] == State.MAIN_MENU   → False (str vs enum)
#   obj.state == State.MAIN_MENU       → True  (enum vs enum)
print("\n── Protection Spectrum ──")
print("  dict          → no type info, no validation, no methods")
print("  TypedDict     → type hints for linter ONLY, still a dict at runtime")
print("  dataclass     → real attributes, but no validation unless you add it")
print("  class + enum  → real attributes + validated values + methods")
print("  pydantic      → auto-validation + auto-coercion + methods")


# ── BREAK IT ───────────────────────────────────────────────
# Uncomment. Set 🔴 on the print line. Watch session in Variables panel.
# session has 3 keys — TypedDict declared 2. No error. Extra fields silently accepted.
# In production: stale/unexpected fields persist in Redis undetected.

# session: FSMData = {"state": "main_menu", "user_id": "user_1", "hacked_field": "surprise"}
# print(f"Extra fields accepted: {session}")           # 🔴👁️ len(session) → 3. TypedDict said 2 fields. Python doesn't care.


if __name__ == "__main__":
    print("\n✅ All assertions passed.")
