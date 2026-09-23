import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const settings = await getSettings();

  return (
    <div className="min-h-screen p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-dark">Setări</h1>
        <p className="text-slate-600 mt-1">Date generale despre companie și configurări operaționale.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <SettingsForm
          initial={{
            company: settings?.company ?? "",
            depot: settings?.depot ?? "",
            currency: settings?.currency ?? "€",
            cpm: settings?.cpm != null ? String(settings.cpm) : "",
            alertDays: settings?.alert_days != null ? String(settings.alert_days) : "",
            waCountry: settings?.wa_country ?? "",
            themeColor: settings?.theme_color ?? "#2f6fed",
            bgColor: settings?.bg_color ?? "#e8f0fb",
          }}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between">
        <div>
          <h2 className="font-medium text-brand-dark">Dispeceri &amp; utilizatori</h2>
          <p className="text-slate-500 text-sm mt-1">Invită și gestionează conturile de dispecer.</p>
        </div>
        <a href="/dispatchers" className="rounded-lg bg-brand text-white font-medium px-4 py-2 hover:bg-brand-dark transition">
          Gestionează dispecerii
        </a>
      </div>
    </div>
  );
}
