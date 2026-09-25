import type { CreditProvider, CreditCheckResult, CreditConsolidatedResult } from '../types/credit';

const providers: CreditProvider[] = [];
const TIMEOUT_MS = 3000;

export function registerCreditProvider(provider: CreditProvider) {
  providers.push(provider);
  console.log(`[CreditOrchestrator] Provider registered: ${provider.name}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout (${ms}ms) for ${providerName}`)), ms)
    ),
  ]);
}

export async function checkCredit(cpf: string): Promise<CreditConsolidatedResult> {
  console.log('[CreditOrchestrator] Starting parallel credit check', { cpf: cpf.replace(/\d{6}/, '******'), providers: providers.length });
  
  const results: CreditCheckResult[] = [];
  const failedProviders: string[] = [];
  
  const promises = providers.map(async (provider) => {
    try {
      console.log(`[CreditOrchestrator] Checking ${provider.name}...`);
      const result = await withTimeout(provider.checkCPF(cpf), TIMEOUT_MS, provider.name);
      console.log(`[CreditOrchestrator] ${provider.name} responded:`, { score: result.score, status: result.status });
      results.push(result);
    } catch (error: any) {
      console.error(`[CreditOrchestrator] ${provider.name} failed:`, error.message);
      failedProviders.push(provider.name);
    }
  });
  
  await Promise.allSettled(promises);
  
  if (results.length === 0) {
    throw new Error('Nenhum bureau de crédito respondeu. Tente novamente.');
  }
  
  // Use worst score (most conservative)
  const worstScore = Math.min(...results.map(r => r.score));
  
  // If any returns rejected, final is rejected
  const hasRejected = results.some(r => r.status === 'rejected');
  const status = hasRejected ? 'rejected' : worstScore >= 500 ? 'approved' : 'pending';
  
  const consolidated: CreditConsolidatedResult = {
    consolidatedScore: worstScore,
    status,
    results,
    worstScore,
    checkedProviders: results.map(r => r.provider),
    failedProviders,
    consultedAt: new Date().toISOString(),
  };
  
  console.log('[CreditOrchestrator] Consolidated result:', { score: worstScore, status, checked: consolidated.checkedProviders.length, failed: failedProviders.length });
  
  return consolidated;
}

export function getRegisteredCreditProviders(): string[] {
  return providers.map(p => p.name);
}
