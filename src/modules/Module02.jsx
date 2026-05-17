import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// THEME — identical palette to Module 01.
// ═══════════════════════════════════════════════════════════════════

const T = {
  paper: "#FAF9F6", surface_1: "#F5F2EC", surface_2: "#EBE6DB",
  border_soft: "#E8E4DB", border_med: "#D9D4C7", border_strong: "#8A8276",
  ink_1: "#2B2826", ink_2: "#5A5550", ink_3: "#7A7368", ink_ghost: "#C0BAB0",
  acc_fill: "#F5E8DF", acc_border: "#C96E4A", acc_ink: "#8A3D1F",
  slate: "#6B7B8E", slate_fill: "#EAECEF",
  plum: "#8E6B8E", plum_fill: "#EFE9EF",
  sage: "#7A8E6B", sage_fill: "#ECEFE7",
  ochre: "#B89461", ochre_fill: "#F1ECDF",
  teal: "#5E8E91", teal_fill: "#E7EDED",
  clay: "#A37857", clay_fill: "#F0E9E2"
};

const FONT_SERIF = "'Iowan Old Style', 'Palatino', 'Georgia', serif";
const FONT_SANS = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
const FONT_MONO = "'Menlo', 'Consolas', 'Courier New', monospace";

// ═══════════════════════════════════════════════════════════════════
// MODULE 02 SECTION REGISTRY
// ═══════════════════════════════════════════════════════════════════

const SECTIONS = [
{ id: "orientation", label: "Orientation", icon: "◈", locked: true, prev: null },
{ id: "pre-prompt", label: "Pre-Prompt Gate", icon: "◆", locked: true, prev: "Orientation" },
{ id: "setup", label: "Setup", icon: "›", locked: true, prev: "Pre-Prompt Gate" },
{ id: "requirements", label: "Requirements", icon: "①", locked: true, prev: "Setup" },
{ id: "core-objects", label: "Core Objects", icon: "②", locked: true, prev: "Requirements" },
{ id: "composition", label: "Composition Gate", icon: "③", locked: true, prev: "Core Objects" },
{ id: "protocols", label: "Protocol vs ABC", icon: "④", locked: true, prev: "Composition Gate" },
{ id: "class-design", label: "Class Design", icon: "⑤", locked: true, prev: "Protocol vs ABC" },
{ id: "tdd-corpus", label: "TDD Test Corpus", icon: "◉", locked: false, prev: null },
{ id: "implementation", label: "Implementation", icon: "⑥", locked: true, prev: "TDD Test Corpus" },
{ id: "deep-dive", label: "Deep Dive", icon: "▼", locked: true, prev: "Implementation" },
{ id: "anti-pattern", label: "Anti-Pattern Hunt", icon: "!", locked: true, prev: "Deep Dive" },
{ id: "tradeoffs", label: "Trade-off Matrix", icon: "↔", locked: true, prev: "Anti-Pattern Hunt" },
{ id: "mock-interview", label: "Mock Interview", icon: "▶", locked: true, prev: "Trade-off Matrix" }];


// ═══════════════════════════════════════════════════════════════════
// MODULE 02 CONTENT — TDD CORPUS (the two Units of Work)
// ═══════════════════════════════════════════════════════════════════

const RED_TEMPLATE_CARD1 = `# CAT-x:     CAT-6 Orchestration (caller's perspective)
# OOP/SOLID: SOLID-DIP — collaborators injected via Protocol
# Template:  B.1.9 Orchestration + B.1.5 Dependency Injection
# Style:     behavior-only — fakes at the boundary, no internal-state assertions

class Test<UserBehavior>:
    """User behavior: <one-sentence statement of what the caller observes>."""

    def test_<vehicle_entering_an_available_lot_receives_a_ticket>(self):
        # ARRANGE — fakes simulating the collaborators the facade will need
        <spot>         = FakeSpot(spot_number=<n>, size=<size>)
        <allocator>    = FakeAllocator(returns_spot=<spot>)
        <calculator>   = NeverCalledCalculator()   # not exercised in this test

        <lot>          = <FacadeClass>(allocator=<allocator>, calculator=<calculator>)
        <vehicle>      = <ValueObject>(<plate>, <size>)

        # ACT — the only thing the user does
        <ticket>       = <lot>.<entry_verb>(<vehicle>)

        # ASSERT — only what the caller can observe
        assert <ticket> is not None                            # a ticket was issued
        assert <ticket>.<vehicle_field> == <vehicle>           # identifies THIS vehicle
        assert <ticket>.<spot_field>    == <spot_number>       # at the chosen spot

        # ✗ FORBIDDEN — these would couple the test to internal storage:
        # assert <lot>._<internal_state>[<ticket>.<id>] == ...
        # assert <allocator>.<method>.call_count == 1`;

const GREEN_TEMPLATE_CARD1 = `# Fill in only what the test demands. Every type and field below
# exists because the RED test named it. Nothing else belongs here yet.

from dataclasses import dataclass
from datetime    import datetime
from enum        import IntEnum
from typing      import Protocol
from uuid        import uuid4


class <SizeEnum>(IntEnum):
    <SMALL>  = <?>
    <MEDIUM> = <?>
    <LARGE>  = <?>


@dataclass(<frozen=?>)
class <ValueObject>:
    <plate_field>: <type>
    <size_field>:  <SizeEnum>


@dataclass(<frozen=?>)
class <Ticket>:
    <id_field>:      <type>
    <vehicle_field>: <ValueObject>
    <spot_field>:    <type>
    <entry_field>:   <type>


class <AllocatorProtocol>(Protocol):
    def <allocate_verb>(self, vehicle: <ValueObject>) -> <ReturnType>: ...


class <CalculatorProtocol>(Protocol):
    ...   # shape unknown — no test demands a method yet


@dataclass
class <FacadeClass>:
    <allocator_field>:  <AllocatorProtocol>
    <calculator_field>: <CalculatorProtocol>

    def <entry_verb>(self, vehicle: <ValueObject>) -> <Ticket> | None:
        # 1. ask the allocator for a spot
        # 2. if no spot — what does the test require you to return?
        # 3. otherwise — construct and return a <Ticket>
        ...`;

const RED_TEMPLATE_CARD2 = `# Style: behavior-only — we observe "spot freed" through a second <entry_verb>(),
# not through <allocator>.<release>.assert_called_with(<spot>).
# Interaction-style assertions are themselves a coupling we avoid.

def test_<a_freed_spot_is_observably_available_for_the_next_vehicle>(self):
    <only_spot>   = FakeSpot(spot_number=<n>, size=<size>)
    <allocator>   = <SingleSpotAllocator>(spot=<only_spot>)   # reuses the same spot
    <calculator>  = FakeCalculator(returns_fare=<amount>)
    <lot>         = <FacadeClass>(allocator=<allocator>, calculator=<calculator>)

    # First vehicle takes the only spot
    <ticket_1>    = <lot>.<entry_verb>(<ValueObject>(<plate_1>, <size>))
    assert <ticket_1> is not None

    # First vehicle leaves — fare is observable
    <fare>        = <lot>.<exit_verb>(<ticket_1>.<id_field>)
    assert <fare> == <expected_amount>

    # Second vehicle can now park — observable via the next <entry_verb>()
    <ticket_2>    = <lot>.<entry_verb>(<ValueObject>(<plate_2>, <size>))
    assert <ticket_2> is not None
    assert <ticket_2>.<spot_field> == <same_spot_number>   # the SAME physical spot`;

const PRESSURE_LIST_CARD1 = [
{ name: "VehicleSize", labels: ["DEC-6.2"], note: "An IntEnum, not three subclasses — size is data, not type" },
{ name: "Vehicle", labels: ["TAX-VALUE", "DEC-6.2"], note: "Frozen value object holding plate + size" },
{ name: "Ticket", labels: ["TAX-VALUE"], note: "Frozen value object — id, vehicle, spot, entry_time" },
{ name: "Allocator Protocol", labels: ["PRT-2", "DT-PRT-2"], note: "Single method allocate(vehicle); structural typing only" },
{ name: "Calculator Protocol", labels: ["PRT-2"], note: "Empty for now — no test demands a method yet" },
{ name: "ParkingLot", labels: ["PAT-4", "TAX-SVC", "SOLID-DIP"], note: "Facade — collaborators injected, no internal instantiation" }];


const REFACTOR_NOTES_CARD1 = {
  do: [
  { text: "frozen=True on Vehicle and Ticket — the dataclass machinery gives __eq__ and __hash__", labels: ["DEC-6.2", "OBJ-1"] },
  { text: "Inject collaborators via @dataclass auto-generated __init__", labels: ["SOLID-DIP"] }],

  dont: [
  { text: "Don't add lot.exit() yet — no test demands it", labels: ["OOP-ABSTR-AP4"] },
  { text: "Don't add internal storage (e.g. _active_tickets) yet — no test demands it", labels: ["OOP-ABSTR-AP4"] },
  { text: "Don't write a concrete SpotAllocator yet — the Protocol is all we need", labels: ["SOLID-DIP", "PRT-2"] },
  { text: "Don't backfill test_vehicle_equality — frozen=True already guarantees it", labels: ["DEC-6.2"] }]

};

const BOUNDARIES_TABLE_CARD1 = [
{ kind: "observable", assertion: "ticket is not None", justification: "Return value from the method under test", label: "CAT-1" },
{ kind: "observable", assertion: "ticket.vehicle == vehicle", justification: "Value-object equality on returned ticket", label: "OBJ-1" },
{ kind: "observable", assertion: "ticket.spot_number == 42", justification: "Field on the returned ticket — caller can read it", label: "CAT-1" },
{ kind: "forbidden", assertion: "lot._active_tickets[ticket.ticket_id] == ...", justification: "Reaches into internal storage the user never sees", label: "OOP-ENCAP-AP4" },
{ kind: "forbidden", assertion: "allocator.allocate.call_count == 1", justification: "Interaction counting — breaks on caching, retry, batching", label: "OOP-POLY-AP1" },
{ kind: "forbidden", assertion: "isinstance(ticket, ConcreteTicket)", justification: "Type identity — breaks on legitimate Protocol-conforming substitutes", label: "OOP-POLY-AP1" }];


const PRESSURE_LIST_CARD2 = [
{ name: "exit method", labels: ["CAT-6"], note: "lot.exit(ticket_id) — the user's other action" },
{ name: "release on Allocator", labels: ["PRT-2"], note: "Protocol grows a method — second enter() can't pass without it" },
{ name: "calculate on Calculator", labels: ["PRT-2", "PAT-6"], note: "Protocol grows — fare must be computed somehow" },
{ name: "lot storage", labels: ["SOLID-DIP"], note: "Lot needs to map ticket_id → spot — appears now, not before" },
{ name: "CompletedParking", labels: ["TAX-VALUE", "DEC-6.2"], note: "New value object carrying entry+exit times to the Calculator" }];


// ═══════════════════════════════════════════════════════════════════
// 21 MINI-ORAL DEFENSES — full data: label, summary, question, 4 slots
// ═══════════════════════════════════════════════════════════════════













const TAG_COLORS = {
  sage: { color: T.sage, fill: T.sage_fill },
  slate: { color: T.slate, fill: T.slate_fill },
  clay: { color: T.clay, fill: T.clay_fill },
  acc: { color: T.acc_ink, fill: T.acc_fill },
  teal: { color: T.teal, fill: T.teal_fill },
  ochre: { color: T.ochre, fill: T.ochre_fill },
  plum: { color: T.plum, fill: T.plum_fill }
};

