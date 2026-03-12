/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#4C6FFF",
          secondary: "#6BCB77",
          accent: "#FFB86B",
          background: "#F7F9FC",
          text: "#2D3748",
          error: "#F56565"
        },
        ink: "#2D3748",
        mist: "#F7F9FC",
        ocean: "#4C6FFF",
        coral: "#FFB86B",
        moss: "#6BCB77",
        sand: "#FFB86B",
        slateblue: "#2D3748"
      },
      boxShadow: {
        card: "0 18px 45px rgba(76, 111, 255, 0.12)",
        soft: "0 10px 25px rgba(45, 55, 72, 0.08)"
      }
    }
  },
  plugins: []
};
