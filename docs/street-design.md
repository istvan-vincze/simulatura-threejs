# Street geometry references

The training junction uses a stylized Budapest residential-street treatment: neutral gray sidewalks, narrow concrete kerbstones immediately adjoining the asphalt, rounded corners, and sloping zebra landings with tactile warning tiles. It is not a reconstruction of a specific junction or a certified accessibility design.

Visual references:

- [BKK: Blaha Lujza tér pedestrian crossings, March 2022](https://bkk.hu/hirek/2022/03/uj-gyalogatkelohelyeket-alakitott-ki-a-bkk-a-blaha-lujza-ternel.7441/) — street photography for curb continuity, materials and crossing approaches.
- [BKK: Akadálymentes környezet, Tervezési útmutató II. kötet, June 2024](https://bkk.hu/downloads/30687/) — section 3.4, pages 39–40, for lowered crossing curbs and contrasting tactile warnings.

Road width and corner radius are shared with the driving boundary in `src/domain/junction.ts`. Changing the pavement must keep rendered asphalt and off-road evaluation aligned. The existing stop markings and lesson routes retain their positions.
