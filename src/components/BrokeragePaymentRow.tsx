"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Brokerage } from "@/lib/brokerage";

export function BrokeragePaymentRow({ item }: { item: Brokerage }) {
  const router = useRouter();
  const [paidClient, setPaidClient] = useState(item.paid_client);
  const [paidSub, setPaidSub] = useState(item.paid_sub);
  const [saving, setSaving] = useState(false);

  async function save(nextPaidClient: boolean, nextPaidSub: boolean) {
    setSaving(true);
    const payload = {
      client: item.client,
      ref: item.ref,
      route: item.route,
      collectDate: item.collect_date,
      deliverDate: item.deliver_date,
      clientPrice: item.client_price,
      sub: item.sub,
      subPrice: item.sub_price,
      status: item.status,
      paidClient: nextPaidClient,
      paidSub: nextPaidSub,
    };
    await fetch(`/api/brokerage/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 font-medium">{item.client}</td>
      <td className="px-4 py-2">{item.sub || "—"}</td>
      <td className="px-4 py-2">{item.client_price != null ? Number(item.client_price).toFixed(2) : "—"}</td>
      <td className="px-4 py-2">{item.sub_price != null ? Number(item.sub_price).toFixed(2) : "—"}</td>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={paidClient}
          disabled={saving}
          onChange={(e) => {
            setPaidClient(e.target.checked);
            save(e.target.checked, paidSub);
          }}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={paidSub}
          disabled={saving}
          onChange={(e) => {
            setPaidSub(e.target.checked);
            save(paidClient, e.target.checked);
          }}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
    </tr>
  );
}
