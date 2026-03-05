/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A5F38',
        secondary: '#047857',
        accent: '#2DD4BF',
        brand: {
          primary: '#0A5F38',
          secondary: '#88B89D',
          accent: '#0D9488',
        },
        text: {
          primary: '#065F46',
          secondary: '#047857',
          subtle: '#059669',
        },
        forest: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        mint: {
          50: '#F5FFFA',
          100: '#C9F4D4',
          200: '#80EFC0',
          300: '#9DE8B0',
          400: '#6AE8BC',
          500: '#10B981',
          600: '#059669',
        },
        blush: '#FFE5EC',
        butter: '#FFFEC0',
        powder: '#D4E4F7',
        beige: '#F5F1E8',
      },
      fontFamily: {
        sans: ['Inter', '"Inter Fallback"', 'sans-serif'],
      },
      boxShadow: {
        'mint-sm': '0 2px 12px rgba(10, 95, 56, 0.08)',
        'mint-md': '0 8px 24px rgba(10, 95, 56, 0.12)',
        'mint-lg': '0 16px 48px rgba(10, 95, 56, 0.1)',
        'mint-soft': '0 4px 14px rgba(128, 239, 192, 0.2)',
        'mint-soft-lg': '0 10px 30px rgba(128, 239, 192, 0.3)',
        'mint-soft-xl': '0 14px 40px rgba(128, 239, 192, 0.25)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 8s infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
};
