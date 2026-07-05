import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#efe3c8',
        'parchment-dark': '#e2d0a8',
        brass: '#b08d3f',
        'brass-light': '#d8b96a',
        walnut: '#4a3220',
        ink: '#3a2c18',
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
