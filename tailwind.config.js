/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Timeless Rides luxury brand colors
        gold: {
          50: '#fdfaeb',
          100: '#faf2c7',
          200: '#f5e38b',
          300: '#f0cf4f',
          400: '#d4af37', // Primary gold from main site
          500: '#c9a227',
          600: '#be7b10',
          700: '#985810',
          800: '#7d4615',
          900: '#6a3a17',
        },
        charcoal: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#454545',
          900: '#1a1a1a', // Primary dark from main site
          950: '#0d0d0d',
        },
        cream: {
          50: '#fdfcfa',
          100: '#f5f2eb', // Primary cream from main site
          200: '#ebe5d9',
          300: '#ddd4c3',
          400: '#c9baa3',
        },
      },
      fontFamily: {
        display: ['Gilda Display', 'Georgia', 'serif'],
        body: ['Lato', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
