-- Fase 5: Aprendizaje anónimo con consentimiento explícito (solo vectores, nunca fotos)

create table if not exists public.vision_feedback_vectors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model_id text not null,
  attribute text not null check (
    attribute in (
      'category',
      'neckline',
      'sleeve',
      'fit',
      'length',
      'skirtCut',
      'pantsCut',
      'waistTie',
      'ruffle',
      'fabric',
      'print'
    )
  ),
  crop_key text not null check (crop_key in ('full', 'neckline', 'sleeves', 'waistLower')),
  predicted_label text not null,
  corrected_label text not null,
  predicted_confidence real check (predicted_confidence is null or (predicted_confidence >= 0 and predicted_confidence <= 1)),
  dim integer not null check (dim > 0 and dim <= 2048),
  vector_int8_b64 text not null check (char_length(vector_int8_b64) between 64 and 4096),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  moderated_at timestamptz,
  moderation_note text
);

create index if not exists idx_vision_feedback_pending
  on public.vision_feedback_vectors (created_at desc)
  where status = 'pendiente';

create index if not exists idx_vision_feedback_approved
  on public.vision_feedback_vectors (model_id, attribute)
  where status = 'aprobado';

alter table public.vision_feedback_vectors enable row level security;
alter table public.vision_feedback_vectors force row level security;

drop policy if exists "vision_feedback_anon_insert_pending" on public.vision_feedback_vectors;
create policy "vision_feedback_anon_insert_pending"
  on public.vision_feedback_vectors
  for insert
  to anon, authenticated
  with check (
    status = 'pendiente'
    and moderated_at is null
  );
