import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Link2, Save, Trash2, Loader2, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getApiUrl, setApiUrl } from '@/lib/api';

const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzV2rfDhhS5nf4J9wRLtuhpVu_vdvGiXrn_9QzS02FvbQ74YPUWS1DrI-p-wfa4kI25/exec?key=ca9d942b56bc480dbb910454cd6a5666';

interface Props {
  onSaved: () => void;
}

export function SettingsView({ onSaved }: Props) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedUrl = getApiUrl();
    if (savedUrl) {
      setUrl(savedUrl);
      setSaved(true);
    } else {
      setUrl(DEFAULT_APPS_SCRIPT_URL);
      setSaved(false);
    }
  }, []);

  const isValid = /https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/i.test(url.trim());

  function handleSave() {
    setSaving(true);
    setApiUrl(url.trim());
    setSaving(false);
    setSaved(url.trim().length > 0);
    toast.success('URL tersimpan', {
      description: 'Dashboard akan memuat data dari Google Sheets Anda.',
    });
    onSaved();
  }

  function handleClear() {
    setApiUrl('');
    setUrl('');
    setSaved(false);
    toast.info('URL dihapus', { description: 'Dashboard kembali ke mode demo.' });
    onSaved();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight">Pengaturan</h2>
        <p className="text-sm text-muted-foreground">Hubungkan dashboard ke Google Sheets Anda</p>
      </div>

      {/* API connection card */}
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-balance-soft">
            <Link2 className="h-5 w-5 text-balance" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold tracking-tight">Google Apps Script URL</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tempel URL web app (<code className="rounded bg-muted px-1 py-0.5 text-xs">/exec</code>) yang sudah Anda deploy.
            </p>
          </div>
          {saved && (
            <span className="flex items-center gap-1 rounded-full bg-income-soft px-2.5 py-1 text-xs font-semibold text-income">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan
            </span>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <Label htmlFor="api-url">Web App URL</Label>
          <Input
            id="api-url"
            type="url"
            placeholder="https://script.google.com/macros/s/AKfycbzV2rfDhhS5nf4J9wRLtuhpVu_vdvGiXrn_9QzS02FvbQ74YPUWS1DrI-p-wfa4kI25/exec?key=ca9d942b56bc480dbb910454cd6a5666"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={cn(url && !isValid && 'border-destructive/50 focus-visible:ring-destructive/40')}
          />
          {url && !isValid && (
            <p className="text-xs text-destructive">URL harus diawali dengan https dan berakhir /exec</p>
          )}
          <p className="text-xs text-muted-foreground">
            Tersimpan di browser Anda (localStorage). Tetap aktif setelah reload.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={!url.trim() || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan &amp; Muat Data
          </Button>
          {saved && (
            <Button variant="outline" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" /> Hapus
            </Button>
          )}
        </div>
      </Card>

      {/* How to deploy */}
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-savings-soft">
            <Info className="h-5 w-5 text-savings" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold tracking-tight">Cara Mendapat URL</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Ikuti langkah singkat ini dari Google Sheets Anda.
            </p>
          </div>
        </div>

        <ol className="mt-4 space-y-3">
          {[
            'Buka Google Sheets, lalu Extensions → Apps Script.',
            'Tempel skrip doGet / doPost Anda yang menangani action getDashboard & addTransaction.',
            'Klik Deploy → New deployment → pilih tipe "Web app".',
            'Set "Execute as: Me" dan "Who has access: Anyone".',
            'Klik Deploy, salin URL yang berakhiran /exec, lalu tempel di atas.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold text-foreground">Contoh format respons getDashboard</p>
          <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-muted-foreground"><code>{`{
  "totalSaldo": 5250000,
  "pemasukanBulanIni": 7000000,
  "pengeluaranBulanIni": 1750000,
  "tabunganBulanIni": 5250000,
  "dompet": [{"nama":"BCA","saldo":4500000}],
  "topPengeluaran": [{"deskripsi":"Belanja","nominal":500000}],
  "rekapKategori": {"Makan & Minum": 350000}
}`}</code></pre>
        </div>

        <a
          href="https://script.google.com/home"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Buka Apps Script <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Card>
    </div>
  );
}
