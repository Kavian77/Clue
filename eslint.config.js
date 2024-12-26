import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import noOnlyTestsPlugin from "eslint-plugin-no-only-tests";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintPluginPrettierRecommended,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "no-only-tests": noOnlyTestsPlugin,
    },
    rules: {
      "no-only-tests/no-only-tests": "error",
    },
  },
);
