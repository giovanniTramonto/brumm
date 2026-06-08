import forms from '@tailwindcss/forms'
import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.ts',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      screens: {
        mobile: '480px',
        tablet: '768px',
        desktop: '1024px',
      },
      colors: {
        admin: '#d5e4eb',
        ini: {
          DEFAULT: '#bdd792',
          200: '#dcedc4',
          300: '#aacb7e',
          500: '#8ab55a',
          700: '#608030',
          800: '#3d5218',
        },
        member: {
          DEFAULT: '#ffdd76',
          200: '#fff3c4',
          300: '#edc844',
          500: '#ffdd76',
          700: '#c9a000',
          800: '#7a5e00',
        },
        team: {
          DEFAULT: '#f2baba',
          200: '#fce9e9',
          300: '#e7a9a9',
          500: '#f2baba',
          700: '#b76464',
          800: '#904848',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
} satisfies Config
