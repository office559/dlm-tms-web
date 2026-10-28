import { createHash } from "crypto";
import { pool } from "@/lib/db";
import { orgId } from "@/lib/org";
import { normalizeSegments, parseDdd } from "./ddd";
import type { Segment } from "./ddd";
import {
  computeDay,
  monthDays,
  totalsOf,
  type CountryPoint,
  type DaySource,
  type DiurnaRule,
  type PontajDay,
  type PontajTotals,
} from "./pontaj-calc";

/* ------------------------------------------------------------------ */
/* Firme                                                               */
/* ------------------------------------------------------------------ */

export type TachoCompany = {
  id: string;
  name: string;
  active: boolean;
  tacho_enabled: boolean;
  diurna_abroad: number;
  diurna_ro: number;
  diurna_currency: string;
};

export async function listTachoCompanies(): Promise<TachoCompany[]> {
  const { rows } = await pool.query(
    `select id, name, active, tacho_enabled,
            diurna_abroad::float8 as diurna_abroad,
            diurna_ro::float8 as diurna_ro,
            diurna_currency
       from companies
      where organization_id = $1
      order by name asc`,
    [await orgId()]
  );
  return rows as TachoCompany[];
}

export async function updateTachoCompany(
  id: string,
  f: { enabled?: boolean; abroad?: number; ro?: number; currency?: string }
) {
  const { rows } = await pool.query(
    `update companies
        set tacho_enabled   = coalesce($2, tacho_enabled),
            diurna_abroad   = coalesce($3, diurna_abroad),
            diurna_ro       = coalesce($4, diurna_ro),
            diurna_currency = coalesce($5, diurna_currency)
      where id = $1 and organization_id = $6
      returning id`,
    [id, f.enabled ?? null, f.abroad ?? null, f.ro ?? null, f.currency?.trim().toUpperCase() || null, await orgId()]
  );
  return rows.length > 0;
}

export function ruleOf(c: TachoCompany | undefined): DiurnaRule {
  return { abroad: c?.diurna_abroad ?? 0, ro: c?.diurna_ro ?? 0, currency: c?.diurna_currency || "EUR" };
}

/* ------------------------------------------------------------------ */
/* Încărcarea fișierelor DDD                                           */
/* ------------------------------------------------------------------ */

export type UploadResult = {
  status: "ok" | "duplicate";
  fileName: string;
  kind: "vu" | "card";
  plate?: string;
  holder?: string;
  drivers: string[];
  days: number;
  firstDay?: string;
  lastDay?: string;
  warnings: string[];
};

function covered(segs: Segment[]) {
  return segs.reduce((a, s) => a + (s.end - s.start), 0);
}