const ORAL_DEFENSES_CARD1 = [
{
  id: "m02_oral_b19_c1",
  label: "B.1.9",
  tagColor: "sage",
  summary: "Defend orchestration testing over interaction testing",
  question: "Your B.1.9 test asserts only on the ticket returned by lot.enter(). A reviewer says: 'You're missing coverage — you never verify that allocator.allocate() was actually called. If I refactor and break that wiring, your test won't catch it.' Defend the omission.",
  position: "We assert on the ticket the lot returns, not on the calls the lot makes — because the contract is 'a vehicle that can be parked receives a ticket,' and that contract is fully expressed in the returned ticket's fields.",
  mechanics: "If allocator.allocate() were not called and the lot somehow still returned a valid ticket pointing to spot 42, the test would still pass — but only in a hypothetical where the wiring is irrelevant. In practice, the only way to produce ticket.spot_number == 42 is to call the allocator and read what it returned. The outcome-level assertion captures the interaction by capturing its only observable consequence.",
  stakes: "A future refactor might replace the allocator with a cached lookup, an event-sourced spot service, or a leasing protocol. The interaction-level test breaks under every one of those refactors; the outcome-level test breaks only when user-facing behavior changes. The 'missing coverage' worry treats coverage as per-line of production code. B.1.9 treats it as per-outcome-the-user-cares-about.",
  principle: "Interaction-based coverage trades refactor cost for localization. Localization is what a debugger is for; correctness is what tests are for."
},
{
  id: "m02_oral_b15_c1",
  label: "B.1.5",
  tagColor: "sage",
  summary: "Defend constructor injection vs internal instantiation",
  question: "A teammate proposes that ParkingLot() should have sensible defaults: with no arguments, it instantiates InMemorySpotAllocator() internally. 'It's just convenience for the 90% case.' Defend rejecting this.",
  position: "Collaborators must arrive through __init__, not be instantiated inside the class. Sensible defaults that wire concrete collaborators belong in a factory function, not in the domain object itself.",
  mechanics: "The moment ParkingLot() calls InMemorySpotAllocator() internally, every test must either work with that concrete allocator (slow, stateful, hard to control) or reach inside the class to monkey-patch it. The seam where a fake plugs in is gone. The class is no longer testable in isolation, because it no longer has an isolation boundary.",
  stakes: "The cost of moving defaults into a factory is one extra function and a call at the construction site. The cost of leaving them inside the class is every test in the suite paying the price for the rest of the project's lifetime. Convenience for the 90% case is real, but it belongs one layer up.",
  principle: "Factory functions are where details live. Domain objects stay abstract. The convenience argument confuses where wiring should happen with what should do the wiring."
},
{
  id: "m02_oral_cat6_c1",
  label: "CAT-6",
  tagColor: "slate",
  summary: "Defend CAT-6 over CAT-2 classification",
  question: "Someone claims lot.enter(vehicle) is just CAT-2 Query — it asks the lot for a ticket and gets one back. Defend the CAT-6 Orchestration classification instead, and explain why the distinction is not academic.",
  position: "lot.enter(vehicle) is CAT-6 Orchestration, not CAT-2 Query. The classification looks pedantic but determines the test template that follows from it.",
  mechanics: "CAT-2 Query is 'ask one object about its own state, get a derived answer' — ticket.is_expired(), vehicle.size. The whole computation is local to the object's own fields. lot.enter() is the opposite: the lot delegates to an injected allocator ('which spot?'), constructs a Ticket value object, and returns a synthesized result. It has no internal answer to give; it composes one from collaborators.",
  stakes: "Misclassifying CAT-6 as CAT-2 produces the wrong test shape — typically a pure-input/output test with no fakes, which then either uses real collaborators (turning the unit test into an integration test) or stubs them with mocks that invite interaction-style assertions. Either failure mode poisons the suite.",
  principle: "CAT classification drives every downstream choice — where the method lives, how it's tested, what gets injected. Getting CAT wrong propagates through the entire design."
},
{
  id: "m02_oral_taxsvc_c1",
  label: "TAX-SVC",
  tagColor: "clay",
  summary: "Defend why ParkingLot is not an entity",
  question: "A teammate argues ParkingLot is an entity because there's only one instance in production and it persists across the application's lifetime. Why is that wrong?",
  position: "ParkingLot is a service (TAX-SVC), not an entity. Singleton-ness in production is a deployment fact, not a domain fact, and the two must not be conflated.",
  mechanics: "An entity has identity in the domain — a User with id 42 remains that user after every field changes. The fact that the application happens to construct one ParkingLot does not give that instance domain identity. Two lots constructed with identical collaborators are interchangeable; there is no 'this lot vs that lot' distinction worth preserving.",
  stakes: "Entity classification implies persistence, identity tracking, repository patterns, and probably an ORM. Services need none of those. Misclassifying drags in machinery that has real cost (more code, more coupling, slower tests) and no benefit. The taxonomy mistake compounds into every layer that follows.",
  principle: "If equality between two instances with the same fields is meaningful, the class is a value or service; if not, it is an entity. ParkingLot fails the entity test on every axis."
},
{
  id: "m02_oral_taxvalue_c1",
  label: "TAX-VALUE",
  tagColor: "clay",
  summary: "Defend Ticket as a value object",
  question: "An interviewer says: 'A Ticket has a unique ticket_id. Doesn't that make it an entity, not a value?' Defend the value-object classification.",
  position: "Ticket is a value object even though it has a unique ticket_id. The id is a field that identifies which ticket, not a domain identity that survives field changes.",
  mechanics: "Consider a banknote's serial number. The serial uniquely identifies which note, but the banknote is still a value object — two notes with the same serial from a counterfeiter's press are forensically identical; a real and a fake with different serials are different banknotes. The serial is part of the value, not an identity layered on top of it.",
  stakes: "Misclassifying Ticket as an entity would pull in persistence, mutation tracking, and identity-based equality. None of that fits the domain — tickets are issued, then redeemed and discarded. They are closed event records, not entities with a lifecycle worth tracking through changes.",
  principle: "If you cannot mutate the object without violating its meaning, it is a value. The frozen dataclass is the syntactic admission of that semantic fact."
},
{
  id: "m02_oral_dip_c1",
  label: "SOLID-DIP",
  tagColor: "acc",
  summary: "Defend DIP as more than 'use interfaces'",
  question: "A coworker says DIP just means 'use interfaces instead of concrete types in your function signatures' — that's it. Defend the deeper claim DIP is actually making.",
  position: "DIP is about controlling the direction of source-code dependency, not about whether your function signatures contain interface types. The signature-level reading is downstream of the principle, not the principle itself.",
  mechanics: "The actual principle: high-level modules (orchestrators like ParkingLot) and low-level modules (infrastructure like RedisSpotAllocator) both depend on abstractions defined in or near the high-level layer. The infrastructure module imports from the domain module — never the other way around. Source-code dependency now flows toward the domain. That is the inversion.",
  stakes: "Without this direction control, the domain layer is uncompilable, untestable, and unreasonable about without the infrastructure existing. With it, the domain is independent — testable in isolation, deployable without infrastructure, evolving on its own schedule. The lot doesn't know Redis exists; Redis knows the Allocator protocol exists.",
  principle: "DIP's payoff is architectural independence, not signature flexibility. The 'use interfaces' rule is a symptom of the principle, not its substance."
},
{
  id: "m02_oral_pat4_c1",
  label: "PAT-4",
  tagColor: "acc",
  summary: "Defend the lot as a facade, not a God Object",
  question: "A reviewer complains: 'Your ParkingLot knows about allocators, calculators, tickets, and spots — that's a God Object. Split it.' Defend it as a facade instead.",
  position: "ParkingLot is a facade (PAT-4), not a God Object. A facade coordinates subsystems behind one entry point; a God Object implements unrelated responsibilities itself.",
  mechanics: "The body of lot.enter() is pure composition — ask the allocator, build a value, return it. No business logic. The lot does not allocate spots (the allocator does), calculate fares (the calculator does), or manage spot state (the allocator's storage does). It delegates each responsibility to a collaborator across a Protocol-shaped seam.",
  stakes: "If the reviewer's 'split it' suggestion were followed, the user-facing API dissolves into three separate calls — allocator.allocate(), build ticket, register ticket somewhere. Every caller now coordinates what was the lot's job. The complexity moves; it doesn't disappear. The dissolution makes the system harder to use, not easier.",
  principle: "A facade's defining trait is concealment of multi-subsystem coordination behind one entry point. Coordination is not conflation; the reviewer conflates the two."
},
{
  id: "m02_oral_poly2_c1",
  label: "POLY-2",
  tagColor: "acc",
  summary: "Defend Protocol over ABC for Allocator",
  question: "A coworker argues: 'Allocator should be an ABC so that anyone claiming to be an allocator must explicitly subclass it. Otherwise typos in method names slip through.' Defend Protocol instead.",
  position: "Allocator is a Protocol, not an ABC. Structural typing is sufficient at every boundary we control, and choosing nominal subclassing where it isn't required is gratuitous coupling.",
  mechanics: "The 'typos slip through' worry is addressed by static type checkers (mypy, pyright) — they catch Protocol conformance failures at the call site, exactly as they catch ABC conformance failures at instantiation. Both catch issues before runtime. The difference is import topology: Protocol requires zero inheritance; ABC requires every implementation to import and subclass the abstract base.",
  stakes: "With Protocol, FakeAllocator in tests imports nothing from the production allocator module. With ABC, the test module must subclass the production class, introducing coupling between test and production code and circular-dependency risk. The 'explicit inheritance is safer' intuition assumes the alternative is unchecked duck typing; in Python, the alternative is structural typing checked by tools — same safety net, less coupling.",
  principle: "Reach for ABC only when something outside your control demands nominal subclassing. For boundaries you own, Protocol is correct by default."
},
{
  id: "m02_oral_prt2_c1",
  label: "PRT-2",
  tagColor: "teal",
  summary: "Defend grouping methods into one Protocol",
  question: "An ISP purist argues: 'Your Allocator Protocol with three methods (allocate, release, available_count) violates Interface Segregation — split it into three single-method Protocols.' Defend the multi-method shape.",
  position: "A single Allocator Protocol with three methods (allocate, release, available_count) is the right shape — not three single-method Protocols.",
  mechanics: "ISP says clients should not be forced to depend on methods they don't use. In practice, the lot's lifecycle requires allocate and release on the same object — they operate on shared state ('this spot is now taken'). Splitting them across Protocols means every implementation has to implement both anyway, and every client would inject the same object under two different type annotations.",
  stakes: "Over-segregation (the ISP-AP1 anti-pattern in the guide) produces more code without more flexibility. The hypothetical 'client that only uses allocate' doesn't exist in this design and, if it appeared later, would be a one-line refactor to extract a sub-Protocol at that time.",
  principle: "ISP is a smell detector, not a rule. Forced segregation below natural cohesion adds code without adding flexibility."
},
{
  id: "m02_oral_prt4_c1",
  label: "PRT-4",
  tagColor: "teal",
  summary: "Defend hand-written Fakes over MagicMock",
  question: "A colleague says: 'Writing FakeAllocator is reinventing what MagicMock(spec=Allocator) gives you in one line. Stop hand-rolling test doubles.' Defend writing them yourself.",
  position: "FakeAllocator is a hand-written test double conforming to the Allocator Protocol — not a MagicMock(spec=Allocator). The test requires real behavior, not just shape conformance.",
  mechanics: "MagicMock gives you something that conforms to the shape of the Protocol but has no behavior — every method returns another mock. That's fine if you intend to assert 'this was called with these args.' But we don't make those assertions; we assert on observable outcomes, which requires the fake to actually do something an allocator does — track which spots are taken, return None when none are available.",
  stakes: "A FakeAllocator with five lines of real state (self._taken: set[int]) is a working alternative implementation. The lot doesn't know it's a fake. The test asserts on what the lot returned. The fake is invisible at the assertion layer — exactly the seam we want. MagicMock would push the test toward assert_called_with, dragging it back into coupling we already refused.",
  principle: "The shape of the test double determines the shape of the tests you'll write. Hand-written fakes invite behavior-style assertions; mocks invite interaction-style assertions."
},
{
  id: "m02_oral_dec62_c1",
  label: "DEC-6.2",
  tagColor: "ochre",
  summary: "Defend frozen=True even when nothing mutates Vehicle",
  question: "A pragmatic teammate says: 'Why make Vehicle frozen? You're never going to mutate it anyway — frozen=True is just clutter.' Defend the decorator.",
  position: "@dataclass(frozen=True) on Vehicle is non-negotiable, even though no current code mutates a Vehicle instance.",
  mechanics: "'You're never going to mutate it anyway' is intent — and intent is not enforceable by anything except frozen=True. The next engineer, three months from now, under deadline pressure, adds vehicle.size = new_size. Tests don't catch it because we test observable behavior. Now Vehicle has lifecycle semantics it never had, and assumptions throughout the codebase quietly become wrong.",
  stakes: "The 'clutter' argument also misses a bundled benefit — frozen=True generates __hash__, which means Vehicles can be dict keys and set members. Without it, the first test that puts a Vehicle in a set crashes with TypeError: unhashable type. One decorator, two guarantees, zero ongoing cost.",
  principle: "The decorator is documentation enforced by the compiler. That is the highest-quality documentation we have."
},
{
  id: "m02_oral_dttax1_c1",
  label: "DT-TAX-1",
  tagColor: "plum",
  summary: "Defend classifying before designing",
  question: "An interviewer says: 'Stop talking about taxonomy — just write the class.' Defend why the DT-TAX-1 step is non-negotiable before any code.",
  position: "The taxonomy step (DT-TAX-1) is non-negotiable before writing any class. The taxonomy fork determines the entire shape that follows — frozen vs mutable, equality-by-value vs equality-by-identity, fields owned vs collaborators injected.",
  mechanics: "A class that 'feels like data' but actually orchestrates collaborators becomes an entity-shaped service — mutable, identity-tracked, persisted — when it should have been a stateless coordinator. A class that 'feels like behavior' but is actually pure data becomes a service-shaped value — mutable when it shouldn't be, missing __eq__, unable to go in sets. The fork between TAX-VALUE, TAX-ENTITY, TAX-SVC, and TAX-FACTORY decides every one of those traits.",
  stakes: "One minute of classification at the design stage costs nothing. One refactor when the wrong machinery starts to bite costs an afternoon and risks breakage in code that depends on the original shape. The asymmetry is enormous, and the cost only compounds as more code grows around the wrong taxonomy.",
  principle: "The interviewer who says 'just write the class' is testing whether you cargo-cult or reason. The reasoned answer is both faster and more correct."
},
{
  id: "m02_oral_dtprt1_c1",
  label: "DT-PRT-1",
  tagColor: "plum",
  summary: "Defend Protocol as the default, not ABC",
  question: "A teammate argues: 'Always reach for ABC first — it's clearer, it gives you isinstance checks, and Protocol is just a fancy duck-typing hack.' Defend Protocol as the default.",
  position: "For boundaries we control, Protocol is the default. ABC is reserved for cases where something outside our control — a framework, a serialization library — demands nominal subclassing.",
  mechanics: "The 'isinstance checks' argument for ABC exposes the misunderstanding: we don't want isinstance checks at our seams — they are themselves a coupling. The lot accepts anything satisfying the Allocator Protocol; that's the whole point. If the lot did isinstance(allocator, Allocator), a FakeAllocator that doesn't subclass Allocator would be rejected, even though it has all the right methods.",
  stakes: "The 'clearer' argument confuses ceremony with clarity. ABC has more keywords (@abstractmethod, the import, the subclass clause), which makes it look more 'official.' But Protocol with the same method stubs and one less inheritance clause is just as readable — with zero coupling between abstraction and implementations.",
  principle: "Reach for ABC when external machinery requires nominal subclassing — plugin registries, serialization libraries walking __bases__. Otherwise, Protocol."
},
{
  id: "m02_oral_dtprt2_c1",
  label: "DT-PRT-2",
  tagColor: "plum",
  summary: "Defend Calculator having zero methods initially",
  question: "A reviewer asks: 'Your Calculator Protocol has no methods. Isn't that a useless type?' Defend the empty Protocol at this stage.",
  position: "A Protocol with no methods is the most honest representation of 'collaborator known, shape unknown.' It exists to declare a slot in the constructor; its surface grows only when a test demands a method.",
  mechanics: "Adding methods speculatively locks in a signature before any test has demanded one. What if the next test demands calculate_with_discount(parking, discount) rather than calculate(parking)? What if it demands calculate(parking, at_time=now)? Speculative signatures get one of these guesses right at best one time in four.",
  stakes: "Once a method exists on a Protocol, removing or changing it has a cost — every fake test double must be updated, every implementation re-checked. The speculative method tends to persist, and code grows around it. The Protocol now carries weight it never earned, and that weight constrains every future test.",
  principle: "The empty Protocol is honest about what is and isn't yet known. Honesty about uncertainty is a design virtue, not a weakness to apologize for."
},
{
  id: "m02_oral_dtcomp1_c1",
  label: "DT-COMP-1",
  tagColor: "plum",
  summary: "Defend collapsing Motorcycle/Car/Truck to a field",
  question: "The textbook models Motorcycle, Car, Truck as Vehicle subclasses. An interviewer notes: 'That's idiomatic OO — why are you rejecting it?' Defend the field-based model.",
  position: "A field-based model — Vehicle(size: VehicleSize) — replaces the textbook's three-subclass hierarchy because the subclasses differ only in data, not in behavior.",
  mechanics: "The legitimate test for inheritance is: do subclasses differ in behavior, or only in data? In the textbook design, Motorcycle, Car, and Truck differ only in their reported size. There is no method whose implementation varies by subclass. That is not specialization — it is data masquerading as type.",
  stakes: "The hierarchy's costs are concrete. Dynamic categorization becomes impossible — changing a vehicle's size requires changing its class. The type space is closed — adding RVs means new code, not new data. Every method that switches on type is just a worse switch on size. Meanwhile, the field-based model gives dynamic recategorization for free and keeps the type space open.",
  principle: "The guide labels this OOP-INHER-AP3 — 'turning data into types' — precisely because the resulting design is worse on every axis."
}];


