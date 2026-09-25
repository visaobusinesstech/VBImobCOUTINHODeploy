/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 */

import {
  DEFAULT_CONTRATO_FILE_ACCEPT,
  VIDEO_CONTRATO_FILE_ACCEPT,
  getContratoFileExtension,
  getContratoFileName,
  getContratoFilePreviewKind,
  getSafeFileExtension,
} from "./contratoFilePreview";

describe("contratoFilePreview", () => {
  it("identifica PDFs privados para preview interno", () => {
    expect(getContratoFilePreviewKind("private::contratos::abc123/contrato_assinado.pdf")).toBe("pdf");
  });

  it("extrai nome do arquivo ignorando querystring", () => {
    expect(
      getContratoFileName(
        "https://files.example.com/storage/v1/object/sign/contratos/abc123/doc.docx?token=123"
      )
    ).toBe("doc.docx");
  });

  it("identifica documentos office e extensão segura", () => {
    expect(getContratoFileExtension("abc/analise.docx")).toBe("docx");
    expect(getContratoFilePreviewKind("abc/analise.docx")).toBe("office");
    expect(getSafeFileExtension({ name: "vistoria", type: "video/mp4" })).toBe("mp4");
  });

  it("reconhece imagem, vídeo e texto em caminhos privados ou URLs legadas", () => {
    expect(
      getContratoFilePreviewKind(
        "https://files.example.com/storage/v1/object/sign/contratos/abc123/foto.jpeg?token=123"
      )
    ).toBe("image");
    expect(getContratoFilePreviewKind("private::contratos::abc123/vistoria.mov")).toBe("video");
    expect(getContratoFilePreviewKind("abc123/comprovantes/recibo.csv")).toBe("text");
  });

  it("mantém a lista de formatos aceitos alinhada aos previews suportados", () => {
    expect(DEFAULT_CONTRATO_FILE_ACCEPT).toContain(".xlsx");
    expect(DEFAULT_CONTRATO_FILE_ACCEPT).toContain(".json");
    expect(DEFAULT_CONTRATO_FILE_ACCEPT).toContain(".webp");
    expect(VIDEO_CONTRATO_FILE_ACCEPT).toContain(".ogg");
  });
});
