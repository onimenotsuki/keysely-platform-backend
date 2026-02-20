-- Trigger: on insert into storage bucket keysely_legal_documents, insert a row into
-- terms_definitions and set all other terms_and_conditions rows to is_active = false.
-- Requires pgcrypto for SHA-256.
-- Prerequisite: create bucket "keysely_legal_documents" in Dashboard or via API if it does not exist.

create extension if not exists pgcrypto;

create or replace function public.sync_terms_definition_on_legal_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  doc_url text;
  doc_hash text;
begin
  if new.bucket_id <> 'keysely_legal_docs' then
    return new;
  end if;

  -- Canonical document identifier (bucket + path) for hashing (digest expects bytea)
  doc_url := new.bucket_id || '/' || new.name;
  doc_hash := encode(digest(convert_to(doc_url, 'UTF8'), 'sha256'), 'hex');

  -- Deactivate all existing terms_and_conditions so only the new one is active
  update public.terms_definitions
  set is_active = false
  where type = 'terms' and is_active = true;

  -- Insert new terms definition: version = document name as stored, content_hash = SHA-256 of doc URL
  insert into public.terms_definitions (
    type,
    version,
    content_hash,
    is_active,
    effective_at
  )
  values (
    'terms',
    new.name,
    doc_hash,
    true,
    timezone('utc'::text, now())
  );

  return new;
end;
$$;

-- Trigger on storage.objects for the legal documents bucket
drop trigger if exists on_legal_document_upload_sync_terms on storage.objects;
create trigger on_legal_document_upload_sync_terms
  after insert on storage.objects
  for each row
  when (new.bucket_id = 'keysely_legal_docs')
  execute function public.sync_terms_definition_on_legal_upload();
