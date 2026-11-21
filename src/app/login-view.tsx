import { forwardRef, useState, type ComponentProps } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Loader2, Lock, LogIn, Mail, PieChart, Receipt, ShieldCheck, User, UserPlus, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase-client';

const emailField = z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid');

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password wajib diisi'),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Nama terlalu panjang'),
  email: emailField,
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email atau password salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek kotak masuk Anda.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  }
  if (m.includes('password should be at least')) return 'Password terlalu pendek.';
  return 'Terjadi kendala saat memproses permintaan. Coba lagi.';
}

export function LoginView() {
  const [tab, setTab] = useState<'masuk' | 'daftar'>('masuk');
  const [busy, setBusy] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  async function onLogin(values: LoginValues) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setBusy(false);
    // Sukses: onAuthStateChange di useSession memindahkan pengguna ke aplikasi.
    if (error) toast.error('Gagal masuk', { description: translateAuthError(error.message) });
  }

  async function onSignup(values: SignupValues) {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name },
        // Link konfirmasi kembali ke alamat tempat aplikasi dibuka (localhost, atau domain deploy).
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);

    if (error) {
      toast.error('Gagal daftar', { description: translateAuthError(error.message) });
      return;
    }
    // Jika konfirmasi email aktif, belum ada sesi. Minta pengguna konfirmasi dulu.
    if (!data.session) {
      toast.success('Pendaftaran berhasil', { description: 'Cek email Anda untuk konfirmasi, lalu masuk.' });
      loginForm.setValue('email', values.email);
      signupForm.reset();
      setTab('masuk');
    }
  }

  async function onForgot() {
    const emailValue = loginForm.getValues('email').trim();
    const parsed = emailField.safeParse(emailValue);
    if (!parsed.success) {
      loginForm.setError('email', { message: parsed.error.issues[0].message });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
      redirectTo: window.location.origin,
    });
    setBusy(false);
    if (error) toast.error('Gagal mengirim email', { description: translateAuthError(error.message) });
    else toast.success('Tautan reset terkirim', { description: 'Cek email Anda untuk membuat password baru.' });
  }

  const loginErr = loginForm.formState.errors;
  const signupErr = signupForm.formState.errors;

  return (
    <main className="min-h-screen bg-[#eef3ff] text-[#0f1a3a]">
      <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10 md:px-8">
        <Decor />

        <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 md:grid-cols-2">
          {/* Panel brand (kiri) */}
          <section className="hidden flex-col items-center text-center md:flex">
            <div className="grid h-20 w-20 place-items-center rounded-[22px] bg-gradient-to-br from-[#38bdf8] to-[#2563eb] shadow-[0_18px_40px_rgba(37,99,235,0.35)]">
              <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 17 9 11 13 15 21 7" />
                <polyline points="15 7 21 7 21 13" />
              </svg>
            </div>
            <h1 className="mt-6 text-4xl font-extrabold tracking-[-0.03em]">Hepeng History</h1>
            <p className="mt-3 max-w-xs text-base text-[#4b5b80]">
              Masuk untuk melihat dompet dan transaksi Anda.
            </p>

            <ul className="mt-6 grid w-full max-w-sm gap-3 text-left">
              <FeatureItem icon={<Wallet className="h-5 w-5" />} title="Kelola dompet" desc="Saldo semua rekening dan e-wallet dalam satu tempat." />
              <FeatureItem icon={<Receipt className="h-5 w-5" />} title="Catat transaksi" desc="Input manual atau scan struk dan mutasi." />
              <FeatureItem icon={<PieChart className="h-5 w-5" />} title="Pantau pengeluaran" desc="Lihat ke mana uang Anda pergi setiap bulan." />
            </ul>

            <p className="mt-6 flex items-center gap-2 text-xs font-semibold text-[#5b6f99]">
              <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
              Data hanya bisa diakses oleh akun Anda
            </p>

            <Illustration />
          </section>

          {/* Kartu form (kanan) */}
          <section className="w-full rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_24px_60px_rgba(37,99,235,0.12)] backdrop-blur md:p-9">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold tracking-[-0.02em]">
                {tab === 'masuk' ? 'Selamat Datang!' : 'Buat Akun Baru'}
              </h2>
              <p className="mt-1.5 text-sm text-[#5b6f99]">
                {tab === 'masuk'
                  ? 'Silakan masuk untuk melanjutkan ke akun Anda'
                  : 'Daftar dulu, lalu mulai catat keuangan Anda'}
              </p>
            </div>

            <div role="tablist" aria-label="Pilih mode" className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#f1f5ff] p-1.5">
              <TabButton active={tab === 'masuk'} onClick={() => setTab('masuk')} icon={<Lock className="h-4 w-4" />}>
                Masuk
              </TabButton>
              <TabButton active={tab === 'daftar'} onClick={() => setTab('daftar')} icon={<User className="h-4 w-4" />}>
                Daftar
              </TabButton>
            </div>

            {tab === 'masuk' ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="mt-6 space-y-5">
                <Field id="login-email" label="E-mail" error={loginErr.email?.message}>
                  <FieldInput
                    id="login-email"
                    type="email"
                    placeholder="Masukkan email Anda"
                    autoComplete="email"
                    icon={<Mail className="h-4 w-4" />}
                    invalid={!!loginErr.email}
                    {...loginForm.register('email')}
                  />
                </Field>
                <Field id="login-password" label="Password" error={loginErr.password?.message}>
                  <PasswordInput
                    id="login-password"
                    placeholder="Masukkan password Anda"
                    autoComplete="current-password"
                    visible={showLoginPwd}
                    onToggle={() => setShowLoginPwd((v) => !v)}
                    invalid={!!loginErr.password}
                    {...loginForm.register('password')}
                  />
                </Field>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onForgot}
                    disabled={busy}
                    className="text-xs font-semibold text-[#2563eb] hover:underline disabled:opacity-50"
                  >
                    Lupa password?
                  </button>
                </div>
                <SubmitButton busy={busy} icon={<LogIn className="h-4 w-4" />}>Masuk</SubmitButton>
              </form>
            ) : (
              <form onSubmit={signupForm.handleSubmit(onSignup)} noValidate className="mt-6 space-y-5">
                <Field id="signup-name" label="Nama" error={signupErr.name?.message}>
                  <FieldInput
                    id="signup-name"
                    placeholder="Masukkan nama Anda"
                    autoComplete="name"
                    icon={<User className="h-4 w-4" />}
                    invalid={!!signupErr.name}
                    {...signupForm.register('name')}
                  />
                </Field>
                <Field id="signup-email" label="E-mail" error={signupErr.email?.message}>
                  <FieldInput
                    id="signup-email"
                    type="email"
                    placeholder="Masukkan email Anda"
                    autoComplete="email"
                    icon={<Mail className="h-4 w-4" />}
                    invalid={!!signupErr.email}
                    {...signupForm.register('email')}
                  />
                </Field>
                <Field id="signup-password" label="Password" hint="(minimal 8 karakter)" error={signupErr.password?.message}>
                  <PasswordInput
                    id="signup-password"
                    placeholder="Buat password Anda"
                    autoComplete="new-password"
                    visible={showSignupPwd}
                    onToggle={() => setShowSignupPwd((v) => !v)}
                    invalid={!!signupErr.password}
                    {...signupForm.register('password')}
                  />
                </Field>
                <SubmitButton busy={busy} icon={<UserPlus className="h-4 w-4" />}>Buat akun</SubmitButton>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
        active
          ? 'bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]'
          : 'text-[#5b6f99] hover:text-[#0f1a3a]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-bold text-[#0f1a3a]">
        {label}{' '}
        {hint && <span className="font-medium text-[#5b6f99]">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const inputBase =
  'h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-sm text-[#0f1a3a] placeholder:text-[#8a97b5] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15';

const FieldInput = forwardRef<HTMLInputElement, ComponentProps<'input'> & { icon: React.ReactNode; invalid: boolean }>(
  function FieldInput({ icon, invalid, className, ...rest }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#5b6f99]">{icon}</span>
        <input
          {...rest}
          ref={ref}
          aria-invalid={invalid}
          className={`${inputBase} ${invalid ? 'border-red-400' : 'border-[#dbe3f5]'} ${className ?? ''}`}
        />
      </div>
    );
  },
);

const PasswordInput = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & { visible: boolean; onToggle: () => void; invalid: boolean }
>(function PasswordInput({ visible, onToggle, invalid, ...rest }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#5b6f99]">
        <Lock className="h-4 w-4" />
      </span>
      <input
        {...rest}
        ref={ref}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid}
        className={`${inputBase} pr-11 ${invalid ? 'border-red-400' : 'border-[#dbe3f5]'}`}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute inset-y-0 right-3 flex items-center text-[#5b6f99] hover:text-[#0f1a3a]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

function SubmitButton({
  busy,
  icon,
  children,
}: {
  busy: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.35)] transition hover:brightness-105 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-white bg-white/70 p-3 shadow-[0_8px_20px_rgba(37,99,235,0.06)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8efff] text-[#2563eb]">{icon}</span>
      <span>
        <span className="block text-sm font-bold text-[#0f1a3a]">{title}</span>
        <span className="block text-xs text-[#5b6f99]">{desc}</span>
      </span>
    </li>
  );
}

function Decor() {
  return (
    <>
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#c7d8ff]/50 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#b9ccff]/50 blur-2xl" />
    </>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 420 300" className="mt-8 w-full max-w-md" aria-hidden="true">
      <ellipse cx="210" cy="265" rx="180" ry="18" fill="#dbe6ff" />
      {/* Struk */}
      <rect x="235" y="60" width="120" height="180" rx="10" fill="#ffffff" stroke="#dbe3f5" />
      <rect x="252" y="85" width="60" height="7" rx="3.5" fill="#bfd3ff" />
      <rect x="252" y="105" width="85" height="7" rx="3.5" fill="#e2eaff" />
      <rect x="252" y="125" width="70" height="7" rx="3.5" fill="#e2eaff" />
      {/* Grafik batang */}
      <rect x="252" y="200" width="16" height="30" rx="3" fill="#60a5fa" />
      <rect x="276" y="186" width="16" height="44" rx="3" fill="#3b82f6" />
      <rect x="300" y="168" width="16" height="62" rx="3" fill="#2563eb" />
      {/* Dompet */}
      <rect x="60" y="150" width="190" height="120" rx="20" fill="#3b82f6" />
      <rect x="60" y="150" width="190" height="34" rx="16" fill="#60a5fa" />
      <rect x="216" y="190" width="70" height="46" rx="14" fill="#2563eb" />
      <circle cx="240" cy="213" r="8" fill="#ffffff" />
      {/* Koin */}
      <circle cx="115" cy="140" r="26" fill="#fbbf24" />
      <circle cx="155" cy="132" r="26" fill="#f59e0b" />
      <text x="155" y="139" textAnchor="middle" fontSize="20" fontWeight="700" fill="#ffffff">Rp</text>
      {/* Tanaman */}
      <path d="M335 230 q-20 -50 0 -80 q20 30 0 80z" fill="#34d399" />
      <rect x="318" y="228" width="34" height="34" rx="6" fill="#ffffff" stroke="#dbe3f5" />
    </svg>
  );
}
