/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-50': 'var(--color-brand-50)',
        'brand-100': 'var(--color-brand-100)',
        'brand-200': 'var(--color-brand-200)',
        'brand-300': 'var(--color-brand-300)',
        'brand-400': 'var(--color-brand-400)',
        'brand-500': 'var(--color-brand-500)',
        'brand-600': 'var(--color-brand-600)',
        'brand-700': 'var(--color-brand-700)',
        'brand-800': 'var(--color-brand-800)',
        'brand-900': 'var(--color-brand-900)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
      },
    },
  },
  plugins: [],
};
