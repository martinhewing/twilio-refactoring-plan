"""
Experiment: State.ERROR Tuple Bug
Question:   Why does a trailing comma in an enum create a tuple instead of a string?
Worksheet:  Q5 — State.ERROR = ("Error",) — customers permanently stuck

Run: python experiments/03_error_tuple_bug.py

DEBUGGER: PyCharm → Run → Debug '03_error_tuple_bug'
  🔴 = set breakpoint on this line
  👁️ = add to Watches panel
  F7 = step into, F8 = step over, Alt+F8 = evaluate expression
"""

from enum import Enum
import json


class BuggyState(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"
    ERROR = ("Error",)                               # ← THE BUG: trailing comma makes this a tuple


class FixedState(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"
    ERROR = "error"                                  # ← correct: just a string


# ── PROVE IT ───────────────────────────────────────────────

buggy_val = BuggyState.ERROR.value                   # 🔴👁️ buggy_val → ('Error',) — it's a tuple, not a string
buggy_type = type(buggy_val)                         #   👁️ buggy_type → <class 'tuple'>
assert isinstance(buggy_val, tuple)
print(f"1. BuggyState.ERROR.value = {buggy_val!r}")
print(f"   type = {buggy_type}")

cmp_result = BuggyState.ERROR.value == "Error"       # 🔴👁️ cmp_result → False. tuple != string. Always.
assert cmp_result == False
print(f'2. ("Error",) == "Error" → {cmp_result}')

fsm_data = {"state": BuggyState.ERROR.value}         # 🔴👁️ fsm_data → {'state': ('Error',)}. Tuple stored in the dict.
print(f"3. Stored in dict:  {fsm_data}")

serialized = json.dumps(fsm_data)                    # 🔴👁️ serialized → '{"state": ["Error"]}'. Tuple became JSON array.
deserialized = json.loads(serialized)                 #   👁️ deserialized["state"] → ['Error']. JSON array became Python list.
assert deserialized["state"] == ["Error"]             #   👁️ type(deserialized["state"]) → <class 'list'>. Third type for same data.
print(f"4. After JSON round-trip: {deserialized}")

try:
    BuggyState(deserialized["state"])                 # 🔴 F8 — lands in except. ['Error'] is not a valid BuggyState.
except ValueError as e:                              #   👁️ e → "'['Error'] is not a valid BuggyState'"
    print(f"5. Hydration fails:  {e}")               #   Customer stuck. State in Redis can't be hydrated. No recovery path.

try:
    recovered = BuggyState(tuple(deserialized["state"]))  # 🔴👁️ tuple(['Error']) → ('Error',) → matches BuggyState.ERROR
    print("6. Tuple reconstruction: works but fragile")    #   But your hydration code needs special tuple-handling for one field.
except ValueError:
    print("6. Tuple reconstruction: fails")

fixed_val = FixedState.ERROR.value                   # 🔴👁️ fixed_val → 'error'. Just a string. type → <class 'str'>.
assert isinstance(fixed_val, str)
print(f"\n7. FixedState.ERROR.value = {fixed_val!r} (type={type(fixed_val).__name__})")

fixed_hydrated = FixedState("error")                 # 🔴👁️ fixed_hydrated → <FixedState.ERROR: 'error'>. One line. No special cases.
assert fixed_hydrated == FixedState.ERROR
print(f'8. FixedState("error") works: {fixed_hydrated}')


# ── BREAK IT ───────────────────────────────────────────────
# Uncomment. Set 🔴 on the first `if`. Call route_customer("Error").
# F8 through every branch — all evaluate False. Customer lands in "STUCK".
# No exception. No log. Customer permanently trapped.

# def route_customer(state_value_from_redis: str):
#     if state_value_from_redis == BuggyState.MAIN_MENU.value:    # 🔴👁️ → False
#         return "Show menu"
#     elif state_value_from_redis == BuggyState.SALES.value:       #   👁️ → False
#         return "Show sales"
#     elif state_value_from_redis == BuggyState.ERROR.value:       #   👁️ → False. "Error" (str) != ("Error",) (tuple)
#         return "Show error recovery"
#     else:
#         return "STUCK — no branch matched"                       # ← customer lands here forever
#
# print(route_customer("Error"))                                   # → "STUCK"
# print(route_customer(("Error",)))                                # → "Show error recovery" — but Redis never stores tuples


if __name__ == "__main__":
    print("\n✅ All assertions passed.")
