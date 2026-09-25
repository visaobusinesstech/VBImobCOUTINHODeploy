# Dashboard de Leads & Vendas (/leads-sales → Dashboard)

## Paleta de Cores

- Primária: #131B2D (tema padrão)
- Azul (ações/gráficos): #3B82F6, #6366F1
- Verde (sucesso): #10B981
- Vermelho (erro/perda): #EF4444
- Âmbar (eficiência): #F59E0B
- Texto: #0F172A, Secundário #64748B
- Fundo cards: #FFFFFF, Bordas #E2E8F0, Fundo página #F8FAFC

Equivalências:
- RGB: calcule conforme necessário (ex.: #3B82F6 → rgb(59,130,246))
- RGBA para fills: opacidades entre 0.08–0.15
- HSL aprox.: #3B82F6 → hsl(211, 90%, 60%)

## Espaçamentos

- Cards: padding 16px, gap entre cards 16px
- Linhas de gráficos: margin-bottom 6–8px no título
- Grid: 12 colunas responsivas

## Tipografia

- Família: sistema/MUI padrão (“Plus Jakarta Sans” quando disponível)
- Títulos KPI: 24px/700
- Subtítulos: 13–14px/500
- Auxiliares: 11–12px/400

## Bordas e Elevações

- Borda: 1px sólido #E2E8F0
- Raio: 12px
- Sombra: 0 2px 8px rgba(2,6,23,0.06)

## Componentes

1. Cartões KPI
   - “Total de Leads”, “Total de Vendas”, “Eficiência”, “Leads Ganhos”, “Leads Perdidos”
   - Ícones Material-UI consistentes
   - Badge de ícone com fundo colorido a 15% de opacidade
2. Gráficos (Chart.js via react-chartjs-2)
   - Receita por Dia: linha com fill (indigo a 12%)
   - Clientes x Valor: barras agrupadas (indigo: leads; azul: valor)
   - Ranking de Responsáveis: barra horizontal (azul)
   - Conversão por Origem: doughnut (canais do contato)

## Responsividade

- Breakpoints: 320, 768, 1024, 1440, 1920
- Layout dos KPIs: xs=12, md=4, lg=2 (quebra controlada)
- Gráficos: linha 1 (7/5 colunas), linha 2 (7/5 colunas)

## Dados Reais

Endpoint: GET /leads-sales/dashboard

Parâmetros: status, responsibleId, contactId, dateStart, dateEnd

Retorno:
```json
{
  "summary": { "totalLeads": 0, "leadsWon": 0, "leadsLost": 0, "totalSales": 0, "efficiency": 0 },
  "revenuePerDay": [{ "date": "YYYY-MM-DD", "revenue": 0 }],
  "clientsValueByDay": [{ "date": "YYYY-MM-DD", "leads": 0, "value": 0 }],
  "rankingResponsibles": [{ "id": 1, "name": "Fulano", "leads": 0, "value": 0 }],
  "conversionByOrigin": [{ "origin": "whatsapp", "won": 0 }]
}
```

## Teste de Regressão Visual

Script (backend): `npm run visual:leads`  
Requer: variável `FRONTEND_URL` e Chrome em `CHROME_PATH` opcional.  
Gera screenshots para viewports 320/768/1024/1440/1920 sob o diretório raiz.

## Observações

- “Total de Vendas” e “Receita por Dia” consideram leads com status de ganho/fechado.
- “Conversão por Origem” usa `contact.channel` quando disponível; caso contrário “indefinido”.

