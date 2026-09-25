// Orchestrators
export { createSignatureDocument, getSignatureStatus, registerSignatureProvider, getRegisteredSignatureProviders } from './orchestrators/signatureOrchestrator';
export { checkCredit, registerCreditProvider, getRegisteredCreditProviders } from './orchestrators/creditOrchestrator';

// Signature Providers
export { autentiqueProvider } from './providers/autentiqueProvider';
export { clicksignProvider } from './providers/clicksignProvider';
export { docusignProvider } from './providers/docusignProvider';

// Credit Providers
export { serasaProvider } from './providers/serasaProvider';
export { spcProvider } from './providers/spcProvider';
export { boaVistaProvider } from './providers/boaVistaProvider';

// Types
export type { SignatureProvider, SignatureDocumentData, SignatureResult, SignatureStatusResult } from './types/signature';
export type { CreditProvider, CreditCheckResult, CreditConsolidatedResult } from './types/credit';

// Auto-register providers in priority order
import { registerSignatureProvider } from './orchestrators/signatureOrchestrator';
import { registerCreditProvider } from './orchestrators/creditOrchestrator';
import { autentiqueProvider } from './providers/autentiqueProvider';
import { clicksignProvider } from './providers/clicksignProvider';
import { docusignProvider } from './providers/docusignProvider';
import { spcProvider } from './providers/spcProvider';
import { boaVistaProvider } from './providers/boaVistaProvider';

// Signature: Autentique > Clicksign > DocuSign
registerSignatureProvider(autentiqueProvider);
registerSignatureProvider(clicksignProvider);
registerSignatureProvider(docusignProvider);

// Credit: SPC + Boa Vista (Serasa = implementação futura)
registerCreditProvider(spcProvider);
registerCreditProvider(boaVistaProvider);
