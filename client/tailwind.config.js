/** @type {import('tailwindcss').Config} */
export default {
  prefix: "tw-",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
