import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        canvas: "#F4EFE6",
        ink: "#1E1A16",
        mid: "#5C5248",
        dim: "#9C9188",
        card: "#FDFAF5",
        line: "rgba(60,50,40,0.10)",
        sage: {
          DEFAULT: "#4E8C58",
          light: "#7AB882",
          tint: "#D4EDD7",
          soft: "#EBF5EC",
        },
        gold: {
          DEFAULT: "#B8832A",
          tint: "#F5E6C8",
          light: "#D4A853",
        },
        blue: {
          DEFAULT: "#3A6E99",
          tint: "#D4E8F5",
          light: "#5A9EC8",
        },
        terra: {
          DEFAULT: "#B35A38",
          tint: "#F5DDD4",
          light: "#D4824A",
        },
        danger: {
          DEFAULT: "#C0392B",
          soft: "#FAE0DC",
          light: "#E05A50",
        },
        sidebar: "#1E1A16",
      },
      borderRadius: {
        card: "14px",
        modal: "18px",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.25s ease both",
        slideUp: "slideUp 0.2s ease",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(60,50,40,0.12)",
        topbar: "0 1px 8px rgba(60,50,40,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
