"""
Experiment: FSM State Hydration
Question:   Why can't we keep the FSM as a dict permanently?
Worksheet:  Q1 — FSM state hydration (op3: WhatsAppFSM.from_dict)

Run: python experiments/01_hydration.py

DEBUGGER: PyCharm → Run → Debug '01_hydration'
  🔴 = set breakpoint on this line
  👁️ = add to Watches panel
  F7 = step into, F8 = step over, Alt+F8 = evaluate expression
"""

from enum import Enum


class State(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"
    SUPPORT = "support"

class WhatsAppFSM:

    def __init__(self, state: State, user_id: str):
        self.state = state                          # 👁️ type(self.state) → <enum 'State'>, not <class 'str'>
        self.user_id = user_id
        self.history: list[str] = []

    def transition_to(self, new_state: State) -> None:
        self.history.append(f"{self.state.value} -> {new_state.value}")
        self.state = new_state

    def is_main_menu(self) -> bool:
        return self.state == State.MAIN_MENU

    def to_dict(self) -> dict:
        return {
            "state": self.state.value,              # 👁️ .value strips the enum — returns plain "main_menu" string
            "user_id": self.user_id,
            "history": self.history,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WhatsAppFSM":
        fsm = cls(
            state=State(data["state"]),             # 🔴👁️ THIS IS THE HYDRATION LINE — "main_menu" becomes State.MAIN_MENU
            user_id=data["user_id"],
        )
        fsm.history = data.get("history", [])
        return fsm


# ── PROVE IT ───────────────────────────────────────────────

fsm = WhatsAppFSM(State.MAIN_MENU, "user_123")     # 🔴 F7 into constructor — watch self.state get set as enum
assert fsm.is_main_menu() == True
print(f"1. Live FSM works:          state={fsm.state}, is_main_menu={fsm.is_main_menu()}")

data = fsm.to_dict()                                # 🔴👁️ data["state"] → "main_menu", type → <class 'str'>. The enum is gone.
assert data["state"] == "main_menu"
assert isinstance(data["state"], str)
print(f"2. Dehydrated to dict:      data={data}")

result = data["state"] == State.MAIN_MENU            # 🔴👁️ result → False. "main_menu" != State.MAIN_MENU. Different types.
assert result == False
print(f'3. Dict comparison fails:   "main_menu" == State.MAIN_MENU → {result}')

try:
    data.is_main_menu()                              # 🔴 F8 — lands in except. Dicts have no methods.
except AttributeError as e:                          # 👁️ e → "'dict' object has no attribute 'is_main_menu'"
    print(f"4. Dict has no methods:     {e}")

fsm2 = WhatsAppFSM.from_dict(data)                  # 🔴 F7 into from_dict — watch State(data["state"]) convert "main_menu" → enum
assert fsm2.is_main_menu() == True                   # 👁️ fsm2.state → <State.MAIN_MENU: 'main_menu'>. Behavior restored.
assert fsm2.state == State.MAIN_MENU
print(f"5. Hydrated FSM works:      state={fsm2.state}, is_main_menu={fsm2.is_main_menu()}")

fsm2.transition_to(State.SALES)                      # 🔴 F8 — watch fsm2.state change from MAIN_MENU → SALES
assert fsm2.state == State.SALES                     # 👁️ fsm2.history → ['main_menu -> sales']. Hydrated object fully functional.
assert fsm2.is_main_menu() == False
print(f"6. Can transition:          state={fsm2.state}, history={fsm2.history}")


# ── BREAK IT ───────────────────────────────────────────────
# Uncomment both lines. F7 into from_dict. Watch State("mian_menu") raise ValueError.
# The typo is caught HERE at the boundary, not 50 lines later in routing.

# corrupted = {"state": "mian_menu", "user_id": "user_123"}
# fsm_bad = WhatsAppFSM.from_dict(corrupted)         # 🔴 F7 — ValueError: 'mian_menu' is not a valid State


if __name__ == "__main__":
    print("\n✅ All assertions passed.")
