import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getBrokerage } from "@/lib/brokerage";
import { BrokerageForm } from "@/components/BrokerageForm";
import { AppShell } from "@/components/AppShell";

export default async function EditBrokeragePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const item = await getBrokerage(id);
  if (!item) notFound();

  return (
    <AppShell active="brokerage" crumb="Editează înregistrare brokeraj">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Editează înregistrare brokeraj</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <BrokerageForm
            initial={{
              id: item.id,
              client: item.client,
              ref: item.ref ?? "",
              route: item.route ?? "",
              collectDate: item.collect_date ? String(item.collect_date).slice(0, 10) : "",
              deliverDate: item.deliver_date ? String(item.deliver_date).slice(0, 10) : "",
              clientPrice: item.client_price != null ? String(item.client_price) : "",
              sub: item.sub ?? "",
              subPrice: item.sub_price != null ? String(item.sub_price) : "",
              status: item.status,
              paidClient: item.paid_client,
              paidSub: item.paid_sub,
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
