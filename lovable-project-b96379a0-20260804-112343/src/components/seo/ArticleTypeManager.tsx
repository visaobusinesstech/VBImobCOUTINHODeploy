
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2, FileText, Globe, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export function ArticleTypeManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imobiliariaId, setImobiliariaId] = useState<string | null>(null);

  const [newType, setNewType] = useState({
    name: "",
    description: "",
    prompt_template: "",
    use_serper: false
  });

  useEffect(() => {
    async function fetchConfig() {
      if (!user) return;
      const { data } = await supabase
        .from("imobiliaria_config")
        .select("id")
        .maybeSingle();
      
      if (data) {
        setImobiliariaId(data.id);
        fetchTypes(data.id);
      }
    }
    fetchConfig();
  }, [user]);

  const fetchTypes = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("article_types")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast({ title: "Erro ao buscar modelos", description: error.message, variant: "destructive" });
    } else {
      setTypes(data || []);
    }
    setLoading(false);
  };

  const handleAddType = async () => {
    if (!imobiliariaId) return;
    if (!newType.name || !newType.prompt_template) {
      toast({ title: "Campos obrigatórios", description: "Nome e template são necessários.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("article_types")
      .insert({
        ...newType,
        imobiliaria_id: imobiliariaId
      });

    if (error) {
      toast({ title: "Erro ao adicionar modelo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Modelo adicionado!", description: "Tipo de artigo salvo com sucesso." });
      setNewType({ name: "", description: "", prompt_template: "", use_serper: false });
      fetchTypes(imobiliariaId);
    }
    setSaving(false);
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este modelo?")) return;

    const { error } = await supabase
      .from("article_types")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setTypes(types.filter(t => t.id !== id));
      toast({ title: "Modelo removido" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Novo Modelo de Prompt</CardTitle>
          <CardDescription>Configure como a IA deve escrever seus artigos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Modelo (ex: Notícia Local)</Label>
            <Input 
              value={newType.name} 
              onChange={e => setNewType({...newType, name: e.target.value})} 
              placeholder="Ex: Guia de Bairro"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição Curta</Label>
            <Input 
              value={newType.description} 
              onChange={e => setNewType({...newType, description: e.target.value})} 
              placeholder="Ex: Artigo focado em dicas de localização"
            />
          </div>
          <div className="space-y-2">
            <Label>Prompt Customizado (Instruções)</Label>
            <Textarea 
              value={newType.prompt_template} 
              onChange={e => setNewType({...newType, prompt_template: e.target.value})} 
              placeholder="Descreva detalhadamente como a IA deve agir e o que deve priorizar..."
              rows={5}
            />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Globe className="w-4 h-4 text-primary" /> Usar Inteligência Serper
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Busca informações atualizadas na web antes de escrever.
              </p>
            </div>
            <Switch 
              checked={newType.use_serper}
              onCheckedChange={v => setNewType({...newType, use_serper: v})}
            />
          </div>
          <Button onClick={handleAddType} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Modelo
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Modelos de Prompt (Article Types)</CardTitle>
          <CardDescription>Personalize o estilo de escrita dos seus posts</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : types.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum modelo customizado cadastrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Serper</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map(type => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{type.description || 'Sem descrição'}</div>
                    </TableCell>
                    <TableCell>
                      {type.use_serper ? (
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <Globe className="w-3 h-3" /> Ativo
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Desativado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