const ORAL_DEFENSES_CARD2 = [
{
  id: "m02_oral_prt2_c2",
  label: "PRT-2",
  tagColor: "teal",
  summary: "Defend not adding release in Unit 01",
  question: "A reviewer of your Unit 01 design says: 'You could have added release(spot) to the Allocator Protocol from the start — it's obviously going to be needed. Why force yourself to add it in Unit 02?' Defend the deferred addition.",
  position: "release(spot) joined the Allocator Protocol in Unit 02, not Unit 01, because no test in Unit 01 demanded it. The deferral is not laziness; it is design discipline.",
  mechanics: "'Obviously going to be needed' is the assumption that destroys design discovery. When Unit 02's test arrived, the signature could plausibly have been release(spot), release(ticket_id), release(spot, freed_at), or release_all_for(vehicle). Speculating in Unit 01 has, at best, a one-in-four chance of matching what the test eventually demands.",
  stakes: "Once a method exists, removing or changing it requires updating every fake, every implementation, every callsite. The wrong-signature method therefore tends to persist, and code grows around it. The Protocol carries weight it never earned. The TDD discipline of 'method appears at the test that demands it' guarantees the signature matches an actual requirement.",
  principle: "A Protocol's job is to be sufficient for current tests, not to be complete. Completeness is an emergent property of the test corpus growing."
},
{
  id: "m02_oral_taxvalue_c2",
  label: "TAX-VALUE",
  tagColor: "clay",
  summary: "Defend a new value object over parameter expansion",
  question: "A teammate says: 'Why introduce CompletedParking when the Calculator could just take (entry_time, exit_time, vehicle_size) as three params? You're adding a class for no reason.' Defend the new type.",
  position: "CompletedParking is introduced as a named value object rather than passing (entry_time, exit_time, vehicle_size) as three loose primitives.",
  mechanics: "The three-parameter version is the start of Primitive Obsession (OOP-ABSTR-AP2). Each new pricing rule adds a parameter — peak hours, day-of-week, holiday surcharges, member discounts — and every callsite must be updated. The Calculator's signature becomes a bag of loosely-related primitives whose ordering becomes a memorization burden, and adding a parameter is a breaking change. CompletedParking names the thing: adding a field to the dataclass changes one place; the Calculator's signature stays stable regardless of how many pricing dimensions exist.",
  stakes: "The cost of introducing the named value is roughly zero — one frozen dataclass with three fields. The cost of not introducing it compounds with every new pricing dimension: parameter ordering becomes a memorization burden, signatures become breaking changes, callers shuffle data they don't care about. The cheap move and the right move are the same move.",
  principle: "A value object should exist when a tuple of fields is passed together repeatedly and has a domain meaning. Three primitives don't deserve a name; 'a parking event that has been completed' does."
},
{
  id: "m02_oral_dec62_c2",
  label: "DEC-6.2",
  tagColor: "ochre",
  summary: "Defend freezing event records like CompletedParking",
  question: "A coworker suggests making CompletedParking mutable so the Calculator can stamp the computed fare onto it as a final step. 'It's just convenience.' Defend frozen=True.",
  position: "@dataclass(frozen=True) on CompletedParking is correct, even though it would be 'convenient' for the Calculator to stamp the computed fare back onto it.",
  mechanics: "The fare is a function of the parking event — derived data. Storing the derived value back on the input conflates inputs and outputs (OOP-ENCAP-AP2). Downstream readers can no longer tell whether parking.fare was passed in at construction or computed and stamped later. The object becomes a mutable cache with unclear provenance, and trust in every reading collapses.",
  stakes: "Once any class can mutate parking.fare, every reader of CompletedParking must defend against the field being not-set, set-at-construction, or recomputed-differently. With frozen=True, whatever fields exist were correct at construction time and never change. Reasoning becomes local; trust becomes cheap.",
  principle: "Return the fare separately, or introduce a new value object (BilledParking) that bundles the event with its computed cost. Each value object is a closed snapshot of one moment; mutation defeats the purpose."
},
{
  id: "m02_oral_obj1_c2",
  label: "OBJ-1",
  tagColor: "clay",
  summary: "Defend Decimal-only money",
  question: "A coworker says: 'Just use float for fare — 5.00 is exact, no rounding error. Decimal is overkill for a parking lot.' Defend the hard rule.",
  position: "Money values use Decimal exclusively. float is forbidden for any value representing currency, at construction and at every step of arithmetic that follows.",
  mechanics: "'5.00 is exact' is true for the single literal and irrelevant. The moment money enters arithmetic — adding tax, applying a discount, computing per-minute rates — floats accumulate error. 0.1 + 0.2 == 0.3 is False in Python because 0.1 and 0.2 have no exact binary representation. Every aggregation amplifies the error; reconciliation reports diverge from source data by cents that compound to dollars.",
  stakes: "One Decimal-vs-float bug in production = under-billing customers, over-billing customers, audit failures, reconciliation chaos that takes weeks to untangle. The cost of always using Decimal is essentially zero: import the module, construct with strings, never write Decimal(0.1) (which floats the value before wrapping). One discipline; an entire bug class avoided.",
  principle: "When a bug class has high consequence and high likelihood, the right defense is to make the bug impossible by construction. Decimal-only money is a constructional defense, not a coding habit."
},
{
  id: "m02_oral_b19_c2",
  label: "B.1.9",
  tagColor: "sage",
  summary: "Defend observation through behavior, not interaction",
  question: "An interviewer points out: 'You could have written allocator.release.assert_called_with(spot) here — it would tell you exactly what the lot called.' You did not. Defend the choice — what is gained, what is lost?",
  position: "'Spot freed' is observed through a second successful enter() call, not through allocator.release.assert_called_with(spot). We refuse interaction-style assertions, full stop.",
  mechanics: "The interaction-style assertion couples the test to one specific method on one specific collaborator. The behavior-style assertion observes the user-facing consequence: after exit, the next vehicle can park. Any implementation that honors the contract passes — whether it calls release(spot), emits a SpotFreed event, uses a database trigger, or runs a leasing protocol.",
  stakes: "Gained: refactor resilience. The test breaks only when user-facing behavior changes. Lost: precise localization. When the test fails, we know something in the entry → exit → re-entry chain is broken, but not exactly which seam. Mock-call assertions point at the failing seam more directly.",
  principle: "Localization is what a debugger is for; correctness is what tests are for. Refactor cost compounds; debugging cost is a one-time payment per failure."
},
{
  id: "m02_oral_dtprt2_c2",
  label: "DT-PRT-2",
  tagColor: "plum",
  summary: "Walk through the moment release was forced into existence",
  question: "Walk an interviewer through the exact sequence of frustrations that forced release onto the Allocator Protocol during Unit 02's RED phase. Why is that sequence valuable beyond just writing the method?",
  position: "The Protocol grew release at exactly the moment Unit 02's RED test could not pass without it — and walking through that moment is the entire pedagogical point.",
  mechanics: "The sequence: I write the RED test asserting that a second enter() succeeds after the first vehicle exits. With only allocate on the Protocol, lot.exit() has no way to tell the allocator the spot is now free. The second enter() calls allocate(), which still thinks the spot is taken, and returns None. The test fails — not because of a logic bug, but because the Protocol is missing a method. That is the moment release appears.",
  stakes: "Doing this the speculative way ('obviously we need release') gets the method but loses two things: the signature is no longer derived from a demand (it is a guess), and there is no test exercising the method (it floats unverified). Both gaps tend to persist because nothing forces them closed later.",
  principle: "Design through discovery is testable design. Every public API shape was, by construction, a shape some test demanded. There are no methods 'just in case'; the codebase is exactly as large as requirements forced it to be."
}];


