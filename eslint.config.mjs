import next from "eslint-config-next";

const eslintConfig = [
  // Ignore build output and the standalone MCP server package (it has its
  // own tsconfig/toolchain and must not be linted by the app config).
  {
    ignores: [".next/**", "node_modules/**", "mcp-server/**", "dist/**", ".claude/**"],
  },
  ...next,
  // `react-hooks/set-state-in-effect` is a new, opinionated rule (eslint-plugin
  // react-hooks v6) that flags calling setState inside an effect. The codebase
  // has several intentional "load data when a selection changes" patterns
  // (e.g. re-fetch when `brandId` changes) that this rule rejects. We keep it
  // visible as a warning rather than an error so the gate stays green while
  // the pattern is reviewed case-by-case.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
