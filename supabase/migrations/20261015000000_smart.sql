-- Igoudar – Migration 2: Gmail-Import, intelligente Links, erweiterte Suche
-- Im Supabase SQL Editor ausführen, NACH 20261008000000_init.sql.

-- ---------------------------------------------------------------------------
-- Links: KI-Zusammenfassung, Seitentext, Vorschaubild
alter table public.links drop column search_vector; -- Index links_search_idx fällt mit weg
alter table public.links
  add column summary   text,
  add column page_text text,
  add column image_url text,
  add column site_name text;

alter table public.links add column search_vector tsvector generated always as (
  setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('german',
    coalesce(note, '') || ' ' || public.immutable_join(tags) || ' ' ||
    coalesce(ai_category, '') || ' ' || coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(domain, '') || ' ' || coalesce(site_name, '')), 'B') ||
  setweight(to_tsvector('german', coalesce(left(page_text, 20000), '')), 'C')
) stored;
create index links_search_idx on public.links using gin (search_vector);
create index links_user_category_idx on public.links (user_id, ai_category, created_at desc);

-- ---------------------------------------------------------------------------
-- Postfächer: Fehlertext für die Anzeige
alter table public.email_accounts add column last_error text;

-- Tokens: verschlüsselt (AES-256-GCM, Schlüssel nur auf dem Server) als Text.
-- Nutzer dürfen nur die Zeile ihres eigenen Postfachs sehen – ohne Schlüssel ist sie wertlos.
alter table public.email_account_secrets
  alter column access_token_enc  type text using null,
  alter column refresh_token_enc type text using null;

create policy "own secrets" on public.email_account_secrets
  for all to authenticated
  using (exists (select 1 from public.email_accounts a
                 where a.id = email_account_id and a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.email_accounts a
                      where a.id = email_account_id and a.user_id = (select auth.uid())));

-- Betreff der Mail wird mit durchsucht
alter table public.documents add column email_subject text;

-- ---------------------------------------------------------------------------
-- Suche: Links mit Zusammenfassung + Seitentext, Dokumente mit Mail-Betreff
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
                  then replace(to_char(d.amount_cents / 100.0, 'FM99999990.00'), '.', ',') || ' ' || coalesce(d.currency, 'EUR') end,
             case when d.source = 'email' then 'aus Gmail' end
           ) as subtitle,
           case when p.tsq is null then left(coalesce(d.summary, ''), 160)
                else ts_headline('german',
                       coalesce(d.summary, '') || ' ' || coalesce(d.email_subject, '') || ' ' || left(coalesce(d.extracted_text, ''), 20000),
                       p.tsq, 'StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=10, MaxFragments=1') end as snippet,
           coalesce(d.document_date, d.created_at::date) as date,
           '/documents/' || d.id as url,
           case when p.tsq is null then 0::real
                else greatest(ts_rank(d.search_vector, p.tsq),
                              ts_rank(to_tsvector('german', coalesce(d.email_subject, '')), p.tsq),
                              similarity(coalesce(d.vendor, ''), p.raw)) end as rank
    from documents d, params p
    where (kinds is null or 'document' = any(kinds))
      and (doc_types is null or d.doc_type = any(doc_types))
      and (date_from is null or coalesce(d.document_date, d.created_at::date) >= date_from)
      and (date_to   is null or coalesce(d.document_date, d.created_at::date) <= date_to)
      and (p.tsq is null
           or d.search_vector @@ p.tsq
           or to_tsvector('german', coalesce(d.email_subject, '')) @@ p.tsq
           or coalesce(d.vendor, '') % p.raw)
  ),
  lnks as (
    select 'link'::text, l.id,
           coalesce(l.title, l.url),
           concat_ws(' · ', l.domain, l.ai_category),
           case when p.tsq is null then left(coalesce(nullif(l.note, ''), l.summary, ''), 160)
                else ts_headline('german',
                       coalesce(l.note, '') || ' ' || coalesce(l.summary, '') || ' ' || left(coalesce(l.page_text, ''), 8000),
                       p.tsq, 'StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=10, MaxFragments=1') end,
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
           coalesce('/documents/' || c.source_document_id, '/documents'),
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
