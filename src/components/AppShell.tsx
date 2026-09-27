import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listExpiryAlerts } from "@/lib/alerts";
import { ShellFrame, type NavGroup } from "@/components/ShellFrame";

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operațiuni",
    items: [
      { key: "dashboard", href: "/dashboard", label: "Dashboard" },
      { key: "jobs", href: "/jobs", label: "Curse" },
      { key: "planning", href: "/planning", label: "Planificare" },
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
      { key: "brokerage", href: "/brokerage", label: "Brokeraj" },
    ],
  },
];

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
  const session = await auth.api.getSession({ headers: await headers() });
  const userName = session?.user.name || session?.user.email || "Utilizator";
  const isAdmin = session?.user.role === "admin";

  const groups: NavGroup[] = isAdmin
    ? [
        ...NAV_GROUPS,
        {
          title: "Administrare",
          items: [
            { key: "dispatchers", href: "/dispatchers", label: "Gestionează dispecerii" },
            { key: "settings", href: "/settings", label: "Setări" },
          ],
        },
      ]
    : NAV_GROUPS;

  let alertCount = 0;
  try {
    const settings = await getSettings();
    const alerts = await listExpiryAlerts(settings?.alert_days ?? 30);
    alertCount = alerts.length;
  } catch {
    alertCount = 0;
  }

  return (
    <ShellFrame
      navGroups={groups}
      activeKey={active}
      crumb={crumb}
      userInitials={initialsOf(userName)}
      userName={userName}
      alertCount={alertCount}
      wide={wide}
    >
      {children}
    </ShellFrame>
  );
}
