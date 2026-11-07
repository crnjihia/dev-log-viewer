// path: tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        devlog: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          border: 'var(--color-border)',
          accent: 'var(--color-accent)',
          error: 'var(--color-error)',
          warn: 'var(--color-warn)',
          info: 'var(--color-info)',
          success: 'var(--color-success)',
          debug: 'var(--color-debug)',
          text: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
