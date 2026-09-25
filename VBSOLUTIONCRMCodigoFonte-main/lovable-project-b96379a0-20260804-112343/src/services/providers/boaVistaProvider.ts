import type { CreditProvider, CreditCheckResult } from '../types/credit';

export const boaVistaProvider: CreditProvider = {
  name: 'Boa Vista SCPC',
  
  async checkCPF(cpf: string): Promise<CreditCheckResult> {
    console.log('[BoaVista] Checking CPF...');
    throw new Error('Boa Vista API key não configurada. Configure em Configurações > Integrações.');
  },
};
