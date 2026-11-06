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
    // `mobile/` is a separate Expo app with its own `npm run lint`
    // (`expo lint`) and is excluded from the Next build. Linting it from the
    // root applies the web app's rules to Node scripts it does not own.
    ignores: [".next/**", "node_modules/**", "out/**", "build/**", "mobile/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
