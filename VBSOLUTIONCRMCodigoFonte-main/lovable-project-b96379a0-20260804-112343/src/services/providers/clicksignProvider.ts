import type { SignatureProvider, SignatureDocumentData, SignatureResult, SignatureStatusResult } from '../types/signature';

export const clicksignProvider: SignatureProvider = {
  name: 'Clicksign',
  
  async createDocument(data: SignatureDocumentData): Promise<SignatureResult> {
    console.log('[Clicksign] Creating document:', data.title);
    throw new Error('Clicksign API key não configurada. Configure em Configurações > Integrações.');
  },
  
  async getStatus(documentId: string): Promise<SignatureStatusResult> {
    console.log('[Clicksign] Getting status:', documentId);
    throw new Error('Clicksign API key não configurada.');
  },
};
