import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Download, ShieldCheck, ShieldX, Ban, RotateCcw, MessageCircle, ExternalLink } from "lucide-react";

type Cons = {
  id: string;
  telefone: string;
  telefone_norm: string;
  nome_contato: string | null;
  email: string | null;
  status: string;
  canal_origem: string;
  origem_referencia: string | null;
  termo_versao: string | null;
  aceito_em: string | null;
  revogado_em: string | null;
  motivo_revogacao: string | null;
  created_at: string;
  token_publico: string;
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  ativo: "bg-emerald-100 text-emerald-800",
  revogado: "bg-red-100 text-red-800",
  bloqueado: "bg-slate-200 text-slate-800",
  expirado: "bg-slate-100 text-slate-700",
};

export default function WhatsappConsentimentos() {
  const { imobiliariaId } = useAuth();
  const [rows, setRows] = useState<Cons[]>([]);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [nTelefone, setNTelefone] = useState("");
  const [nNome, setNNome] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    if (!imobiliariaId) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_consentimentos")
      .select("id, telefone, telefone_norm, nome_contato, email, status, canal_origem, origem_referencia, termo_versao, aceito_em, revogado_em, motivo_revogacao, created_at, token_publico")
      .eq("imobiliaria_id", imobiliariaId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as any) || []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, [imobiliariaId]);

  const filtrado = useMemo(() => {
    return rows.filter(r => {
      if (statusFiltro !== "todos" && r.status !== statusFiltro) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (r.nome_contato?.toLowerCase().includes(b)) ||
               (r.telefone?.toLowerCase().includes(b)) ||
               (r.email?.toLowerCase().includes(b));
      }
      return true;
    });
  }, [rows, busca, statusFiltro]);

  const kpis = useMemo(() => ({
    total: rows.length,
    ativo: rows.filter(r => r.status === "ativo").length,
    pendente: rows.filter(r => r.status === "pendente").length,
    revogado: rows.filter(r => r.status === "revogado").length,
    bloqueado: rows.filter(r => r.status === "bloqueado").length,
  }), [rows]);

  async function atualizarStatus(id: string, novo: string, motivo?: string) {
    const patch: any = { status: novo };
    if (novo === "revogado") { patch.revogado_em = new Date().toISOString(); patch.revogado_por = "admin_backoffice"; patch.motivo_revogacao = motivo || "Revogado no back-office"; }
    if (novo === "bloqueado") { patch.revogado_em = new Date().toISOString(); patch.revogado_por = "admin_backoffice"; patch.motivo_revogacao = motivo || "Bloqueado no back-office"; }
    if (novo === "ativo") { patch.aceito_em = new Date().toISOString(); patch.revogado_em = null; patch.revogado_por = null; patch.motivo_revogacao = null; }
    const { error } = await supabase.from("whatsapp_consentimentos").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado");
    carregar();
  }

  function copiarLinkTitular(token: string) {
    const url = `${window.location.origin}/consentimento/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link do portal do titular copiado");
  }

  function exportarCSV() {
    const header = ["telefone","nome","email","status","canal","termo_versao","criado_em","aceito_em","revogado_em","motivo_revogacao","link_titular"];
    const linhas = filtrado.map(r => [
      r.telefone, r.nome_contato || "", r.email || "", r.status, r.canal_origem, r.termo_versao || "",
      r.created_at, r.aceito_em || "", r.revogado_em || "", r.motivo_revogacao || "",
      `${window.location.origin}/consentimento/${r.token_publico}`,
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv = "\uFEFF" + header.join(",") + "\n" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `whatsapp-consentimentos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function cadastrarManual() {
    if (!imobiliariaId || !nTelefone) { toast.error("Telefone obrigatório"); return; }
    setSalvando(true);
    const { error } = await supabase.from("whatsapp_consentimentos").insert({
      imobiliaria_id: imobiliariaId,
      telefone: nTelefone,
      telefone_norm: nTelefone.replace(/\D/g, "").slice(-13),
      token_publico: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
      nome_contato: nNome || null,
      email: nEmail || null,
      status: "ativo",
      canal_origem: "crm_corretor",
      origem_referencia: "cadastro_manual_backoffice",
      finalidades: ["comunicacao_transacional", "marketing_imobiliario"],
      termo_versao: "1.0",
      aceito_em: new Date().toISOString(),
    } as any);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consentimento cadastrado (aceite verbal registrado)");
    setNovoOpen(false); setNTelefone(""); setNNome(""); setNEmail("");
    carregar();
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-semibold">Consentimentos WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Opt-in, opt-out e auditoria LGPD</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCSV}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
          <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
            <DialogTrigger asChild><Button>+ Registrar aceite manual</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar aceite verbal / presencial</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Telefone (com DDD)" value={nTelefone} onChange={e => setNTelefone(e.target.value)} />
                <Input placeholder="Nome" value={nNome} onChange={e => setNNome(e.target.value)} />
                <Input placeholder="E-mail (opcional)" value={nEmail} onChange={e => setNEmail(e.target.value)} />
                <p className="text-xs text-muted-foreground">Ao registrar, você declara que obteve consentimento explícito do titular. O ato é auditado com seu usuário e timestamp.</p>
                <Button onClick={cadastrarManual} disabled={salvando} className="w-full">Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Total", kpis.total, "bg-slate-100"],
          ["Ativos", kpis.ativo, "bg-emerald-100"],
          ["Pendentes", kpis.pendente, "bg-amber-100"],
          ["Revogados", kpis.revogado, "bg-red-100"],
          ["Bloqueados", kpis.bloqueado, "bg-slate-200"],
        ].map(([label, val, cls]) => (
          <Card key={label as string}>
            <CardContent className={`p-4 ${cls}`}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-semibold">{val as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Buscar por nome, telefone ou e-mail" value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="revogado">Revogados</SelectItem>
                <SelectItem value="bloqueado">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Termo</TableHead>
                    <TableHead>Registrado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrado.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.nome_contato || "—"}</div>
                        {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.telefone}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge></TableCell>
                      <TableCell className="text-xs">{r.canal_origem}<br /><span className="text-muted-foreground">{r.origem_referencia}</span></TableCell>
                      <TableCell className="text-xs">v{r.termo_versao || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => copiarLinkTitular(r.token_publico)} title="Copiar link do titular"><Copy className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" asChild title="Abrir portal do titular"><a href={`/consentimento/${r.token_publico}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
                          {r.status !== "ativo" && <Button size="icon" variant="ghost" onClick={() => atualizarStatus(r.id, "ativo")} title="Reativar"><RotateCcw className="h-4 w-4 text-emerald-600" /></Button>}
                          {r.status === "ativo" && <Button size="icon" variant="ghost" onClick={() => atualizarStatus(r.id, "revogado")} title="Revogar"><ShieldX className="h-4 w-4 text-red-600" /></Button>}
                          {r.status !== "bloqueado" && <Button size="icon" variant="ghost" onClick={() => atualizarStatus(r.id, "bloqueado", "Bloqueio administrativo")} title="Bloquear"><Ban className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtrado.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhum consentimento encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />Como funciona</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Todo envio para <b>mensagens_whatsapp</b> é <b>bloqueado no banco</b> se não houver consentimento <b>ativo</b>.</p>
          <p>• Mensagens de entrada com palavras-chave <b>SAIR, PARAR, CANCELAR, DESCADASTRAR</b> revogam automaticamente o consentimento (via webhook).</p>
          <p>• Cada titular tem uma URL única <code>/consentimento/&#123;token&#125;</code> para consultar, revogar e exportar seus dados.</p>
          <p>• Todo evento (opt-in, envio, bloqueio, revogação, reativação) é registrado em log auditável imutável.</p>
        </CardContent>
      </Card>
    </div>
  );
}
