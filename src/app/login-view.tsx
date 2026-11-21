import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '@/components/logo';
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
      options: { data: { name: values.name } },
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
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border bg-card shadow-xl">
        <CardHeader className="items-center space-y-3 text-center">
          <Logo size={52} />
          <CardTitle className="font-display text-2xl font-extrabold tracking-[-0.03em] text-foreground">
            Hepeng History
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Masuk untuk melihat dompet dan transaksi Anda.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'masuk' | 'daftar')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="masuk">Masuk</TabsTrigger>
              <TabsTrigger value="daftar">Daftar</TabsTrigger>
            </TabsList>

            <TabsContent value="masuk">
              <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="mt-4 space-y-4">
                <Field id="login-email" label="Email" error={loginErr.email?.message}>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="nama@email.com"
                    autoComplete="email"
                    aria-invalid={!!loginErr.email}
                    {...loginForm.register('email')}
                  />
                </Field>
                <Field id="login-password" label="Password" error={loginErr.password?.message}>
                  <PasswordInput
                    id="login-password"
                    placeholder="Masukkan password"
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
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    Lupa password?
                  </button>
                </div>
                <Button type="submit" className="w-full gap-2 font-bold" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  Masuk
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="daftar">
              <form onSubmit={signupForm.handleSubmit(onSignup)} noValidate className="mt-4 space-y-4">
                <Field id="signup-name" label="Nama" error={signupErr.name?.message}>
                  <Input
                    id="signup-name"
                    placeholder="Nama lengkap Anda"
                    autoComplete="name"
                    aria-invalid={!!signupErr.name}
                    {...signupForm.register('name')}
                  />
                </Field>
                <Field id="signup-email" label="Email" error={signupErr.email?.message}>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="nama@email.com"
                    autoComplete="email"
                    aria-invalid={!!signupErr.email}
                    {...signupForm.register('email')}
                  />
                </Field>
                <Field id="signup-password" label="Password" hint="Minimal 8 karakter" error={signupErr.password?.message}>
                  <PasswordInput
                    id="signup-password"
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                    visible={showSignupPwd}
                    onToggle={() => setShowSignupPwd((v) => !v)}
                    invalid={!!signupErr.password}
                    {...signupForm.register('password')}
                  />
                </Field>
                <Button type="submit" className="w-full gap-2 font-bold" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Buat akun
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
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
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-foreground">
          {label}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type PasswordInputProps = React.ComponentProps<typeof Input> & {
  visible: boolean;
  onToggle: () => void;
  invalid: boolean;
};

function PasswordInput({ visible, onToggle, invalid, ...rest }: PasswordInputProps) {
  return (
    <div className="relative">
      <Input
        {...rest}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