// Deferred tests list
const DEFERRED_TESTS = [
{ name: "test_vehicle_equality", note: "frozen=True guarantees __eq__. Write this test only if a user behavior observably depends on Vehicle equality (e.g., looking up a parked vehicle by identity).", labels: ["DEC-6.2"] },
{ name: "test_vehicle_hashability", note: "Same. The first test that puts a Vehicle in a set or as a dict key surfaces this need.", labels: ["OBJ-1"] },
{ name: "test_vehicle_immutability", note: "Defer until a refactor moves the frozen=True constraint or a method appears that wants to mutate a Vehicle. The dataclass enforces it today.", labels: ["DEC-6.2"] },
{ name: "test_parking_spot_occupy_raises_when_already_occupied", note: "Defer. This is an invariant of the SpotAllocator's implementation, not user behavior. It gets its own unit of work when we drop down to test the allocator concretely.", labels: ["TAX-ENTITY", "B.1.6"] },
{ name: "test_motorcycle_subclass_returns_size_small", note: "Never. There is no Motorcycle subclass and never will be. Size is a field, not a type.", labels: ["OOP-INHER-AP3"], ap: true }];


// Roadmap tracks
const ROADMAP_TRACKS = [
{
  tag: "Next up", tagColor: "acc", title: "Two more user behaviors — finish the facade", meta: "Section 9 · L4 corpus",
  cards: [
  { num: "UoW 03", title: "A vehicle arriving at a full lot is rejected gracefully", desc: "The first time allocator.allocate() returns None, the facade must communicate 'no spot available' to the caller. Sentinel value? Exception? Result type? The RED test for this behavior chooses the contract.", forces: ["CAT-6", "DT-METHOD-1", "PAT-4"], forcesNote: "error-shape decision, sentinel vs exception trade-off" },
  { num: "UoW 04", title: "A vehicle's size constrains which spots accept it", desc: "The first test where vehicle size matters forces VehicleSize.LARGE to be rejected from a SMALL-only allocator. The Protocol must now know about size, or the size filtering belongs inside the allocator implementation — and the test reveals which.", forces: ["PRT-2", "DEC-6.2", "DT-PRT-2"], forcesNote: "Protocol shape, size-as-data over size-as-type" }]

},
{
  tag: "Deepen inward", tagColor: "teal", title: "Drop down to the collaborators — test them as their own units", meta: "Section 9 · L2 + L3 corpus",
  cards: [
  { num: "Inner 01", title: "SpotAllocator as its own unit", desc: "Now that the Protocol's shape is stable, the concrete allocator gets its own test corpus — invariants like 'a spot cannot be allocated twice,' 'release of an unallocated spot is a no-op or an error,' 'concurrent access is safe.'", forces: ["TAX-ENTITY", "B.1.6", "CAT-3"], forcesNote: "state-management invariants, thread safety, concurrency" },
  { num: "Inner 02", title: "FareCalculator with multiple strategies", desc: "Peak hours, vehicle-size pricing, member discounts. Each is a FareStrategy implementation; the Calculator composes them. This is where the Strategy pattern earns its place — and where the original textbook's peak-hours-as-subclass design gets replaced with composition.", forces: ["PAT-6", "SOLID-OCP", "POLY-2"], forcesNote: "Strategy pattern, open-closed, structural typing at the strategy seam" }]

},
{
  tag: "Module 02 arc", tagColor: "sage", title: "Then: deep dive, anti-pattern hunt, mock interview", meta: "Sections 11–14",
  cards: [
  { num: "§11", title: "Deep dive — HandicappedSpot, bidirectional mapping, concurrency", desc: "The interviewer's follow-up questions. How do you support priority spots without an inheritance hierarchy? How do you find a vehicle's spot from a license plate without scanning every ticket? How do two threads safely allocate the same spot pool?", forces: ["PAT-6", "OBJ-2", "SOLID-OCP"], forcesNote: "extension without inheritance, alias-safe lookup, lock granularity" },
  { num: "§12", title: "Anti-pattern hunt — side-by-side comparison", desc: "The textbook's design alongside ours, point by point. Where the textbook chose inheritance, why we chose composition. Where it chose mutable tickets, why we chose immutable. Each comparison anchored to a guide label so the candidate can name the anti-pattern, not just feel it.", forces: ["OOP-INHER-AP3", "OOP-ENCAP-AP3", "SOLID-DIP-AP1"], forcesNote: "pattern recognition, vocabulary for critique", ap: true },
  { num: "§13", title: "Trade-off matrix", desc: "Every design choice tabulated against alternatives: sentinel vs exception, Protocol vs ABC, composition vs inheritance, immutable vs mutable, thread-safe vs single-threaded. Each row a defensible call; each column a defensible critique.", forces: ["DT-METHOD-1", "DT-PRT-1", "DT-COMP-1"], forcesNote: "articulation of trade-offs under pressure" },
  { num: "§14", title: "Mock interview runner — 45-minute timed simulation", desc: "The voice examiner takes the role of a senior engineer. The candidate has 45 minutes to gather requirements, identify objects, design classes, write tests, implement, defend, and deep-dive. The runner scores against the rubric the worksheet has been training all along.", forces: ["CAT-6", "B.1.9", "PAT-4"], forcesNote: "the whole vocabulary, under time pressure" }]

}];


// ═══════════════════════════════════════════════════════════════════
// API — REUSES MODULE 01's BACKEND ENDPOINTS UNCHANGED
// ═══════════════════════════════════════════════════════════════════

async function assessAnswer(question, devAnswer, modelAnswer) {
  const response = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer: devAnswer, model_answer: modelAnswer })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "API error" }));
    throw new Error(err.detail || "Assessment failed");
  }
  return response.json();
}

async function speakText(text) {
  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.92;u.pitch = 0.85;u.lang = "en-GB";
        window.speechSynthesis.speak(u);
      }
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
  } catch (e) {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;u.pitch = 0.85;u.lang = "en-GB";
      window.speechSynthesis.speak(u);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS — REUSED FROM MODULE 01 PATTERN
// ═══════════════════════════════════════════════════════════════════

function LockBanner({ prev }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", background: T.surface_1, borderRadius: 6, border: `1px solid ${T.border_soft}`, margin: "0 0 20px" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: T.ink_ghost, marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>· Locked ·</div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_3, letterSpacing: "0.04em" }}>
        {prev ? <>Complete <span style={{ color: T.acc_ink, fontWeight: 600 }}>{prev}</span> to unlock</> : <>Coming soon</>}
      </div>
    </div>);

}

function CodeBlock({ code, lang = "python", title }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {navigator.clipboard.writeText(code).then(() => {setCopied(true);setTimeout(() => setCopied(false), 1500);});};
  return (
    <div style={{ background: T.surface_1, borderRadius: 6, border: `1px solid ${T.border_soft}`, overflow: "hidden", margin: "12px 0" }}>
      {title &&
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 14px", background: T.surface_2, borderBottom: `1px solid ${T.border_soft}` }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.ink_3, letterSpacing: "0.03em" }}>{title}</span>
          <button onClick={copy} style={{ background: copied ? T.sage_fill : T.paper, border: `1px solid ${copied ? T.sage : T.border_med}`, borderRadius: 3, color: copied ? T.sage : T.ink_3, cursor: "pointer", fontSize: 10.5, fontFamily: FONT_MONO, padding: "2px 8px", fontWeight: 600, letterSpacing: "0.03em" }}>{copied ? "✓ copied" : "copy"}</button>
        </div>
      }
      <pre style={{ margin: 0, padding: "14px", overflowX: "auto", fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.65, color: T.ink_1, tabSize: 2 }}>{code}</pre>
    </div>);

}




