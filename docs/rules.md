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

## Updating the rules

1. Open the unversioned official source and verify its effective date; check whether a replacement regulation has actually entered into force.
2. Save a new dated reference and metadata rather than silently rewriting the current archive.
3. Map changed provisions to lesson content and evaluator behavior. Distinguish enacted rules from draft proposals.
4. Update the affected scenario, implementation tests, visible source date and limitations together.
5. Review ambiguous legal interpretations with a qualified Hungarian driving instructor before calling the curriculum exam-ready.
