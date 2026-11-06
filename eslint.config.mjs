import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "backend/src/generated/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
);
