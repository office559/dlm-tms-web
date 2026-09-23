import { pool } from "@/lib/db";

export type Settings = {
  id: boolean;
  company: string | null;
  depot: string | null;
  currency: string | null;
  cpm: number | null;
  alert_days: number | null;
  wa_country: string | null;
  theme_color: string | null;
  bg_color: string | null;
  updated_at: Date;
};

export type SettingsInput = {
  company?: string | null;
  depot?: string | null;
  currency?: string | null;
  cpm?: number | null;
  alertDays?: number | null;
  waCountry?: string | null;
  themeColor?: string | null;
  bgColor?: string | null;
};

function nullify<T>(v: T | "" | undefined): T | null {
  return v === "" || v === undefined ? null : v;
}

export async function getSettings() {
  const { rows } = await pool.query<Settings>(`select * from settings where id = true limit 1`);
  return rows[0] ?? null;
}

export async function updateSettings(input: SettingsInput) {
  const { rows } = await pool.query<Settings>(
    `insert into settings (id, company, depot, currency, cpm, alert_days, wa_country, theme_color, bg_color, updated_at)
     values (true, $1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (id) do update set
       company = excluded.company,
       depot = excluded.depot,
       currency = excluded.currency,
       cpm = excluded.cpm,
       alert_days = excluded.alert_days,
       wa_country = excluded.wa_country,
       theme_color = excluded.theme_color,
       bg_color = excluded.bg_color,
       updated_at = now()
     returning *`,
    [
      nullify(input.company),
      nullify(input.depot),
      nullify(input.currency),
      input.cpm ?? null,
      input.alertDays ?? null,
      nullify(input.waCountry),
      nullify(input.themeColor),
      nullify(input.bgColor),
    ]
  );
  return rows[0];
}
