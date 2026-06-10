import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        tcm: {
          blue:    '#1A3A5C',
          gold:    '#C9A84C',
          red:     '#C0392B',
          green:   '#1E8449',
          grey:    '#4A5568',
          'light-grey': '#F7FAFC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
