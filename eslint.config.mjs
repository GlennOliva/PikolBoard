import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // `.next/` holds generated build output, including the `validator.ts` and
    // `routes.d.ts` type stubs plus bundled server chunks. Linting them
    // reports thousands of errors that no one can act on and drowns out real
    // ones, so the whole directory is excluded.
    ignores: [".next/**", "node_modules/**", "out/**", "build/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
