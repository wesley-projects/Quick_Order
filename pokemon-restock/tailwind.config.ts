import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#090b11',
          900: '#0e1118',
          850: '#131824',
          800: '#1a2030',
          700: '#242b3d',
          600: '#333c52',
          500: '#4a5470',
        },
        bolt: {
          400: '#ffd76a',
          500: '#f7c948',
          600: '#d9a91c',
        },
        ember: {
          400: '#ff7a6b',
          500: '#ef4444',
          600: '#c62f2f',
        },
        mint: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.45)' },
          '70%': { boxShadow: '0 0 0 8px rgba(34,197,94,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
