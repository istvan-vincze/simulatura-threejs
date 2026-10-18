# KRESZ source and coverage

Checked on **18 October 2026** against the [Nemzeti Jogszabálytár's consolidated 1/1975. (II. 5.) KPM–BM regulation](https://njt.jog.gov.hu/jogszabaly/1975-1-20-24). The unversioned official page displayed the effective text date **2026.04.11**. Do not infer currency from a search result pointing to a numeric historical suffix such as `.19` (2012).

The government publication [Az új KRESZ tervezete, 10 February 2026](https://kormany.hu/dokumentumtar/az-uj-kresz-tervezete) explicitly labels that document a draft. It has not been substituted for the consolidated law in this application. Recheck the official registry when updating the curriculum; this archive does not auto-update.

The [local text archive](reference/kresz-2026-04-11.txt) contains the regulation body and appendices, with links to its official figures. Editorial amendment footnotes are omitted. [Source metadata](reference/source.json) records retrieval, effective date and hashes. The original official page remains authoritative; the archive is a convenient searchable reference.

## Implemented lesson rules

| Lesson / behavior       | Provision                             | Interpretation in this chapter                                                                                                                                                                        |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equal-priority junction | 28. § (1) a), (3)                     | The learner proceeds straight and yields to the vehicle coming from the right. No signs, tram, emergency vehicle, officer, or conflicting special rule.                                               |
| STOP                    | 12. § (1) b); 28. § (2) b)            | Stop before the marked line, then give priority to the crossing road. Slowing down alone is insufficient.                                                                                             |
| Traffic signal          | 9. § (1) a), (2), (4) a), c)–e)       | Red and red+amber prohibit crossing the stop line. Green permits proceeding if clear. Amber requires stopping unless safe stopping is no longer possible.                                             |
| Left turn               | 29. § (2); 31. § (1), (3), (5) c) ca) | Signal before and throughout the turn, yield to the oncoming straight vehicle, turn in a wide arc and finish on the right side. No other vehicles, pedestrians or special priority rules are present. |
| Right-hand travel       | 25. § (2)                             | Keep the car on the right side of the carriageway for this straight route.                                                                                                                            |
| Built-up-area car speed | 26. § (1) a), (4)                     | 50 km/h maximum in this town, with lower speed as the situation requires.                                                                                                                             |

The signal order is green → amber → red → red+amber → green. Cross directions are interlocked with all-red clearance intervals. Phase durations are authored simulation timings, not statutory durations.

## Simulation assumptions, not legal rules

- Vehicle footprint is a 4.4 × 1.82 m oriented rectangle. Wheels use a 2.65 m wheelbase.
- STOP is recognized at zero simulated speed while the front is within 3 m before the near edge of the painted line, or aligned with its 0.35 m stripe. Crossing the stripe’s far edge without a stop records a violation. Braking with no throttle settles residual speed below 0.05 m/s to zero. This tolerance is a coaching implementation; there is no invented legal “wait three seconds” rule.
- Priority uses an authored conflict area for each movement pair: straight/crossing or left-turn/oncoming. Swept vehicle bounds sampled every 5 cm establish path-distance entry and exit windows. The checker compares the other vehicle's arrival with estimated learner clearance, with a 1-second margin and a 2 m/s minimum assumed clearance speed. It evaluates while the learner occupies the conflict area, allowing waiting in the approach lane. This conservative bounding-box model is not a general legal priority solver or a prediction of another driver's braking.
- The left-turn guide has a 5.85 m radius. Steering remains manual; there is no path snapping. The indicator checker requires at least 1 simulated second of advance signaling before the car turns more than 0.12 radians, and continuous left indication until its rear clears the junction while aligned within 0.25 radians of the westbound lane. These are coaching thresholds, not statutory durations or angles. KRESZ requires timely and continuous indication without prescribing a fixed number of seconds. The lane checker detects crossing into the opposing approach or exit lane, but does not separately grade exact positioning beside the centerline before the turn.
- Amber clearance estimates stopping distance from 0.7 seconds response time and 5 m/s² braking at the instant amber begins. These numbers are simulation assumptions, not legislation. Red always prohibits a new line crossing.
- The speed evaluator allows 0.5 km/h numerical tolerance. This is not a legally permitted speeding margin.
- Curb departure ends a run. Wrong-lane driving records an error. Ending a run early cannot pass.
- Crosswalks are modeled, but these lessons contain no pedestrians; pedestrian priority has not yet been evaluated.
- The goal is reached when the vehicle's rear has cleared the goal strip. For the left turn, the goal is westbound and the car must have finished its turn and be aligned within 0.3 radians of the exit direction. Errors remain in the run even if the driver later recovers.

## Continuous evaluation in free driving

