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
        canvas: "var(--bg-main, #F0F4F8)",
        ink: "var(--ink, #1E252B)",
        mid: "var(--ink-mid, #3A4550)",
        dim: "var(--ink-ghost, #8D99AE)",
        soft: "var(--ink-soft, #5C6B73)",
        card: "var(--bg-surface, #FFFFFF)",
        line: "var(--border, #D2DBE3)",
        sage: {
          DEFAULT: "var(--sage, #68A688)",
          light: "var(--sage-light, #EAF3EE)",
          tint: "var(--sage-light, #EAF3EE)",
          soft: "var(--sage-light, #EAF3EE)",
          mid: "var(--sage-mid, #99CBB2)",
        },
        amber: {
          DEFAULT: "var(--amber, #FF8D69)",
          light: "var(--amber-light, #FFF1EE)",
          tint: "var(--amber-light, #FFF1EE)",
          mid: "var(--amber-mid, #FFC4B3)",
        },
        teal: {
          DEFAULT: "var(--teal, #53A4D0)",
          light: "var(--teal-light, #EDF5FA)",
          tint: "var(--teal-light, #EDF5FA)",
          mid: "var(--teal-mid, #9FD2EF)",
        },
        rose: {
          DEFAULT: "var(--rose, #FF7894)",
          light: "var(--rose-light, #FFF0F2)",
          tint: "var(--rose-light, #FFF0F2)",
          mid: "var(--rose-mid, #FFA3B4)",
        },
        plum: {
          DEFAULT: "var(--plum, #E36EB3)",
          light: "var(--plum-light, #FDF0F7)",
          tint: "var(--plum-light, #FDF0F7)",
          mid: "var(--plum-mid, #F3A9D1)",
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
        sidebar: "var(--bg-surface, #FFFFFF)",
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
