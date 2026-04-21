/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1E4840",
          secondary: "#6BCB77",
          accent: "#FFB86B",
          background: "#F7F9FC",
          text: "#2D3748",
          error: "#F56565"
        },
        ink: "#2D3748",
        mist: "#F7F9FC",
        ocean: "#1E4840",
        coral: "#FFB86B",
        moss: "#6BCB77",
        sand: "#FFB86B",
        slateblue: "#2D3748"
      },
      boxShadow: {
        card: "0 18px 45px rgba(30, 72, 64, 0.12)",
        soft: "0 10px 25px rgba(45, 55, 72, 0.08)"
      }
    }
  },
  plugins: []
};
