import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { CustomerForm } from "@/components/CustomerForm";
import { AppShell } from "@/components/AppShell";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <AppShell active="customers" crumb="Editează client">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Editează client</h1>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <CustomerForm
            initial={{
              id: customer.id,
              name: customer.name,
              type: customer.type ?? "",
              code: customer.code ?? "",
              termDays: customer.term_days != null ? String(customer.term_days) : "",
              commission: customer.commission != null ? String(customer.commission) : "",
              terms: customer.terms ?? "",
              email: customer.email ?? "",
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
