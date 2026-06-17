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
        canvas: '#f3f6f4',
        surface: '#ffffff',
        // Danske Spil-inspireret grøn som primærfarve
        brand: {
          50: '#e7f7ee',
          100: '#c4ecd5',
          200: '#92dcb1',
          300: '#5bc98c',
          400: '#27b56a',
          500: '#00a050',
          600: '#008a45',
          700: '#007038',
          800: '#02592e',
          900: '#084827',
        },
        // Gul/guld accent
        accent: {
          50: '#fffbe6',
          100: '#fff3bd',
          200: '#ffe885',
          300: '#ffdc4d',
          400: '#ffce1f',
          500: '#f5be00',
          600: '#cf9a00',
          700: '#a37700',
          800: '#7d5b06',
          900: '#684b0c',
        },
        health: {
          red: '#e5484d',
          yellow: '#f5be00',
          green: '#00a050',
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
