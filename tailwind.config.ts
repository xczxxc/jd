import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF8DA1',
          50: '#FFF2F5',
          100: '#FFE3E9',
          200: '#FFC8D4',
          300: '#FFAABC',
          400: '#FF8DA1',
          500: '#FF7089',
          600: '#EE5C7D',
          700: '#C93E5F',
          800: '#9E2F49',
          900: '#742436',
        },
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        gold: '#F0B36B',
        mint: '#7FC8B0',
        sky: '#7FA9E0',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: { bubble: '22px' },
      boxShadow: {
        soft: '0 8px 30px -12px rgba(255,141,161,0.45)',
        lift: '0 20px 45px -25px rgba(40,15,25,0.55)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        pop: 'pop .18s ease-out',
        pulseRing: 'pulseRing 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
