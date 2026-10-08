-- Igoudar – Grundschema (MVP)
-- Läuft im Supabase SQL Editor oder über `supabase db push`.
-- Jede Tabelle gehört einem Nutzer (user_id = auth.uid()), Row Level Security ist überall an.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: array_to_string ist nicht IMMUTABLE und darf so nicht in
-- generierte Spalten. Für Tags (text[]) ist das Ergebnis aber deterministisch.
create or replace function public.immutable_join(arr text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select coalesce(array_to_string(arr, ' '), '') $$;

-- ---------------------------------------------------------------------------
-- 1. Users → profiles (Login selbst liegt in auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  locale      text not null default 'de-DE',
  timezone    text not null default 'Europe/Berlin',
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2a. Verbundene Postfächer (Woche 2)
create table public.email_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider          text not null check (provider in ('gmail', 'outlook')),
  address           text not null,
  sync_cursor       text,
  last_synced_at    timestamptz,
  status            text not null default 'active' check (status in ('active', 'reauth_required', 'paused')),
  created_at        timestamptz not null default now(),
  unique (user_id, provider, address)
);

-- OAuth-Tokens getrennt: RLS an, keine Policy → nur der Server mit Service-Key liest sie.
create table public.email_account_secrets (
  email_account_id  uuid primary key references public.email_accounts(id) on delete cascade,
  access_token_enc  bytea,
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  updated_at        timestamptz not null default now()
);
alter table public.email_account_secrets enable row level security;

-- 2b. E-Mails: nur Metadaten
create table public.emails (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email_account_id    uuid not null references public.email_accounts(id) on delete cascade,
  provider_message_id text not null,
  from_address        text not null,
  from_name           text,
  subject             text,
  received_at         timestamptz not null,
  has_pdf             boolean not null default false,
  classification      text check (classification in ('invoice', 'order_confirmation', 'delivery', 'contract', 'other')),
  processed_at        timestamptz,
  unique (email_account_id, provider_message_id)
);
create index emails_user_received_idx on public.emails (user_id, received_at desc);

-- 2c. Regeln: "Alle Rechnungen von Amazon automatisch speichern"
create table public.capture_rules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email_account_id uuid references public.email_accounts(id) on delete cascade,
  sender_pattern   text,
  subject_pattern  text,
  document_type    text,
  action           text not null default 'save' check (action in ('save', 'ignore')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Dokumente (PDF aus Mail oder Upload)
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email_id         uuid references public.emails(id) on delete set null,
  source           text not null default 'upload' check (source in ('email', 'upload')),
  storage_path     text not null,                -- Bucket "documents": {user_id}/{uuid}.pdf
  filename         text not null,
  file_size        integer not null,
  sha256           text not null,
  page_count       integer,
  doc_type         text check (doc_type in ('invoice', 'order_confirmation', 'delivery_note', 'contract', 'other')),
  vendor           text,
  document_date    date,
  amount_cents     integer,
  currency         char(3) default 'EUR',
  contract_number  text,
  notice_period    text,
  summary          text,
  extracted_text   text,
  ai_raw           jsonb,
  ai_confidence    real,
  status           text not null default 'pending' check (status in ('pending', 'extracting', 'analyzing', 'done', 'failed')),
  error            text,
  user_edited      boolean not null default false,
  created_at       timestamptz not null default now(),
  search_vector    tsvector generated always as (
    setweight(to_tsvector('german', coalesce(vendor, '') || ' ' || coalesce(contract_number, '') || ' ' || coalesce(filename, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(left(extracted_text, 200000), '')), 'C')
  ) stored,
  unique (user_id, sha256)
);
create index documents_search_idx on public.documents using gin (search_vector);
create index documents_vendor_trgm_idx on public.documents using gin (vendor extensions.gin_trgm_ops);
create index documents_user_type_date_idx on public.documents (user_id, doc_type, document_date desc);

-- ---------------------------------------------------------------------------
-- 4. Links (Browser-Extension, Woche 2)
create table public.links (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url                text not null,
  title              text,
  domain             text not null,
  favicon_url        text,
  screenshot_path    text,
  note               text,
  tags               text[] not null default '{}',
  ai_category        text,
  category_confirmed boolean not null default false,
  source_browser     text check (source_browser in ('chrome', 'firefox', 'web')),
  last_opened_at     timestamptz,
  created_at         timestamptz not null default now(),
  search_vector      tsvector generated always as (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(note, '') || ' ' || public.immutable_join(tags) || ' ' || coalesce(ai_category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(domain, '')), 'B')
  ) stored,
  unique (user_id, url)
);
create index links_search_idx on public.links using gin (search_vector);
create index links_tags_idx on public.links using gin (tags);
create index links_title_trgm_idx on public.links using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 5. Verträge
create table public.contracts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_document_id    uuid references public.documents(id) on delete set null,
  vendor                text not null,
  title                 text,
  contract_number       text,
  monthly_cost_cents    integer,
  start_date            date,
  min_term_months       integer,
  renewal_months        integer,
  notice_period_days    integer,
  end_date              date,
  cancellation_deadline date,
  status                text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  needs_review          boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  search_vector         tsvector generated always as (
    setweight(to_tsvector('german', coalesce(vendor, '') || ' ' || coalesce(title, '') || ' ' || coalesce(contract_number, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(notes, '') || ' vertrag'), 'B')
  ) stored
);
create index contracts_search_idx on public.contracts using gin (search_vector);
create index contracts_vendor_trgm_idx on public.contracts using gin (vendor extensions.gin_trgm_ops);
create index contracts_deadline_idx on public.contracts (user_id, cancellation_deadline);

create table public.contract_documents (
  contract_id uuid not null references public.contracts(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (contract_id, document_id)
);

-- ---------------------------------------------------------------------------
-- 6. Erinnerungen
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contract_id  uuid references public.contracts(id) on delete cascade,
  kind         text not null check (kind in ('cancellation_window', 'contract_end', 'custom')),
  remind_at    timestamptz not null,
  message      text not null,
  channel      text not null default 'email' check (channel in ('email', 'in_app')),
  status       text not null default 'scheduled' check (status in ('scheduled', 'sent', 'dismissed', 'snoozed')),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index reminders_due_idx on public.reminders (status, remind_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: jeder sieht und ändert nur seine eigenen Zeilen.
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['email_accounts', 'emails', 'capture_rules', 'documents', 'links',
                           'contracts', 'contract_documents', 'reminders']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Datei-Speicher: privater Bucket, Ordner = user_id
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Universelle Suche über Dokumente, Links und Verträge.
-- q          freier Suchtext (websearch-Syntax: "Vodafone -Mobil", Anführungszeichen)
-- kinds      'document' | 'link' | 'contract'  (null = alle)
-- doc_types  Filter auf documents.doc_type      (null = alle)
-- date_from / date_to  Zeitraum                  (null = offen)
-- Läuft mit den Rechten des Aufrufers → RLS gilt.
create or replace function public.search_all(
  q          text,
  kinds      text[] default null,
  doc_types  text[] default null,
  date_from  date default null,
  date_to    date default null,
  lim        int default 30
)
returns table (
  kind     text,
  id       uuid,
  title    text,
  subtitle text,
  snippet  text,
  date     date,
  url      text,
  rank     real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with params as (
    select
      nullif(trim(coalesce(q, '')), '') as raw,
      case when nullif(trim(coalesce(q, '')), '') is null then null
           else websearch_to_tsquery('german', q) end as tsq
  ),
  docs as (
    select 'document'::text as kind, d.id,
           coalesce(d.vendor, d.filename) as title,
           concat_ws(' · ',
             case d.doc_type
               when 'invoice' then 'Rechnung'
               when 'order_confirmation' then 'Auftragsbestätigung'
               when 'delivery_note' then 'Lieferschein'
               when 'contract' then 'Vertrag'
               else 'Dokument' end,
             case when d.amount_cents is not null
                  then replace(to_char(d.amount_cents / 100.0, 'FM99999990.00'), '.', ',') || ' ' || coalesce(d.currency, 'EUR') end
           ) as subtitle,
           case when p.tsq is null then left(coalesce(d.summary, ''), 160)
                else ts_headline('german', coalesce(d.summary, '') || ' ' || left(coalesce(d.extracted_text, ''), 20000), p.tsq,
                                 'StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=10, MaxFragments=1') end as snippet,
           coalesce(d.document_date, d.created_at::date) as date,
           '/documents/' || d.id as url,
           case when p.tsq is null then 0::real
                else greatest(ts_rank(d.search_vector, p.tsq), similarity(coalesce(d.vendor, ''), p.raw)) end as rank
    from documents d, params p
    where (kinds is null or 'document' = any(kinds))
      and (doc_types is null or d.doc_type = any(doc_types))
      and (date_from is null or coalesce(d.document_date, d.created_at::date) >= date_from)
      and (date_to   is null or coalesce(d.document_date, d.created_at::date) <= date_to)
      and (p.tsq is null or d.search_vector @@ p.tsq or coalesce(d.vendor, '') % p.raw)
  ),
  lnks as (
    select 'link'::text, l.id,
           coalesce(l.title, l.url),
           concat_ws(' · ', l.domain, l.ai_category),
           left(coalesce(l.note, ''), 160),
           l.created_at::date,
           l.url,
           case when p.tsq is null then 0::real
                else greatest(ts_rank(l.search_vector, p.tsq), similarity(coalesce(l.title, ''), p.raw)) end
    from links l, params p
    where (kinds is null or 'link' = any(kinds))
      and doc_types is null
      and (date_from is null or l.created_at::date >= date_from)
      and (date_to   is null or l.created_at::date <= date_to)
      and (p.tsq is null or l.search_vector @@ p.tsq or coalesce(l.title, '') % p.raw)
  ),
  ctrs as (
    select 'contract'::text, c.id,
           c.vendor || coalesce(' – ' || c.title, ''),
           concat_ws(' · ', 'Vertrag',
             case when c.cancellation_deadline is not null
                  then 'kündbar bis ' || to_char(c.cancellation_deadline, 'DD.MM.YYYY') end),
           left(coalesce(c.notes, ''), 160),
           coalesce(c.start_date, c.created_at::date),
           '/contracts/' || c.id,
           case when p.tsq is null then 0::real
                else greatest(ts_rank(c.search_vector, p.tsq), similarity(c.vendor, p.raw)) end
    from contracts c, params p
    where (kinds is null or 'contract' = any(kinds))
      and (doc_types is null or 'contract' = any(doc_types))
      and (date_from is null or coalesce(c.start_date, c.created_at::date) >= date_from)
      and (date_to   is null or coalesce(c.start_date, c.created_at::date) <= date_to)
      and (p.tsq is null or c.search_vector @@ p.tsq or c.vendor % p.raw)
  )
  select * from (
    select * from docs
    union all select * from lnks
    union all select * from ctrs
  ) r
  order by r.rank desc, r.date desc nulls last
  limit greatest(1, least(lim, 100));
$$;

grant execute on function public.search_all(text, text[], text[], date, date, int) to authenticated;
