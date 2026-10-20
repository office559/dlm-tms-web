/**
 * Cititor de fișiere tahograf .DDD (UE 165/2014, Anexa 1B / 1C).
 *
 * Suportă:
 *  - fișiere de CAMION (VU): generația 1, generația 2 și generația 2 v2 (Smart 2)
 *  - fișiere de CARD de șofer: generația 1 și 2 (inclusiv trecerile de frontieră din v2)
 *
 * Extrage doar ce ne trebuie pentru pontaj: activitățile pe minut (condus, muncă,
 * disponibilitate, odihnă), cine a condus (cardul), numărul camionului și țările
 * (locurile de început/sfârșit de zi și trecerile de frontieră).
 *
 * Fișierul nu are dependențe — se poate testa și separat cu Node.
 */

export type Activity = 0 | 1 | 2 | 3; // 0 odihnă/pauză, 1 disponibilitate, 2 alte activități (muncă), 3 condus

/** O perioadă continuă de activitate, în minute UTC de la începutul zilei (0..1440). */
export type Segment = { start: number; end: number; act: Activity; manual?: boolean };

export type CountryEvent = {
  /** ISO, UTC */
  at: string;
  /** codul țării în care se află șoferul după acest moment (ex. "RO", "DE") */
  country: string;
  /** de unde vine informația */
  kind: "border" | "start" | "end" | "place";
  from?: string;
};

export type DriverDay = {
  cardNumber: string;
  /** ziua UTC, YYYY-MM-DD */
  day: string;
  segments: Segment[];
  /** numerele de înmatriculare folosite în acea zi (dacă se cunosc) */
  vehicles: string[];
};

