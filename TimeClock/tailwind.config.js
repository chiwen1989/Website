/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          blue: '#58a6ff',
          green: '#3fb950',
          purple: '#bc8cff'
        }
      }
    }
  },
  plugins: []
}

