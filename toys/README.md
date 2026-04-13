# experiments/

Quick-fire toy scripts that isolate one concept at a time from the monolith.

## Rules

1. **Each file is standalone** — no imports between experiment files
2. **Run with `python experiments/xx_name.py`** — no pytest, no fixtures, just `assert`
3. **Break it on purpose** — every script has a `# BREAK IT` section at the bottom
4. **One concept per file** — if you're testing two things, make two files

## Running

```bash
cd twilio-refactoring-plan
python experiments/01_hydration.py
python experiments/02_enum_vs_string.py
python experiments/03_error_tuple_bug.py
python experiments/04_round_trip.py
```

All green = all asserts passed. Any failure = you found the edge case.

## Adding your own

```bash
cp experiments/_template.py experiments/05_my_concept.py
```

Name format: `NN_concept_name.py` — keeps them in learning order.