export type ParsedDdd = {
  kind: "vu" | "card";
  generation: string;
  /** VU: numărul camionului */
  plate?: string;
  vin?: string;
  /** card: datele șoferului */
  card?: { number: string; surname: string; firstNames: string; expiry?: string };
  /** toți titularii de card întâlniți (VU) */
  holders: { number: string; surname: string; firstNames: string }[];
  days: DriverDay[];
  countries: (CountryEvent & { cardNumber: string })[];
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* Coduri de țară (NationNumeric) → ISO                                 */
/* ------------------------------------------------------------------ */

const NATIONS: Record<number, string> = {
  0x01: "AT", 0x02: "AL", 0x03: "AD", 0x04: "AM", 0x05: "AZ", 0x06: "BE", 0x07: "BG",
  0x08: "BA", 0x09: "BY", 0x0a: "CH", 0x0b: "CY", 0x0c: "CZ", 0x0d: "DE", 0x0e: "DK",
  0x0f: "ES", 0x10: "EE", 0x11: "FR", 0x12: "FI", 0x13: "LI", 0x14: "FO", 0x15: "GB",
  0x16: "GE", 0x17: "GR", 0x18: "HU", 0x19: "HR", 0x1a: "IT", 0x1b: "IE", 0x1c: "IS",
  0x1d: "KZ", 0x1e: "LU", 0x1f: "LT", 0x20: "LV", 0x21: "MT", 0x22: "MC", 0x23: "MD",
  0x24: "MK", 0x25: "NO", 0x26: "NL", 0x27: "PT", 0x28: "PL", 0x29: "RO", 0x2a: "SM",
  0x2b: "RU", 0x2c: "SE", 0x2d: "SK", 0x2e: "SI", 0x2f: "TM", 0x30: "TR", 0x31: "UA",
  0x32: "VA", 0x33: "RS", 0x34: "ME", 0x35: "RS", 0x36: "UZ", 0x37: "TJ", 0x38: "KG",
  0xfd: "EU", 0xfe: "EU", 0xff: "",
};

export function nationToIso(n: number): string {
  return NATIONS[n] ?? "";
}

/* ------------------------------------------------------------------ */
/* Citire de bază                                                      */
/* ------------------------------------------------------------------ */

class Reader {
  b: Uint8Array;
  pos: number;
  constructor(b: Uint8Array, pos = 0) {
    this.b = b;
    this.pos = pos;
  }
  get left() {
    return this.b.length - this.pos;
  }
  need(n: number) {
    if (this.pos + n > this.b.length) throw new Error("fișier trunchiat");
  }
  u8() {
    this.need(1);
    return this.b[this.pos++];
  }
  u16() {
    this.need(2);
    const v = (this.b[this.pos] << 8) | this.b[this.pos + 1];
    this.pos += 2;
    return v;
  }
  u24() {
    this.need(3);
    const v = (this.b[this.pos] << 16) | (this.b[this.pos + 1] << 8) | this.b[this.pos + 2];
    this.pos += 3;
    return v;
  }
  u32() {
    this.need(4);
    const v =
      this.b[this.pos] * 0x1000000 +
      ((this.b[this.pos + 1] << 16) | (this.b[this.pos + 2] << 8) | this.b[this.pos + 3]);
    this.pos += 4;
    return v;
  }
  bytes(n: number) {
    this.need(n);
    const s = this.b.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  skip(n: number) {
    this.need(n);
    this.pos += n;
  }
}

function u16at(b: Uint8Array, p: number) {
  return (b[p] << 8) | b[p + 1];
}
function u32at(b: Uint8Array, p: number) {
  return b[p] * 0x1000000 + ((b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]);
}

/** Text simplu (IA5 / Latin), fără caracterele de umplutură. */
function ascii(b: Uint8Array): string {
  let s = "";
  for (const c of b) s += c >= 0x20 && c !== 0xff ? String.fromCharCode(c) : " ";
  return s.replace(/\s+/g, " ").trim();
}

/** Text cu pagină de cod (primul octet = code page; ISO-8859-x). */
function cpText(b: Uint8Array): string {
  if (b.length === 0) return "";
  const body = b.subarray(1);
  let s = "";
  for (const c of body) s += c >= 0x20 && c !== 0xff ? String.fromCharCode(c) : " ";
  return s.replace(/\s+/g, " ").trim();
}

function timeReal(sec: number): Date | null {
  if (!sec || sec === 0xffffffff) return null;
  return new Date(sec * 1000);
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** ActivityChangeInfo (2 octeți): 'scpaattttttttttt'. */
function decodeChange(v: number) {
  return {
    slot: (v >> 15) & 1, // 0 = șofer, 1 = coechipier
    crew: (v >> 14) & 1,
    notInserted: (v >> 13) & 1, // 0 = card introdus, 1 = card lipsă
    act: ((v >> 11) & 3) as Activity,
    minute: v & 0x7ff,
  };
}

function cleanCard(s: string) {
  return s.replace(/\s+/g, "").toUpperCase();
}

/** Lipește segmentele vecine cu aceeași activitate și le sortează. */
export function normalizeSegments(segs: Segment[]): Segment[] {
  const s = segs
    .filter((x) => x.end > x.start)
    .map((x) => ({ ...x, start: Math.max(0, x.start), end: Math.min(1440, x.end) }))
    .sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && last.act === x.act && last.end >= x.start && !!last.manual === !!x.manual) {
      last.end = Math.max(last.end, x.end);
    } else if (last && x.start < last.end) {
      // suprapunere: ultima scriere câștigă
      last.end = x.start;
      out.push({ ...x });
    } else {
      out.push({ ...x });
    }
  }
  return out.filter((x) => x.end > x.start);
}

/* ------------------------------------------------------------------ */
/* Detectare                                                           */
/* ------------------------------------------------------------------ */

export function parseDdd(input: Uint8Array | ArrayBuffer, fileName = ""): ParsedDdd {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length < 8) throw new Error("Fișierul e prea mic pentru a fi un fișier tahograf.");
  if (b[0] === 0x76) return parseVu(b);
  // fișierele de card încep cu un FID (de regulă 0x0002 = ICC)
  if (b[0] === 0x00 || b[0] === 0x05 || b[0] === 0xc1) return parseCard(b);
  const n = fileName.toUpperCase();
  if (n.startsWith("C_")) return parseCard(b);
  return parseVu(b);
}

