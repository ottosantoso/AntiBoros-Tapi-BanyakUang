-- is_admin() cukup dibaca dengan security invoker: policy "lihat peran sendiri" sudah mengizinkan
-- user membaca barisnya sendiri. Dengan begitu temuan advisor 0029 untuk is_admin hilang.
-- admin_summary() tetap security definer karena menghitung auth.users, dan sudah memeriksa is_admin() di dalamnya.
alter function public.is_admin() security invoker;
alter function public.is_admin() set search_path = public;
