export interface SignatureDocumentData {
  title: string;
  content?: string;
  fileUrl?: string;
  signers: { name: string; email: string; cpf?: string }[];
  contratoId: string;
}

export interface SignatureResult {
  provider: string;
  documentId: string;
  signUrl: string;
  status: 'pending' | 'signed' | 'cancelled' | 'expired';
  createdAt: string;
}

export interface SignatureStatusResult {
  provider: string;
  documentId: string;
  status: 'pending' | 'signed' | 'cancelled' | 'expired';
  signedAt?: string;
  signers: { name: string; email: string; signed: boolean; signedAt?: string }[];
}

export interface SignatureProvider {
  name: string;
  createDocument(data: SignatureDocumentData): Promise<SignatureResult>;
  getStatus(documentId: string): Promise<SignatureStatusResult>;
}
