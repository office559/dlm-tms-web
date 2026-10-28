import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgContext } from "@/lib/org";
import { getUserTimezone } from "@/lib/user-prefs";
import { currentMonth, getDispatchMonth, isMonth } from "@/lib/dispatch";
import { AppShell } from "@/components/AppShell";
import { DispeceratView } from "@/components/DispeceratView";

export const dynamic = "force-dynamic";

export default async function DispeceratPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  // rubrica Dispecerat: doar proprietarul platformei (contul de administrator)
  if (!ctx.isPlatformAdmin) redirect("/dashboard");

  const tz = await getUserTimezone(session.user.id);
  const { m } = await searchParams;
  const month = isMonth(m) ? m : currentMonth(tz);
  const data = await getDispatchMonth(month, tz);

  return (
    <AppShell active="dispecerat" crumb="Dispecerat" wide>
      <DispeceratView data={data} />
    </AppShell>
  );
}
