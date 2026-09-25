import type { CreditProvider, CreditCheckResult } from '../types/credit';

export const serasaProvider: CreditProvider = {
  name: 'Serasa Experian',
  
  async checkCPF(cpf: string): Promise<CreditCheckResult> {
    console.log('[Serasa] Checking CPF...');
    throw new Error('Serasa API key não configurada. Configure em Configurações > Integrações.');
  },
};
