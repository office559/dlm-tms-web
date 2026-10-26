/**
 * Restricții de circulație pentru camioane — DATE (se actualizează o dată pe an).
 * Perioada acoperită: noiembrie 2026 – decembrie 2027.
 * Sursele: calendare oficiale / ministere + rezumate specializate. Verifică mereu
 * înainte de plecare, mai ales pentru zilele regionale.
 */

export type CountryCode = "DE" | "AT" | "PL" | "SK" | "CZ" | "IT" | "HU" | "FR" | "ES" | "BE" | "NL";

export type Holiday = { date: string; name: string; scope?: string };

export type CountryInfo = {
  code: CountryCode;
  name: string;
  weight: string;
  permanent: string;
  notes: string[];
  /** De la această lună încolo datele sunt estimate (calendarul oficial nu e publicat). */
  provisionalFrom?: string;
  /** De la această lună încolo nu avem date deloc (afișăm „?”). */
  unknownFrom?: string;
};

export const FIRST_MONTH = "2026-11";
export const LAST_MONTH = "2027-12";

export const COUNTRIES: CountryInfo[] = [
  {
    code: "DE",
    name: "Germania",
    weight: "> 7,5 t (și remorci în transport comercial)",
    permanent: "Duminici și sărbători 00–22",
    notes: [
      "Sâmbăta, 1 iul – 31 aug, 07–20, pe autostrăzi și drumuri federale selectate (A1, A2, A3, A5, A6, A7, A8, A9, A45, A61 etc.).",
      "Sărbătorile regionale se aplică doar în landurile din paranteză.",
      "S-a anunțat renunțarea la interdicția de Fronleichnam, Reformationstag și Allerheiligen, dar nu e confirmat că a intrat în vigoare — le păstrăm în tabel, de confirmat.",
      "Excepții: transport combinat (max. 200 km spre gară / 150 km spre port), lapte, carne, pește, fructe și legume perisabile.",
      "Există și interdicții de noapte regionale (22–06) pe tronsoane marcate cu indicator.",
    ],
  },
  {
    code: "AT",
    name: "Austria",
    weight: "> 7,5 t (camioane cu remorcă > 3,5 t)",
    permanent: "Noapte 22–05 • Sâm 15:00 → Dum 22:00 • sărbători 00–22",
    notes: [
      "Interdicție de noapte 22:00–05:00 în toată țara (excepție: camioane silențioase cu placa „L”). Nu apare pe zile în tabel.",
      "Tirol (A12/A13/A14): interdicții suplimentare — sectoriale, sâmbete de vară/iarnă, zile speciale. Calendarul 2027 nu e publicat; verifică ASFINAG.",
      "Excepții: transport combinat (rază 65 km), unele mărfuri proaspete cu CMR/listă de încărcare.",
    ],
    provisionalFrom: "2027-01",
  },
  {
    code: "PL",
    name: "Polonia",
    weight: "> 12 t",
    permanent: "Sărbători 08–22 • ajun de sărbătoare 18–22",
    notes: [
      "Vara (de la sfârșitul anului școlar până la ultima duminică din august): vineri 18–22, sâmbătă 08–14, duminică 08–22. Pentru 2027 am estimat 25 iunie – 29 august.",
      "Nu se aplică în ajunul zilelor de 24 și 31 decembrie.",
      "Excepții: marfă perisabilă, medicamente, combustibil, animale vii; întoarcerea din străinătate; 50 km de la graniță.",
    ],
  },
  {
    code: "SK",
    name: "Slovacia",
    weight: "> 7,5 t (combinații > 3,5 t)",
    permanent: "Duminici și sărbători 06–22 (din 1 sept 2026)",
    notes: [
      "Din 1.09.2026 interdicția de duminică începe la 06:00 (înainte: 00:00).",
      "Sâmbăta, 1 iul – 31 aug, 09–19 (înainte: 07–19).",
      "Se aplică pe autostrăzi și drumuri de clasa I; pe drumuri de clasa a III-a e interzis permanent peste 12 t.",
      "Regimul exact pentru sărbători succesive: verifică înainte de plecare.",
    ],
  },
  {
    code: "CZ",
    name: "Cehia",
    weight: "> 7,5 t",
    permanent: "Duminici și sărbători 13–22",
    notes: [
      "1 iul – 31 aug: vineri 17–21 și sâmbătă 07–13.",
      "Se aplică pe autostrăzi, drumuri internaționale (E) și drumuri de clasa I.",
    ],
  },
  {
    code: "IT",
    name: "Italia",
    weight: "> 7,5 t",
    permanent: "Duminici și sărbători 09–22 (07–22 din iunie până în septembrie)",
    notes: [
      "Calendarul oficial se publică prin decret MIT (de obicei în decembrie). 2027 nu e publicat: zilele afișate sunt estimate din regula permanentă.",
      "Vara sunt interdicții suplimentare sâmbăta și vinerea după-amiază (iulie–august), stabilite prin decret — nu sunt incluse în estimarea 2027.",
      "Excepții: marfă perisabilă, animale vii.",
    ],
    provisionalFrom: "2027-01",
  },
  {
    code: "HU",
    name: "Ungaria",
    weight: "> 7,5 t",
    permanent: "Sâm 22:00 → Dum 22:00 • sărbători 00–22 (ajun 22–24)",
    notes: [
      "Iulie–august: sâmbătă 15:00 → duminică 22:00.",
      "4 noiembrie – 1 martie: transportul internațional cu Euro 3 sau mai nou nu e acoperit de interdicția generală de weekend/sărbători.",
      "Zilele-punte (bridge days) se stabilesc anual prin decret și nu sunt incluse.",
      "24 decembrie e zi liberă din 2024 — verifică dacă se aplică și interdicția.",
    ],
    provisionalFrom: "2027-01",
  },
  {
    code: "FR",
    name: "Franța",
    weight: "> 7,5 t",
    permanent: "Sâm și ajun 22–24 • Dum și sărbători 00–22",
    notes: [
      "Sâmbătă sărbătoare și duminică înainte de sărbătoare: 00–24.",
      "Vara: câteva sâmbete 07–19, stabilite anual (2026: 11, 18, 25 iul, 1 și 8 aug). Pentru 2027 nu sunt publicate.",
      "Île-de-France și Auvergne-Rhône-Alpes au restricții suplimentare (ex. vineri 16–21, sâmbătă 10–18) care nu sunt în tabel.",
      "Calendarul detaliat se publică de obicei spre sfârșit de an (Bison Futé).",
    ],
    provisionalFrom: "2027-01",
  },
  {
    code: "ES",
    name: "Spania",
    weight: "> 7,5 t",
    permanent: "Fără interdicție națională — doar pe rute și date",
    notes: [
      "Restricțiile se stabilesc anual prin rezoluția DGT, pe drumuri și zile concrete (vezi dgt.es).",
      "Zilele afișate pentru 2026 sunt zile cu restricții pe drumuri selectate, în funcție de regiune și sărbătoare.",
      "Calendarul 2027 nu e încă publicat.",
    ],
    unknownFrom: "2027-01",
  },
  {
    code: "BE",
    name: "Belgia",
    weight: "fără prag (nu există interdicție generală)",
    permanent: "Nu există interdicție generală",
    notes: [
      "Fără interdicție de weekend/sărbători pentru camioane obișnuite.",
      "Transporturi speciale (lățime > 4 m sau lungime > 30 m): interdicții de zi pe autostrăzi selectate.",
      "Zone cu emisii reduse (LEZ) în Bruxelles, Anvers și Gent — contează norma Euro.",
    ],
  },
  {
    code: "NL",
    name: "Olanda",
    weight: "fără prag (nu există interdicție generală)",
    permanent: "Nu există interdicție generală",
    notes: [
      "Fără interdicție de weekend/sărbători pentru camioane obișnuite.",
      "Transporturi excepționale: nu la orele de vârf 06–10 și 15–20.",
      "Zone de mediu (milieuzones) și zone zero-emisii în orașe; unele tuneluri restricționează ADR.",
    ],
  },
];

