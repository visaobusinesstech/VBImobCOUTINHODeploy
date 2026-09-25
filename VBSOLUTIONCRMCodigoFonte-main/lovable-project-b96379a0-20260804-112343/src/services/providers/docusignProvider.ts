import type { SignatureProvider, SignatureDocumentData, SignatureResult, SignatureStatusResult } from '../types/signature';

export const docusignProvider: SignatureProvider = {
  name: 'DocuSign',
  
  async createDocument(data: SignatureDocumentData): Promise<SignatureResult> {
    console.log('[DocuSign] Creating document:', data.title);
    throw new Error('DocuSign API key não configurada. Configure em Configurações > Integrações.');
  },
  
  async getStatus(documentId: string): Promise<SignatureStatusResult> {
    console.log('[DocuSign] Getting status:', documentId);
    throw new Error('DocuSign API key não configurada.');
  },
};