function AnswerField({
  id, placeholder, checks, setChecks, multiline = false, question = "", modelAnswer: modelAnswerProp



}) {
  const val = checks["answer_" + id] || "";
  const set = (v) => setChecks((p) => ({ ...p, ["answer_" + id]: v }));
  const [showModel, setShowModel] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [probeSpeaking, setProbeSpeaking] = useState(false);
  const [probeRecording, setProbeRecording] = useState(false);
  const probeRecRef = useRef(null);
  const recRef = useRef(null);
  const modelAnswer = modelAnswerProp;
  const verdict = checks["verdict_" + id];
  const feedback = checks["feedback_" + id] || "";
  const probe = checks["probe_" + id] || "";
  const probeVal = checks["answer_probe_" + id] || "";
  const confirmed = verdict === "CONFIRMED";
  const partialCount = checks["partial_count_" + id] || 0;

  const sty = {
    width: "100%", background: confirmed ? T.sage_fill : T.paper,
    border: `1px solid ${confirmed ? T.sage : T.border_med}`,
    borderRadius: 4, color: T.ink_1, fontFamily: FONT_SANS, fontSize: 14,
    padding: "9px 12px", resize: "vertical", outline: "none",
    boxSizing: "border-box", minHeight: multiline ? 100 : undefined, lineHeight: 1.6
  };

  const hasSR = typeof window !== "undefined" && navigator.mediaDevices;
  const toggleVoice = async () => {
    if (recording) {
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();recRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      setRecording(false);return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "answer.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.transcript) set(val ? val + " " + data.transcript : data.transcript);
          }
        } catch {}
      };
      mr.start();recRef.current = mr;setRecording(true);
    } catch {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;rec.interimResults = false;rec.lang = "en-GB";
        rec.onresult = (e) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " ";
          if (t.trim()) set(val ? val + " " + t.trim() : t.trim());
        };
        rec.onerror = () => setRecording(false);
        rec.onend = () => setRecording(false);
        rec.start();recRef.current = rec;setRecording(true);
      }
    }
  };

  const defend = async (ans, q, isProbe = false) => {
    if (!ans?.trim() || !modelAnswer) return;
    setAssessing(true);
    try {
      const assessQuestion = q || question || placeholder || id;
      const trimmedAns = ans.length > 3000 ? ans.slice(0, 3000) + "..." : ans;
      const assessReference = isProbe ?
      `The candidate was asked this follow-up probe after a PARTIAL on the original question.\n\nORIGINAL QUESTION:\n${question || placeholder || id}\n\nMODEL ANSWER:\n${modelAnswer}\n\nPROBE QUESTION:\n${q}\n\nJudge whether the candidate's probe answer demonstrates understanding of the concept in the model answer.` :
      modelAnswer;
      const r = await assessAnswer(assessQuestion, trimmedAns, assessReference);
      const partialKey = "partial_count_" + id;
      const currentCount = checks[partialKey] || 0;

      if (isProbe) {
        if (r.verdict === "CONFIRMED") {
          setChecks((p) => ({ ...p, ["verdict_" + id]: "CONFIRMED", ["feedback_" + id]: r.feedback || "" }));
        } else {
          const newProbe = r.probe || null;
          setChecks((p) => ({ ...p,
            ["probe_feedback_" + id]: r.feedback || "Try to be more specific about the underlying concept.",
            ["probe_" + id]: newProbe || p["probe_" + id] || probe,
            [partialKey]: (p[partialKey] || 0) + 1,
            ...(newProbe ? { ["answer_probe_" + id]: "" } : {})
          }));
        }
      } else {
        if (r.verdict === "NOT_MET" && currentCount < 10) {
          setChecks((p) => ({ ...p, ["verdict_" + id]: "PARTIAL", ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "", ["probe_feedback_" + id]: "", ["answer_probe_" + id]: "", [partialKey]: currentCount + 1 }));
        } else if (r.verdict === "PARTIAL") {
          setChecks((p) => ({ ...p, ["verdict_" + id]: r.verdict, ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "", ["probe_feedback_" + id]: "", ["answer_probe_" + id]: "", [partialKey]: currentCount + 1 }));
        } else {
          setChecks((p) => ({ ...p, ["verdict_" + id]: r.verdict, ["feedback_" + id]: r.feedback || "", ["probe_" + id]: r.probe || "" }));
        }
      }
    } catch (e) {
      if (isProbe) setChecks((p) => ({ ...p, ["probe_feedback_" + id]: "Error: " + e.message }));else
      setChecks((p) => ({ ...p, ["verdict_" + id]: "ERROR", ["feedback_" + id]: e.message }));
    }
    setAssessing(false);
  };

  const speakProbe = async () => {
    if (probeSpeaking) {setProbeSpeaking(false);return;}
    setProbeSpeaking(true);await speakText(probe);setProbeSpeaking(false);
  };

  const toggleProbeVoice = async () => {
    if (probeRecording) {
      if (probeRecRef.current && probeRecRef.current.state !== "inactive") {
        probeRecRef.current.stop();probeRecRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      setProbeRecording(false);return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "answer.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.transcript) setChecks((p) => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + data.transcript }));
          }
        } catch {}
      };
      mr.start();probeRecRef.current = mr;setProbeRecording(true);
    } catch {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = true;rec.interimResults = false;rec.lang = "en-GB";
        rec.onresult = (ev) => {
          let t = "";
          for (let i = 0; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript + " ";
          if (t.trim()) setChecks((p) => ({ ...p, ["answer_probe_" + id]: (p["answer_probe_" + id] || "") + (p["answer_probe_" + id] ? " " : "") + t.trim() }));
        };
        rec.onerror = () => setProbeRecording(false);
        rec.onend = () => setProbeRecording(false);
        rec.start();probeRecRef.current = rec;setProbeRecording(true);
      }
    }
  };

  const vc = { CONFIRMED: T.sage, PARTIAL: T.ochre, NOT_MET: T.acc_border, ERROR: T.acc_border };
  const vf = { CONFIRMED: T.sage_fill, PARTIAL: T.ochre_fill, NOT_MET: T.acc_fill, ERROR: T.acc_fill };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          {multiline ?
          <textarea value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} rows={4} readOnly={confirmed} /> :
          <input value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={sty} readOnly={confirmed} />
          }
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
          {hasSR && !confirmed &&
          <button onClick={toggleVoice} style={{ background: recording ? T.acc_fill : T.paper, border: `1px solid ${recording ? T.acc_border : T.border_med}`, borderRadius: 3, color: recording ? T.acc_border : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{recording ? "■ STOP" : "● REC"}</button>
          }
          {modelAnswer && !confirmed &&
          <button onClick={() => defend(val)} disabled={assessing || !val.trim()} style={{ background: assessing ? T.surface_1 : T.acc_fill, border: `1px solid ${T.acc_border}`, borderRadius: 3, color: T.acc_ink, cursor: assessing || !val.trim() ? "default" : "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, letterSpacing: "0.06em", opacity: !val.trim() ? 0.45 : 1, whiteSpace: "nowrap", textTransform: "uppercase" }}>{assessing ? "..." : "Defend"}</button>
          }
          {confirmed && <span style={{ color: T.sage, fontSize: 16, textAlign: "center" }}>✓</span>}
        </div>
      </div>

      {verdict && verdict !== "ERROR" &&
      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 4, background: vf[verdict], border: `1px solid ${vc[verdict]}55`, borderLeft: `3px solid ${vc[verdict]}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: vc[verdict], fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{verdict.toLowerCase().replace("_", " ")}</span>
            {confirmed && <span style={{ color: T.sage, fontSize: 12 }}>✓</span>}
            {verdict === "PARTIAL" && <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3, marginLeft: "auto" }}>attempt {partialCount}/10</span>}
          </div>
          <div style={{ fontSize: 13, color: T.ink_2, lineHeight: 1.65, marginTop: 4 }}>{feedback}</div>
        </div>
      }
      {verdict === "ERROR" && <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 4, background: T.acc_fill, border: `1px solid ${T.acc_border}55`, fontSize: 12.5, color: T.acc_ink }}>{feedback}</div>}

      {verdict === "PARTIAL" && probe &&
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 4, background: T.ochre_fill, border: `1px solid ${T.ochre}33`, borderLeft: `3px solid ${T.ochre}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ochre, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Follow-up</span>
            <button onClick={speakProbe} style={{ background: probeSpeaking ? T.ochre_fill : T.paper, border: `1px solid ${probeSpeaking ? T.ochre : T.border_med}`, borderRadius: 3, color: probeSpeaking ? T.ochre : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "3px 7px", fontFamily: FONT_MONO, fontWeight: 600, whiteSpace: "nowrap", marginLeft: "auto" }}>{probeSpeaking ? "■" : "▶"}</button>
          </div>
          <div style={{ fontSize: 14, color: T.ink_1, lineHeight: 1.65, marginBottom: 10, fontFamily: FONT_SERIF, fontStyle: "italic" }}>"{probe}"</div>
          {checks["probe_feedback_" + id] &&
        <div style={{ fontSize: 12.5, color: T.ink_2, lineHeight: 1.55, marginBottom: 10, padding: "6px 10px", background: T.paper, border: `1px solid ${T.ochre}33`, borderRadius: 3 }}>{checks["probe_feedback_" + id]}</div>
        }
          <div style={{ display: "flex", gap: 6 }}>
            <input value={probeVal} onChange={(e) => setChecks((p) => ({ ...p, ["answer_probe_" + id]: e.target.value }))} placeholder="Answer the follow-up..." style={{ ...sty, minHeight: undefined, flex: 1 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {hasSR && <button onClick={toggleProbeVoice} style={{ background: probeRecording ? T.acc_fill : T.paper, border: `1px solid ${probeRecording ? T.acc_border : T.border_med}`, borderRadius: 3, color: probeRecording ? T.acc_border : T.ink_3, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{probeRecording ? "■ STOP" : "● REC"}</button>}
              <button onClick={() => defend(probeVal, probe, true)} disabled={assessing || !probeVal.trim()} style={{ background: T.ochre_fill, border: `1px solid ${T.ochre}`, borderRadius: 3, color: T.ochre, cursor: "pointer", fontSize: 10.5, padding: "6px 9px", fontFamily: FONT_MONO, fontWeight: 700, opacity: !probeVal.trim() ? 0.45 : 1, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.06em" }}>{assessing ? "..." : "Defend"}</button>
            </div>
          </div>
        </div>
      }

      {modelAnswer &&
      <div style={{ marginTop: 6 }}>
          <button onClick={() => setShowModel(!showModel)} style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: showModel ? T.teal : T.ink_3, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{showModel ? "Hide" : "Reveal"} model answer</span>
            <span style={{ color: showModel ? T.teal : T.ink_3, fontSize: 10, transform: showModel ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>{showModel ? "▾" : "▸"}</span>
          </button>
          {showModel &&
        <div style={{ background: T.teal_fill, border: `1px solid ${T.teal}33`, borderLeft: `3px solid ${T.teal}`, borderRadius: "0 4px 4px 0", padding: "10px 14px", marginTop: 4 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.teal, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Model answer</div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 13.5, color: T.ink_1, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
            </div>
        }
        </div>
      }
    </div>);

}

function Checkbox({ id, label, checks, setChecks }) {
  const checked = !!checks[id];
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "5px 0", userSelect: "none" }}>
      <div onClick={() => setChecks((p) => ({ ...p, [id]: !p[id] }))} style={{ width: 17, height: 17, minWidth: 17, borderRadius: 3, marginTop: 2, border: checked ? `2px solid ${T.sage}` : `2px solid ${T.border_med}`, background: checked ? T.sage_fill : T.paper, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", cursor: "pointer" }}>
        {checked && <span style={{ color: T.sage, fontSize: 11, fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ color: checked ? T.ink_3 : T.ink_2, fontSize: 14, lineHeight: 1.55, transition: "color 0.15s", textDecoration: checked ? "line-through" : "none", textDecorationColor: T.ink_ghost }}>{label}</span>
    </label>);

}

function ProgressRing({ total, done }) {
  const pct = total > 0 ? done / total * 100 : 0;
  const r = 14,c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke={T.border_soft} strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={T.acc_border} strokeWidth="3" strokeDasharray={c} strokeDashoffset={c - c * pct / 100} strokeLinecap="round" transform="rotate(-90 18 18)" style={{ transition: "stroke-dashoffset 0.5s" }} />
      </svg>
      <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: pct === 100 ? T.acc_border : T.ink_3, fontWeight: 600 }}>{done}/{total}</span>
    </div>);

}

// ═══════════════════════════════════════════════════════════════════
// MODULE 02-SPECIFIC COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function GuideRef({ label, ap = false }) {
  return (
    <span style={{
      display: "inline-block",
      fontFamily: FONT_MONO,
      fontSize: 10,
      fontWeight: 700,
      background: ap ? T.acc_fill : T.surface_1,
      color: ap ? T.acc_ink : T.ink_2,
      border: `1px solid ${ap ? T.acc_border : T.border_soft}`,
      borderRadius: 2,
      padding: "1px 6px",
      letterSpacing: "0.02em",
      marginRight: 4,
      verticalAlign: "baseline"
    }}>{label}</span>);

}

function HeaderBadge({ text, color, fill, sub }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: fill, border: `1px solid ${color}55`, borderRadius: 3,
      padding: "2px 8px", fontFamily: FONT_MONO, fontSize: 10.5,
      color, fontWeight: 700, letterSpacing: "0.04em"
    }}>
      {text}{sub && <span style={{ color, fontWeight: 500, opacity: 0.85 }}>{sub}</span>}
    </span>);

}

function PhaseHeader({ num, name, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{
        background: color, color: T.paper, width: 24, height: 24, borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700
      }}>{num}</div>
      <span style={{
        fontFamily: FONT_MONO, fontSize: 11, color, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase"
      }}>{name}</span>
    </div>);

}

function BoundariesTable({ rows }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${T.border_soft}`, borderRadius: 6, background: T.surface_1, marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT_SANS }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border_med}`, background: T.surface_2 }}>
            {["Assertion", "Justification", "Label", "Kind"].map((h) =>
            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: T.ink_3, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: FONT_MONO }}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isForbidden = row.kind === "forbidden";
            const apStyle = isForbidden ? { textDecoration: "line-through", textDecorationColor: T.acc_border, color: T.ink_3 } : {};
            return (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border_soft}` : "none" }}>
                <td style={{ padding: "9px 12px", fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, ...apStyle }}>{row.assertion}</td>
                <td style={{ padding: "9px 12px", fontFamily: FONT_SERIF, fontStyle: "italic", color: T.ink_2, ...apStyle }}>{row.justification}</td>
                <td style={{ padding: "9px 12px" }}><GuideRef label={row.label} ap={isForbidden} /></td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    color: isForbidden ? T.acc_ink : T.sage,
                    background: isForbidden ? T.acc_fill : T.sage_fill,
                    border: `1px solid ${isForbidden ? T.acc_border : T.sage}55`,
                    padding: "2px 7px", borderRadius: 3
                  }}>{row.kind}</span>
                </td>
              </tr>);

          })}
        </tbody>
      </table>
    </div>);

}

function MiniOralPanel({ defense, checks, setChecks }) {
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const tc = TAG_COLORS[defense.tagColor];
  const verdict = checks["verdict_" + defense.id];
  const confirmed = verdict === "CONFIRMED";

  const speakQuestion = async () => {
    if (speaking) {setSpeaking(false);return;}
    setSpeaking(true);
    await speakText(defense.question);
    setSpeaking(false);
  };

  // Composed model answer for the assessor
  const composedModel = `POSITION: ${defense.position}\n\nMECHANICS: ${defense.mechanics}\n\nSTAKES: ${defense.stakes}\n\nPRINCIPLE: ${defense.principle}`;

  return (
    <div style={{
      marginTop: 8,
      border: open ? `1px solid ${T.acc_border}` : `1px dashed ${T.border_soft}`,
      borderRadius: 4,
      background: open ? T.surface_1 : T.paper,
      transition: "border-color 0.15s, border-style 0.15s"
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: "7px 11px", display: "flex", alignItems: "center", gap: 9, textAlign: "left"
        }}>
        
        <span style={{ fontSize: 9, color: T.ink_ghost, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s", display: "inline-block", flexShrink: 0 }}>▸</span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: T.acc_ink, background: T.acc_fill,
          padding: "3px 8px", borderRadius: 2, border: `1px solid ${T.acc_border}`, flexShrink: 0
        }}>Defend</span>
        <span style={{
          fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em",
          color: tc.color, background: tc.fill, padding: "2px 7px", borderRadius: 2,
          border: `1px solid ${tc.color}55`, flexShrink: 0
        }}>{defense.label}</span>
        <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 12.5, color: T.ink_2, lineHeight: 1.4, flex: 1 }}>
          {defense.summary}
        </span>
        {confirmed && <span style={{ color: T.sage, fontSize: 14, flexShrink: 0 }}>✓</span>}
      </button>

      {open &&
      <div style={{ padding: "0 12px 12px" }}>
          {/* Voice test panel */}
          <div style={{
          margin: "0 0 12px", padding: "11px 13px 12px",
          background: T.paper, border: `1px solid ${T.acc_border}`, borderRadius: 4
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
              <span style={{
              fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: T.acc_ink, background: T.acc_fill,
              padding: "3px 8px", borderRadius: 2, border: `1px solid ${T.acc_border}`
            }}>Voice Test</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: FONT_MONO, fontSize: 9, color: T.ink_3, letterSpacing: "0.05em" }}>
                {[["①", "Listen"], ["②", "Speak"], ["③", "Compare"]].map(([n, lbl], i) =>
              <span key={lbl} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 2, background: T.surface_1, border: `1px solid ${T.border_soft}`, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      <span style={{ color: T.ink_ghost }}>{n}</span>{lbl}
                    </span>
                    {i < 2 && <span style={{ color: T.ink_ghost, fontSize: 9 }}>→</span>}
                  </span>
              )}
              </div>
            </div>

            <div style={{
            fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 14, color: T.ink_1,
            lineHeight: 1.55, padding: "8px 0 12px"
          }}>
              "{defense.question}"
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={speakQuestion} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 14px", fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.07em", textTransform: "uppercase", borderRadius: 3, cursor: "pointer",
              background: speaking ? T.ink_1 : T.surface_1,
              color: speaking ? T.paper : T.ink_1,
              border: `1px solid ${T.ink_1}`
            }}>
                <span style={{ fontSize: 10 }}>{speaking ? "■" : "▶"}</span>
                {speaking ? "Stop" : "Listen to question"}
              </button>
            </div>
          </div>

          {/* AnswerField for the defense */}
          <AnswerField
          id={defense.id}
          placeholder="Speak or type your defense..."
          checks={checks}
          setChecks={setChecks}
          multiline
          question={defense.question}
          modelAnswer={composedModel} />
        

          {/* Model answer — 4-slot structured view (manual reveal, separate from AnswerField's flat reveal) */}
          <details style={{ marginTop: 10, borderTop: `1px dashed ${T.border_soft}`, paddingTop: 8 }}>
            <summary style={{
            listStyle: "none", cursor: "pointer",
            fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3,
            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
            userSelect: "none", padding: "3px 0"
          }}>▸ Show structured model answer (4 slots)</summary>
            <div style={{ marginTop: 8 }}>
              {[
            { num: "1", name: "Position", text: defense.position },
            { num: "2", name: "Mechanics", text: defense.mechanics },
            { num: "3", name: "Stakes", text: defense.stakes },
            { num: "4", name: "Principle", text: defense.principle }].
            map((slot) =>
            <div key={slot.num} style={{ marginBottom: 13 }}>
                  <div style={{ display: "inline-flex", alignItems: "stretch", marginBottom: 5, borderRadius: 3, overflow: "hidden", border: `1px solid ${T.acc_border}` }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, background: T.acc_fill, color: T.acc_ink, padding: "3px 7px", borderRight: `1px solid ${T.acc_border}` }}>{slot.num}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.ink_2, padding: "3px 9px", background: T.paper }}>{slot.name}</span>
                  </div>
                  <p style={{ fontFamily: FONT_SERIF, fontSize: 12.5, color: T.ink_2, lineHeight: 1.6, margin: 0 }}>
                    {slot.num === "4" ? <strong style={{ color: T.ink_1 }}>{slot.text}</strong> : slot.text}
                  </p>
                </div>
            )}
            </div>
          </details>
        </div>
      }
    </div>);

}

function GuideRefsFooter({ title, sub, groups


}) {
  return (
    <div style={{ padding: "22px 24px 24px", background: T.surface_2, borderTop: `1px solid ${T.border_soft}` }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16
      }}>
        {title}
        <span style={{
          fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 12.5, color: T.ink_3,
          fontWeight: 400, letterSpacing: "normal", textTransform: "none", marginLeft: 6
        }}>{sub}</span>
      </div>

      {groups.map((group, gi) =>
      <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 12 : 0 }}>
          <div style={{
          fontFamily: FONT_MONO, fontSize: 9.5, color: T.ink_3, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7, opacity: 0.7
        }}>{group.label}</div>
          {group.items.map((item, ii) => {
          const tc = TAG_COLORS[item.tagColor];
          return (
            <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "3px 0", lineHeight: 1.55 }}>
                <span style={{
                fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700,
                padding: "2px 8px", borderRadius: 3,
                whiteSpace: "nowrap", minWidth: 78, textAlign: "center",
                flexShrink: 0, letterSpacing: "0.02em", marginTop: 1,
                background: tc.fill, color: tc.color,
                border: `1px solid ${tc.color}55`
              }}>{item.tag}</span>
                <span style={{ fontFamily: FONT_SERIF, color: T.ink_2, fontSize: 13, flex: 1 }}>{item.text}</span>
              </div>);

        })}
        </div>
      )}
    </div>);

}

// ═══════════════════════════════════════════════════════════════════
// THE UNIT OF WORK CARD — Card 1 + Card 2
// ═══════════════════════════════════════════════════════════════════

function UnitOfWorkCard1({ checks, setChecks }) {
  return (
    <article style={{
      background: T.paper, border: `1px solid ${T.border_soft}`, borderRadius: 8,
      overflow: "hidden", margin: "24px 0", boxShadow: `0 1px 0 ${T.border_soft}`
    }}>
      <header style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${T.border_soft}`, background: T.surface_1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>User Behavior 01</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_ghost }}>·</span>
          <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13.5, color: T.ink_3 }}>ParkingLot Facade — innermost test in the outside-in cascade</span>
        </div>
        <h3 style={{
          fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 700, color: T.ink_1,
          margin: "0 0 10px", letterSpacing: "-0.01em", lineHeight: 1.25
        }}>A vehicle entering an available lot receives a ticket</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <HeaderBadge text="B.1.9" color={T.sage} fill={T.sage_fill} />
          <HeaderBadge text="CAT-6" sub="Orchestration" color={T.slate} fill={T.slate_fill} />
          <HeaderBadge text="SOLID-DIP" color={T.acc_ink} fill={T.acc_fill} />
          <HeaderBadge text="PAT-4 Facade" color={T.acc_ink} fill={T.acc_fill} />
          <HeaderBadge text="TAX-SVC" sub="Facade Service" color={T.clay} fill={T.clay_fill} />
        </div>
      </header>

      {/* ──── RED ──── */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={1} name="Red — write the test that does not yet have an implementation" color={T.acc_border} />
        <p style={{ fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2, lineHeight: 1.65, margin: "0 0 12px" }}>
          The skeleton names every collaborator the facade will need. Every placeholder is a design decision the test makes —
          including the choice of <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.surface_2, padding: "0 4px", borderRadius: 2 }}>FakeAllocator</code> as
          a Protocol-conforming double.
        </p>
        <CodeBlock title="B.1.9 Template — write the failing test first" code={RED_TEMPLATE_CARD1} />
      </div>

      {/* ──── PRESSURE ──── */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={2} name="Pressure — what the test has forced into existence" color={T.ochre} />
        <p style={{ fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2, lineHeight: 1.65, margin: "0 0 12px" }}>
          Each item below appears in the codebase because the test could not pass without it. Nothing else exists yet.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {PRESSURE_LIST_CARD1.map((item, i) =>
          <div key={i} style={{ padding: "10px 14px", background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: T.ink_1 }}>{item.name}</span>
                {item.labels.map((l) => <GuideRef key={l} label={l} />)}
              </div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.ink_2, lineHeight: 1.5 }}>{item.note}</div>
            </div>
          )}
        </div>
      </div>

      {/* ──── GREEN ──── */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={3} name="Green — write the minimum to pass; resist designing ahead" color={T.sage} />
        <CodeBlock title="Fill in only what the test demanded" code={GREEN_TEMPLATE_CARD1} />
      </div>

      {/* ──── REFACTOR ──── */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={4} name="Refactor — improve structure; resist adding scope" color={T.teal} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 10 }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.sage, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Do</div>
            {REFACTOR_NOTES_CARD1.do.map((item, i) =>
            <div key={i} style={{ marginBottom: 8, paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: T.sage, fontSize: 12 }}>✓</span>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.ink_2, lineHeight: 1.55 }}>{item.text}</div>
                <div style={{ marginTop: 3 }}>{item.labels.map((l) => <GuideRef key={l} label={l} />)}</div>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Don't</div>
            {REFACTOR_NOTES_CARD1.dont.map((item, i) =>
            <div key={i} style={{ marginBottom: 8, paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: T.acc_border, fontSize: 12 }}>✗</span>
                <div style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.ink_2, lineHeight: 1.55 }}>{item.text}</div>
                <div style={{ marginTop: 3 }}>{item.labels.map((l) => <GuideRef key={l} label={l} />)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ──── BOUNDARIES ──── */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={5} name="Boundaries — the assertion catalogue" color={T.plum} />
        <p style={{ fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2, lineHeight: 1.65, margin: "0 0 6px" }}>
          What can be asserted, what must not be. The forbidden assertions are not stylistic — they actively destroy refactor resilience.
        </p>
        <BoundariesTable rows={BOUNDARIES_TABLE_CARD1} />
      </div>

      {/* ──── EXAMINE — 15 oral defenses ──── */}
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 10, color: T.plum, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", background: T.plum_fill,
            padding: "3px 9px", borderRadius: 3, border: `1px solid ${T.plum}44`
          }}>Examine — 15 oral defenses</span>
          <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: T.ink_3 }}>
            One per concept the card exercises. Speak it aloud; the model answer reveals after you submit.
          </span>
        </div>
        {ORAL_DEFENSES_CARD1.map((d) =>
        <MiniOralPanel key={d.id} defense={d} checks={checks} setChecks={setChecks} />
        )}
      </div>

      {/* ──── GUIDE REFS FOOTER ──── */}
      <GuideRefsFooter
        title="Guide References"
        sub="map labels back to the guide for deeper study"
        groups={[
        { label: "Test templates", items: [
          { tag: "B.1.9", tagColor: "sage", text: <><strong style={{ color: T.ink_1 }}>Orchestration test</strong> — assert against collaborators injected as fakes; never assert on internal state. The shape of every test in this unit.</> },
          { tag: "B.1.5", tagColor: "sage", text: <><strong style={{ color: T.ink_1 }}>Dependency injection fixture</strong> — collaborators arrive via <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>__init__</code>, so the test can substitute fakes.</> }]
        },
        { label: "Method category & taxonomy", items: [
          { tag: "CAT-6", tagColor: "slate", text: <><strong style={{ color: T.ink_1 }}>Orchestration</strong> — methods that coordinate multiple collaborators; assert via the observable outcome of the whole.</> },
          { tag: "TAX-SVC", tagColor: "clay", text: <><strong style={{ color: T.ink_1 }}>Facade service</strong> — the lot orchestrates a workflow; it is not itself data.</> },
          { tag: "TAX-VALUE", tagColor: "clay", text: <><strong style={{ color: T.ink_1 }}>Value object</strong> — immutable, equality by value: Vehicle, Ticket.</> }]
        },
        { label: "SOLID & design patterns", items: [
          { tag: "SOLID-DIP", tagColor: "acc", text: <><strong style={{ color: T.ink_1 }}>Dependency Inversion</strong> — depend on abstractions (Protocols), never concretions.</> },
          { tag: "PAT-4", tagColor: "acc", text: <><strong style={{ color: T.ink_1 }}>Facade pattern</strong> — one entry point hides subsystem complexity.</> },
          { tag: "POLY-2", tagColor: "acc", text: <><strong style={{ color: T.ink_1 }}>Polymorphism via Protocol</strong> — substitutability through structural typing, not inheritance.</> }]
        },
        { label: "Protocols & decorators", items: [
          { tag: "PRT-2", tagColor: "teal", text: <><strong style={{ color: T.ink_1 }}>Service protocol</strong> — multi-method boundary for collaborators. Structural conformance only.</> },
          { tag: "PRT-4", tagColor: "teal", text: <><strong style={{ color: T.ink_1 }}>Fake implementation pattern</strong> — production-grade test doubles that conform to a Protocol.</> },
          { tag: "DEC-6.2", tagColor: "ochre", text: <><strong style={{ color: T.ink_1 }}>@dataclass(frozen=True)</strong> — immutable value object decorator. Provides __eq__ and __hash__ for free.</> }]
        },
        { label: "Decision trees", items: [
          { tag: "DT-TAX-1", tagColor: "plum", text: <>Is this thing a service, value, entity, or factory? Taxonomy decision tree.</> },
          { tag: "DT-PRT-1", tagColor: "plum", text: <>Protocol vs ABC — when structural typing wins over nominal inheritance.</> },
          { tag: "DT-PRT-2", tagColor: "plum", text: <>What methods belong on this Protocol? — derive from the caller's needs.</> },
          { tag: "DT-COMP-1", tagColor: "plum", text: <>Composition vs inheritance — default to composition; reach for inheritance only when LSP holds.</> }]
        }]
        } />
      
    </article>);

}

