-- Model keuangan rencana: persentase 50/30/20 bisa dipilih (standar, cepat menabung, keluarga, hemat, kustom).
-- Persentase disimpan per rencana, jadi perubahan daftar model di aplikasi tidak mengubah rencana lama.
-- Rencana yang sudah ada otomatis memakai 50/30/20. Migrasi sebelumnya tidak diubah.

alter table public.rencana_bulanan
  add column if not exists model_kode text not null default 'standar',
  add column if not exists persen_kebutuhan int not null default 50,
  add column if not exists persen_keinginan int not null default 30,
  add column if not exists persen_investasi int not null default 20;

alter table public.rencana_bulanan drop constraint if exists rencana_bulanan_model_check;
alter table public.rencana_bulanan add constraint rencana_bulanan_model_check check (
  model_kode in ('standar', 'cepat-nabung', 'keluarga', 'hemat', 'kustom')
);

alter table public.rencana_bulanan drop constraint if exists rencana_bulanan_persen_check;
alter table public.rencana_bulanan add constraint rencana_bulanan_persen_check check (
  persen_kebutuhan between 0 and 100
  and persen_keinginan between 0 and 100
  and persen_investasi between 0 and 100
  and persen_kebutuhan + persen_keinginan + persen_investasi = 100
);

-- Model dikunci setelah bulan ditutup, supaya arsip analisa akhir bulan tetap konsisten.
create or replace function public.tg_rencana_model_lock() returns trigger
language plpgsql as $$
begin
  if old.status = 'ditutup' and (
    new.model_kode is distinct from old.model_kode
    or new.persen_kebutuhan is distinct from old.persen_kebutuhan
    or new.persen_keinginan is distinct from old.persen_keinginan
    or new.persen_investasi is distinct from old.persen_investasi
  ) then
    raise exception 'Model keuangan tidak bisa diubah setelah bulan ditutup';
  end if;
  return new;
end $$;

drop trigger if exists trg_rencana_model_lock on public.rencana_bulanan;
create trigger trg_rencana_model_lock
  before update on public.rencana_bulanan
  for each row execute function public.tg_rencana_model_lock();
