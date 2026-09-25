import { useState } from "react";
import { Loader2, Shield, FileSignature, CheckCircle, XCircle, AlertTriangle, ExternalLink, User, Copy, Clock, BadgeCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Contrato } from "@/hooks/useContratos";

interface Props {
  contrato: Contrato;
}

type StepStatus = "idle" | "loading" | "success" | "error";

interface CreditResult {
  success?: boolean;
  simulated?: boolean;
  message?: string;
  providers?: string[];
  results?: { provider: string; score: number; status: string; restrictions: string[] }[];
  score?: number | null;
  riskLevel?: string;
  status?: string;
  restrictions?: string[];
  cpfMasked?: string;
  consultedAt?: string;
  error?: string;
}

interface SignatureResult {
  success?: boolean;
  simulated?: boolean;
  message?: string;
  providers?: string[];
  activeProvider?: string;
  documentId?: string | null;
  signUrl?: string | null;
  signers?: { name: string; email: string; signed: boolean; signUrl?: string }[];
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  error?: string;
}

const ScoreGaugeSmall = ({ score }: { score: number }) => {
  const pct = Math.min(100, Math.max(0, ((score - 300) / 600) * 100));
  const color = score >= 700 ? "text-success" : score >= 500 ? "text-warning" : "text-destructive";
  const bgColor = score >= 700 ? "bg-success" : score >= 500 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${bgColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xl font-bold ${color} min-w-[50px] text-right`}>{score}</span>
    </div>
  );
};

export function ContratoServicesPanel({ contrato }: Props) {
  const { toast } = useToast();
  const [creditStatus, setCreditStatus] = useState<StepStatus>("idle");
  const [creditResult, setCreditResult] = useState<CreditResult | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<StepStatus>("idle");
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [signerEmails, setSignerEmails] = useState<Record<number, string>>({});

  const cpf = contrato.inquilino_cpf || contrato.proprietario_cpf || "";
  const hasRestrictions = (creditResult?.restrictions?.length ?? 0) > 0;
  const restrictionStatusLabel = hasRestrictions ? "SIM, CPF COM RESTRIÇÃO" : "NÃO, CPF SEM RESTRIÇÃO";
  const restrictionStatusDescription = hasRestrictions
    ? `${creditResult?.restrictions?.length ?? 0} pendência(s) encontrada(s) nos bureaus de crédito`
    : "Nenhuma pendência encontrada nos bureaus de crédito consultados";

  const handleCreditCheck = async () => {
    if (!cpf) {
      toast({ title: "CPF não informado", description: "Preencha o CPF do inquilino ou proprietário no contrato.", variant: "destructive" });
      return;
    }
    if (!lgpdConsent) {
      toast({ title: "Consentimento LGPD necessário", description: "Marque o consentimento antes de prosseguir.", variant: "destructive" });
      return;
    }
    setCreditStatus("loading");
    setCreditResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("credit-check", {
        body: { cpf, contratoId: contrato.id },
      });
      if (error) {
        // supabase-js v2 wraps non-2xx as FunctionsHttpError — extract the JSON body
        let msg = error.message;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) {
        setCreditResult({ error: data.error });
        setCreditStatus("error");
        return;
      }
      setCreditResult(data);
      setCreditStatus("success");
      if (data?.success) setActiveStep(1);
    } catch (err: any) {
      setCreditResult({ error: err.message });
      setCreditStatus("error");
      toast({ title: "Erro na consulta de crédito", description: err.message, variant: "destructive" });
    }
  };

  const handleSignature = async () => {
    setSignatureStatus("loading");
    setSignatureResult(null);
    try {
      const signers = [
        { name: contrato.cliente, email: signerEmails[0] || "" },
        ...(contrato.proprietario ? [{ name: contrato.proprietario, email: signerEmails[1] || "" }] : []),
        ...(contrato.inquilino ? [{ name: contrato.inquilino, email: signerEmails[2] || "" }] : []),
      ];
      const { data, error } = await supabase.functions.invoke("signature-digital", {
        body: { action: "create", contratoId: contrato.id, title: contrato.titulo, signers },
      });
      if (error) {
        let msg = error.message;
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
            msg = body?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) {
        setSignatureResult({ error: data.error });
        setSignatureStatus("error");
        return;
      }
      setSignatureResult(data);
      setSignatureStatus("success");
      if (data?.success) {
        toast({ title: "Documento de assinatura criado!", description: `ID: ${data.documentId}` });
      }
    } catch (err: any) {
      setSignatureResult({ error: err.message });
      setSignatureStatus("error");
      toast({ title: "Erro na assinatura digital", description: err.message, variant: "destructive" });
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const steps = [
    { label: "Restrição CPF", icon: ShieldAlert, done: creditStatus === "success" },
    { label: "Revisão", icon: AlertTriangle, done: activeStep >= 1 },
    { label: "Assinatura", icon: FileSignature, done: signatureStatus === "success" },
  ];

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4 p-4 rounded-xl bg-secondary/20 border border-border">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Shield className="w-4 h-4 text-primary" />
        Serviços Jurídicos e Crédito
      </p>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === i;
          const isDone = step.done;
          return (
            <div key={step.label} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setActiveStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all w-full justify-center ${
                  isDone
                    ? "bg-success/10 text-success border border-success/20"
                    : isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-secondary/50 text-muted-foreground border border-transparent"
                }`}
              >
                {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {step.label}
              </button>
              {i < steps.length - 1 && <div className="w-4 h-px bg-border flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 0: Crédito — em breve */}
      {activeStep === 0 && (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Clock className="w-3 h-3" /> Atualização futura
            </Badge>
            <p className="text-sm font-semibold text-foreground">Consulta de CPF em breve</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              A consulta de restrição e score do CPF (SPC, Boa Vista e Serasa) será liberada em uma próxima atualização.
            </p>
            <button
              onClick={() => setActiveStep(1)}
              className="mt-2 px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              Pular para revisão →
            </button>
          </div>
        </div>
      )}


      {/* Step 1: Revisão */}
      {activeStep === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Revise os dados do contrato antes de enviar para assinatura digital.</p>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Título", value: contrato.titulo },
              { label: "Cliente", value: contrato.cliente },
              { label: "Tipo", value: contrato.tipo },
              { label: "Valor", value: formatCurrency(contrato.valor) },
              ...(contrato.proprietario ? [{ label: "Proprietário", value: contrato.proprietario }] : []),
              ...(contrato.inquilino ? [{ label: "Inquilino", value: contrato.inquilino }] : []),
              ...(contrato.data_inicio ? [{ label: "Início", value: new Date(contrato.data_inicio + "T00:00:00").toLocaleDateString("pt-BR") }] : []),
              ...(contrato.data_fim ? [{ label: "Término", value: new Date(contrato.data_fim + "T00:00:00").toLocaleDateString("pt-BR") }] : []),
            ].map((item, i) => (
              <div key={i} className="p-2 rounded-lg bg-secondary/30">
                <p className="text-muted-foreground">{item.label}</p>
                <p className="font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          {creditResult?.success && (
            <div className="p-2 rounded-lg bg-success/5 border border-success/20 text-xs flex items-center gap-2 text-success">
              <ShieldCheck className="w-3.5 h-3.5" />
              Crédito validado — Score: {creditResult.score} ({creditResult.riskLevel})
            </div>
          )}

          {/* Signers email */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">E-mails dos signatários (para notificação):</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground w-24 flex-shrink-0">{contrato.cliente}</span>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={signerEmails[0] || ""}
                  onChange={(e) => setSignerEmails(prev => ({ ...prev, 0: e.target.value }))}
                  className="h-7 text-xs"
                />
              </div>
              {contrato.proprietario && (
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground w-24 flex-shrink-0 truncate">{contrato.proprietario}</span>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={signerEmails[1] || ""}
                    onChange={(e) => setSignerEmails(prev => ({ ...prev, 1: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>
              )}
              {contrato.inquilino && (
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground w-24 flex-shrink-0 truncate">{contrato.inquilino}</span>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={signerEmails[2] || ""}
                    onChange={(e) => setSignerEmails(prev => ({ ...prev, 2: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setActiveStep(2)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <FileSignature className="w-4 h-4" />
            Prosseguir para Assinatura
          </button>
        </div>
      )}

      {/* Step 2: Assinatura */}
      {activeStep === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Envie o contrato para assinatura digital com validade jurídica via ICP-Brasil.
            Fallback automático: Autentique → Clicksign → DocuSign.
          </p>

          <button
            onClick={handleSignature}
            disabled={signatureStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {signatureStatus === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Criando documento para assinatura...</>
            ) : (
              <><FileSignature className="w-4 h-4" />Enviar para Assinatura Digital</>
            )}
          </button>

          {/* Signature Result */}
          {signatureResult && !signatureResult.error && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-success" />
                    <span className="text-xs font-medium text-foreground">Documento Criado</span>
                  </div>
                  {signatureResult.simulated && <Badge variant="outline" className="text-[10px]">Simulado</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">ID Documento</p>
                    <p className="font-mono font-medium text-foreground flex items-center gap-1">
                      {signatureResult.documentId}
                      <button onClick={() => copyText(signatureResult.documentId || "")}>
                        <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Provedor</p>
                    <p className="font-medium text-foreground">{signatureResult.activeProvider}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {signatureResult.status === "pending" ? "⏳ Aguardando assinaturas" : signatureResult.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium text-foreground">
                      {signatureResult.createdAt ? new Date(signatureResult.createdAt).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                </div>

                {/* Signers */}
                {signatureResult.signers && signatureResult.signers.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border">
                    <p className="text-[10px] font-medium text-muted-foreground">Signatários:</p>
                    {signatureResult.signers.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-1.5 rounded bg-secondary/30">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-foreground">{s.name}</span>
                          {s.email && <span className="text-[10px] text-muted-foreground">({s.email})</span>}
                        </div>
                        <Badge variant={s.signed ? "default" : "outline"} className="text-[9px]">
                          {s.signed ? "✅ Assinado" : "⏳ Pendente"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {signatureResult.signUrl && (
                  <a href={signatureResult.signUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir documento para assinatura
                  </a>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">{signatureResult.message}</p>
            </div>
          )}

          {signatureResult?.error && (
            <div className="p-3 rounded-lg border-destructive/20 border bg-destructive/5 flex items-center gap-2 text-xs text-destructive">
              <XCircle className="w-4 h-4" />
              {signatureResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
