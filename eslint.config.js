import globals from "globals";

export default [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // App globals (loaded via script tags)
        App: "readonly",
        Upload: "readonly",
        Calibrate: "readonly",
        Editor: "readonly",
        Rooms: "readonly",
        Nodes: "readonly",
        Floors: "readonly",
        Export: "readonly",
        Storage: "readonly",
        jsyaml: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { varsIgnorePattern: "^(App|Upload|Calibrate|Editor|Rooms|Nodes|Floors|Export|Storage)$" }],
      "no-undef": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "warn",
      "no-throw-literal": "error",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
];
