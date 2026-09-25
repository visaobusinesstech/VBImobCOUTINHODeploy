import {
  assumeHumanDisabledReason,
  canAssumeHumanOnTicket,
  ticketAiAgentIsResponding,
  whatsappHasConnectionAgent,
} from "./ticketAiAgentPreview";

describe("ticketAiAgentPreview — Assumir humano", () => {
  it("whatsappHasConnectionAgent: prompt ou multi-agente, respeita agentDisabled", () => {
    expect(whatsappHasConnectionAgent(null)).toBe(false);
    expect(whatsappHasConnectionAgent({ promptId: 1 })).toBe(true);
    expect(whatsappHasConnectionAgent({ anthropicMultiAgentId: 9 })).toBe(true);
    expect(
      whatsappHasConnectionAgent({ promptId: 1, agentDisabled: true })
    ).toBe(false);
  });

  it("ticketAiAgentIsResponding", () => {
    expect(ticketAiAgentIsResponding({ isBot: true })).toBe(true);
    expect(ticketAiAgentIsResponding({ useIntegration: true })).toBe(true);
    expect(ticketAiAgentIsResponding({ isBot: false, useIntegration: false })).toBe(
      false
    );
  });

  it("canAssumeHumanOnTicket só com agente na conexão e IA ativa no ticket", () => {
    expect(
      canAssumeHumanOnTicket({
        isBot: true,
        whatsapp: { promptId: 3 },
      })
    ).toBe(true);
    expect(
      canAssumeHumanOnTicket({
        isBot: true,
        whatsapp: { agentDisabled: true, promptId: 3 },
      })
    ).toBe(false);
    expect(
      canAssumeHumanOnTicket({
        isBot: false,
        useIntegration: false,
        whatsapp: { promptId: 3 },
      })
    ).toBe(false);
  });

  it("assumeHumanDisabledReason", () => {
    expect(
      assumeHumanDisabledReason({
        isBot: true,
        whatsapp: { agentDisabled: true },
      })
    ).toMatch(/não habilitado/i);
    expect(
      assumeHumanDisabledReason({
        isBot: false,
        useIntegration: false,
        whatsapp: { promptId: 1 },
      })
    ).toMatch(/não está respondendo/i);
  });
});
