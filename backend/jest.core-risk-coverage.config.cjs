const testPlan = require("./core-risk-test-plan.json");
const domains = Object.values(testPlan.domains);
const coreRiskSpecs = [
  ...new Set(
    domains.flatMap(({ specs }) => specs.map((path) => `<rootDir>/${path}`)),
  ),
];
const coreRiskSources = [...new Set(domains.flatMap(({ sources }) => sources))];
const coverageThreshold = Object.fromEntries(
  domains.map(({ coveragePattern, thresholds }) => [
    coveragePattern,
    thresholds,
  ]),
);

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: coreRiskSources,
  coverageDirectory: "../coverage/core-risk",
  coverageReporters: ["text", "json-summary"],
  coverageThreshold,
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testEnvironment: "node",
  testMatch: coreRiskSpecs,
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
};
