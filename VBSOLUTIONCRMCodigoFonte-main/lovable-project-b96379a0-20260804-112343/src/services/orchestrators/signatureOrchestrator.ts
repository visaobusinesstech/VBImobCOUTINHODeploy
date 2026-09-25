import type { SignatureProvider, SignatureDocumentData, SignatureResult, SignatureStatusResult } from '../types/signature';

const providers: SignatureProvider[] = [];

export function registerSignatureProvider(provider: SignatureProvider) {
  providers.push(provider);
  console.log(`[SignatureOrchestrator] Provider registered: ${provider.name}`);
}

export async function createSignatureDocument(data: SignatureDocumentData): Promise<SignatureResult> {
  console.log('[SignatureOrchestrator] Creating document with fallback strategy', { title: data.title, signers: data.signers.length });
  
  const errors: { provider: string; error: string }[] = [];
  
  for (const provider of providers) {
    try {
      console.log(`[SignatureOrchestrator] Trying provider: ${provider.name}`);
      const result = await provider.createDocument(data);
      console.log(`[SignatureOrchestrator] Success with provider: ${provider.name}`, { documentId: result.documentId });
      return result;
    } catch (error: any) {
      console.error(`[SignatureOrchestrator] Provider ${provider.name} failed:`, error.message);
      errors.push({ provider: provider.name, error: error.message });
    }
  }
  
  console.error('[SignatureOrchestrator] All providers failed', errors);
  throw new Error(`Todos os provedores de assinatura falharam: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`);
}

export async function getSignatureStatus(documentId: string, providerName?: string): Promise<SignatureStatusResult> {
  const targetProviders = providerName 
    ? providers.filter(p => p.name === providerName)
    : providers;
    
  for (const provider of targetProviders) {
    try {
      return await provider.getStatus(documentId);
    } catch (error: any) {
      console.error(`[SignatureOrchestrator] Status check failed for ${provider.name}:`, error.message);
    }
  }
  
  throw new Error('Não foi possível consultar o status da assinatura');
}

export function getRegisteredSignatureProviders(): string[] {
  return providers.map(p => p.name);
}