The authored practice junction uses `driving-evaluator.ts`, independently of lesson questions, target routes and completion. It accepts consecutive vehicle observations, actual traffic, junction layout and indicator input. Events contain a stable sequence number, simulated time, position, approach and provision reference. Four approach directions share the same geometry-based checks. Each visit has its own stop, line-crossing and turning state; exiting or reversing back behind the line rearms the checks. Existing lesson evaluators remain unchanged regression cases.

- STOP applies to the north/south approaches only in the STOP layout. The same stopping tolerance used in lessons applies; a rolling stop is rejected. Retreating away from the line clears the remembered stop.
- Signals use the correct north/south or east/west phase for the observed approach. The existing amber stopping-distance approximation applies. Reverse gear supports maneuvering but does not yet implement the complete legal rules for reversing.
- Priority first establishes who must yield: traffic from the right at equal priority, north/south approaches yielding to the east/west priority road in the STOP layout, and left turns yielding to oncoming straight traffic. A three-second prediction samples actual speed and steering every 0.15 seconds to detect conflicting footprints. This is a local training approximation, not an exhaustive priority solver. Green also requires yielding to conflicting traffic still clearing the junction.
- Turn detection uses actual heading change of 0.2 radians near the junction. Indication must precede it by one simulated second and continue until the vehicle has cleared the junction and aligned with its exit. Those are coaching thresholds, not statutory timing or angle requirements. Lane changes, U-turn-specific rules and precise pre-turn positioning are not comprehensively evaluated.
- Speed uses the existing 0.5 km/h numerical tolerance. Wrong-lane checks compare the footprint to the road centerline outside the junction, with 0.12 m numerical tolerance. A violation episode rearms after one simulated second without that condition, avoiding repeated frame-level alerts.
- Curbs and vehicle collisions are evaluated before blocking the attempted movement. The drive continues; the player can reverse or recover to the start. Map edges stop movement without inventing a traffic-law violation. Recovery preserves the log, while a new drive clears it. The most recent 100 events and total count are kept in memory, not browser storage.

The traffic stream is one east-to-west car with repeating arrivals. It respects signal stops, yields to conflicting priority traffic and avoids spawning near the learner. Pedestrian priority, following-distance grading, parking, trams, bicycles, additional road types and many other KRESZ obligations remain outside the modeled coverage. A clean log is not proof of legal or exam-ready driving.

## Imported Zugló map

`map-evaluator.ts` uses the same evidence log while observing the imported graph in world coordinates. It has no lesson goal or prescribed player route. The [offline source and derivation](../data/osm/README.md) distinguish OSM data, estimated geometry and unverified controls.

- Speed limits come from each road's OSM tag (mostly 30 km/h), with the built-up-area default for untagged roads and the existing 0.5 km/h numerical tolerance. Displayed limits and evaluation use the same road lookup.
- One-way direction and right-hand travel use the nearest oriented road segment. Footprints are checked outside an 11 m region around junctions and sharp centre-line bends, where comparing against just one approach would create false positives. This deliberately leaves detailed intersection lane positioning ungraded.
- Indicator checks begin on a recognized junction approach. An actual heading change greater than 0.25 radians within 10 m of the junction triggers a turn; the same one-second advance indication approximation applies. Clearing the junction before cancelling does not produce a late-indication error. These distances/angles are coaching approximations, not law.
- Imported node-based turn restrictions are checked when an entered junction is exited. They are displayed in the scene. Broader sign precedence, lane-specific turns, via-way restrictions, U-turn rules and legal route planning are not yet covered comprehensively.
- Road departure uses the exact polygons rendered as asphalt, checking the vehicle corners, edge midpoints and centre. End barriers stop the car without a traffic-law penalty. Collision and recovery behavior share the practice mode's evidence semantics.
- The NPC follows a closed directed circuit that respects imported one-way and turn restrictions. It yields conservatively to conflicting learner movement. Unknown priority is not inferred from its behavior.
- The source extract has one mapped give-way node on these selected streets, rendered in its tagged direction, and no mapped STOP or signal nodes. Sparse tags do not establish the full priority system. Actual local controls still need verification; **this map does not grade STOP, signals or junction priority**. Use **Gyakorlótér** for those exercises. The real map is not ready for exam scoring.

## Updating the rules

1. Open the unversioned official source and verify its effective date; check whether a replacement regulation has actually entered into force.
2. Save a new dated reference and metadata rather than silently rewriting the current archive.
3. Map changed provisions to lesson content and evaluator behavior. Distinguish enacted rules from draft proposals.
4. Update the affected scenario, implementation tests, visible source date and limitations together.
5. Review ambiguous legal interpretations with a qualified Hungarian driving instructor before calling the curriculum exam-ready.
