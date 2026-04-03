"""
Experiment: Enum vs String Comparison
Question:   What exactly happens when you compare a string to an enum?
Worksheet:  Q5 — State.ERROR tuple bug; L2 — FSM transition tests

Run: python experiments/02_enum_vs_string.py

DEBUGGER: PyCharm → Run → Debug '02_enum_vs_string'
  🔴 = set breakpoint on this line
  👁️ = add to Watches panel
  F7 = step into, F8 = step over, Alt+F8 = evaluate expression
"""

from enum import Enum


class State(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"


# ── PROVE IT ───────────────────────────────────────────────

a = State.MAIN_MENU                                 # 🔴👁️ id(a) → note this number
b = State.MAIN_MENU                                 #   👁️ id(b) → same number. Python reuses the same enum object.
assert a is b                                        #   👁️ a is b → True
print(f"1. Enum identity:       State.MAIN_MENU is State.MAIN_MENU → {a is b}")

c = State("main_menu")                              # 🔴👁️ c is State.MAIN_MENU → True. Doesn't create new object — finds existing one.
assert c is State.MAIN_MENU                          #   👁️ id(c) → same number as id(a)
print(f"2. Enum from value:     State('main_menu') is State.MAIN_MENU → {c is State.MAIN_MENU}")

raw = "main_menu"                                    # 🔴👁️ type(raw) → <class 'str'>
match = raw == State.MAIN_MENU                       #   👁️ match → False. str != enum. Python does NOT auto-convert.
match_value = raw == State.MAIN_MENU.value           #   👁️ match_value → True. You have to dig into .value yourself.
assert match == False
assert match_value == True
print(f'3. String vs enum:      "main_menu" == State.MAIN_MENU → {match}')
print(f'4. String vs .value:    "main_menu" == State.MAIN_MENU.value → {match_value}')

state_from_redis = "main_menu"                       # 🔴 This simulates what Redis gives you — a plain string

if state_from_redis == State.MAIN_MENU:              #   👁️ this condition → False. Falls through to else.
    result = "ROUTED CORRECTLY"
else:
    result = "SILENTLY WRONG — fell through to else" # 🔴👁️ result → this string. Every customer misrouted. No error raised.

assert result == "SILENTLY WRONG — fell through to else"
print(f"5. Dict routing fails:  {result}")

state_hydrated = State(state_from_redis)             # 🔴👁️ state_hydrated → <State.MAIN_MENU: 'main_menu'>. String became enum.

if state_hydrated == State.MAIN_MENU:                #   👁️ this condition → True now. Same logic, different outcome.
    result = "ROUTED CORRECTLY"                      #   👁️ result → "ROUTED CORRECTLY". Only the type changed.
else:
    result = "SILENTLY WRONG"

assert result == "ROUTED CORRECTLY"
print(f"6. Hydrated routing:    {result}")

all_states = [s.value for s in State]                # 🔴👁️ all_states → ['main_menu', 'sales']. Enum gives you the complete valid set.
print(f"7. All valid states:    {all_states}")
assert "banana" not in all_states


# ── BREAK IT ───────────────────────────────────────────────
# Uncomment. Set 🔴 on the first `if` inside handle(). Call handle("main_menu").
# F8 through each branch — every one evaluates False. Returns "UNKNOWN".
# No error. No exception. No log. Just wrong behavior in production.

# def handle(state_str: str):
#     if state_str == State.MAIN_MENU:                # 🔴👁️ state_str == State.MAIN_MENU → False
#         return "menu"
#     elif state_str == State.SALES:                   #   👁️ state_str == State.SALES → False
#         return "sales"
#     else:
#         return "UNKNOWN"                             # ← every customer lands here
#
# print(handle("main_menu"))                          # → "UNKNOWN"
# print(handle("sales"))                              # → "UNKNOWN"


if __name__ == "__main__":
    print("\n✅ All assertions passed.")
