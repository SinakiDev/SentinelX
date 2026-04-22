/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080b14',
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2035',
        },
        badge: {
          post: '#14b8a6',
          reply: '#e879a8',
          rt: '#60a5fa',
        },
        live: '#22c55e',
      },
    },
  },
  plugins: []
}
