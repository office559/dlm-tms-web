import ExcelJS from "exceljs";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buildReport, fmtDay, parseReportParams } from "@/lib/reports-firms";
import type { FirmReport, Report } from "@/lib/reports-firms";
import { formatDateInTz, formatTimeInTz } from "@/lib/tz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAVY = "FF1E3A5F";
const MONEY = "#,##0.00";

function headerRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle" };
  });
}

function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Firma";
  let n = base;
  let i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

function fileSafe(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function addSummary(wb: ExcelJS.Workbook, r: Report, used: Set<string>) {
  const ws = wb.addWorksheet(sheetName("Sumar", used));
  ws.columns = [{ width: 30 }, { width: 10 }, { width: 16 }, { width: 14 }];
  ws.addRow([`Raport ${r.companyLabel}`]).font = { bold: true, size: 14 };
  ws.addRow([`Perioada ${fmtDay(r.from)} – ${fmtDay(r.to)}`]);
  ws.addRow([]);
  headerRow(ws.addRow(["Firmă", "Curse", "Venit", "Moneda"]));
  for (const f of r.firms) {
    if (f.currencies.length === 0) ws.addRow([f.name, 0, 0, ""]);
    for (const b of f.currencies) {
      const row = ws.addRow([f.name, b.jobs, b.total, b.currency]);
      row.getCell(3).numFmt = MONEY;
    }
  }
  ws.addRow([]);
  headerRow(ws.addRow(["Total pe monedă", "Curse", "Venit", "Moneda"]));
  for (const t of r.totals) {
    const row = ws.addRow(["Total", t.jobs, t.total, t.currency]);
    row.font = { bold: true };
    row.getCell(3).numFmt = MONEY;
  }
  if (r.costsByCategory.length) {
    ws.addRow([]);
    headerRow(ws.addRow(["Cheltuieli pe categorie", "", "Sumă", ""]));
    for (const c of r.costsByCategory) {
      const row = ws.addRow([c.label, "", c.total, ""]);
      row.getCell(3).numFmt = MONEY;
    }
    const tot = ws.addRow(["Total cheltuieli", "", r.costsTotal, ""]);
    tot.font = { bold: true };
    tot.getCell(3).numFmt = MONEY;
  }
}

function addFirm(wb: ExcelJS.Workbook, r: Report, f: FirmReport, used: Set<string>) {
  const ws = wb.addWorksheet(sheetName(f.name, used));
  ws.columns = [
    { width: 16 },
    { width: 30 },
    { width: 10 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];
  ws.addRow([f.name]).font = { bold: true, size: 14 };
  ws.addRow([`Perioada ${fmtDay(r.from)} – ${fmtDay(r.to)}`]);
  ws.addRow([]);

  if (f.currencies.length === 0) ws.addRow(["Nicio cursă în perioadă."]);
  for (const b of f.currencies) {
    ws.addRow([`Venit pe vehicul și șofer (${b.currency})`]).font = { bold: true };
    headerRow(ws.addRow(["Vehicul", "Șofer", "Curse", "Venit", "Medie / cursă", "% din firmă"]));
    for (const row of b.rows) {
      const x = ws.addRow([
        row.plate,
        row.driver,
        row.jobs,
        row.total,
        row.jobs ? row.total / row.jobs : 0,
        b.total > 0 ? row.total / b.total : 0,
      ]);
      x.getCell(4).numFmt = MONEY;
      x.getCell(5).numFmt = MONEY;
      x.getCell(6).numFmt = "0%";
    }
    const t = ws.addRow([`Total ${f.name}`, "", b.jobs, b.total, b.jobs ? b.total / b.jobs : 0, 1]);
    t.font = { bold: true };
    t.getCell(4).numFmt = MONEY;
    t.getCell(5).numFmt = MONEY;
    t.getCell(6).numFmt = "0%";
    ws.addRow([]);
  }

  ws.addRow(["Lista curselor"]).font = { bold: true };
  headerRow(ws.addRow(["Data încărcării", "Traseu", "Referință", "Client", "Vehicul", "Șofer", "Status", "Moneda", "Tarif + extra"]));
  ws.getColumn(8).width = 10;
  ws.getColumn(9).width = 14;
  ws.getColumn(2).width = 40;
  for (const j of f.jobList) {
    const when = j.startAt ? `${formatDateInTz(j.startAt, "UTC")} ${formatTimeInTz(j.startAt, "UTC")}` : "";
    const x = ws.addRow([when, j.route, j.ref, j.client, j.plate, j.driver, j.status, j.currency, j.amount]);
    x.getCell(9).numFmt = MONEY;
    if (j.status === "anulat") x.font = { color: { argb: "FF94A3B8" }, italic: true };
  }
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Neautorizat", { status: 401 });

  const url = new URL(req.url);
  const { from, to, firma } = parseReportParams({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    firma: url.searchParams.get("firma") ?? undefined,
  });
  const report = await buildReport(from, to, firma);

  const wb = new ExcelJS.Workbook();
  wb.creator = "DLM TMS";
  const used = new Set<string>();
  if (report.firms.length !== 1) addSummary(wb, report, used);
  for (const f of report.firms) addFirm(wb, report, f, used);
  if (report.firms.length === 0) addSummary(wb, report, used);

  const buf = await wb.xlsx.writeBuffer();
  const name = `Raport_${fileSafe(report.companyLabel) || "firme"}_${from}_${to}.xlsx`;
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
