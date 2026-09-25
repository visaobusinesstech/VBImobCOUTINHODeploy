import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Wand2, Save, Search } from "lucide-react";

interface Row {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  slug: string | null;
  meta_description: string | null;
  conteudo: any;
}

function slugify(s: string) {
  return (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

function currentTags(c: any): string[] {
  const t = c?.tags;
  if (Array.isArray(t)) return t.map(String);
  return [];
}

export function EdicaoMassaPostsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [search, setSearch] = useState("");

  // bulk fields
  const [tituloPrefix, setTituloPrefix] = useState("");
  const [tituloSuffix, setTituloSuffix] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [regenSlug, setRegenSlug] = useState(true);
  const [metaDesc, setMetaDesc] = useState("");
  const [aplicarMeta, setAplicarMeta] = useState(false);
  const [tagsAdd, setTagsAdd] = useState("");
  const [tagsRemove, setTagsRemove] = useState("");
  const [tagsReplace, setTagsReplace] = useState("");
  const [modoTags, setModoTags] = useState<"none" | "add" | "remove" | "replace">("none");

  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("conteudos_seo")
      .select("id,titulo,tipo,status,slug,meta_description,conteudo" as any)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setRows((data as any[]) as Row[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const tipos = useMemo(() => Array.from(new Set(rows.map(r => r.tipo))), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (filterTipo === "todos" || r.tipo === filterTipo) &&
      (filterStatus === "todos" || r.status === filterStatus) &&
      (!q || r.titulo.toLowerCase().includes(q) || (r.slug || "").toLowerCase().includes(q))
    );
  }, [rows, filterTipo, filterStatus, search]);

  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach(r => next.delete(r.id));
    else filtered.forEach(r => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const buildUpdate = (r: Row) => {
    const updates: any = {};
    let novoTitulo = r.titulo;
    if (findText) novoTitulo = novoTitulo.split(findText).join(replaceText);
    if (tituloPrefix) novoTitulo = `${tituloPrefix}${novoTitulo}`;
    if (tituloSuffix) novoTitulo = `${novoTitulo}${tituloSuffix}`;
    if (novoTitulo !== r.titulo) updates.titulo = novoTitulo;

    if (regenSlug && (novoTitulo !== r.titulo || !r.slug)) {
      updates.slug = slugify(novoTitulo);
    }

    if (aplicarMeta) updates.meta_description = metaDesc || null;

    if (modoTags !== "none") {
      const base = currentTags(r.conteudo);
      let novas = base;
      if (modoTags === "add") {
        const add = tagsAdd.split(",").map(s => s.trim()).filter(Boolean);
        novas = Array.from(new Set([...base, ...add]));
      } else if (modoTags === "remove") {
        const rm = new Set(tagsRemove.split(",").map(s => s.trim()).filter(Boolean));
        novas = base.filter(t => !rm.has(t));
      } else if (modoTags === "replace") {
        novas = tagsReplace.split(",").map(s => s.trim()).filter(Boolean);
      }
      updates.conteudo = { ...(r.conteudo || {}), tags: novas };
    }
    return updates;
  };

  const previewFirst = filtered.find(r => selected.has(r.id));
  const preview = previewFirst ? buildUpdate(previewFirst) : null;

  const aplicar = async () => {
    if (selected.size === 0) { toast({ title: "Selecione ao menos um post", variant: "destructive" }); return; }
    const alvos = rows.filter(r => selected.has(r.id));
    setSaving(true); setProgress(0);
    let ok = 0, fail = 0;
    for (let i = 0; i < alvos.length; i++) {
      const r = alvos[i];
      const upd = buildUpdate(r);
      if (Object.keys(upd).length === 0) { ok++; setProgress(Math.round(((i + 1) / alvos.length) * 100)); continue; }
      const { error } = await supabase.from("conteudos_seo").update(upd).eq("id", r.id);
      if (error) fail++; else ok++;
      setProgress(Math.round(((i + 1) / alvos.length) * 100));
    }
    setSaving(false);
    toast({
      title: "Edição em massa concluída",
      description: `${ok} atualizados, ${fail} falhas.`,
      variant: fail > 0 ? "destructive" : "default",
    });
    setSelected(new Set());
    fetchRows();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Wand2 className="w-5 h-5" /> Edição em massa</CardTitle>
          <CardDescription>Atualize título, slug, meta description e tags de vários posts de uma vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7" value={search} onChange={e => setSearch(e.target.value)} placeholder="Título ou slug" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={fetchRows} className="gap-1.5 w-full">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Posts ({filtered.length}) — Selecionados: {selected.size}</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className={selected.has(r.id) ? "bg-muted/40" : ""}>
                      <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} /></TableCell>
                      <TableCell className="max-w-[260px] truncate font-medium">{r.titulo}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{r.slug || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                      <TableCell><Badge variant={r.status === "publicado" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-xs">{currentTags(r.conteudo).slice(0, 3).join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações em lote</CardTitle>
            <CardDescription>Serão aplicadas aos {selected.size} posts selecionados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Título</Label>
              <Input placeholder="Prefixo (opcional)" value={tituloPrefix} onChange={e => setTituloPrefix(e.target.value)} />
              <Input placeholder="Sufixo (opcional)" value={tituloSuffix} onChange={e => setTituloSuffix(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Buscar" value={findText} onChange={e => setFindText(e.target.value)} />
                <Input placeholder="Substituir" value={replaceText} onChange={e => setReplaceText(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="regen" checked={regenSlug} onCheckedChange={v => setRegenSlug(!!v)} />
              <Label htmlFor="regen" className="text-sm cursor-pointer">Regenerar slug a partir do novo título</Label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="ameta" checked={aplicarMeta} onCheckedChange={v => setAplicarMeta(!!v)} />
                <Label htmlFor="ameta" className="text-xs font-semibold uppercase text-muted-foreground cursor-pointer">Meta description</Label>
              </div>
              <Textarea rows={3} value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder="Nova meta description (máx. 160 caracteres recomendado)" disabled={!aplicarMeta} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Tags</Label>
              <Select value={modoTags} onValueChange={(v: any) => setModoTags(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não alterar</SelectItem>
                  <SelectItem value="add">Adicionar</SelectItem>
                  <SelectItem value="remove">Remover</SelectItem>
                  <SelectItem value="replace">Substituir todas</SelectItem>
                </SelectContent>
              </Select>
              {modoTags === "add" && <Input placeholder="tag1, tag2" value={tagsAdd} onChange={e => setTagsAdd(e.target.value)} />}
              {modoTags === "remove" && <Input placeholder="tag1, tag2" value={tagsRemove} onChange={e => setTagsRemove(e.target.value)} />}
              {modoTags === "replace" && <Input placeholder="tag1, tag2, tag3" value={tagsReplace} onChange={e => setTagsReplace(e.target.value)} />}
            </div>

            {preview && (
              <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-1">
                <p className="font-semibold text-muted-foreground uppercase">Preview (1º selecionado)</p>
                {preview.titulo && <p><b>Título:</b> {preview.titulo}</p>}
                {preview.slug && <p><b>Slug:</b> {preview.slug}</p>}
                {"meta_description" in preview && <p><b>Meta:</b> {preview.meta_description || "(vazio)"}</p>}
                {preview.conteudo && <p><b>Tags:</b> {(preview.conteudo.tags || []).join(", ") || "(vazio)"}</p>}
                {Object.keys(preview).length === 0 && <p className="text-muted-foreground">Nenhuma alteração configurada.</p>}
              </div>
            )}

            {saving && <Progress value={progress} />}

            <Button onClick={aplicar} disabled={saving || selected.size === 0} className="w-full gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Aplicar a {selected.size} post{selected.size === 1 ? "" : "s"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
