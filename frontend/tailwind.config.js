/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core / brand
        primary: '#0A5F38',       // Deep forest green
        secondary: '#047857',     // Emerald green
        accent: '#2DD4BF',        // Teal
        destructive: '#EF4444',
        brand: {
          primary: '#0A5F38',
          secondary: '#88B89D',   // Sage green
          accent: '#0D9488',     // Teal-600
        },
        // Text
        text: {
          primary: '#065F46',
          secondary: '#047857',
          subtle: '#059669',
        },
        // Forest (green scale)
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
        // Teal (Tailwind-style 50–900)
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        // Sage (50–900, main 400 = #88B89D)
        sage: {
          50: '#F0F7F3',
          100: '#D9EBE3',
          200: '#C2DFD3',
          300: '#A5D0BC',
          400: '#88B89D',
          500: '#6B9D7E',
          600: '#4F825F',
          700: '#336740',
          800: '#264D33',
          900: '#1A2D21',
        },
        // Mint (legacy)
        mint: {
          50: '#F5FFFA',
          100: '#C9F4D4',
          200: '#80EFC0',
          300: '#9DE8B0',
          400: '#6AE8BC',
          500: '#10B981',  // compatibility
          600: '#059669',  // compatibility
        },
        // Complementary (unchanged)
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
