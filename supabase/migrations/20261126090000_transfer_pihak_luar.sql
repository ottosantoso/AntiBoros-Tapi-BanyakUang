-- Transfer ke/dari pihak luar (mis. istri, ShopeePay istri) dicatat sebagai transaksi biasa.
-- Pemasukan dari pihak luar = Pemasukan riil; keluar ke pihak luar = Pengeluaran riil.
-- Kolom pihak_luar hanya untuk tampilan ("Ke: ..." / "Dari: ...").

alter table public.transactions
  add column if not exists pihak_luar text
  check (pihak_luar is null or char_length(btrim(pihak_luar)) between 1 and 80);

-- Pemasukan/pengeluaran riil untuk Analisa: semua transaksi, kecuali
--   1. "Penyesuaian Saldo" (koreksi saldo, bukan uang masuk/keluar sungguhan)
--   2. sisi transfer antar dompet (transfer_id terisi, bukan biaya admin)
-- Kategori "Transfer" yang dicatat manual (mis. dari istri) ikut dihitung.
-- Pokok transfer antar dompet ada di wallet_transfers dan tidak ikut dihitung.

create or replace function public.report_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with tx as (
    select t.id, t.tanggal, t.deskripsi, t.tipe, t.nominal,
           coalesce(nullif(btrim(s.kategori), ''), nullif(btrim(t.kategori), ''), 'Tanpa kategori') as kat
    from public.transactions t
    left join public.subkategori s on s.id = t.subkategori_id
    where t.user_id = auth.uid()
      and coalesce(s.kategori, t.kategori, '') is distinct from 'Penyesuaian Saldo'
      and not (t.transfer_id is not null and coalesce(s.kategori, t.kategori, '') is distinct from 'Biaya Admin')
  ),
  per as (
    select * from tx where tanggal between p_from and p_to
  ),
  tot as (
    select
      coalesce(sum(nominal) filter (where tipe = 'Pemasukan'), 0)   as masuk,
      coalesce(sum(nominal) filter (where tipe = 'Pengeluaran'), 0) as keluar
    from per
  ),
  kat_keluar as (
    select kat, sum(nominal) as total
    from per where tipe = 'Pengeluaran'
    group by kat
  ),
  kat_masuk as (
    select kat, sum(nominal) as total
    from per where tipe = 'Pemasukan'
    group by kat
  ),
  bulan as (
    select generate_series(
      (date_trunc('month', p_to)::date - interval '5 months')::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    )::date as awal
  ),
  tren as (
    select b.awal,
      coalesce(sum(x.nominal) filter (where x.tipe = 'Pemasukan'), 0)   as masuk,
      coalesce(sum(x.nominal) filter (where x.tipe = 'Pengeluaran'), 0) as keluar
    from bulan b
    left join tx x on date_trunc('month', x.tanggal)::date = b.awal
    group by b.awal
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('dari', p_from, 'sampai', p_to),
    'pemasukan', (select masuk from tot),
    'pengeluaran', (select keluar from tot),
    'sisa_bersih', (select masuk - keluar from tot),
    'rasio_tabungan', (select case when masuk > 0 then round((masuk - keluar) * 100.0 / masuk, 1) end from tot),
    'per_kategori', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kategori', k.kat,
        'total', k.total,
        'persen', case when (select keluar from tot) > 0 then round(k.total * 100.0 / (select keluar from tot), 1) else 0 end
      ) order by k.total desc)
      from kat_keluar k
    ), '[]'::jsonb),
    'top_pengeluaran', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'tanggal', r.tanggal, 'deskripsi', r.deskripsi, 'nominal', r.nominal, 'kategori', r.kat
      ) order by r.nominal desc)
      from (select * from per where tipe = 'Pengeluaran' order by nominal desc limit 5) r
    ), '[]'::jsonb),
    'tren_6_bulan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bulan', to_char(t.awal, 'YYYY-MM'), 'pemasukan', t.masuk, 'pengeluaran', t.keluar
      ) order by t.awal)
      from tren t
    ), '[]'::jsonb),
    'aliran_dana', jsonb_build_object(
      'sumber_pemasukan', coalesce((
        select jsonb_agg(jsonb_build_object('kategori', m.kat, 'total', m.total) order by m.total desc)
        from kat_masuk m
      ), '[]'::jsonb),
      'tujuan_pengeluaran', coalesce((
        select jsonb_agg(jsonb_build_object('kategori', k.kat, 'total', k.total) order by k.total desc)
        from kat_keluar k
      ), '[]'::jsonb),
      'transfer', (
        select jsonb_build_object(
          'jumlah', count(*),
          'total', coalesce(sum(w.nominal), 0),
          'biaya_admin', coalesce(sum(w.biaya_admin), 0)
        )
        from public.wallet_transfers w
        where w.user_id = auth.uid() and w.tanggal between p_from and p_to
      )
    )
  );
$$;

revoke all on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;
