module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/src/__tests__/realtyCrm.spec.ts",
    "<rootDir>/src/__tests__/realtyIntel.spec.ts",
    "<rootDir>/src/__tests__/crmMenuDelivery.spec.ts",
    "<rootDir>/src/__tests__/proprietarioCrm.spec.ts",
    "<rootDir>/src/__tests__/relacionamentoCrm.spec.ts",
    "<rootDir>/src/__tests__/captacaoIndicacao.spec.ts",
    "<rootDir>/src/__tests__/agendaCompromissos.spec.ts",
    "<rootDir>/src/__tests__/condominioCrm.spec.ts",
    "<rootDir>/src/__tests__/corretoresParity.spec.ts",
    "<rootDir>/src/__tests__/inadimplenciaParity.spec.ts",
    "<rootDir>/src/__tests__/consultaCpfParity.spec.ts"
  ],
  collectCoverage: false,
  clearMocks: true,
  bail: 0
};
