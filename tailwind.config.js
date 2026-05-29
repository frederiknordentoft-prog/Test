/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#F5B800',
          green: '#0E4E3A',
          'green-light': '#15634a',
          'green-dark': '#0a3a2a',
        },
        felt: '#0c3d2e',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.2)',
        'card-lift': '0 8px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
