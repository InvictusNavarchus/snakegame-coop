/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'bg': 'var(--color-bg)',
        'text': 'var(--color-text)',
        'primary': 'var(--color-primary)',
        'secondary': 'var(--color-secondary)',
        'accent': 'var(--color-accent)',
        'snake1': 'var(--color-snake1)',
        'snake2': 'var(--color-snake2)',
        'food': 'var(--color-food)'
      }
    }
  },
  plugins: []
};