import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { auth } from "@/lib/auth";
import { getOrgContext, runWithOrg } from "@/lib/org";
import { getSettings } from "@/lib/settings";
import { listExpiryAlerts } from "@/lib/alerts";
import { getUserTimezone } from "@/lib/user-prefs";
import { DEFAULT_TIMEZONE } from "@/lib/tz";
import { ShellFrame, type NavGroup } from "@/components/ShellFrame";

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operațiuni",
    items: [
      { key: "dashboard", href: "/dashboard", label: "Dashboard" },
      { key: "jobs", href: "/jobs", label: "Curse" },
      { key: "planning", href: "/planning", label: "Planificare" },
      { key: "dispecerat", href: "/dispecerat", label: "Dispecerat" },
      { key: "restrictions", href: "/restrictions", label: "Restricții circulație" },
    ],
  },
  {
    title: "Resurse",
    items: [
      { key: "drivers", href: "/drivers", label: "Șoferi" },
      { key: "vehicles", href: "/vehicles", label: "Vehicule" },
      { key: "trailers", href: "/trailers", label: "Remorci" },
      { key: "customers", href: "/customers", label: "Clienți" },
    ],
  },
  {
    title: "Business",
    items: [
      { key: "reports", href: "/reports", label: "Rapoarte & Profituri" },
      { key: "tacho", href: "/tacho", label: "Pontaj tahograf" },
      { key: "brokerage", href: "/brokerage", label: "Brokeraj" },
    ],
  },
];

/**
 * Numărul de alerte (ITP / RCA / etc. care expiră) din meniu. Se reține 60 de
 * secunde, ca să nu interogăm baza de date de fiecare dată când schimbi pagina.
 */
const getAlertCount = unstable_cache(
  async (organizationId: string) => {
    try {
      // în interiorul cache-ului nu avem acces la cookie-uri: organizația vine ca argument
      return await runWithOrg(organizationId, async () => {
        const settings = await getSettings();
        const alerts = await listExpiryAlerts(settings?.alert_days ?? 30);
        return alerts.length;
      });
    } catch {
      return 0;
    }
  },
  ["nav-alert-count"],
  { revalidate: 60 }
);

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

export async function AppShell({
  active,
  crumb,
  wide,
  children,
}: {
  active: string;
  crumb: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [session, ctx] = await Promise.all([
    headers().then((h) => auth.api.getSession({ headers: h })),
    getOrgContext(),
  ]);
  const alertCount = ctx ? await getAlertCount(ctx.organizationId) : 0;

  // Fusul orar ales de utilizator (ex. Germania) — salvat în contul lui.
  let timezone = DEFAULT_TIMEZONE;
  if (session) {
    try {
      timezone = await getUserTimezone(session.user.id);
    } catch {
      timezone = DEFAULT_TIMEZONE;
    }
  }

  const userName = session?.user.name || session?.user.email || "Utilizator";
  const isAdmin = ctx?.isOrgAdmin ?? false;

  const groups: NavGroup[] = [...NAV_GROUPS];
  if (isAdmin) {
    groups.push({
      title: "Administrare",
      items: [
        { key: "dispatchers", href: "/dispatchers", label: "Gestionează dispecerii" },
        { key: "settings", href: "/settings", label: "Setări" },
      ],
    });
  }
  if (ctx?.isPlatformAdmin) {
    groups.push({
      title: "Platformă",
      items: [{ key: "platform", href: "/platform", label: "Firme clienți" }],
    });
  }

  return (
    <ShellFrame
      navGroups={groups}
      activeKey={active}
      crumb={crumb}
      userInitials={initialsOf(userName)}
      userName={userName}
      alertCount={alertCount}
      timezone={timezone}
      wide={wide}
      orgName={ctx?.organizationName}
      showOrgPill={ctx?.isPlatformAdmin ?? false}
    >
      {children}
    </ShellFrame>
  );
}
