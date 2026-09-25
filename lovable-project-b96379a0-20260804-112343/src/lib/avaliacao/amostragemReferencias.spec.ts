import { describe, it, expect } from "vitest";
import { aplicarAmostragem, type ConfigAmostragem } from "./amostragemReferencias";

describe("Lógica de Amostragem de Referências (NBR 14.653)", () => {
  const imovelAlvo = {
    titulo: "Apartamento Teste",
    tipo: "Apartamento",
    bairro: "Águas Claras",
    area: 100,
    preco: 1000000,
  };

  const comparaveis = [
    { id: "1", titulo: "Comp 1 - Perfeito", tipo: "Apartamento", bairro: "Águas Claras", area: 100, preco: 1000000, operacao: "Venda" },
    { id: "2", titulo: "Comp 2 - Área Fora (+50%)", tipo: "Apartamento", bairro: "Águas Claras", area: 151, preco: 1500000, operacao: "Venda" },
    { id: "3", titulo: "Comp 3 - Bairro Diferente", tipo: "Apartamento", bairro: "Sudoeste", area: 100, preco: 1200000, operacao: "Venda" },
    { id: "4", titulo: "Comp 4 - Tipo Diferente", tipo: "Casa", bairro: "Águas Claras", area: 100, preco: 1300000, operacao: "Venda" },
    { id: "5", titulo: "Comp 5 - Forçada Manual", tipo: "Apartamento", bairro: "Taguatinga", area: 50, preco: 500000, operacao: "Venda", forcada: true },
  ];

  it("deve filtrar por bairro quando configurado", () => {
    const config: Partial<ConfigAmostragem> = { somenteMesmoBairro: true };
    const resultado = aplicarAmostragem(comparaveis, imovelAlvo, config);
    
    // Devem sobrar: 1, 2, 4 (mesmo bairro) e 5 (forcada)
    // Mas 4 é tipo diferente, 2 é área diferente... espera, o filtro é incremental.
    // SomenteMesmoBairro true: descarta o '3'.
    const ids = resultado.selecionados.map(c => c.id);
    expect(ids).toContain("1");
    expect(ids).toContain("5"); // Forçada sempre entra
    expect(ids).not.toContain("3");
  });

  it("deve filtrar por tipo quando configurado", () => {
    const config: Partial<ConfigAmostragem> = { somenteMesmoTipo: true };
    const resultado = aplicarAmostragem(comparaveis, imovelAlvo, config);
    
    const ids = resultado.selecionados.map(c => c.id);
    expect(ids).toContain("1");
    expect(ids).toContain("5");
    expect(ids).not.toContain("4"); // Casa vs Apartamento
  });

  it("deve respeitar a tolerância de área", () => {
    const config: Partial<ConfigAmostragem> = { toleranciaAreaPct: 30 };
    const resultado = aplicarAmostragem(comparaveis, imovelAlvo, config);
    
    const ids = resultado.selecionados.map(c => c.id);
    expect(ids).toContain("1");
    expect(ids).toContain("5");
    expect(ids).not.toContain("2"); // 151m² > 130m² (30% de 100)
  });

  it("deve priorizar por similaridade (score área + R$/m²)", () => {
    const compsSimilaridade = [
      { id: "a", area: 110, preco: 1100000, operacao: "Venda" }, // R$ 10k/m² (Idêntico ao alvo)
      { id: "b", area: 100, preco: 1200000, operacao: "Venda" }, // R$ 12k/m² (+20%)
    ];
    // Garantir que os filtros não removam as referências de teste (desligando filtros padrão da AMOSTRAGEM_PADRAO)
    const config: Partial<ConfigAmostragem> = { 
      criterio: "similaridade",
      somenteMesmoBairro: false,
      somenteMesmoTipo: false,
      toleranciaAreaPct: 0
    };
    const resultado = aplicarAmostragem(compsSimilaridade, imovelAlvo, config);
    expect(resultado.selecionados.length).toBeGreaterThan(0);
    expect(resultado.selecionados[0].id).toBe("a"); // Mais similar no pm2 e área combinados
  });

  it("deve aplicar penalidade pesada (+5) para bairros diferentes no score de similaridade", () => {
    const imovelNoBairro = { ...imovelAlvo, bairro: "Asa Sul", area: 100, preco: 1000000 };
    const comps = [
      { id: "mesmo-bairro", bairro: "Asa Sul", area: 150, preco: 1500000, operacao: "Venda" }, // Área bem diferente (+50%)
      { id: "bairro-dif", bairro: "Sobradinho", area: 100, preco: 1000000, operacao: "Venda" }, // Mesma área, mas bairro longe
    ];

    const config: Partial<ConfigAmostragem> = { 
      criterio: "similaridade",
      somenteMesmoBairro: false, // Desliga o filtro para testar a penalidade no score
      somenteMesmoTipo: false,
      toleranciaAreaPct: 0
    };

    const resultado = aplicarAmostragem(comps, imovelNoBairro, config);
    
    // O imóvel do mesmo bairro deve ganhar mesmo tendo área pior,
    // porque a penalidade de bairro (+5) é muito maior que o desvio de área (0.5 * 2 = 1.0)
    expect(resultado.selecionados[0].id).toBe("mesmo-bairro");
    
    // Validar diagnóstico se presente
    if (resultado.diagnosticoSelecao) {
      const diagBairroDif = resultado.diagnosticoSelecao.find(d => d.id === "bairro-dif");
      expect(diagBairroDif?.componentes.bairro).toBe(5);
      
      const diagMesmoBairro = resultado.diagnosticoSelecao.find(d => d.id === "mesmo-bairro");
      expect(diagMesmoBairro?.componentes.bairro).toBe(0);
    }
  });

  it("referências forçadas devem ignorar todos os filtros", () => {
    const config: Partial<ConfigAmostragem> = { 
      somenteMesmoBairro: true, 
      somenteMesmoTipo: true, 
      toleranciaAreaPct: 10 
    };
    const resultado = aplicarAmostragem(comparaveis, imovelAlvo, config);
    
    const ids = resultado.selecionados.map(c => c.id);
    expect(ids).toContain("5"); // Taguatinga, 50m², mas é forcada
  });

  describe("Casos de Borda e Estabilidade", () => {
    it("deve incluir imóveis exatamente no limite de tolerância (30%)", () => {
      const imovelComArea = { ...imovelAlvo, area: 100 };
      const compsBorda = [
        { id: "limite-sup", area: 130, preco: 1300000, operacao: "Venda" }, // +30%
        { id: "limite-inf", area: 70, preco: 700000, operacao: "Venda" },   // -30%
        { id: "fora", area: 130.1, preco: 1301000, operacao: "Venda" },     // >30%
      ];
      
      const config: Partial<ConfigAmostragem> = { 
        toleranciaAreaPct: 30,
        somenteMesmoBairro: false,
        somenteMesmoTipo: false
      };
      
      const resultado = aplicarAmostragem(compsBorda, imovelComArea, config);
      const ids = resultado.selecionados.map(c => c.id);
      
      expect(ids).toContain("limite-sup");
      expect(ids).toContain("limite-inf");
      expect(ids).not.toContain("fora");
    });

    it("deve lidar estavelmente com imóveis sem preço ou área (zero ou null)", () => {
      const compsInvalidos = [
        { id: "sem-preco", area: 100, preco: 0, operacao: "Venda" },
        { id: "sem-area", area: 0, preco: 1000000, operacao: "Venda" },
        { id: "valido", area: 100, preco: 1000000, operacao: "Venda" }
      ];
      
      const config: Partial<ConfigAmostragem> = { 
        criterio: "similaridade",
        somenteMesmoBairro: false,
        somenteMesmoTipo: false,
        toleranciaAreaPct: 0
      };
      const resultado = aplicarAmostragem(compsInvalidos, imovelAlvo, config);
      
      // Não deve quebrar e deve priorizar o válido
      expect(resultado.selecionados.length).toBeGreaterThan(0);
      expect(resultado.selecionados[0].id).toBe("valido");
    });

    it("deve garantir estabilidade quando houver menos resultados que o tamanho da amostra", () => {
      const poucosComps = [
        { id: "1", area: 100, preco: 1000000, operacao: "Venda" }
      ];
      
      const config: Partial<ConfigAmostragem> = { 
        tamanho: 10,
        somenteMesmoBairro: false,
        somenteMesmoTipo: false,
        toleranciaAreaPct: 0
      };
      const resultado = aplicarAmostragem(poucosComps, imovelAlvo, config);
      
      expect(resultado.selecionados.length).toBe(1);
    });

    it("deve normalizar textos para comparação de bairros (acentos e caixa)", () => {
      const imovelBairro = { ...imovelAlvo, bairro: "Águas Claras" };
      const compsBairro = [
        { id: "match", bairro: "aguas claras", area: 100, preco: 1000000, operacao: "Venda" },
        { id: "match2", bairro: "ÁGUAS CLARAS", area: 100, preco: 1000000, operacao: "Venda" }
      ];
      
      const config: Partial<ConfigAmostragem> = { somenteMesmoBairro: true, somenteMesmoTipo: false };
      const resultado = aplicarAmostragem(compsBairro, imovelBairro, config);
      
      expect(resultado.selecionados.length).toBe(2);
    });
  });

  describe("Benchmarks de Performance", () => {
    it("deve processar volumes crescentes de referências (1.000, 5.000 e 20.000) em tempo hábil", () => {
      const imovelAlvoBench = {
        titulo: "Alvo Benchmark",
        tipo: "Apartamento",
        bairro: "Águas Claras",
        area: 100,
        preco: 1000000,
      };

      const gerarVolume = (n: number) => Array.from({ length: n }, (_, i) => ({
        id: `bench-${n}-${i}`,
        titulo: `Imóvel Bench ${i}`,
        bairro: i % 2 === 0 ? "Águas Claras" : "Sudoeste",
        tipo: i % 3 === 0 ? "Apartamento" : "Casa",
        area: 50 + (i % 100),
        preco: 500000 + (i * 100),
        operacao: "Venda",
        dias_anuncio: i % 30
      }));

      const tamanhos = [1000, 5000, 20000];
      const config: ConfigAmostragem = {
        tamanho: 10,
        criterio: "similaridade",
        somenteMesmoBairro: true,
        somenteMesmoTipo: true,
        toleranciaAreaPct: 30
      };

      tamanhos.forEach(n => {
        const volume = gerarVolume(n);
        const start = performance.now();
        const resultado = aplicarAmostragem(volume, imovelAlvoBench, config);
        const end = performance.now();
        const duration = end - start;

        console.log(`Benchmark (${n} itens): ${duration.toFixed(2)}ms`);
        
        expect(resultado.selecionados.length).toBeLessThanOrEqual(10);
        // Para 20k, esperamos que seja rápido o suficiente (< 200ms) devido ao cache de scores e normalização
        expect(duration).toBeLessThan(n > 5000 ? 200 : 100);
      });
    });
  });
});
