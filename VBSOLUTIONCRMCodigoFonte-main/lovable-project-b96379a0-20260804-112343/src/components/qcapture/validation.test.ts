import { expect, test, describe } from "vitest";

// Simulação das funções de validação do componente
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
const isValidPhone = (value: string) => value.replace(/\D/g, "").length >= 10;
const isGenericName = (nome: string) => {
  const normalized = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /^(anuncio|proprietario|direto|particular|imovel|contato|vendedor|dono)$/i.test(normalized);
};

describe("Validação de Proprietário (Captação)", () => {
  test("Deve rejeitar nomes genéricos ou muito curtos", () => {
    const nomesInvalidos = ["Dono", "Proprietário", "Anúncio", "Jo", "Particular"];
    nomesInvalidos.forEach(nome => {
      const invalido = !nome || nome.length < 3 || isGenericName(nome);
      if (!invalido) {
        throw new Error(`Falhou ao rejeitar: ${nome}. isGenericName: ${isGenericName(nome)}, length: ${nome.length}`);
      }
      expect(invalido).toBe(true);
    });
  });

  test("Deve aceitar nomes válidos", () => {
    const nomesValidos = ["João da Silva", "Maria Oliveira", "Carlos Alberto"];
    nomesValidos.forEach(nome => {
      const invalido = !nome || nome.length < 3 || isGenericName(nome);
      expect(invalido).toBe(false);
    });
  });

  test("Deve validar e-mails corretamente", () => {
    expect(isValidEmail("teste@gmail.com")).toBe(true);
    expect(isValidEmail("joao.silva@empresa.com.br")).toBe(true);
    
    expect(isValidEmail("email_invalido")).toBe(false);
    expect(isValidEmail("email@semdomino")).toBe(false);
    expect(isValidEmail("@semusuario.com")).toBe(false);
  });

  test("Deve validar telefones corretamente", () => {
    expect(isValidPhone("(61) 98888-7777")).toBe(true);
    expect(isValidPhone("61988887777")).toBe(true);
    
    expect(isValidPhone("12345")).toBe(false); // Muito curto
    expect(isValidPhone("abc")).toBe(false); // Não numérico
  });

  test("Deve detectar telefones com sequências inválidas (ex: 00, 11)", () => {
    const isSuspiciousPhone = (telefone: string) => {
      const digits = telefone.replace(/\D/g, "");
      return /^(00|11|22|33|44|55|66|77|88|99)/.test(digits.substring(2, 4));
    };

    expect(isSuspiciousPhone("610099998888")).toBe(true);
    expect(isSuspiciousPhone("611199998888")).toBe(true);
    expect(isSuspiciousPhone("61988887777")).toBe(false);
  });
});
