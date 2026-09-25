import { useMemo } from "react";
import { CheckCircle2, AlertCircle, FileText, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ChecklistItem {
  key: string;
  label: string;
  /** field name(s) to check on the form — truthy = done */
  fields: string[];
  /** 'file' checks url fields, 'data' checks string/number fields, 'bool' checks boolean */
  type: "file" | "data" | "bool";
  required: boolean;
}

const CHECKLIST_LOCACAO: ChecklistItem[] = [
  { key: "contrato_anexo", label: "Contrato assinado (PDF)", fields: ["contrato_anexo_url"], type: "file", required: true },
  { key: "vistoria_entrada", label: "Vistoria de entrada", fields: ["vistoria_entrada"], type: "bool", required: true },
  { key: "vistoria_anexo", label: "Laudo de vistoria (anexo)", fields: ["vistoria_anexo_url"], type: "file", required: true },
  { key: "apolice_seguro", label: "Apólice de seguro", fields: ["apolice_seguro"], type: "bool", required: true },
  { key: "apolice_anexo", label: "Apólice (anexo PDF)", fields: ["apolice_anexo_url"], type: "file", required: true },
  { key: "seguro_incendio", label: "Seguro incêndio (anexo)", fields: ["seguro_incendio_anexo_url"], type: "file", required: true },
  { key: "inquilino_cpf", label: "CPF do inquilino", fields: ["inquilino_cpf"], type: "data", required: true },
  { key: "inquilino_telefone", label: "Telefone do inquilino", fields: ["inquilino_telefone"], type: "data", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietario_cpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietario_telefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricao_iptu"], type: "data", required: false },
  { key: "numero_agua", label: "Número conta de água", fields: ["numero_agua"], type: "data", required: false },
  { key: "numero_luz", label: "Número conta de luz", fields: ["numero_luz"], type: "data", required: false },
  { key: "seguro_fianca", label: "Seguro fiança (anexo)", fields: ["seguro_fianca_anexo_url"], type: "file", required: false },
  { key: "caucao_comprovante", label: "Comprovante de caução", fields: ["caucao_comprovante_url"], type: "file", required: false },
  { key: "aditivo", label: "Aditivo contratual", fields: ["aditivo_anexo_url"], type: "file", required: false },
  { key: "vistoria_video", label: "Vistoria em vídeo", fields: ["vistoria_video"], type: "bool", required: false },
  { key: "vistoria_video_url", label: "Vídeo de vistoria (anexo)", fields: ["vistoria_video_url"], type: "file", required: false },
];

const CHECKLIST_VENDA: ChecklistItem[] = [
  { key: "contrato_anexo", label: "Contrato de venda (PDF)", fields: ["contrato_anexo_url"], type: "file", required: true },
  { key: "cliente_cpf", label: "CPF do comprador", fields: ["cliente_cpf"], type: "data", required: true },
  { key: "cliente_telefone", label: "Telefone do comprador", fields: ["cliente_telefone"], type: "data", required: true },
  { key: "cliente_email", label: "E-mail do comprador", fields: ["cliente_email"], type: "data", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietario_cpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietario_telefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricao_iptu"], type: "data", required: false },
  { key: "comissao", label: "Comissão definida", fields: ["comissao_percentual", "comissao_valor"], type: "data", required: true },
  { key: "aditivo", label: "Aditivo contratual", fields: ["aditivo_anexo_url"], type: "file", required: false },
];

const CHECKLIST_ADMINISTRACAO: ChecklistItem[] = [
  { key: "contrato_anexo", label: "Contrato de administração (PDF)", fields: ["contrato_anexo_url"], type: "file", required: true },
  { key: "proprietario_cpf", label: "CPF do proprietário", fields: ["proprietario_cpf"], type: "data", required: true },
  { key: "proprietario_telefone", label: "Telefone do proprietário", fields: ["proprietario_telefone"], type: "data", required: true },
  { key: "matricula", label: "Matrícula do imóvel", fields: ["matricula"], type: "data", required: true },
  { key: "inscricao_iptu", label: "Inscrição IPTU", fields: ["inscricao_iptu"], type: "data", required: false },
  { key: "numero_agua", label: "Número conta de água", fields: ["numero_agua"], type: "data", required: false },
  { key: "numero_luz", label: "Número conta de luz", fields: ["numero_luz"], type: "data", required: false },
  { key: "apolice_seguro", label: "Apólice de seguro", fields: ["apolice_seguro"], type: "bool", required: false },
  { key: "apolice_anexo", label: "Apólice (anexo PDF)", fields: ["apolice_anexo_url"], type: "file", required: false },
  { key: "comissao", label: "Comissão definida", fields: ["comissao_percentual", "comissao_valor"], type: "data", required: true },
];

function getChecklistForType(tipo: string): ChecklistItem[] {
  switch (tipo) {
    case "Locação": return CHECKLIST_LOCACAO;
    case "Venda":
    case "Exclusividade": return CHECKLIST_VENDA;
    case "Administração": return CHECKLIST_ADMINISTRACAO;
    default: return CHECKLIST_VENDA;
  }
}

function isItemDone(item: ChecklistItem, form: Record<string, any>): boolean {
  return item.fields.some((field) => {
    const val = form[field];
    if (item.type === "bool") return val === true;
    if (item.type === "file") return typeof val === "string" && val.length > 5;
    // data
    if (typeof val === "number") return val > 0;
    return typeof val === "string" && val.trim().length > 0;
  });
}

interface Props {
  tipo: string;
  form: Record<string, any>;
}

export function ContratoDocChecklist({ tipo, form }: Props) {
  const checklist = useMemo(() => getChecklistForType(tipo), [tipo]);

  const results = useMemo(() => {
    return checklist.map((item) => ({
      ...item,
      done: isItemDone(item, form),
    }));
  }, [checklist, form]);

  const requiredItems = results.filter((r) => r.required);
  const optionalItems = results.filter((r) => !r.required);
  const doneCount = results.filter((r) => r.done).length;
  const requiredDoneCount = requiredItems.filter((r) => r.done).length;
  const requiredMissing = requiredItems.filter((r) => !r.done);
  const progress = results.length > 0 ? Math.round((doneCount / results.length) * 100) : 0;
  const requiredProgress = requiredItems.length > 0 ? Math.round((requiredDoneCount / requiredItems.length) * 100) : 100;

  const allRequiredDone = requiredMissing.length === 0;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Checklist de Documentação</span>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {tipo}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {allRequiredDone ? (
            <Badge className="bg-success/15 text-success border-success/25 text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3" /> Completo
            </Badge>
          ) : (
            <Badge className="bg-warning/15 text-warning border-warning/25 text-[10px] gap-1">
              <AlertCircle className="h-3 w-3" /> {requiredMissing.length} pendente{requiredMissing.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Progresso geral</span>
          <span>{doneCount}/{results.length} ({progress}%)</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Required missing alert */}
      {requiredMissing.length > 0 && (
        <div className="rounded-lg bg-destructive/5 border border-destructive/15 p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Documentos obrigatórios pendentes
          </p>
          <ul className="space-y-1">
            {requiredMissing.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-[11px] text-destructive/80">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive/50 flex-shrink-0" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required items */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Obrigatórios ({requiredDoneCount}/{requiredItems.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {requiredItems.map((item) => (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                item.done
                  ? "bg-success/5 text-success"
                  : "bg-destructive/5 text-muted-foreground"
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-destructive/50 flex-shrink-0" />
              )}
              <span className={item.done ? "line-through opacity-70" : ""}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional items */}
      {optionalItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Opcionais ({optionalItems.filter((i) => i.done).length}/{optionalItems.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {optionalItems.map((item) => (
              <div
                key={item.key}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                  item.done
                    ? "bg-success/5 text-success"
                    : "bg-muted/50 text-muted-foreground"
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                )}
                <span className={item.done ? "line-through opacity-70" : ""}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