function UnitOfWorkCard2({ checks, setChecks }) {
  return (
    <article style={{
      background: T.paper, border: `1px solid ${T.border_soft}`, borderRadius: 8,
      overflow: "hidden", margin: "24px 0", boxShadow: `0 1px 0 ${T.border_soft}`
    }}>
      <header style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${T.border_soft}`, background: T.surface_1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>User Behavior 02</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_ghost }}>·</span>
          <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13.5, color: T.ink_3 }}>A freed spot is reusable — second enter() must succeed</span>
        </div>
        <h3 style={{
          fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 700, color: T.ink_1,
          margin: "0 0 10px", letterSpacing: "-0.01em", lineHeight: 1.25
        }}>A freed spot is observably available for the next vehicle</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <HeaderBadge text="B.1.9" color={T.sage} fill={T.sage_fill} />
          <HeaderBadge text="CAT-6" sub="Orchestration" color={T.slate} fill={T.slate_fill} />
          <HeaderBadge text="SOLID-DIP" color={T.acc_ink} fill={T.acc_fill} />
          <HeaderBadge text="TAX-SVC" sub="Facade Service" color={T.clay} fill={T.clay_fill} />
        </div>
      </header>

      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={1} name="Red — observe spot freed through behavior, not interaction" color={T.acc_border} />
        <CodeBlock title="Second enter() succeeds → spot was released, somehow" code={RED_TEMPLATE_CARD2} />
      </div>

      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border_soft}` }}>
        <PhaseHeader num={2} name="Pressure — what the second test forced into existence" color={T.ochre} />
        <div style={{ display: "grid", gap: 8 }}>
          {PRESSURE_LIST_CARD2.map((item, i) =>
          <div key={i} style={{ padding: "10px 14px", background: T.surface_1, border: `1px solid ${T.border_soft}`, borderRadius: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: T.ink_1 }}>{item.name}</span>
                {item.labels.map((l) => <GuideRef key={l} label={l} />)}
              </div>
              <div style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.ink_2, lineHeight: 1.5 }}>{item.note}</div>
            </div>
          )}
        </div>
      </div>

      {/* ──── EXAMINE — 6 oral defenses ──── */}
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{
            fontFamily: FONT_MONO, fontSize: 10, color: T.plum, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase", background: T.plum_fill,
            padding: "3px 9px", borderRadius: 3, border: `1px solid ${T.plum}44`
          }}>Examine — 6 oral defenses</span>
          <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: 13, color: T.ink_3 }}>
            New material for this unit of work, plus reinforcement of cross-cutting concerns.
          </span>
        </div>
        {ORAL_DEFENSES_CARD2.map((d) =>
        <MiniOralPanel key={d.id} defense={d} checks={checks} setChecks={setChecks} />
        )}
      </div>

      <GuideRefsFooter
        title="Guide References"
        sub="new to this unit of work"
        groups={[
        { label: "Protocol growth & new value object", items: [
          { tag: "PRT-2", tagColor: "teal", text: <><strong style={{ color: T.ink_1 }}>Allocator gains <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>release(spot)</code></strong> — the Protocol grows only when an outer test demands a new method.</> },
          { tag: "TAX-VALUE", tagColor: "clay", text: <><strong style={{ color: T.ink_1 }}>CompletedParking emerges</strong> as a new value object carrying entry_time + exit_time to the Calculator.</> },
          { tag: "DEC-6.2", tagColor: "ochre", text: <><strong style={{ color: T.ink_1 }}>@dataclass(frozen=True)</strong> applied to CompletedParking for the same reason as Ticket: it is a closed event record.</> }]
        },
        { label: "Money & equality", items: [
          { tag: "OBJ-1", tagColor: "clay", text: <><strong style={{ color: T.ink_1 }}>Decimal equality</strong> — <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>fare == Decimal("5.00")</code>, never <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>== 5.00</code>.</> }]
        },
        { label: "Behavior-only test discipline", items: [
          { tag: "B.1.9", tagColor: "sage", text: <><strong style={{ color: T.ink_1 }}>Observe spot freed via a second enter()</strong> — not via <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>allocator.release.assert_called_with(spot)</code>.</> },
          { tag: "DT-PRT-2", tagColor: "plum", text: <><strong style={{ color: T.ink_1 }}>When does a Protocol grow a method?</strong> Only when the outer test cannot pass without it.</> }]
        }]
        } />
      
    </article>);

}

