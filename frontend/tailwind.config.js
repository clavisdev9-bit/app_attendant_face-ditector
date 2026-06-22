/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#185FA5',
          700: '#0d4f91',
          800: '#042C53',
          900: '#021a33',
          950: '#010d1c',
        },
        sidebar: {
          bg:     '#042C53',
          border: '#0d3d6e',
          text:   '#94a3b8',
          hover:  '#0d4f91',
          active: '#185FA5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
        xs:    '0.75rem',
        sm:    '0.8125rem',
        base:  '0.875rem',
        lg:    '1rem',
        xl:    '1.125rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card:  '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.06)',
        panel: '0 4px 16px -2px rgba(0,0,0,.08)',
        topbar:'0 1px 0 0 rgba(0,0,0,.06)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [forms],
}
