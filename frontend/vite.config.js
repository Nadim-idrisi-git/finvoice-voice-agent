import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  // Vite compiles JSX with its built-in esbuild using React's automatic runtime.
  esbuild: { jsx: "automatic" },
});