// ═══════════════════════════════════════════════════════════════════
// DEFERRED LIST + WHAT'S NEXT
// ═══════════════════════════════════════════════════════════════════

function DeferredList() {
  return (
    <div style={{
      marginTop: 28, padding: "18px 22px",
      background: T.surface_2, border: `1px solid ${T.border_soft}`,
      borderRadius: 6, borderLeft: `3px solid ${T.ink_ghost}`
    }}>
      <h4 style={{
        fontFamily: FONT_SERIF, fontSize: 16, fontWeight: 700, color: T.ink_1,
        margin: "0 0 8px", letterSpacing: "-0.005em"
      }}>Tests we are NOT writing yet — and why</h4>
      <p style={{ fontFamily: FONT_SERIF, fontSize: 13.5, color: T.ink_2, lineHeight: 1.65, margin: "0 0 14px" }}>
        Outside-In TDD defers anything not driven by a current user behavior. Each one either emerges later
        when a user behavior demands it, or never gets written because the dataclass machinery already guarantees it.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {DEFERRED_TESTS.map((t, i) =>
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", borderTop: i > 0 ? `1px dashed ${T.border_soft}` : "none" }}>
            <code style={{
            fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper,
            padding: "1px 6px", borderRadius: 3, border: `1px solid ${T.border_soft}`,
            flexShrink: 0, marginTop: 1
          }}>{t.name}</code>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 13, color: T.ink_2, lineHeight: 1.55, flex: 1 }}>
              {t.note}
              <div style={{ marginTop: 4 }}>{t.labels.map((l) => <GuideRef key={l} label={l} ap={!!t.ap} />)}</div>
            </div>
          </li>
        )}
      </ul>
    </div>);

}

