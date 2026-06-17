/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0b1d16',
          soft: '#33433c',
          muted: '#6b7d75',
        },
        canvas: '#e4ede7',
        surface: '#ffffff',
        // Danske Spil-grøn, dybere tone
        brand: {
          50: '#e7f6ed',
          100: '#c3e9d2',
          200: '#8fd6ac',
          300: '#54c084',
          400: '#1ba75f',
          500: '#009444',
          600: '#007a37',
          700: '#00632d',
          800: '#054f26',
          900: '#06371c',
          950: '#042713',
        },
        // Danske Spil-gul/guld (#FFCB05)
        accent: {
          50: '#fff8e0',
          100: '#ffeeb0',
          200: '#ffe173',
          300: '#ffd633',
          400: '#ffcb05',
          500: '#e6b400',
          600: '#bf9400',
          700: '#997400',
          800: '#7a5d06',
          900: '#67500c',
        },
        health: {
          red: '#e5484d',
          yellow: '#ffcb05',
          green: '#009444',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(8, 40, 26, 0.05), 0 1px 3px rgba(8, 40, 26, 0.07)',
        cardhover: '0 6px 16px rgba(8, 40, 26, 0.10), 0 2px 5px rgba(8, 40, 26, 0.06)',
        modal: '0 24px 60px rgba(8, 40, 26, 0.28)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'ring-fill': {
          '0%': { strokeDashoffset: '999' },
          '100%': { strokeDashoffset: 'var(--dash, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        rise: 'rise 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
        pop: 'pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
