import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12151b',
        surface: '#1a1e26',
        surface2: '#202531',
        hairline: '#2c313c',
        ink2: '#8b92a0',
        amber: '#ffc93c',
        teal: '#4fd1ae',
        coral: '#ff6b5b',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
