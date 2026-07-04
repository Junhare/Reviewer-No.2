import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      ".next-build/**",
      ".next-compiled/**",
      ".next-webpack/**",
      "node_modules/**",
    ],
  },
  ...nextVitals,
];

export default eslintConfig;
