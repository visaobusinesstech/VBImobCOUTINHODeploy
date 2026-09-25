import type { SignatureProvider, SignatureDocumentData, SignatureResult, SignatureStatusResult } from '../types/signature';

export const autentiqueProvider: SignatureProvider = {
  name: 'Autentique',
  
  async createDocument(data: SignatureDocumentData): Promise<SignatureResult> {
    console.log('[Autentique] Creating document:', data.title);
    // Integration via edge function - calls Autentique API
    throw new Error('Autentique API key não configurada. Configure em Configurações > Integrações.');
  },
  
  async getStatus(documentId: string): Promise<SignatureStatusResult> {
    console.log('[Autentique] Getting status:', documentId);
    throw new Error('Autentique API key não configurada.');
  },
};
