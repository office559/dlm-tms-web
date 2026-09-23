import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CustomerForm } from "@/components/CustomerForm";

export default async function NewCustomerPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-brand-dark">Adaugă client</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <CustomerForm />
      </div>
    </div>
  );
}
