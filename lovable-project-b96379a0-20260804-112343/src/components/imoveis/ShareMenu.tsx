import { Share2, MessageCircle, Facebook, Instagram, Copy, ExternalLink, Music, Twitter, Linkedin, Send, Link } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getShareCurrentUrl, getShareUrl, getOgShareUrl } from "@/lib/publicUrl";

interface ShareMenuProps {
  id?: string;
  titulo: string;
  preco: number;
  operacao: string;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  quartos: number;
  area: number;
  fotos: string[];
}

const formatPreco = (preco: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(preco);

function cleanTitulo(titulo: string, fallback = "Imóvel"): string {
  let clean = titulo
    .replace(/\s*[-–]\s*(DFimoveis\.com|DFImóveis|OLX|ZAP\s*Im[oó]veis|Viva\s*Real|W\s*Im[oó]veis|Chave\s*na\s*M[aã]o|Im[oó]veis\s*Web|Netim[oó]veis|imovelweb|QuintoAndar|Loft|123i).*$/i, "")
    .replace(/\s*[-–]\s*\S+\.(com|com\.br|net|net\.br)\s*$/i, "")
    .trim();
  return clean || fallback;
}

async function safeCopy(text: string): Promise<boolean> {
  // Try modern clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fallback */ }
  }
  // Fallback for mobile / non-HTTPS / older browsers
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function ShareMenu({ id, titulo, preco, operacao, endereco, bairro, cidade, quartos, area, fotos }: ShareMenuProps) {
  const { toast } = useToast();
  // Use OG URL for social sharing (crawlers get meta tags with cover image)
  const publicUrl = id ? getOgShareUrl(id) : getShareCurrentUrl();
  // Direct link for copy/paste (no redirect through edge function)
  const directUrl = id ? getShareUrl(`/imovel/${id}`) : getShareCurrentUrl();

  const local = [bairro, cidade].filter(Boolean).join(", ");
  const cleanedTitulo = cleanTitulo(titulo);
  const operacaoLabel = operacao === "Aluguel" ? "para alugar" : "à venda";
  const shareLines = [
    `🏠 ${cleanedTitulo} ${operacaoLabel}${quartos > 0 ? ` com ${quartos} quartos` : ""}${local ? ` em ${local}` : ""}`,
    `💰 ${formatPreco(preco)}${operacao === "Aluguel" ? "/mês" : ""}`,
    quartos > 0 ? `🛏 ${quartos} quartos` : null,
    area > 0 ? `📐 ${area}m²` : null,
    local ? `📍 ${local.toUpperCase()}` : null,
  ].filter(Boolean).join("\n");

  const text = [shareLines, publicUrl].filter(Boolean).join("\n");
  const textPlain = text;
  const shareLinesPlain = shareLines;

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, "_blank");
  };

  const shareInstagram = async () => {
    const ok = await safeCopy(textPlain);
    toast({ title: ok ? "Texto copiado!" : "Não foi possível copiar", description: ok ? "Cole no Instagram ao criar seu post." : "Copie manualmente o texto." });
    window.open("https://www.instagram.com/", "_blank");
  };

  const shareTikTok = async () => {
    const ok = await safeCopy(textPlain);
    toast({ title: ok ? "Texto copiado!" : "Não foi possível copiar", description: ok ? "Cole no TikTok ao criar seu vídeo." : "Copie manualmente o texto." });
    window.open("https://www.tiktok.com/upload", "_blank");
  };

  const shareTwitter = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(textPlain)}`, "_blank");
  };

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`, "_blank");
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(publicUrl)}&text=${encodeURIComponent(shareLinesPlain)}`, "_blank");
  };

  const copyText = async () => {
    const ok = await safeCopy(textPlain);
    toast({ title: ok ? "Texto copiado!" : "Erro ao copiar", description: ok ? undefined : "Não foi possível copiar para a área de transferência." });
  };

  const copyLink = async () => {
    const ok = await safeCopy(directUrl);
    toast({ title: ok ? "Link copiado!" : "Erro ao copiar", description: ok ? undefined : "Não foi possível copiar o link." });
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: shareLinesPlain, url: publicUrl });
        return;
      } catch { /* user cancelled or not supported */ }
    }
    // Fallback: copy text
    await copyText();
  };

  const shareOLX = () => window.open("https://www.olx.com.br/anunciar", "_blank");
  const shareZAP = () => window.open("https://www.zapimoveis.com.br/anunciar/", "_blank");
  const shareVivaReal = () => window.open("https://www.vivareal.com.br/anunciar/", "_blank");
  const shareDFImoveis = () => window.open("https://www.dfimoveis.com.br/", "_blank");
  const shareWImoveis = () => window.open("https://www.wimoveis.com.br/publicar", "_blank");
  const shareChaveNaMao = () => window.open("https://www.chavenamao.com.br/", "_blank");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-8 h-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Share2 className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-card border-border max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Compartilhar</DropdownMenuLabel>
        <DropdownMenuItem onClick={shareNative} className="gap-2 cursor-pointer">
          <Share2 className="w-4 h-4" /> Compartilhar…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTelegram} className="gap-2 cursor-pointer">
          <Send className="w-4 h-4 text-blue-400" /> Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareFacebook} className="gap-2 cursor-pointer">
          <Facebook className="w-4 h-4 text-blue-500" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareInstagram} className="gap-2 cursor-pointer">
          <Instagram className="w-4 h-4 text-pink-500" /> Instagram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTikTok} className="gap-2 cursor-pointer">
          <Music className="w-4 h-4 text-foreground" /> TikTok
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareTwitter} className="gap-2 cursor-pointer">
          <Twitter className="w-4 h-4 text-foreground" /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareLinkedIn} className="gap-2 cursor-pointer">
          <Linkedin className="w-4 h-4 text-blue-600" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyText} className="gap-2 cursor-pointer">
          <Copy className="w-4 h-4" /> Copiar texto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink} className="gap-2 cursor-pointer">
          <Link className="w-4 h-4" /> Copiar link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Portais Imobiliários</DropdownMenuLabel>
        <DropdownMenuItem onClick={shareOLX} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> OLX
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareZAP} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> ZAP Imóveis
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareVivaReal} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> Viva Real
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareDFImoveis} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> DF Imóveis
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareWImoveis} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> W Imóveis
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareChaveNaMao} className="gap-2 cursor-pointer">
          <ExternalLink className="w-4 h-4" /> Chave na Mão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
