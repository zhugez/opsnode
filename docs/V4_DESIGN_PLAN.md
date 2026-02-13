# OpsNode V4 Design Plan (Focused)

## Design Principles
1. **Command-center first**: surface mission-critical state in one glance (unit counts, role distribution, mission status bands, gateway state).
2. **Role clarity**: every unit card and selection should clearly show archetype, tier, and operational posture.
3. **Readable mission state**: normalize status language and color semantics (idle/running/paused, enabled/disabled) across HUD + roster + 3D scene.
4. **Spatial rhythm over clutter**: simplify panel composition, align blocks to a strong grid, increase negative space, reduce decorative noise.
5. **RTS framing**: keep map/stage central, move controls into compact command rails, preserve direct-manipulation interactions.
6. **No regression**: keep spawn/select/multiselect/recruit/batch/status behavior and `/api/gateway-action` contract intact.
7. **Performance guardrails**: avoid expensive new render loops, memoize derived metrics, reuse existing assets/components.

## P0 (Must Ship)
- **Information hierarchy pass**
  - Add top command HUD with live counters (total/active/running/paused/selected).
  - Add role-distribution strip (sentinel/sniper/analyst/medic counts).
  - Add mission state readability card (operational %, paused count, disabled count, selected count).
- **Layout restructuring**
  - Promote 3D stage as primary center panel.
  - Reframe side content into compact command rail + status rail.
  - Keep roster and batch controls but simplify visual density.
- **Visual system refresh**
  - Dark neutral RTS palette, tighter borders, stronger typographic hierarchy.
  - Reduced glow clutter; clearer labels and section separators.
- **Behavior lock**
  - Ensure existing interactions remain unchanged:
    - spawn animation on recruit,
    - unit selection + additive multiselect,
    - recruit modal,
    - batch enable/disable/pause/resume,
    - status toggle + enable toggle,
    - gateway summon/reset calls.

## P1 (Partial if Safe)
- Add compact “Mission Queue” summary row (derived, non-destructive).
- Add clearer status legends near stage (color key + meaning).
- Improve detail mode readability with denser metadata grouping.
- Minor accessibility polish (aria labels + stronger contrast on tiny text).

## P2 (Later)
- Virtualized large-roster mode for 100+ units.
- Keyboard command layer (group assign, quick select numbers).
- Persistent mission presets and saved formations.
- Server-backed telemetry stream replacing local derived counters.
