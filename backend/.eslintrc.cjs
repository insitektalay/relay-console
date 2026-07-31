module.exports = {
  root: true,
  env: {
    es2022: true,
    jest: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  ignorePatterns: ["dist/**", "node_modules/**"],
  rules: {
    "no-constant-binary-expression": "error",
    "no-dupe-else-if": "error",
    "no-duplicate-case": "error",
    "no-func-assign": "error",
    "no-import-assign": "error",
    "no-self-assign": "error",
    "no-unreachable": "error",
    "no-unreachable-loop": "error",
    "no-unsafe-finally": "error",
    "no-useless-catch": "error",
    "valid-typeof": "error",
  },
};
