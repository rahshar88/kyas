-- §S13's missing half: somewhere for the photo to go.
--
-- S13 has processed photos correctly since Milestone 2 — square crop, compression, EXIF
-- stripped on the device, GPS included. And then the result stayed in the local draft forever,
-- because nothing ever uploaded it: no bucket existed, submission never sent it, and no screen
-- could display it. The avatar service even said so — "Nothing uploads — that belongs to
-- submission" — and submission disagreed. Found by a person looking at their own home screen
-- and asking why it showed an R instead of their face.
--
-- The bucket is **private**. §13.2's minimisation applies to photos more than anything else
-- here, and §S14's visibility controls are meaningless if the underlying object is public. The
-- app displays avatars through short-lived signed URLs instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

/**
 * One folder per person, named by their user id: `avatars/<user-id>/avatar.jpg`.
 *
 * The folder name is the whole authorisation story — every policy below reduces to "the first
 * path segment is you". Upsert needs all four verbs: the first upload inserts, replacing a
 * photo updates, S13's "Remove photo" deletes, and the signed-URL call reads.
 */
create policy "avatars: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: replace own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "avatars: remove own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
