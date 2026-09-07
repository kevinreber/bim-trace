# Image-to-BIM evals

Measures whether AI floor-plan generation actually produces a coherent building,
instead of judging it by eye in the viewport.

Manual testing can only tell you "this looks wrong". It cannot tell you whether
the model was wrong, or the model was fine and the validator discarded part of
its output. These checks separate those layers by scoring the **raw model
response**, before `validateAndFixElements` repairs anything.

## Layout

| File | Purpose |
|------|---------|
| `fixtures/manifest.json` | Fixture list, notes, and optional ground-truth expectations |
| `fixtures/*.jpg` | The images themselves (committed; licences in `ATTRIBUTION.md`) |
| `run.mjs` | Sends every fixture through the real endpoint, writes raw responses to `runs/<id>/` |
| `score.mjs` | Replays captured responses through the checks and prints a report |
| `checks.mjs` | The check implementations |
| `selftest.mjs` | Verifies the checks still fire, using synthetic fixtures |

API calls are the expensive part and scoring is free, so they are separate
commands. Capture a run once, then re-score it as often as you like — including
after adding new checks.

## Usage

```bash
npm run dev                       # the endpoint lives in the Vite plugin
npm run eval:run -- --runs 3      # capture (needs ANTHROPIC_API_KEY)
npm run eval:score                # score the newest run
npm run eval:selftest             # verify the checks themselves
```

`run.mjs` flags: `--runs`, `--model`, `--fixture`, `--base-url`.
`score.mjs` flags: `--run <id>` (defaults to newest).

## Cost

Every capture spends real API credits. The runner prints an estimate before it
starts and the actual spend per request as it goes, using the token counts the
proxy now returns.

At `effort: "high"` with a 32k output cap, an Opus 5 generation runs near that
ceiling and costs up to roughly $0.85. A full single pass over 7 fixtures is
therefore about $6, and three passes about $18.

Ways to spend less:

- `--model claude-sonnet-5` is roughly 60% of the Opus price.
- `--fixture <id>` runs one fixture. `cad-plan-clean` alone catches most
  regressions, because it is the control case.
- Lower `EFFORT` in `server/aiConfig.ts`. Generations take 2-4 minutes at
  `"high"` and most of that is thinking tokens, which are billed as output.
- Re-score existing captures with `npm run eval:score` as often as you like. It
  reads from disk and costs nothing, so new checks never require new API calls.

**This is a development cost, not a product cost.** The app itself is BYOK: users
paste their own Anthropic key, and `server/apiProxy.ts` only falls back to
`ANTHROPIC_API_KEY` when no user key is supplied. Nothing here charges your
credits at runtime — only eval captures do.

## Building the corpus

The ten images listed in `manifest.json` are committed, so the corpus works out
of the box. To extend it, add an entry to `manifest.json` and drop the matching
image into `fixtures/`, recording its licence in `ATTRIBUTION.md`. Fixtures whose
images are absent are skipped, so a half-built entry costs nothing.

The corpus is deliberately stratified so a failure tells you *which* capability
broke. **`cad-plan-clean` is the control case** — a crisp orthographic floor plan
with dimension labels. It should score near-perfect. If it does not, the problem
is the prompt or the schema rather than model vision, and switching models will
not help.

### Run each fixture three times

Thinking is enabled and Claude 5 models removed the sampling parameters, so
there is no `temperature: 0` to pin determinism with. A check that fails once in
three runs is a different problem from one that fails every time, and a single
run per image cannot tell them apart.

## The checks

Tier 1 needs no ground truth — these are internal-consistency invariants:

| Check | Catches |
|-------|---------|
| `host_resolution` | Doors/windows naming a wall the model never emitted. The app silently discards these. |
| `host_level_match` | An opening on a wall belonging to a different floor. |
| `opening_on_wall` | An opening sitting off its host wall's centerline. |
| `opening_within_span` | An opening extending past the wall's end, which cuts a hole outside the wall outline. |
| `opening_no_overlap` | Two openings occupying the same span of one wall. |
| `wall_not_degenerate` | Zero-length walls. |
| `wall_loop_closure` | Wall endpoints meeting nothing, so rooms are not enclosed. |
| `level_has_slab` | A floor with walls but no slab. |
| `multistory_has_stair` | Multiple levels with no stair connecting them. |
| `has_roof` | A building with walls but no roof. |
| `no_origin_cluster` | Elements collapsed to (0,0), the signature of coordinates that failed to parse upstream. |
| `finite_coordinates` | NaN or Infinity in positions. |

Tier 2 runs only where `manifest.json` supplies an `expect` block. Keep it to
cheap scalar labels — roughly two minutes of work per image, not hand-modelled
geometry:

```json
"expect": {
  "floors": 2,
  "doors": 1,
  "windows": 7,
  "footprintMeters": [12, 9]
}
```

Counts are compared exactly; `footprintMeters` allows 25% deviation.
`floorsRange: [min, max]` asserts an inclusive band instead of an exact
storey count, for drawings where the count genuinely admits more than one
reading — `hand-sketch` has a roof belvedere served by a stair, which is a
storey or not depending on where you draw the line, and asserting one number
there scores the ambiguity rather than the model.
`maxElements` asserts an upper bound instead, for adversarial fixtures where the
right answer is "almost nothing" rather than a specific number.

A fixture may also list `skipChecks`. The adversarial fixture uses it to exclude
the structural checks (roof, slab, loop closure, stairs) — returning almost
nothing is the correct behaviour there, so an incomplete structure is not a
defect. Excluded checks are still printed, marked `(not scored)`, and are left
out of the failure-rate table.

The two `orthographic-plan` fixtures skip `has_roof` for the same reason. The
MEASURED DRAWING ruleset in the system prompt says to add a roof only when the
drawing shows one, and a bare floor plan does not. Scoring `has_roof` there
inverts the signal: the captured run that obeyed the prompt and emitted no roof
was marked a failure, while the two runs that invented a roof passed. A check
that rewards ignoring the prompt will steer prompt tuning the wrong way, which
is worse than no check at all.

## Images

The corpus ships with 10 images covering 7 fixtures, sourced from Wikimedia
Commons. Licences and creators are recorded in `fixtures/ATTRIBUTION.md`. Every
image is CC0 or public domain except `l-shaped-plan.jpg`, which is CC BY-SA 4.0
— delete it and its manifest entry if you would rather not carry a share-alike
image, and the runner will simply skip it.
