# From a first chapter to a KRESZ simulator

The product leads with a traffic decision, then lets the learner practice it and receive an explanation grounded in the relevant rule. Car handling supports that loop. New content should arrive as complete, reviewable lessons with successful and failed examples.

## Toward an exam with varied routes

The user wants a future exam that gives changing directions and continuously evaluates the resulting driving, rather than a fixed sequence of the existing lessons. Free driving now provides the first route-independent observation/evidence loop: movement continues after violations, and returning to a junction creates a fresh encounter. It now supports the authored junction and an imported connected residential street network around Újvidék tér in Zugló. The real-map traffic controls remain unverified.

The next exam steps are to verify the real map’s controls and lane geometry, generalize traffic beyond its current legal circuit, add seeded route selection and timely turn instructions, then implement an exam lifecycle and reviewed assessment policy. The imported graph and shared carriageway geometry are already present; procedurally generated surroundings preserve the real street layout. Route compliance must be evaluated separately from traffic-law evidence: taking a wrong turn is not automatically a KRESZ violation. Keep the exact seed and driver inputs for replay, and make an exam reproducible even though different runs choose different routes. Extend and validate rule coverage before presenting this as a proper practical exam. Do not assign arbitrary penalty points now.

## Next slices

1. **Validate this chapter visually and with a driving instructor.** Check sightlines, sign orientation, stop distances, camera comfort, steering feel, mobile control ergonomics and explanations. The current user will perform the browser pass.
2. **Extend turning.** Shared lane paths, authored conflict areas, a left-turn lesson across oncoming traffic and indicator evaluation are implemented. Next add a right-turn lesson and additional conflicting movements. Keep the existing four lessons as regression cases; the current two movement pairs do not constitute a general priority solver.
3. **Vulnerable road users.** Add pedestrian and cycle paths, crossing occupancy, perception distance and yield events. Add visual pedestrian signals and crossings together with their actual behavior.
4. **Road and sign variations.** T-junctions, priority-road bends, roundabouts, one-way streets, lane changes, obstructions and overtaking. Build junction geometry from the same lane definitions used by the rules.
5. **Special participants and controls.** Trams, emergency vehicles, officer signals, flashing amber and railway crossings. Define precedence explicitly per movement and source provision.
6. **Authoring and review.** A versioned scenario schema, validation of approach/route geometry, deterministic seeded traffic, recorded inputs and replay. Only then add a scenario editor that can author valid situations without embedding arbitrary code.

## Coverage inventory

| Area                                        | Initial provision pointers         | State                                                  |
| ------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Right-hand priority, STOP, ordinary signals | 9., 12., 28. §                     | Three implemented straight-through lessons             |
| Signs and road markings                     | 10.–18. §                          | Only a small visual subset; no full sign library       |
| Speed and following distance                | 26.–27. §                          | Basic urban speed check only                           |
| Direction changes and turning               | 29., 31. §                         | Left turn across oncoming traffic; other turns planned |
| Overtaking, avoidance, reversing            | 34.–35., 33. §                     | Planned                                                |
| Pedestrians and crossings                   | 21., 31., 43. §                    | Planned                                                |
| Cyclists and bicycle infrastructure         | 54. § and applicable general rules | Planned                                                |
| Railway crossings                           | 39. §                              | Planned                                                |
| Motorways, residential zones                | 37., 39/A. §                       | Planned                                                |
| Stopping and parking                        | 40.–41. §                          | Planned                                                |
| Trams and public transport                  | 24., 28., 31., 38. §               | Planned                                                |
| Officer directions and emergency vehicles   | 6., 28., 42., 49. §                | Planned                                                |
| Lighting, visibility, technical failure     | 44.–45., 56.–57. §                 | Planned                                                |

These pointers organize future work; they do not claim comprehensive rule coverage. An exhaustive curriculum also needs actor classes, road types, signs, movement intentions, visibility, conflicting participants and exception combinations. Enumerate those combinations with traceable source references before claiming “every KRESZ scenario.”

## Ownership boundaries

Scenario data describes a lesson. Pure domain code decides movement, conflicts and events. Rendering creates and positions models. UI presents choices and feedback. A GLB asset, new camera, or prettier road must not change scoring. A legal amendment must not require rewriting a car mesh. Defer a generic rule engine until multiple movement types make its inputs and precedence concrete.
