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
        mint: {
          50: '#E8FAF0',
          100: '#C9F4D4', // PRIMARY BRAND COLOR
          200: '#80EFC0', // Hover states, interactions
          300: '#9DE8B0', // Active/pressed states
          400: '#A8E8BC', // Borders, dividers
        },
        text: {
          primary: '#1E5A3B', // Body text, headings - WCAG AAA compliant
          secondary: '#2D7A52', // Subheadings, labels - WCAG AA compliant
          subtle: '#4A9A6A', // Captions, metadata - Large text only
        },
        blush: '#FFE5EC', // Soft Blush Pink - Romantic, gentle accent
        butter: '#FFFEC0', // Butter Yellow - Warm, cheerful highlights
        powder: '#D4E4F7', // Powder Blue - Cool, professional balance
        beige: '#F5F1E8', // Warm Beige - Natural, earthy grounding
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'mint-sm': '0 2px 12px rgba(201, 244, 212, 0.2)',
        'mint-md': '0 8px 24px rgba(201, 244, 212, 0.3)',
        'mint-lg': '0 16px 48px rgba(30, 90, 59, 0.1)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
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
}

