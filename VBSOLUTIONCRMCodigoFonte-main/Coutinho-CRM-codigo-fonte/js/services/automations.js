/**
 * Motor de Automações e Alertas
 * Registra tarefas e históricos sem disparar mensagens externas não autorizadas
 */
import { db } from '../state/db.js';

export const automationEngine = {
  checkTriggers() {
    const automations = db.get('automations').filter(a => a.active);
    const notifications = [];

    automations.forEach(auto => {
      if (auto.trigger === 'LEAD_PARADO_3_DIAS') {
        const staleLeads = db.get('clients').filter(c => {
          if (!c.lastContactAt) return false;
          const diffDays = Math.floor((new Date() - new Date(c.lastContactAt)) / (1000 * 60 * 60 * 24));
          return diffDays >= auto.delayDays;
        });

        staleLeads.forEach(lead => {
          notifications.push({
            id: `notif_${auto.id}_${lead.id}`,
            title: `Follow-up Pendente: ${lead.name}`,
            message: `Lead parado há mais de ${auto.delayDays} dias. Região: ${lead.interestRegion}`,
            type: 'WARNING',
            targetUrl: `#/crm?client=${lead.id}`,
            createdAt: new Date().toISOString()
          });
        });
      }

      if (auto.trigger === 'CONTRATO_VENCENDO_30_DIAS') {
        const contracts = db.get('contracts').filter(c => {
          if (!c.endDate || c.status !== 'ATIVO') return false;
          const diffDays = Math.floor((new Date(c.endDate) - new Date()) / (1000 * 60 * 60 * 24));
          return diffDays > 0 && diffDays <= auto.delayDays;
        });

        contracts.forEach(contract => {
          notifications.push({
            id: `notif_ctr_${contract.id}`,
            title: `Contrato a Vencer: ${contract.contractNumber}`,
            message: `Contrato de R$ ${contract.totalValue.toLocaleString('pt-BR')} encerra em breve.`,
            type: 'INFO',
            targetUrl: `#/contracts`,
            createdAt: new Date().toISOString()
          });
        });
      }
    });

    return notifications;
  }
};