export async function saveDddFile(buf: Buffer, fileName: string, uploadedBy: string, source = "upload"): Promise<UploadResult> {
  const sha = createHash("sha256").update(buf).digest("hex");
  const org = await orgId();
  const existing = await pool.query(
    `select kind, plate, holder_name, days_count, first_day, last_day from tacho_files where sha256 = $1 and organization_id = $2`,
    [sha, org]
  );
  if (existing.rows.length) {
    const r = existing.rows[0];
    return {
      status: "duplicate",
      fileName,
      kind: r.kind,
      plate: r.plate ?? undefined,
      holder: r.holder_name ?? undefined,
      drivers: [],
      days: r.days_count,
      warnings: [],
    };
  }

  const parsed = parseDdd(new Uint8Array(buf), fileName);
  // aceeași zi de două ori în fișier (rar, la carduri) → le unim
  const merged = new Map<string, (typeof parsed.days)[number]>();
  for (const d of parsed.days) {
    const k = `${d.cardNumber}|${d.day}`;
    const prev = merged.get(k);
    merged.set(
      k,
      prev
        ? { ...d, segments: normalizeSegments([...prev.segments, ...d.segments]), vehicles: [...new Set([...prev.vehicles, ...d.vehicles])] }
        : d
    );
  }
  parsed.days = [...merged.values()];
  const days = parsed.days.map((d) => d.day).sort();
  const holderName = parsed.card ? `${parsed.card.surname} ${parsed.card.firstNames}`.trim() : null;

  const client = await pool.connect();
  try {
    await client.query("begin");
    const f = await client.query(
      `insert into tacho_files (sha256, file_name, kind, generation, plate, card_number, holder_name,
                                first_day, last_day, days_count, warnings, source, data, uploaded_by, organization_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning id`,
      [
        sha,
        fileName,
        parsed.kind,
        parsed.generation,
        parsed.plate ?? null,
        parsed.card?.number ?? null,
        holderName,
        days[0] ?? null,
        days[days.length - 1] ?? null,
        parsed.days.length,
        parsed.warnings.join("\n") || null,
        source,
        buf,
        uploadedBy,
        org,
      ]
    );
    const fileId = f.rows[0].id;

    for (const h of parsed.holders) {
      await client.query(
        `insert into tacho_cards (card_number, surname, first_names, organization_id)
         values ($1, $2, $3, $4)
         on conflict (organization_id, card_number) do update
           set surname = excluded.surname, first_names = excluded.first_names, updated_at = now()`,
        [h.number, h.surname, h.firstNames, org]
      );
    }

    if (parsed.days.length) {
      const src = parsed.kind === "card" ? "card" : `vu:${parsed.plate || "?"}`;
      // o zi descărcată mai târziu e mai completă → înlocuim doar dacă acoperă cel puțin la fel de mult
      await client.query(
        `insert into tacho_days (card_number, day, source, segments, vehicles, covered, file_id, organization_id)
         select u.*, $8::uuid from unnest($1::text[], $2::date[], $3::text[], $4::jsonb[], $5::jsonb[], $6::int[], $7::bigint[]) as u
         on conflict (organization_id, card_number, day, source) do update
           set segments = excluded.segments,
               vehicles = excluded.vehicles,
               covered  = excluded.covered,
               file_id  = excluded.file_id,
               updated_at = now()
         where excluded.covered >= tacho_days.covered`,
        [
          parsed.days.map((d) => d.cardNumber),
          parsed.days.map((d) => d.day),
          parsed.days.map(() => src),
          parsed.days.map((d) => JSON.stringify(d.segments)),
          parsed.days.map((d) => JSON.stringify(d.vehicles)),
          parsed.days.map((d) => covered(d.segments)),
          parsed.days.map(() => fileId),
          org,
        ]
      );
    }

    if (parsed.countries.length) {
      await client.query(
        `insert into tacho_countries (card_number, at, kind, country, from_country, organization_id)
         select u.*, $6::uuid from unnest($1::text[], $2::timestamptz[], $3::text[], $4::text[], $5::text[]) as u
         on conflict do nothing`,
        [
          parsed.countries.map((c) => c.cardNumber),
          parsed.countries.map((c) => c.at),
          parsed.countries.map((c) => c.kind),
          parsed.countries.map((c) => c.country),
          parsed.countries.map((c) => c.from ?? null),
          org,
        ]
      );
    }

    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  await linkCardsToDrivers();

  const driverCards = new Set(parsed.days.map((d) => d.cardNumber));
  return {
    status: "ok",
    fileName,
    kind: parsed.kind,
    plate: parsed.plate,
    holder: holderName ?? undefined,
    drivers: parsed.holders.filter((h) => driverCards.has(h.number)).map((h) => `${h.surname} ${h.firstNames}`.trim()),
    days: parsed.days.length,
    firstDay: days[0],
    lastDay: days[days.length - 1],
    warnings: parsed.warnings,
  };
}

/** Normalizare pentru comparat nume: fără diacritice, litere mici, cuvinte sortate. */
function nameKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Leagă cardurile de șoferii din TMS: întâi după numărul cardului (câmpul „Card"
 * de la șofer), apoi după nume (în orice ordine, fără diacritice).
 */
export async function linkCardsToDrivers() {
  const org = await orgId();
  const [cards, drivers] = await Promise.all([
    pool.query(
      `select card_number, surname, first_names from tacho_cards where driver_id is null and organization_id = $1`,
      [org]
    ),
    pool.query(`select id, name, card from drivers where organization_id = $1`, [org]),
  ]);
  if (!cards.rows.length) return;
  const byCard = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const d of drivers.rows) {
    if (d.card) byCard.set(String(d.card).replace(/\s+/g, "").toUpperCase(), d.id);
    byName.set(nameKey(d.name), d.id);
  }
  for (const c of cards.rows) {
    const n = String(c.card_number);
    let id = byCard.get(n);
    if (!id) for (const [k, v] of byCard) if (k.length >= 8 && (n.includes(k) || k.includes(n.slice(0, 14)))) id = v;
    if (!id) id = byName.get(nameKey(`${c.surname} ${c.first_names}`));
    if (id) {
      await pool.query(
        `update tacho_cards set driver_id = $2, updated_at = now() where card_number = $1 and organization_id = $3`,
        [n, id, org]
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Șoferii unei firme într-o lună                                      */
/* ------------------------------------------------------------------ */

export type FirmDriver = { card_number: string; name: string; driver_id: string | null; plates: string[] };

export async function listFirmDrivers(companyId: string, from: string, to: string): Promise<FirmDriver[]> {
  const { rows } = await pool.query(
    `with plates as (
       select upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) as p, driver_id, driver2_id
         from vehicles where company_id = $1 and organization_id = $4
     ),
     by_vehicle as (
       select td.card_number, v.p
         from tacho_days td
         cross join lateral jsonb_array_elements_text(td.vehicles) as v(p)
        where td.organization_id = $4
          and td.day between $2::date and $3::date
          and v.p in (select p from plates)
          and td.covered > 0
     ),
     cards as (
       select card_number from by_vehicle
       union
       select tc.card_number from tacho_cards tc
         join plates pl on tc.driver_id is not null and tc.driver_id in (pl.driver_id, pl.driver2_id)
        where tc.organization_id = $4
     )
     select c.card_number,
            coalesce(d.name, trim(coalesce(tc.surname, '') || ' ' || coalesce(tc.first_names, '')), c.card_number) as name,
            tc.driver_id,
            coalesce((select array_agg(distinct bv.p) from by_vehicle bv where bv.card_number = c.card_number), '{}') as plates
       from cards c
       left join tacho_cards tc on tc.card_number = c.card_number and tc.organization_id = $4
       left join drivers d on d.id = tc.driver_id
      order by 2 asc`,
    [companyId, from, to, await orgId()]
  );
  return rows.map((r) => ({ ...r, plates: r.plates ?? [] })) as FirmDriver[];
}

/* ------------------------------------------------------------------ */
/* Pontajul unui șofer                                                 */
/* ------------------------------------------------------------------ */

export async function getDriverMonth(cardNumber: string, year: number, month: number, rule: DiurnaRule): Promise<PontajDay[]> {
  const days = monthDays(year, month);
  const from = days[0];
  const to = days[days.length - 1];
  const org = await orgId();
  const [act, ctry] = await Promise.all([
    pool.query(
      `select to_char(day, 'YYYY-MM-DD') as day, source, segments, vehicles
         from tacho_days
        where organization_id = $4 and card_number = $1 and day between $2::date and $3::date`,
      [cardNumber, from, to, org]
    ),
    pool.query(
      `select extract(epoch from at) * 1000 as at, country
         from tacho_countries
        where organization_id = $4
          and card_number = $1
          and at < ($3::date + 1)
          and at >= ($2::date - 120)
        order by at asc`,
      [cardNumber, from, to, org]
    ),
  ]);
  const byDay = new Map<string, DaySource[]>();
  for (const r of act.rows) {
    const l = byDay.get(r.day) ?? [];
    l.push({ source: r.source, segments: r.segments as Segment[], vehicles: (r.vehicles as string[]) ?? [] });
    byDay.set(r.day, l);
  }
  const points: CountryPoint[] = ctry.rows.map((r) => ({ at: Number(r.at), country: r.country }));
  return days.map((d) => computeDay(d, byDay.get(d) ?? [], points, rule));
}

export type DriverSummary = FirmDriver & { totals: PontajTotals };

export async function getFirmMonthSummary(
  companyId: string,
  year: number,
  month: number,
  rule: DiurnaRule
): Promise<DriverSummary[]> {
  const days = monthDays(year, month);
  const drivers = await listFirmDrivers(companyId, days[0], days[days.length - 1]);
  const res: DriverSummary[] = [];
  for (const d of drivers) {
    const m = await getDriverMonth(d.card_number, year, month, rule);
    res.push({ ...d, totals: totalsOf(m) });
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Fișiere încărcate                                                   */
/* ------------------------------------------------------------------ */

export type TachoFileRow = {
  id: string;
  file_name: string;
  kind: string;
  generation: string | null;
  plate: string | null;
  holder_name: string | null;
  first_day: string | null;
  last_day: string | null;
  days_count: number;
  warnings: string | null;
  uploaded_at: Date;
};

export async function listRecentFiles(limit = 15): Promise<TachoFileRow[]> {
  const { rows } = await pool.query(
    `select id, file_name, kind, generation, plate, holder_name,
            to_char(first_day, 'YYYY-MM-DD') as first_day,
            to_char(last_day, 'YYYY-MM-DD') as last_day,
            days_count, warnings, uploaded_at
       from tacho_files
      where organization_id = $2
      order by uploaded_at desc
      limit $1`,
    [limit, await orgId()]
  );
  return rows as TachoFileRow[];
}

export function parseMonth(v: string | undefined | null): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (m) return { year: Number(m[1]), month: Math.min(12, Math.max(1, Number(m[2]))) };
  // implicit: luna trecută (pontajul se face de obicei după ce se termină luna)
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
