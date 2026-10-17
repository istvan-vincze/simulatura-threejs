export type ScenarioId = "priority" | "stop" | "signals" | "left-turn";
export interface Scenario {
  id: ScenarioId;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  question: string;
  choices: readonly string[];
  answer: number;
  explanation: string;
  rule: string;
  objectives: readonly string[];
}
export const RULE_SOURCE = "https://njt.jog.gov.hu/jogszabaly/1975-1-20-24";
export const scenarios: readonly Scenario[] = [
  // Each lesson describes only the participants actually present in its scene.
  {
    id: "priority",
    number: "01",
    title: "A jobbkéz-szabály",
    subtitle: "Egyenrangú kereszteződés",
    description:
      "Egyenesen haladsz tovább. Nincs elsőbbséget szabályozó tábla; jobbról egy kék autó érkezik.",
    question: "Melyikőtök haladhat át először?",
    choices: [
      "Én, mert egyenesen haladok.",
      "A jobbról érkező kék autó.",
      "Aki előbb ér a kereszteződéshez.",
    ],
    answer: 1,
    explanation:
      "Ebben az egyenrangú kereszteződésben elsőbbséget adsz a jobbról érkező autónak. Várd meg, amíg elhalad, majd folytasd egyenesen.",
    rule: "KRESZ 28. § (1) a)",
    objectives: [
      "Adj elsőbbséget a kék autónak.",
      "Maradj a jobb oldali sávban.",
      "Haladj át egyenesen a célkapuig.",
    ],
  },
  {
    id: "stop",
    number: "02",
    title: "Állj! Aztán indulj.",
    subtitle: "STOP tábla és elsőbbség",
    description:
      "STOP táblához érkezel. A keresztező úton egy kék autó halad. A fehér vonal jelzi a megállás helyét.",
    question: "Mi a teendőd a vonalnál?",
    choices: [
      "Lassítok, és ha szabad az út, továbbgurulok.",
      "Csak akkor állok meg, ha jármű érkezik.",
      "Megállok, majd elsőbbséget adok.",
    ],
    answer: 2,
    explanation:
      "A STOP táblánál teljesen meg kell állnod a megállás helyét jelző vonal előtt, majd elsőbbséget kell adnod a keresztező úton közlekedőknek.",
    rule: "KRESZ 12. § (1) b), 28. § (2) b)",
    objectives: [
      "Állj meg közvetlenül a vonal előtt.",
      "Engedd el a keresztező forgalmat.",
      "Haladj át egyenesen a célkapuig.",
    ],
  },
  {
    id: "signals",
    number: "03",
    title: "A megfelelő pillanat",
    subtitle: "Jelzőlámpás kereszteződés",
    description:
      "A lámpád piros. A keresztirányú forgalom halad; a feladatod egyenesen továbbmenni, amikor szabad.",
    question: "Elindulhatsz a piros és sárga együttes jelzésénél?",
    choices: [
      "Még nem; megvárom a zöld jelzést.",
      "Igen, ha nincs senki a kereszteződésben.",
      "Igen, a sárga már szabad utat jelez.",
    ],
    answer: 0,
    explanation:
      "A piros és a piros-sárga jelzésnél is a vonal előtt vársz. Zöldnél indulhatsz tovább, ha a kereszteződés szabad.",
    rule: "KRESZ 9. § (4)",
    objectives: [
      "Állj meg a piros jelzésnél.",
      "Várd meg a zöldet és a szabad utat.",
      "Haladj át egyenesen a célkapuig.",
    ],
  },
  {
    id: "left-turn",
    number: "04",
    title: "Balra, körültekintően",
    subtitle: "Kanyarodás és szembejövő forgalom",
    description:
      "Balra kanyarodsz a jelzés nélküli kereszteződésben. A szemből érkező kék autó egyenesen halad. Más jármű és gyalogos nincs a helyszínen.",
    question: "Hogyan készíted elő a balra kanyarodást?",
    choices: [
      "Bekapcsolom a bal irányjelzőt, és elsőbbséget adok a szemből egyenesen haladónak.",
      "Az irányjelző bekapcsolásával elsőbbséget kapok.",
      "Rögtön balra fordulok, mert a másik autó nem jobbról érkezik.",
    ],
    answer: 0,
    explanation:
      "Időben jelezd a balra kanyarodást, és tartsd fenn a jelzést a manőver végéig. Adj elsőbbséget a szemből egyenesen haladó autónak. Nagy ívben fordulj, majd a menetirány szerinti jobb oldalon folytasd.",
    rule: "KRESZ 29. § (2); 31. § (1), (3), (5) c) ca)",
    objectives: [
      "Kapcsold be időben a bal irányjelzőt (Q vagy a képernyőgomb).",
      "Lassíts, és engedd el a szemből érkező kék autót.",
      "Kis sebességgel, nagy ívben fordulj balra (A / ←).",
      "Egyenesítsd ki a kormányt, és a jobb oldali sávban haladj a célkapuig.",
    ],
  },
];
