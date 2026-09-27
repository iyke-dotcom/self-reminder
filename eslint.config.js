import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist", "node_modules", "playwright-report", "test-results"] },
  {
    files: ["**/*.js"],
    ...js.configs.recommended,
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  prettier,
];
