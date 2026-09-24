-- Rulează această migrație în Supabase (SQL Editor).
-- Adaugă urmărirea stării mesajelor WhatsApp automate trimise șoferilor
-- (trimis / citit / confirmat prin butonul "Confirmă") pe tabelul jobs.

alter table jobs
  add column if not exists wa_message_sid text,
  add column if not exists wa_sent_at timestamptz,
  add column if not exists wa_read_at timestamptz,
  add column if not exists wa_confirmed_at timestamptz;

create index if not exists jobs_wa_message_sid_idx on jobs (wa_message_sid);
