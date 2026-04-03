"""
Experiment: Round-Trip Testing (to_dict → from_dict)
Question:   Does dehydrate → hydrate give you back the exact same object?
Worksheet:  L2 — FSM transition tests, round-trip assertions

Run: python experiments/04_round_trip.py

DEBUGGER: PyCharm → Run → Debug '04_round_trip'
  🔴 = set breakpoint on this line
  👁️ = add to Watches panel
  F7 = step into, F8 = step over, Alt+F8 = evaluate expression
"""

from enum import Enum
import json


class State(Enum):
    MAIN_MENU = "main_menu"
    SALES = "sales"
    SUPPORT = "support"

class WhatsAppFSM:
    def __init__(self, state: State, user_id: str):
        self.state = state
        self.user_id = user_id
        self.history: list[str] = []
        self.menu_name: str = ""

    def transition_to(self, new_state: State) -> None:
        self.history.append(f"{self.state.value} -> {new_state.value}")
        self.state = new_state

    def to_dict(self) -> dict:
        return {
            "state": self.state.value,
            "user_id": self.user_id,
            "history": self.history,
            "menu_name": self.menu_name,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WhatsAppFSM":
        fsm = cls(
            state=State(data["state"]),
            user_id=data["user_id"],
        )
        fsm.history = data.get("history", [])
        fsm.menu_name = data.get("menu_name", "")
        return fsm

    def __eq__(self, other):
        if not isinstance(other, WhatsAppFSM):
            return NotImplemented
        return self.to_dict() == other.to_dict()


# ── PROVE IT ───────────────────────────────────────────────

original = WhatsAppFSM(State.MAIN_MENU, "user_456") # 🔴👁️ original.state → <State.MAIN_MENU: 'main_menu'>
data = original.to_dict()                            #   👁️ data → {'state': 'main_menu', ...}. Enum stripped to string.
restored = WhatsAppFSM.from_dict(data)               #   👁️ restored.state → <State.MAIN_MENU: 'main_menu'>. Enum restored.
assert original == restored                          #   👁️ original == restored → True. But original is not restored (different objects).
print(f"1. Basic round-trip:     {original.to_dict()} == {restored.to_dict()}")

original.transition_to(State.SALES)                  # 🔴 F8 — watch original.state change MAIN_MENU → SALES
original.transition_to(State.SUPPORT)                #    F8 — watch original.state change SALES → SUPPORT
data2 = original.to_dict()                           #   👁️ data2["history"] → ['main_menu -> sales', 'sales -> support']
restored2 = WhatsAppFSM.from_dict(data2)             #   👁️ restored2.history → same list. History survives the round-trip.
assert restored2.state == State.SUPPORT              #   👁️ restored2.state → State.SUPPORT, not State.MAIN_MENU
assert restored2.history == ["main_menu -> sales", "sales -> support"]
print(f"2. History preserved:    {restored2.history}")

json_str = json.dumps(original.to_dict())            # 🔴👁️ json_str → '{"state": "support", ...}'. Pure text — storable in Redis.
redis_data = json.loads(json_str)                    #   👁️ redis_data → dict again. type(redis_data["state"]) → <class 'str'>
from_redis = WhatsAppFSM.from_dict(redis_data)       #   👁️ from_redis.state → <State.SUPPORT: 'support'>. Enum survived JSON detour.
assert from_redis == original
print(f"3. JSON round-trip:      json → dict → FSM works")

trip1 = WhatsAppFSM.from_dict(original.to_dict())    # 🔴👁️ trip1.to_dict() → matches original
trip2 = WhatsAppFSM.from_dict(trip1.to_dict())       #   👁️ trip2.to_dict() → matches trip1
trip3 = WhatsAppFSM.from_dict(trip2.to_dict())       #   👁️ trip3.to_dict() → matches trip2. No drift after 3 cycles.
assert trip1 == trip2 == trip3 == original            # If this fails, you have a serialization bug that corrupts data over time.
print(f"4. Triple round-trip:    stable after 3 cycles")

from_redis.transition_to(State.MAIN_MENU)            # 🔴 F8 — watch from_redis.state change SUPPORT → MAIN_MENU
assert from_redis.state == State.MAIN_MENU           #   👁️ from_redis.history → 3 entries now. Hydrated object is fully functional.
assert len(from_redis.history) == 3
print(f"5. Behavior after hydration: can transition, history={len(from_redis.history)} entries")


# ── BREAK IT ───────────────────────────────────────────────
# Uncomment. Set 🔴 on the `restored =` line. Watch restored.menu_name.
# It's "" (empty), not "Sales Department". Data silently lost.
# Old Redis data missing new fields doesn't error — it defaults. Test round-trips.

# original.menu_name = "Sales Department"
# bad_dict = original.to_dict()
# del bad_dict["menu_name"]                           # simulate old Redis data without this field
# restored = WhatsAppFSM.from_dict(bad_dict)          # 🔴👁️ restored.menu_name → '' — data silently lost, no error
# print(f"menu_name: '{restored.menu_name}'")


if __name__ == "__main__":
    print("\n✅ All assertions passed.")
