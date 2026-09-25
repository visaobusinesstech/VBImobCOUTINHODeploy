import type { CreditProvider, CreditCheckResult } from '../types/credit';

export const spcProvider: CreditProvider = {
  name: 'SPC Brasil',
  
  async checkCPF(cpf: string): Promise<CreditCheckResult> {
    console.log('[SPC] Checking CPF...');
    throw new Error('SPC API key não configurada. Configure em Configurações > Integrações.');
  },
};
