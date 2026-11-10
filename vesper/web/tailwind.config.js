const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: c('--c-bg'),
        surface: c('--c-surface'),
        raised: c('--c-raised'),
        fg: c('--c-fg'),
        muted: c('--c-muted'),
        line: c('--c-line'),
        accent: c('--c-accent'),
        accent2: c('--c-accent2'),
        danger: c('--c-danger'),
        ok: c('--c-ok'),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Unbounded Variable"', '"Manrope Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        soft: '0 10px 30px -12px rgb(0 0 0 / 0.45)',
        glow: '0 8px 30px -8px rgb(var(--c-accent) / 0.55)',
      },
      keyframes: {
        flash: { '0%,100%': { backgroundColor: 'transparent' }, '30%': { backgroundColor: 'rgb(var(--c-accent) / 0.22)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        dot: { '0%,80%,100%': { opacity: '.25', transform: 'translateY(0)' }, '40%': { opacity: '1', transform: 'translateY(-2px)' } },
      },
      animation: { flash: 'flash 1.6s ease-out', shimmer: 'shimmer 1.4s infinite', dot: 'dot 1.2s infinite' },
    },
  },
  plugins: [],
};
