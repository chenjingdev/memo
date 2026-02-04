export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['Crimson Pro', 'serif'],
        ui: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'slide-down': 'slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        slideDown: {
          '0%': { opacity: '0', transform: 'translate(-50%, -20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translate(-50%, 0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
