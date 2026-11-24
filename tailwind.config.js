/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        soft: 'var(--surface-soft)',
        card: 'var(--surface-card)',
        strong: 'var(--surface-strong)',
        ink: 'var(--ink)',
        body: 'var(--body-text)',
        muted: 'var(--muted)',
        faint: 'var(--muted-soft)',
        hairline: 'var(--hairline)',
        hairlineSoft: 'var(--hairline-soft)',
        primary: 'var(--primary)',
        primaryActive: 'var(--primary-active)',
        primaryDisabled: 'var(--primary-disabled)',
        onPrimary: 'var(--on-primary)',
        accent: 'var(--brand-accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
        dark: 'var(--surface-dark)',
        darkElevated: 'var(--surface-dark-elevated)',
        onDarkSoft: 'var(--on-dark-soft)',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.05)',
        raised: '0 4px 12px rgba(0,0,0,0.08)',
      },
      spacing: {
        section: '96px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scan-line': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'scale-in': 'scale-in 140ms ease-out',
        'scan-line': 'scan-line 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};
