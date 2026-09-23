"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Job } from "@/lib/jobs";

function toLocalDate(d: string | Date | null) {
  if (!d) return "";
  return String(d).slice(0, 10);
}

export function JobPaymentRow({ job }: { job: Job }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(job.invoice);
  const [paidAt, setPaidAt] = useState(toLocalDate(job.paid_at));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    const payload = {
      kind: job.kind,
      clientId: job.client_id,
      ref: job.ref,
      loadPlace: job.load_place,
      unloadPlace: job.unload_place,
      startAt: job.start_at ? new Date(job.start_at).toISOString() : null,
      endAt: job.end_at ? new Date(job.end_at).toISOString() : null,
      miles: job.miles,
      currency: job.currency,
      rate: job.rate,
      extra: job.extra,
      driverId: job.driver_id,
      vehicleId: job.vehicle_id,
      trailerId: job.trailer_id,
      dispatcherId: job.dispatcher_id,
      status: job.status,
      notes: job.notes,
      invoice,
      paidAt: paidAt || null,
    };
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 font-medium">
        {job.load_place || "—"} → {job.unload_place || "—"}
      </td>
      <td className="px-4 py-2">{job.ref || "—"}</td>
      <td className="px-4 py-2">{job.rate != null ? `${job.rate} ${job.currency ?? ""}` : "—"}</td>
      <td className="px-4 py-2">
        <select
          value={invoice}
          onChange={(e) => setInvoice(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand"
        >
          <option value="none">Neemisă</option>
          <option value="emisă">Emisă</option>
          <option value="plătită">Plătită</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-brand text-white text-xs font-medium px-3 py-1.5 hover:bg-brand-dark transition disabled:opacity-60"
        >
          {saving ? "..." : "Salvează"}
        </button>
      </td>
    </tr>
  );
}
