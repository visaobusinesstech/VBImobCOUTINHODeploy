import { useCallback, useState } from "react";

import { useToast } from "@/hooks/use-toast";
import { getContratoSignedUrl, type ResolveContratoFileOptions } from "@/lib/contratosStorage";
import {
  buildContratoOfficePreviewUrl,
  getContratoFileName,
  getContratoFilePreviewKind,
  type ContratoFilePreviewKind,
} from "@/lib/contratoFilePreview";

export interface ContratoViewerFile {
  source: string;
  url: string | null;
  name: string;
  previewKind: ContratoFilePreviewKind;
  officePreviewUrl: string | null;
}

interface ContratoFileViewerState {
  open: boolean;
  loading: boolean;
  file: ContratoViewerFile | null;
}

const initialState: ContratoFileViewerState = {
  open: false,
  loading: false,
  file: null,
};

export function useContratoFileViewer() {
  const { toast } = useToast();
  const [viewerState, setViewerState] = useState<ContratoFileViewerState>(initialState);

  const closeContratoFileViewer = useCallback(() => {
    setViewerState(initialState);
  }, []);

  const openContratoFileViewer = useCallback(
    async (pathOrUrl: string, fallbackName?: string, resolveOptions?: ResolveContratoFileOptions) => {
      if (!pathOrUrl) {
        toast({
          title: "Arquivo indisponível",
          description: "Nenhum arquivo foi encontrado para visualização.",
          variant: "destructive",
        });
        return false;
      }

      const previewKind = getContratoFilePreviewKind(pathOrUrl);
      const name = getContratoFileName(pathOrUrl, fallbackName || "arquivo");

      setViewerState({
        open: true,
        loading: true,
        file: {
          source: pathOrUrl,
          url: null,
          name,
          previewKind,
          officePreviewUrl: null,
        },
      });

      try {
        const resolvedUrl = await getContratoSignedUrl(pathOrUrl, resolveOptions);

        if (!resolvedUrl) {
          throw new Error("Não foi possível gerar o link do arquivo.");
        }

        setViewerState({
          open: true,
          loading: false,
          file: {
            source: pathOrUrl,
            url: resolvedUrl,
            name,
            previewKind,
            officePreviewUrl: previewKind === "office" ? buildContratoOfficePreviewUrl(resolvedUrl) : null,
          },
        });

        return true;
      } catch (error: any) {
        setViewerState(initialState);
        toast({
          title: "Erro ao abrir arquivo",
          description: error?.message || "Não foi possível visualizar o arquivo agora.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast],
  );

  return {
    viewerState,
    openContratoFileViewer,
    closeContratoFileViewer,
  };
}
