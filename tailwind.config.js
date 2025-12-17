/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        alertPulse: {
          "0%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(239,68,68,0.8)",
          },
          "50%": {
            transform: "scale(1.08)",
            boxShadow: "0 0 0 14px rgba(239,68,68,0)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(239,68,68,0)",
          },
        },
      },
      animation: {
        "alert-pulse": "alertPulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