/* ------------------------------------------------------------------ */
/* VU (camion)                                                         */
/* ------------------------------------------------------------------ */

type IwRecord = {
  surname: string;
  firstNames: string;
  card: string;
  slot: number;
  insertion: Date | null;
  withdrawal: Date | null;
};

type VuState = {
  out: ParsedDdd;
  /** card → zi → segmente */
  acc: Map<string, Map<string, Segment[]>>;
};

function addSegments(st: VuState, card: string, day: string, segs: Segment[]) {
  let m = st.acc.get(card);
  if (!m) st.acc.set(card, (m = new Map()));
  m.set(day, [...(m.get(day) ?? []), ...segs]);
}

function holderSeen(out: ParsedDdd, number: string, surname: string, firstNames: string) {
  if (!number) return;
  if (!out.holders.some((h) => h.number === number)) out.holders.push({ number, surname, firstNames });
}

/**
 * Împarte activitățile zilei pe titularii de card: o perioadă cu card introdus în
 * slotul X aparține cardului care era în slotul X în acel moment (după IW).
 */
function assignVuDay(
  st: VuState,
  dayStart: Date,
  changes: ReturnType<typeof decodeChange>[],
  iws: IwRecord[]
) {
  const day = isoDay(dayStart);
  const t0 = dayStart.getTime();
  for (const slot of [0, 1]) {
    const list = changes.filter((c) => c.slot === slot).sort((a, b) => a.minute - b.minute);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.notInserted) continue;
      const start = c.minute;
      const end = i + 1 < list.length ? list[i + 1].minute : 1440;
      if (end <= start) continue;
      // poate fi mai mult de un card în aceeași perioadă: tăiem după intervalele IW
      for (const iw of iws) {
        if (iw.slot !== slot || !iw.card) continue;
        const a = iw.insertion ? Math.floor((iw.insertion.getTime() - t0) / 60000) : -1;
        const z = iw.withdrawal ? Math.ceil((iw.withdrawal.getTime() - t0) / 60000) : 100000;
        const s = Math.max(start, a);
        const e = Math.min(end, z);
        if (e > s) addSegments(st, iw.card, day, [{ start: s, end: e, act: c.act }]);
      }
    }
  }
}

function parseVu(b: Uint8Array): ParsedDdd {
  const out: ParsedDdd = { kind: "vu", generation: "", holders: [], days: [], countries: [], warnings: [] };
  const st: VuState = { out, acc: new Map() };
  const r = new Reader(b);
  const iwAll: IwRecord[] = [];

  try {
    while (r.left >= 2) {
      const t1 = r.u8();
      const t2 = r.u8();
      if (t1 !== 0x76) {
        out.warnings.push(`Etichetă necunoscută la poziția ${r.pos - 2}; citirea s-a oprit.`);
        break;
      }
      if (t2 === 0x00) {
        r.skip(2); // versiunea interfeței de descărcare
        continue;
      }
      if (t2 >= 0x01 && t2 <= 0x05) {
        out.generation ||= "1";
        if (t2 === 0x01) parseVuOverviewG1(r, out);
        else if (t2 === 0x02) parseVuActivitiesG1(r, st, iwAll);
        else break; // evenimente/viteză/date tehnice — nu ne trebuie, și urmează după activități
        continue;
      }
      if (t2 >= 0x21 && t2 <= 0x25) out.generation ||= "2";
      else if (t2 >= 0x31 && t2 <= 0x35) out.generation ||= "2v2";
      else {
        out.warnings.push(`Bloc necunoscut 0x76${t2.toString(16)}; citirea s-a oprit.`);
        break;
      }
      const sub = t2 & 0x0f;
      parseVuBlockG2(r, st, sub, iwAll);
    }
  } catch (e) {
    out.warnings.push(`Fișier incomplet: ${(e as Error).message}. S-a păstrat ce s-a putut citi.`);
  }

  for (const [card, days] of st.acc) {
    for (const [day, segs] of days) {
      out.days.push({ cardNumber: card, day, segments: normalizeSegments(segs), vehicles: out.plate ? [out.plate] : [] });
    }
  }
  out.days.sort((a, b) => (a.day < b.day ? -1 : 1));
  return out;
}

