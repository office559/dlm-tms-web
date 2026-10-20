import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getDriverMonth,
  listFirmDrivers,
  listTachoCompanies,
  parseMonth,
  ruleOf,
} from "@/lib/tacho/pontaj";
import {
  DOW_SHORT,
  MONTHS_RO,
  fmtDayRo,
  monthDays,
  totalsOf,
  weeksOf,
  type PontajDay,
} from "@/lib/tacho/pontaj-calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAVY = "FF1E3A5F";
const WEEK = "FFE8EEF7";
/** Minutele se scriu ca fracțiune de zi, ca Excel să le arate [h]:mm și să le poată aduna. */
const T = (m: number) => m / 1440;
const TIME_FMT = "[h]:mm";

function headerRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 30;
}

function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Sofer";
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

function fileSafe(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function addDriverSheet(
  wb: ExcelJS.Workbook,
  used: Set<string>,
  name: string,
  firm: string,
  period: string,
  days: PontajDay[],
  currency: string
) {
  const ws = wb.addWorksheet(sheetName(name, used));
  ws.columns = [
    { width: 13 }, { width: 5 }, { width: 8 }, { width: 8 }, { width: 9 }, { width: 9 }, { width: 9 },
    { width: 10 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 18 }, { width: 14 }, { width: 8 }, { width: 10 },
  ];
  ws.addRow([`Pontaj tahograf — ${name}`]).font = { bold: true, size: 14 };
  ws.addRow([`${firm} · ${period} · zi de lucru după ora de început (UTC), ore afișate în ora României · noapte 22:00–06:00`]);
  ws.addRow([]);
  headerRow(
    ws.addRow([
      "Data", "Zi", "Început", "Sfârșit", "Condus", "Alte activ.", "Disponib.", "Total muncă",
      "Pauze", "Odihnă", "Noapte", "Sărbători", "Țări", "Camion", "Zi", `Diurnă (${currency})`,
    ])
  );
  const timeCols = [5, 6, 7, 8, 9, 10, 11, 12];
  for (const week of weeksOf(days)) {
    for (const d of week) {
      const row = ws.addRow([
        fmtDayRo(d.day), DOW_SHORT[d.dow], d.start, d.end,
        T(d.drive), T(d.other), T(d.avail), T(d.work), T(d.breaks), T(d.rest), T(d.night), T(d.holidayWork),
        d.countries.join(", "), d.vehicles.join(", "),
        d.worked ? "lucru" : "liber", d.diurna || null,
      ]);
      timeCols.forEach((c) => (row.getCell(c).numFmt = TIME_FMT));
      if (d.isHoliday) row.getCell(1).note = d.holidayName;
      if (!d.worked) row.font = { color: { argb: "FF94A3B8" } };
    }
    const t = totalsOf(week);
    const row = ws.addRow([
      "Săptămâna", "", "", "", T(t.drive), T(t.other), T(t.avail), T(t.work), T(t.breaks), "", T(t.night), T(t.holidayWork), "", "", "", t.diurna,
    ]);
    row.font = { bold: true };
    row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEK } }));
    timeCols.forEach((c) => (row.getCell(c).numFmt = TIME_FMT));
  }
  const t = totalsOf(days);
  ws.addRow([]);
  const tot = ws.addRow([
    "TOTAL LUNĂ", "", "", "", T(t.drive), T(t.other), T(t.avail), T(t.work), T(t.breaks), "", T(t.night), T(t.holidayWork), "", "", `${t.daysWorked} zile`, t.diurna,
  ]);
  tot.font = { bold: true, size: 12 };
  timeCols.forEach((c) => (tot.getCell(c).numFmt = TIME_FMT));
  ws.addRow([`Zile cu diurnă: ${t.diurnaDays}`]).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 4 }];
  return t;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const companies = await listTachoCompanies();
  const firm = companies.find((c) => c.id === sp.get("firma") && c.tacho_enabled);
  if (!firm) return NextResponse.json({ error: "Alege o firmă activă pentru pontaj." }, { status: 400 });
  const { year, month } = parseMonth(sp.get("luna"));
  const rule = ruleOf(firm);
  const period = `${MONTHS_RO[month - 1]} ${year}`;
  const md = monthDays(year, month);

  let drivers = await listFirmDrivers(firm.id, md[0], md[md.length - 1]);
  const only = sp.get("sofer");
  if (only) drivers = drivers.filter((d) => d.card_number === only);
  if (!drivers.length) return NextResponse.json({ error: "Niciun șofer cu date în această lună." }, { status: 404 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DLM TMS";
  const used = new Set<string>();

  const summary = drivers.length > 1 ? wb.addWorksheet(sheetName("Sumar", used)) : null;
  const sumRows: (string | number)[][] = [];
  for (const d of drivers) {
    const days = await getDriverMonth(d.card_number, year, month, rule);
    const t = addDriverSheet(wb, used, d.name, firm.name, period, days, rule.currency);
    sumRows.push([d.name, d.plates.join(", "), t.daysWorked, T(t.drive), T(t.other), T(t.work), T(t.night), T(t.holidayWork), t.diurnaDays, t.diurna]);
  }
  if (summary) {
    summary.columns = [{ width: 28 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 11 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];
    summary.addRow([`Pontaj ${firm.name} — ${period}`]).font = { bold: true, size: 14 };
    summary.addRow([]);
    headerRow(summary.addRow(["Șofer", "Camioane", "Zile lucrate", "Condus", "Alte activ.", "Total muncă", "Noapte", "Sărbători", "Zile diurnă", `Diurnă (${rule.currency})`]));
    for (const r of sumRows) {
      const row = summary.addRow(r);
      [4, 5, 6, 7, 8].forEach((c) => (row.getCell(c).numFmt = TIME_FMT));
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const name = `Pontaj_${fileSafe(firm.name)}_${year}-${String(month).padStart(2, "0")}${only && drivers[0] ? "_" + fileSafe(drivers[0].name) : ""}.xlsx`;
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