function WhatsNextRoadmap() {
  return (
    <div style={{
      margin: "36px 0 24px", background: T.surface_1,
      border: `1px solid ${T.border_soft}`, borderRadius: 6, overflow: "hidden"
    }}>
      <div style={{
        padding: "14px 22px 12px", borderBottom: `1px solid ${T.border_soft}`,
        background: T.surface_2, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap"
      }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.acc_ink, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Roadmap</span>
        <h3 style={{ fontFamily: FONT_SERIF, fontSize: 19, color: T.ink_1, fontWeight: 700, margin: 0, letterSpacing: "-0.01em", flex: 1 }}>What's Next</h3>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, fontWeight: 600, letterSpacing: "0.06em" }}>Module 02 · 2 of 4 user behaviors covered</span>
      </div>

      <div style={{ padding: "20px 22px 22px" }}>
        <p style={{
          fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2, lineHeight: 1.6,
          margin: "0 0 22px", fontStyle: "italic", paddingLeft: 12, borderLeft: `2px solid ${T.acc_border}`
        }}>
          Two user behaviors are now defended end-to-end. The <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>ParkingLot</code> facade
          has earned five collaborators — <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>Vehicle</code>, <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>Ticket</code>, <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>Allocator</code>, <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>Calculator</code>, <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>CompletedParking</code> — each one forced into existence by a test that
          could not pass without it. <strong style={{ color: T.ink_1, fontStyle: "normal", fontWeight: 700 }}>Nothing speculative exists in the codebase.</strong>
        </p>

        {ROADMAP_TRACKS.map((track, ti) => {
          const tc = TAG_COLORS[track.tagColor];
          return (
            <div key={ti} style={{ marginBottom: ti < ROADMAP_TRACKS.length - 1 ? 28 : 0 }}>
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10,
                paddingBottom: 6, borderBottom: `1px solid ${T.border_soft}`
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700,
                  padding: "2px 8px", borderRadius: 3, letterSpacing: "0.1em",
                  textTransform: "uppercase", flexShrink: 0,
                  background: tc.fill, color: tc.color, border: `1px solid ${tc.color}55`
                }}>{track.tag}</span>
                <h4 style={{ fontFamily: FONT_SERIF, fontSize: 15, color: T.ink_1, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{track.title}</h4>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, marginLeft: "auto", letterSpacing: "0.04em" }}>{track.meta}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {track.cards.map((card, ci) =>
                <div key={ci} style={{
                  background: T.paper, border: `1px solid ${T.border_soft}`,
                  borderRadius: 4, padding: "11px 13px 12px"
                }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, fontWeight: 700, letterSpacing: "0.06em" }}>{card.num}</span>
                      <div style={{ fontFamily: FONT_SERIF, fontSize: 13.5, color: T.ink_1, fontWeight: 700, lineHeight: 1.35, flex: 1 }}>{card.title}</div>
                    </div>
                    <p style={{ fontFamily: FONT_SERIF, fontSize: 12.5, color: T.ink_2, lineHeight: 1.55, margin: "0 0 6px" }}>{card.desc}</p>
                    <div style={{
                    marginTop: 7, paddingTop: 7, borderTop: `1px dashed ${T.border_soft}`,
                    fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, lineHeight: 1.45, letterSpacing: "0.02em"
                  }}>
                      <strong style={{ color: T.acc_ink, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginRight: 4 }}>Forces:</strong>
                      {card.forces.map((f, fi) => <GuideRef key={fi} label={f} ap={!!card.ap} />)}
                      <span style={{ fontFamily: FONT_SERIF, fontStyle: "italic", color: T.ink_3 }}>— {card.forcesNote}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>);

        })}

        <div style={{
          marginTop: 24, padding: "14px 16px", background: T.surface_2,
          borderLeft: `3px solid ${T.acc_ink}`, borderRadius: "0 4px 4px 0"
        }}>
          <p style={{ fontFamily: FONT_SERIF, fontSize: 13.5, color: T.ink_2, lineHeight: 1.6, margin: 0 }}>
            The pattern repeats at every scale.{" "}
            <strong style={{ color: T.ink_1 }}>
              An outer test demands behavior; the behavior forces a collaborator; the collaborator earns its Protocol shape from what was asked of it.
            </strong>{" "}
            Nothing speculative survives, because nothing speculative was ever written. By Section 14, the candidate will have built
            the same parking lot the textbook built — with one third the classes, no inheritance hierarchies, and a test corpus that survives refactor.
          </p>
        </div>
      </div>
    </div>);

}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════

export default function Module02({ onHome }) {
  const [activeSection, setActiveSection] = useState("tdd-corpus");
  const STORAGE_KEY = "module02_checks";

  const [checks, setChecks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) localStorage.setItem(STORAGE_KEY + "_corrupt_" + Date.now(), raw);
      } catch {}
      return {};
    }
  });

  const sectionRefs = useRef({});
  const mainRef = useRef(null);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {didMount.current = true;return;}
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));}
    catch (e) {console.error("Save failed:", e);}
  }, [checks]);

  const resetProgress = () => {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    setChecks({});localStorage.removeItem(STORAGE_KEY);
  };

  const verdictCount = useMemo(() => {
    const allDefenses = [...ORAL_DEFENSES_CARD1, ...ORAL_DEFENSES_CARD2];
    const confirmed = allDefenses.filter((d) => checks["verdict_" + d.id] === "CONFIRMED").length;
    return { total: allDefenses.length, done: confirmed };
  }, [checks]);

  const scrollTo = useCallback((id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {setActiveSection(e.target.dataset.section || "");break;}
        }
      },
      { root: mainRef.current, rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const regRef = (id) => (el) => {
    if (el) {el.dataset.section = id;sectionRefs.current[id] = el;}
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: T.paper, fontFamily: FONT_SANS, color: T.ink_2 }}>
      {/* ── SIDEBAR ── */}
      <nav style={{
        width: 240, minWidth: 240, background: T.surface_1,
        borderRight: `1px solid ${T.border_soft}`, display: "flex", flexDirection: "column",
        overflowY: "auto", padding: "20px 0"
      }}>
        <div style={{ padding: "0 18px 18px", borderBottom: `1px solid ${T.border_soft}` }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 700, color: T.ink_1, letterSpacing: "-0.015em" }}>Module 02</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, marginTop: 3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Parking Lot OOD</div>
          <div style={{ marginTop: 14 }}><ProgressRing total={verdictCount.total} done={verdictCount.done} /></div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.ink_3, marginTop: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Oral defenses confirmed</div>
        </div>

        <div style={{ padding: "10px 0", flex: 1 }}>
          {SECTIONS.map((s) =>
          <button key={s.id} onClick={() => scrollTo(s.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 18px",
            background: activeSection === s.id ? T.surface_2 : "transparent", border: "none",
            borderLeft: activeSection === s.id ? `2px solid ${T.acc_border}` : "2px solid transparent",
            cursor: "pointer", textAlign: "left", transition: "all 0.15s", opacity: s.locked ? 0.55 : 1
          }}>
              <span style={{
              fontFamily: FONT_MONO, fontSize: 12,
              color: activeSection === s.id ? T.acc_border : T.ink_3, minWidth: 16
            }}>{s.icon}</span>
              <span style={{
              fontFamily: FONT_MONO, fontSize: 12,
              color: activeSection === s.id ? T.ink_1 : T.ink_2,
              fontWeight: activeSection === s.id ? 600 : 400, letterSpacing: "0.01em",
              flex: 1
            }}>{s.label}</span>
              {s.locked && <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: T.ink_ghost }}>·</span>}
            </button>
          )}
        </div>

        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.border_soft}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: T.ink_3, marginBottom: 8, letterSpacing: "0.04em" }}>21 oral defenses · 45 min budget</div>
          {onHome && (
            <button onClick={onHome} style={{
              width: "100%", padding: "6px 0", background: "transparent",
              border: `1px solid ${T.border_med}`, borderRadius: 3, color: T.ink_3,
              cursor: "pointer", fontSize: 10, fontFamily: FONT_MONO, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
            }}>← All worksheets</button>
          )}
          <button onClick={resetProgress}
          onMouseEnter={(e) => {e.currentTarget.style.color = T.acc_ink;e.currentTarget.style.borderColor = T.acc_border;e.currentTarget.style.background = T.acc_fill;}}
          onMouseLeave={(e) => {e.currentTarget.style.color = T.ink_3;e.currentTarget.style.borderColor = T.border_med;e.currentTarget.style.background = T.paper;}}
          style={{
            width: "100%", padding: "6px 0", background: T.paper,
            border: `1px solid ${T.border_med}`, borderRadius: 3, color: T.ink_3,
            cursor: "pointer", fontSize: 10, fontFamily: FONT_MONO, fontWeight: 600,
            letterSpacing: "0.08em", transition: "all 0.15s", textTransform: "uppercase"
          }}>Reset progress</button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main ref={mainRef} style={{ flex: 1, overflowY: "auto", padding: "40px 56px 120px", color: T.ink_2 }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>

          {/* Stubs for sections 1–8 */}
          {SECTIONS.slice(0, 8).map((s) =>
          <div key={s.id} ref={regRef(s.id)}>
              <h2 style={{ fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700, color: T.ink_1, margin: "36px 0 16px", letterSpacing: "-0.015em", borderBottom: `1px solid ${T.border_soft}`, paddingBottom: 10 }}>{s.label}</h2>
              <LockBanner prev={s.prev} />
            </div>
          )}

          {/* ═══ TDD CORPUS (the implemented section) ═══ */}
          <div ref={regRef("tdd-corpus")}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 38, fontWeight: 700, color: T.ink_1, letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 8 }}>
              TDD Test Corpus
            </div>
            <div style={{ fontFamily: FONT_SERIF, fontSize: 14, fontStyle: "italic", color: T.ink_3, marginTop: 8, letterSpacing: "0.01em" }}>
              Outside-In TDD. We start at the user's vantage point. Internal classes exist only when an outer test forces them into being.
            </div>

            <div style={{
              background: T.surface_1, border: `1px solid ${T.border_soft}`,
              borderLeft: `3px solid ${T.acc_border}`, borderRadius: "0 6px 6px 0",
              padding: "16px 20px", marginTop: 24
            }}>
              <p style={{ fontFamily: FONT_MONO, fontSize: 11, color: T.acc_ink, fontWeight: 700, margin: "0 0 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>The discipline</p>
              <p style={{ margin: 0, fontFamily: FONT_SERIF, fontSize: 14, color: T.ink_2, lineHeight: 1.65 }}>
                Hard rule — tests assert only what a caller can observe. No reaching into internal storage. No
                <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2, margin: "0 4px" }}>assert_called_with</code>,
                no <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>call_count</code>,
                no <code style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.ink_1, background: T.paper, padding: "0 4px", borderRadius: 2 }}>isinstance</code> at
                the seam. <strong style={{ color: T.ink_1 }}>Localization is what a debugger is for; correctness is what tests are for.</strong>
              </p>
            </div>

            <UnitOfWorkCard1 checks={checks} setChecks={setChecks} />
            <UnitOfWorkCard2 checks={checks} setChecks={setChecks} />

            <DeferredList />
            <WhatsNextRoadmap />
          </div>

          {/* Stubs for sections 10–14 */}
          {SECTIONS.slice(9).map((s) =>
          <div key={s.id} ref={regRef(s.id)}>
              <h2 style={{ fontFamily: FONT_SERIF, fontSize: 26, fontWeight: 700, color: T.ink_1, margin: "36px 0 16px", letterSpacing: "-0.015em", borderBottom: `1px solid ${T.border_soft}`, paddingBottom: 10 }}>{s.label}</h2>
              <LockBanner prev={s.prev} />
            </div>
          )}

        </div>
      </main>
    </div>);

}