/* ---------- VU generația 1 ---------- */

function readVri(b: Uint8Array) {
  // VehicleRegistrationIdentification: nation (1) + codePage (1) + număr (13)
  return cpText(b.subarray(1, 15));
}

function parseVuOverviewG1(r: Reader, out: ParsedDdd) {
  r.skip(194); // certificat stat membru
  r.skip(194); // certificat VU
  out.vin = ascii(r.bytes(17));
  out.plate = cleanPlate(readVri(r.bytes(15)));
  r.skip(4); // ora curentă
  r.skip(8); // perioada descărcabilă
  r.skip(1); // stare sloturi
  r.skip(4 + 18 + 36); // ultima descărcare
  const locks = r.u8();
  r.skip(locks * 98);
  const controls = r.u8();
  r.skip(controls * 31);
  r.skip(128); // semnătura
}

function parseVuActivitiesG1(r: Reader, st: VuState, iwAll: IwRecord[]) {
  const date = timeReal(r.u32());
  r.skip(3); // km la miezul nopții
  const nIw = r.u16();
  const iws: IwRecord[] = [];
  for (let i = 0; i < nIw; i++) {
    const rec = r.bytes(129);
    const iw: IwRecord = {
      surname: cpText(rec.subarray(0, 36)),
      firstNames: cpText(rec.subarray(36, 72)),
      card: cleanCard(ascii(rec.subarray(74, 90))),
      insertion: timeReal(u32at(rec, 94)),
      slot: rec[101],
      withdrawal: timeReal(u32at(rec, 102)),
    };
    iws.push(iw);
    iwAll.push(iw);
    holderSeen(st.out, iw.card, iw.surname, iw.firstNames);
  }
  const nAct = r.u16();
  const changes = [];
  for (let i = 0; i < nAct; i++) changes.push(decodeChange(r.u16()));
  const nPlace = r.u8();
  for (let i = 0; i < nPlace; i++) {
    const rec = r.bytes(28);
    const card = cleanCard(ascii(rec.subarray(2, 18)));
    const at = timeReal(u32at(rec, 18));
    const type = rec[22];
    const country = nationToIso(rec[23]);
    if (card && at && country) {
      st.out.countries.push({ cardNumber: card, at: at.toISOString(), country, kind: type === 0 || type === 2 ? "start" : "end" });
    }
  }
  const nSpec = r.u16();
  r.skip(nSpec * 5);
  r.skip(128);
  if (date) assignVuDay(st, startOfUtcDay(date), changes, iws.length ? iws : iwAll);
}

/* ---------- VU generația 2 / 2 v2 ---------- */

