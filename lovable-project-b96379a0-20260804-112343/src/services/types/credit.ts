export interface CreditCheckResult {
  provider: string;
  score: number;
  status: 'approved' | 'rejected' | 'pending' | 'error';
  restrictions: string[];
  consultedAt: string;
}

export interface CreditConsolidatedResult {
  consolidatedScore: number;
  status: 'approved' | 'rejected' | 'pending';
  results: CreditCheckResult[];
  worstScore: number;
  checkedProviders: string[];
  failedProviders: string[];
  consultedAt: string;
}

export interface CreditProvider {
  name: string;
  checkCPF(cpf: string): Promise<CreditCheckResult>;
}
