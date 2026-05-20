/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        card: '#151515',
        cardHover: '#1a1a1a',
        borderLine: '#1f1f1f',
        textMuted: '#888888',
      }
    },
  },
  plugins: [],
}