function parseVuBlockG2(r: Reader, st: VuState, sub: number, iwAll: IwRecord[]) {
  let date: Date | null = null;
  const iws: IwRecord[] = [];
  const changes: ReturnType<typeof decodeChange>[] = [];
  // fiecare bloc = șir de "record arrays", ultimul fiind semnătura (tip 0x08)
  for (let guard = 0; guard < 64; guard++) {
    const type = r.u8();
    const size = r.u16();
    const count = r.u16();
    const data = r.bytes(size * count);
    if (sub === 0x01) {
      if (type === 0x24 && count > 0) st.out.plate = cleanPlate(readVri(data.subarray(0, 15)));
      else if (type === 0x0b && count > 0 && !st.out.plate) st.out.plate = cleanPlate(size >= 15 ? readVri(data.subarray(0, 15)) : cpText(data.subarray(0, size)));
      else if (type === 0x0a && count > 0) st.out.vin = ascii(data.subarray(0, 17));
    } else if (sub === 0x02) {
      for (let i = 0; i < count; i++) {
        const rec = data.subarray(i * size, (i + 1) * size);
        if (type === 0x06) date = timeReal(u32at(rec, 0));
        else if (type === 0x01) changes.push(decodeChange(u16at(rec, 0)));
        else if (type === 0x0d && size >= 104) {
          const iw: IwRecord = {
            surname: cpText(rec.subarray(0, 36)),
            firstNames: cpText(rec.subarray(36, 72)),
            card: cleanCard(ascii(rec.subarray(74, 90))),
            insertion: timeReal(u32at(rec, 95)),
            slot: rec[102],
            withdrawal: timeReal(u32at(rec, 103)),
          };
          iws.push(iw);
          iwAll.push(iw);
          holderSeen(st.out, iw.card, iw.surname, iw.firstNames);
        } else if (type === 0x1c && size >= 25) {
          const card = cleanCard(ascii(rec.subarray(2, 18)));
          const at = timeReal(u32at(rec, 19));
          const et = rec[23];
          const country = nationToIso(rec[24]);
          if (card && at && country) {
            st.out.countries.push({ cardNumber: card, at: at.toISOString(), country, kind: et === 0 || et === 2 ? "start" : "end" });
          }
        } else if (type === 0x22 && size >= 53) {
          const card = cleanCard(ascii(rec.subarray(2, 18)));
          const left = nationToIso(rec[38]);
          const entered = nationToIso(rec[39]);
          const at = timeReal(u32at(rec, 40));
          if (card && at && entered) {
            st.out.countries.push({ cardNumber: card, at: at.toISOString(), country: entered, from: left, kind: "border" });
          }
        }
      }
    }
    if (type === 0x08) break;
  }
  if (sub === 0x02 && date) assignVuDay(st, startOfUtcDay(date), changes, iws.length ? iws : iwAll);
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function cleanPlate(s: string) {
  return s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Card de șofer                                                       */
/* ------------------------------------------------------------------ */

function parseCard(b: Uint8Array): ParsedDdd {
  const out: ParsedDdd = { kind: "card", generation: "1", holders: [], days: [], countries: [], warnings: [] };
  const r = new Reader(b);
  const files = new Map<string, Uint8Array>(); // "0504:0" / "0504:2"
  try {
    while (r.left >= 5) {
      const fid = r.u16();
      const type = r.u8();
      const len = r.u16();
      const data = r.bytes(len);
      if (type === 0 || type === 2) files.set(`${fid.toString(16).padStart(4, "0")}:${type}`, data);
    }
  } catch (e) {
    out.warnings.push(`Fișier de card incomplet: ${(e as Error).message}.`);
  }
  const pick = (fid: string) => files.get(`${fid}:2`) ?? files.get(`${fid}:0`);
  const gen2 = (fid: string) => files.has(`${fid}:2`);
  if (files.has("0504:2")) out.generation = "2";
  if (files.has("0528:2")) out.generation = "2v2";

  // Identificare
  const id = pick("0520");
  if (!id || id.length < 65 + 72) throw new Error("Nu am găsit datele de identificare ale cardului (EF 0520).");
  const number = cleanCard(ascii(id.subarray(1, 17)));
  const expiry = timeReal(u32at(id, 61));
  const surname = cpText(id.subarray(65, 101));
  const firstNames = cpText(id.subarray(101, 137));
  out.card = { number, surname, firstNames, expiry: expiry?.toISOString() };
  out.holders.push({ number, surname, firstNames });

  // Vehicule folosite (pentru a ști ce camion a condus în fiecare zi)
  const vehiclesUsed = parseVehiclesUsed(pick("0505"), gen2("0505"));

  // Activități
  const act = pick("0504");
  if (act) {
    for (const rec of parseCardActivity(act)) {
      const dayStart = Date.UTC(rec.date.getUTCFullYear(), rec.date.getUTCMonth(), rec.date.getUTCDate());
      const segs: Segment[] = [];
      for (let i = 0; i < rec.changes.length; i++) {
        const c = rec.changes[i];
        const end = i + 1 < rec.changes.length ? rec.changes[i + 1].minute : 1440;
        if (end <= c.minute) continue;
        // card lipsă + odihnă = necunoscut → îl tratăm ca odihnă; card lipsă + altă activitate = introdusă manual
        segs.push({ start: c.minute, end, act: c.act, manual: c.notInserted === 1 && c.act !== 0 ? true : undefined });
      }
      const day = new Date(dayStart).toISOString().slice(0, 10);
      const plates = vehiclesUsed
        .filter((v) => v.first.getTime() < dayStart + 86400000 && (v.last?.getTime() ?? Infinity) > dayStart)
        .map((v) => v.plate)
        .filter(Boolean);
      out.days.push({ cardNumber: number, day, segments: normalizeSegments(segs), vehicles: [...new Set(plates)] });
    }
  }

  // Locuri de început / sfârșit de zi
  for (const fid of ["0506", "0526"]) {
    const pl = pick(fid);
    if (!pl) continue;
    const g2 = gen2(fid);
    const ptrLen = g2 ? 2 : 1;
    const recLen = fid === "0526" ? 22 : g2 ? 21 : 10;
    for (let p = ptrLen; p + recLen <= pl.length; p += recLen) {
      const at = timeReal(u32at(pl, p));
      const et = pl[p + 4];
      const country = nationToIso(pl[p + 5]);
      if (at && country) out.countries.push({ cardNumber: number, at: at.toISOString(), country, kind: et === 0 || et === 2 ? "start" : "end" });
    }
  }

  // Treceri de frontieră (card v2)
  const bc = pick("0528");
  if (bc) {
    for (let p = 2; p + 17 <= bc.length; p += 17) {
      const left = nationToIso(bc[p]);
      const entered = nationToIso(bc[p + 1]);
      const at = timeReal(u32at(bc, p + 2));
      if (at && entered) out.countries.push({ cardNumber: number, at: at.toISOString(), country: entered, from: left, kind: "border" });
    }
  }

  out.days.sort((a, b) => (a.day < b.day ? -1 : 1));
  return out;
}

function parseVehiclesUsed(data: Uint8Array | undefined, g2: boolean) {
  const res: { plate: string; first: Date; last: Date | null }[] = [];
  if (!data) return res;
  // CardVehicleRecord gen1 = 31 octeți, gen2 = 48 (+ VIN)
  const recLen = g2 ? 48 : 31;
  for (let p = 2; p + recLen <= data.length; p += recLen) {
    const first = timeReal(u32at(data, p + 6));
    const last = timeReal(u32at(data, p + 10));
    const plate = cleanPlate(readVri(data.subarray(p + 14, p + 29)));
    if (first && plate) res.push({ plate, first, last });
  }
  return res;
}

function parseCardActivity(data: Uint8Array) {
  const recs: { date: Date; changes: ReturnType<typeof decodeChange>[] }[] = [];
  if (data.length < 8) return recs;
  const oldest = u16at(data, 0);
  const newest = u16at(data, 2);
  const buf = data.subarray(4);
  const L = buf.length;
  const at = (p: number) => buf[((p % L) + L) % L];
  const u16c = (p: number) => (at(p) << 8) | at(p + 1);
  const u32c = (p: number) => at(p) * 0x1000000 + ((at(p + 1) << 16) | (at(p + 2) << 8) | at(p + 3));

  let pos = oldest;
  for (let guard = 0; guard < 2000; guard++) {
    const recLen = u16c(pos + 2);
    if (recLen < 12 || recLen > L) break;
    const date = timeReal(u32c(pos + 4));
    const changes = [];
    for (let q = pos + 12; q < pos + recLen; q += 2) changes.push(decodeChange(u16c(q)));
    if (date) recs.push({ date, changes: changes.sort((a, b) => a.minute - b.minute) });
    if (((pos % L) + L) % L === newest) break;
    pos = (pos + recLen) % L;
  }
  return recs;
}
