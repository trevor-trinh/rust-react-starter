import nextPlugin from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/target/**",
      "**/.sqlx/**",
      "**/tsconfig.tsbuildinfo",
    ],
  },
  ...nextPlugin,
];

export default eslintConfig;
