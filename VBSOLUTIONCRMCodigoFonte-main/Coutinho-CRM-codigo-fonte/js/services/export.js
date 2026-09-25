/**
 * Exportadores (Relatório PDF / Impressão / Backup)
 */
import { db } from '../state/db.js';
import { toCurrency, toNumber, calculateEvaluation, getEvaluationNarrative, calculatePremiumEvaluation } from './evaluation.js';

export const exportService = {
  printEvaluationReport(evaluationId) {
    const evaluation = db.getById('evaluations', evaluationId);
    if (!evaluation) {
      alert('Avaliação não encontrada para geração de relatório.');
      return;
    }

    const settings = db.data.settings;
    const broker = db.getById('users', evaluation.brokerId) || db.data.users[0];
    const stats = calculateEvaluation(evaluation.propertyArea, evaluation.comparables || []);
    const narrative = getEvaluationNarrative(evaluation);

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Laudo Mercadológico - ${evaluation.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0b1d3a;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand h1 {
            margin: 0;
            font-size: 20px;
            color: #0b1d3a;
            letter-spacing: -0.5px;
          }
          .brand p {
            margin: 2px 0 0 0;
            color: #64748b;
            font-size: 11px;
            font-weight: 500;
          }
          .badge {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
            color: #0b1d3a;
          }
          .title-section {
            background: #0b1d3a;
            color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 24px;
          }
          .title-section h2 {
            margin: 0 0 8px 0;
            font-size: 18px;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            background: #ffffff;
          }
          .card h3 {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: #0b1d3a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
          }
          .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px dashed #f1f5f9;
          }
          .metric-row:last-child { border-bottom: none; }
          .price-banner {
            background: #f8fafc;
            border: 2px solid #0b1d3a;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            margin: 20px 0;
          }
          .price-banner h4 {
            margin: 0 0 4px 0;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
          }
          .price-banner .price {
            font-size: 26px;
            font-weight: 800;
            color: #0b1d3a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background: #f1f5f9;
            color: #0b1d3a;
            font-weight: 600;
          }
          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .disclaimer {
            font-size: 10px;
            color: #64748b;
            max-width: 60%;
          }
          .signature-box {
            text-align: center;
            border-top: 1px solid #0b1d3a;
            width: 200px;
            padding-top: 6px;
            font-size: 11px;
            font-weight: 600;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <h1>COUTINHO IMÓVEIS</h1>
            <p>Consultoria & Gestão Imobiliária · CRECI ${settings.creciJ}</p>
          </div>
          <div class="badge">PARECER MERCADOLÓGICO</div>
        </div>

        <div class="title-section">
          <h2>${evaluation.title}</h2>
          <div>Endereço: <strong>${evaluation.propertyAddress}</strong></div>
          <div style="margin-top: 4px; opacity: 0.9; font-size: 12px;">Proprietário / Solicitante: ${evaluation.clientOwner} | Data de Emissão: ${new Date(evaluation.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3>Características do Imóvel</h3>
            <div class="metric-row"><span>Área Privativa:</span> <strong>${toNumber(evaluation.propertyArea)} m²</strong></div>
            <div class="metric-row"><span>Quartos / Suítes:</span> <strong>${evaluation.bedrooms} quartos (${evaluation.suites} suítes)</strong></div>
            <div class="metric-row"><span>Vagas de Garagem:</span> <strong>${evaluation.parkingSpots} vagas</strong></div>
            <div class="metric-row"><span>Estado de Conservação:</span> <strong>${evaluation.conservationState}</strong></div>
          </div>

          <div class="card">
            <h3>Indicadores Estatísticos</h3>
            <div class="metric-row"><span>Comparáveis Analisados:</span> <strong>${stats.count} imóveis</strong></div>
            <div class="metric-row"><span>Preço Médio por m²:</span> <strong>${toCurrency(stats.averagePriceM2)}</strong></div>
            <div class="metric-row"><span>Mediana do m²:</span> <strong>${toCurrency(stats.medianPriceM2)}</strong></div>
            <div class="metric-row"><span>Faixa de Mercado:</span> <strong>${toCurrency(stats.minPriceM2)} a ${toCurrency(stats.maxPriceM2)}/m²</strong></div>
          </div>
        </div>

        <div class="price-banner">
          <h4>Valor Recomendado para Comercialização</h4>
          <div class="price">${toCurrency(evaluation.idealSalePrice || stats.idealSalePrice)}</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">
            Preço estratégico de anúncio sugerido: <strong>${toCurrency(evaluation.strategicListingPrice || stats.strategicListingPrice)}</strong>
          </div>
        </div>

        ${evaluation.adjNotes || evaluation.adjPercent || evaluation.adjExtraParking || evaluation.adjOther || evaluation.adjOverride ? `
        <div class="card" style="margin-bottom: 20px;">
          <h3>Ajustes Aplicados pelo Corretor</h3>
          ${evaluation.adjPercent ? `<div class="metric-row"><span>Ajuste de padrão / reforma:</span> <strong>${evaluation.adjPercent > 0 ? '+' : ''}${evaluation.adjPercent}%</strong></div>` : ''}
          ${evaluation.adjExtraParking ? `<div class="metric-row"><span>Vagas extras:</span> <strong>${evaluation.adjExtraParking} × ${toCurrency(evaluation.adjParkingValue || 0)}</strong></div>` : ''}
          ${evaluation.adjOther ? `<div class="metric-row"><span>Outros ajustes:</span> <strong>${toCurrency(evaluation.adjOther)}</strong></div>` : ''}
          ${evaluation.adjOverride ? `<div class="metric-row"><span>Valor final definido manualmente:</span> <strong>${toCurrency(evaluation.adjOverride)}</strong></div>` : ''}
          ${evaluation.adjNotes ? `<p style="margin: 10px 0 0 0; font-size: 12px;"><strong>Justificativa:</strong> ${evaluation.adjNotes}</p>` : ''}
        </div>` : ''}

        <div class="card" style="margin-bottom: 20px;">
          <h3>Amostragem de Imóveis Comparáveis</h3>
          <table>
            <thead>
              <tr>
                <th>Endereço do Comparável</th>
                <th>Área (m²)</th>
                <th>Quartos</th>
                <th>Vagas</th>
                <th>Valor Anunciado</th>
                <th>Valor / m²</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              ${(evaluation.comparables || []).map(comp => `
                <tr>
                  <td>${comp.address}</td>
                  <td>${toNumber(comp.area)} m²</td>
                  <td>${comp.bedrooms}</td>
                  <td>${comp.parking}</td>
                  <td>${toCurrency(comp.price)}</td>
                  <td><strong>${toCurrency(comp.priceM2)}</strong></td>
                  <td>${comp.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-bottom: 20px;">
          <h3>Análise e Estratégia Comercial</h3>
          <p style="margin: 0 0 8px 0;"><strong>Metodologia:</strong> ${narrative.methodology}</p>
          <p style="margin: 0 0 8px 0;"><strong>Diagnóstico:</strong> ${narrative.marketAnalysis}</p>
          <p style="margin: 0;"><strong>Posicionamento de Preço:</strong> ${narrative.pricingStrategy}</p>
        </div>

        <div class="footer">
          <div class="disclaimer">
            ${narrative.disclaimer}
            <br>Emitido pelo Coutinho CRM Imobiliário em ${new Date().toLocaleString('pt-BR')}.
          </div>
          <div class="signature-box">
            ${broker.name}<br>
            <span style="font-size: 10px; font-weight: normal; color: #475569;">CRECI ${broker.creci || 'CRECI-DF'}</span>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(reportHtml);
      printWin.document.close();
    } else {
      alert('Por favor, permita pop-ups para visualizar e imprimir o laudo em PDF.');
    }
  },

  exportDatabaseBackup() {
    const dataStr = JSON.stringify(db.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coutinho_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
