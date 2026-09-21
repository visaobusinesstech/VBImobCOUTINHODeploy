module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/src/__tests__/realtyCrm.spec.ts",
    "<rootDir>/src/__tests__/realtyIntel.spec.ts",
    "<rootDir>/src/__tests__/crmMenuDelivery.spec.ts"
  ],
  collectCoverage: false,
  clearMocks: true,
  bail: 0
};
