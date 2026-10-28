import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOrgContext } from "@/lib/org";
import { getUserTimezone } from "@/lib/user-prefs";
import { currentYear, getDispatchYear, isYear } from "@/lib/dispatch";
import { AppShell } from "@/components/AppShell";
import { DispeceratView } from "@/components/DispeceratView";

export const dynamic = "force-dynamic";

export default async function DispeceratPage({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  // rubrica Dispecerat: doar proprietarul platformei (contul de administrator)
  if (!ctx.isPlatformAdmin) redirect("/dashboard");

  const tz = await getUserTimezone(session.user.id);
  const { y } = await searchParams;
  const year = isYear(y) ? Number(y) : currentYear(tz);
  const data = await getDispatchYear(year, tz);

  return (
    <AppShell active="dispecerat" crumb="Dispecerat" wide>
      <DispeceratView data={data} />
    </AppShell>
  );
}
