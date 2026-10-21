/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        elevated: 'hsl(var(--background-elevated))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        income: {
          DEFAULT: 'hsl(var(--income))',
          soft: 'hsl(var(--income-soft))',
          foreground: 'hsl(var(--income-fg))',
        },
        expense: {
          DEFAULT: 'hsl(var(--expense))',
          soft: 'hsl(var(--expense-soft))',
          foreground: 'hsl(var(--expense-fg))',
        },
        balance: {
          DEFAULT: 'hsl(var(--balance))',
          soft: 'hsl(var(--balance-soft))',
          foreground: 'hsl(var(--balance-fg))',
        },
        savings: {
          DEFAULT: 'hsl(var(--savings))',
          soft: 'hsl(var(--savings-soft))',
          foreground: 'hsl(var(--savings-fg))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
          6: 'hsl(var(--chart-6))',
          7: 'hsl(var(--chart-7))',
          8: 'hsl(var(--chart-8))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.5' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
