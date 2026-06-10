import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'tcm-blue':       '#1a3b6e',
        'tcm-blue-dark':  '#122a52',
        'tcm-grey':       '#6b7280',
        'tcm-light-grey': '#f3f4f6',
      },
    },
  },
  plugins: [],
}
export default config