const h = (date: string, name: string, scope?: string): Holiday => ({ date, name, scope });

/** Sărbători (zile cu interdicție), noiembrie 2026 – decembrie 2027. */
export const HOLIDAYS: Record<CountryCode, Holiday[]> = {
  DE: [
    h("2026-11-01", "Allerheiligen", "BW BY NW RP SL"),
    h("2026-11-18", "Buß- und Bettag", "SN"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Crăciun (a 2-a zi)"),
    h("2027-01-01", "Anul Nou"),
    h("2027-01-06", "Bobotează", "BW BY ST"),
    h("2027-03-08", "Ziua femeii", "BE MV"),
    h("2027-03-26", "Vinerea Mare"),
    h("2027-03-28", "Paște"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-06", "Înălțarea Domnului"),
    h("2027-05-17", "Lunea Rusaliilor"),
    h("2027-05-27", "Fronleichnam", "BW BY HE NW RP SL"),
    h("2027-08-15", "Adormirea Maicii Domnului", "SL, parțial BY"),
    h("2027-10-03", "Ziua Unității"),
    h("2027-10-31", "Reformationstag", "BB HB HH MV NI SN ST SH TH"),
    h("2027-11-01", "Allerheiligen", "BW BY NW RP SL"),
    h("2027-11-17", "Buß- und Bettag", "SN"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Crăciun (a 2-a zi)"),
  ],
  AT: [
    h("2026-11-01", "Toți Sfinții"),
    h("2026-12-08", "Neprihănita Zămislire"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Sf. Ștefan"),
    h("2027-01-01", "Anul Nou"),
    h("2027-01-06", "Bobotează"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-06", "Înălțarea Domnului"),
    h("2027-05-17", "Lunea Rusaliilor"),
    h("2027-05-27", "Corpus Christi"),
    h("2027-08-15", "Adormirea Maicii Domnului"),
    h("2027-10-26", "Ziua Națională"),
    h("2027-11-01", "Toți Sfinții"),
    h("2027-12-08", "Neprihănita Zămislire"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Sf. Ștefan"),
  ],
  PL: [
    h("2026-11-01", "Wszystkich Świętych"),
    h("2026-11-11", "Ziua Independenței"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Crăciun (a 2-a zi)"),
    h("2027-01-01", "Anul Nou"),
    h("2027-03-28", "Paște"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-03", "Ziua Constituției"),
    h("2027-05-16", "Rusalii"),
    h("2027-05-27", "Corpus Christi"),
    h("2027-08-15", "Adormirea Maicii Domnului"),
    h("2027-11-01", "Wszystkich Świętych"),
    h("2027-11-11", "Ziua Independenței"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Crăciun (a 2-a zi)"),
  ],
  SK: [
    h("2026-11-01", "Toți Sfinții"),
    h("2026-11-17", "Ziua luptei pentru libertate"),
    h("2026-12-24", "Ajunul Crăciunului"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Sf. Ștefan"),
    h("2027-01-01", "Anul Nou"),
    h("2027-01-06", "Bobotează"),
    h("2027-03-26", "Vinerea Mare"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-08", "Ziua Victoriei"),
    h("2027-07-05", "Sf. Chiril și Metodiu"),
    h("2027-08-29", "Răscoala Națională"),
    h("2027-09-01", "Ziua Constituției"),
    h("2027-09-15", "Fecioara Durerilor"),
    h("2027-11-01", "Toți Sfinții"),
    h("2027-11-17", "Ziua luptei pentru libertate"),
    h("2027-12-24", "Ajunul Crăciunului"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Sf. Ștefan"),
  ],
  CZ: [
    h("2026-11-17", "Ziua luptei pentru libertate"),
    h("2026-12-24", "Ajunul Crăciunului"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Sf. Ștefan"),
    h("2027-01-01", "Anul Nou"),
    h("2027-03-26", "Vinerea Mare"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-08", "Ziua Victoriei"),
    h("2027-07-05", "Sf. Chiril și Metodiu"),
    h("2027-07-06", "Jan Hus"),
    h("2027-09-28", "Sf. Venceslau"),
    h("2027-10-28", "Ziua Independenței"),
    h("2027-11-17", "Ziua luptei pentru libertate"),
    h("2027-12-24", "Ajunul Crăciunului"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Sf. Ștefan"),
  ],
  IT: [
    h("2026-11-01", "Ognissanti"),
    h("2026-12-08", "Immacolata"),
    h("2026-12-25", "Natale"),
    h("2026-12-26", "Santo Stefano"),
    h("2027-01-01", "Capodanno"),
    h("2027-01-06", "Epifania"),
    h("2027-03-28", "Pasqua"),
    h("2027-03-29", "Lunedì dell'Angelo"),
    h("2027-04-25", "Festa della Liberazione"),
    h("2027-05-01", "Festa del Lavoro"),
    h("2027-06-02", "Festa della Repubblica"),
    h("2027-08-15", "Ferragosto"),
    h("2027-11-01", "Ognissanti"),
    h("2027-12-08", "Immacolata"),
    h("2027-12-25", "Natale"),
    h("2027-12-26", "Santo Stefano"),
  ],
  HU: [
    h("2026-11-01", "Toți Sfinții"),
    h("2026-12-24", "Ajunul Crăciunului", "de confirmat"),
    h("2026-12-25", "Crăciun"),
    h("2026-12-26", "Crăciun (a 2-a zi)"),
    h("2027-01-01", "Anul Nou"),
    h("2027-03-15", "Revoluția din 1848"),
    h("2027-03-26", "Vinerea Mare"),
    h("2027-03-28", "Paște"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-16", "Rusalii"),
    h("2027-05-17", "Lunea Rusaliilor"),
    h("2027-08-20", "Ziua Sf. Ștefan"),
    h("2027-10-23", "Revoluția din 1956"),
    h("2027-11-01", "Toți Sfinții"),
    h("2027-12-24", "Ajunul Crăciunului", "de confirmat"),
    h("2027-12-25", "Crăciun"),
    h("2027-12-26", "Crăciun (a 2-a zi)"),
  ],
  FR: [
    h("2026-11-11", "Armistițiul 1918"),
    h("2026-12-25", "Crăciun"),
    h("2027-01-01", "Anul Nou"),
    h("2027-03-28", "Paște"),
    h("2027-03-29", "Lunea Paștelui"),
    h("2027-05-01", "1 Mai"),
    h("2027-05-06", "Înălțarea Domnului"),
    h("2027-05-08", "Victoria 1945"),
    h("2027-05-16", "Rusalii"),
    h("2027-05-17", "Lunea Rusaliilor"),
    h("2027-07-14", "Ziua Națională"),
    h("2027-08-15", "Adormirea Maicii Domnului"),
    h("2027-11-01", "Toussaint"),
    h("2027-11-11", "Armistițiul 1918"),
    h("2027-12-25", "Crăciun"),
  ],
  ES: [],
  BE: [],
  NL: [],
};

/** Spania: zile cu restricții pe drumuri selectate (rezoluția DGT 2026). */
export const ES_DATES_2026: string[] = [
  "2026-11-01",
  "2026-11-02",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-12-04",
  "2026-12-05",
  "2026-12-06",
  "2026-12-08",
  "2026-12-24",
  "2026-12-31",
];

/** Surse oficiale pentru verificare. */
export const SOURCES: { label: string; url: string }[] = [
  { label: "BGL — Fahrverbote Deutschland 2026", url: "https://www.bgl-ev.de/wp-content/uploads/2026/06/2026-Fahrverbote-Deutschland.pdf" },
  { label: "WKO — Lkw-Fahrverbote Österreich", url: "https://www.wko.at/transport/lkw-fahrverbote-oesterreich-ueberblick" },
  { label: "Bison Futé — brosura PL 2026", url: "https://www.bison-fute.gouv.fr/IMG/pdf/26056_BROCHURE_2026_FR.pdf" },
  { label: "DGT — restricții 2026", url: "https://www.dgt.es" },
  { label: "MIT — calendar divieti 2026", url: "https://mit.gov.it" },
  { label: "GITD — zakazy ruchu (Polonia)", url: "https://www.gov.pl/web/gitd" },
];
