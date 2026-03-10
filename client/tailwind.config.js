/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#F3F4F6",
        ocean: "#0EA5E9",
        coral: "#F97316",
        moss: "#16A34A",
        sand: "#FCD34D",
        slateblue: "#1E293B"
      },
      boxShadow: {
        card: "0 10px 30px rgba(15, 23, 42, 0.12)"
      }
    }
  },
  plugins: []
};
