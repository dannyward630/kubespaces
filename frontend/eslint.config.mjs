import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships flat configs directly, so we consume them
// straight rather than through @eslint/eslintrc's FlatCompat (which chokes on
// the newer config shape).
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-config-next 16 promoted these newer react-hooks rules to errors.
    // Our client hooks intentionally fetch-on-mount / init theme in effects,
    // which is the recommended pattern; keep them as warnings, not blockers.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
