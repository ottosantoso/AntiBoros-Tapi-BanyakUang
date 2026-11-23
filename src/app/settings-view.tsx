import { Clock, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MasterKategoriSettings } from '@/app/master-kategori-settings';
import { BerulangSettings } from '@/app/berulang-settings';

interface Props {
  onSaved?: () => void;
}

const COMING_SOON = [
  'Profil: nama dan foto',
  'Preferensi: bahasa dan format tanggal',
  'Notifikasi: pengingat budget dan transaksi berulang',
  'Backup dan ekspor data',
];

// Prop onSaved tetap diterima karena App.tsx masih mengirimkannya.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function SettingsView(_props: Props) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Informasi aplikasi dan pengaturan yang tersedia</p>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-balance-soft">
            <Info className="h-5 w-5 text-balance" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold tracking-tight">Tentang aplikasi</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Hepeng History · Pantau Duit & Pengeluaran Harianmu</p>
          </div>
        </div>

        <ul className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-income" />
            <span className="text-muted-foreground">
              Data tersimpan di database dan hanya bisa diakses oleh akun Anda.
            </span>
          </li>
          <li className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-savings" />
            <span className="text-muted-foreground">
              Scanner struk dan mutasi diproses oleh layanan AI di server. Tidak ada yang perlu dikonfigurasi di sini.
            </span>
          </li>
        </ul>
      </Card>

      <MasterKategoriSettings />

      <BerulangSettings />

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-savings-soft">
            <Clock className="h-5 w-5 text-savings" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold tracking-tight">Segera hadir</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Pengaturan berikut belum tersedia.</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {COMING_SOON.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
