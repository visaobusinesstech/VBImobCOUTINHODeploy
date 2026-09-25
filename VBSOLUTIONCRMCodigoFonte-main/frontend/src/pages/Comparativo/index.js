/**
 * Copyright (c) Visão Business. Todos os direitos reservados.
 * VB Solution CRM — propriedade intelectual da Visão Business.
 * Uso conforme LICENSE na raiz do repositório.
 *
 * Comparativo de Imóveis — paridade visual/funcional com Lovable / Radarimobtech.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Plus,
  X,
  MapPin,
  Check,
  Minus,
  Loader2,
  Building2,
  Share2,
  ImageOff,
  FileDown,
} from "lucide-react";
import MainContainer from "../../components/MainContainer";
import realtyService from "../../services/realtyService";
import {
  formatBRL,
  imovelPurposeLabel,
  mediaUrl,
} from "../../helpers/realtyCrm";
import { exportComparativoPDF } from "../../helpers/exportComparativoPDF";
import toastError from "../../errors/toastError";

const MAX_COMPARE = 4;

function calcScore(im) {
  const area = Number(im.areaM2) || 0;
  return Math.min(
    100,
    Math.round(
      (Number(im.bedrooms) || 0) * 8 +
        (Number(im.suites) || 0) * 6 +
        (Number(im.bathrooms) || 0) * 5 +
        (Number(im.parkingSpots) || 0) * 7 +
        (area > 100 ? 15 : area > 60 ? 10 : 5) +
        (im.aceitaFinanciamento ? 10 : 0) +
        (im.aceitaFgts ? 8 : 0) +
        (im.exclusivo ? 5 : 0) +
        (im.temEscritura ? 10 : 0)
    )
  );
}

function getBestIndex(values, highlight) {
  if (!highlight) return -1;
  const nums = values.map((v) => (v != null && v !== "" ? Number(v) : NaN));
  const valid = nums.filter((n) => !Number.isNaN(n));
  if (!valid.length) return -1;
  const target = highlight === "max" ? Math.max(...valid) : Math.min(...valid);
  return nums.findIndex((n) => n === target);
}

function CompareRow({ label, values, type = "text", highlight, cols }) {
  const bestIdx = getBestIndex(values, highlight);
  return (
    <div
      className="realty-cmp-row"
      style={{ gridTemplateColumns: `180px repeat(${cols}, 1fr)` }}
    >
      <div className="realty-cmp-row__label">{label}</div>
      {values.map((val, i) => {
        const isBest = bestIdx === i && highlight;
        return (
          <div
            key={i}
            className={`realty-cmp-row__cell${isBest ? " is-best" : ""}`}
          >
            {type === "boolean" ? (
              val ? (
                <Check size={16} className="realty-cmp-check" />
              ) : (
                <Minus size={16} className="realty-cmp-minus" />
              )
            ) : type === "currency" ? (
              <span>
                {val != null && val !== "" && !Number.isNaN(Number(val))
                  ? formatBRL(val)
                  : "—"}
                {isBest ? " ✦" : ""}
              </span>
            ) : type === "area" ? (
              <span>
                {val != null && val !== "" ? `${val} m²` : "—"}
                {isBest ? " ✦" : ""}
              </span>
            ) : (
              <span>
                {val != null && val !== "" ? val : "—"}
                {isBest ? " ✦" : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreCell({ imovel }) {
  const score = calcScore(imovel);
  const tone =
    score >= 70 ? "is-good" : score >= 40 ? "is-mid" : "is-bad";
  return (
    <div className={`realty-cmp-score ${tone}`}>
      <strong>{score}</strong>
      <span>/100</span>
    </div>
  );
}

function coverUrl(im) {
  const imgs = im.images || [];
  if (!imgs.length) return null;
  const idx = Number(im.fotoCapaIndex) || 0;
  return mediaUrl(imgs[idx] || imgs[0]);
}

const Comparativo = () => {
  const [imoveis, setImoveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await realtyService.listImoveis({ pageSize: 200 });
      setImoveis(data.imoveis || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => imoveis.find((i) => String(i.id) === String(id)))
        .filter(Boolean),
    [selectedIds, imoveis]
  );

  const available = useMemo(
    () =>
      imoveis.filter(
        (i) =>
          i.status !== "inativo" &&
          i.status !== "vendido" &&
          !selectedIds.some((id) => String(id) === String(i.id))
      ),
    [imoveis, selectedIds]
  );

  const addImovel = (id) => {
    setSelectedIds((prev) => {
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.some((x) => String(x) === String(id))) return prev;
      const next = [...prev, id];
      if (next.length >= MAX_COMPARE) setSelectorOpen(false);
      return next;
    });
  };

  const removeImovel = (id) => {
    setSelectedIds((prev) => prev.filter((x) => String(x) !== String(id)));
  };

  const handleShare = () => {
    if (selected.length < 2) return;
    const text = selected
      .map(
        (im, i) =>
          `*${i + 1}. ${im.title}*\n📍 ${im.neighborhood || "—"}, ${im.city || "—"}\n💰 ${formatBRL(im.price)}\n🛏 ${im.bedrooms || 0}q | 🚿 ${im.bathrooms || 0}b | 🚗 ${im.parkingSpots || 0}v | 📐 ${im.areaM2 || 0}m²`
      )
      .join("\n\n");
    const msg = `📊 *Comparativo de Imóveis*\n\n${text}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) {
    return (
      <MainContainer autoHeight>
        <div className="realty-page realty-cmp-page">
          <div className="realty-empty">
            <Loader2 size={32} className="animate-spin" style={{ color: "#2673d9" }} />
            <p>Carregando imóveis...</p>
          </div>
        </div>
      </MainContainer>
    );
  }

  const cols = selected.length;

  return (
    <MainContainer autoHeight>
      <div className="realty-page realty-cmp-page">
        <div className="realty-page__header">
          <div>
            <h1 className="realty-page__title realty-cmp-title">
              <ArrowLeftRight size={22} />
              Comparativo de Imóveis
            </h1>
            <p className="realty-page__subtitle">
              Selecione até {MAX_COMPARE} imóveis para comparar lado a lado
            </p>
          </div>
          {selected.length >= 2 && (
            <div className="realty-page__header-actions">
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={() =>
                  exportComparativoPDF({
                    imoveis: selected,
                    brandName: "VBSolution CRM",
                  })
                }
              >
                <FileDown size={16} /> Exportar PDF
              </button>
              <button
                type="button"
                className="realty-page__btn realty-page__btn--ghost"
                onClick={handleShare}
              >
                <Share2 size={16} /> Compartilhar via WhatsApp
              </button>
            </div>
          )}
        </div>

        <div
          className="realty-cmp-slots"
          style={{ gridTemplateColumns: `repeat(${MAX_COMPARE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: MAX_COMPARE }).map((_, idx) => {
            const imovel = selected[idx];
            if (imovel) {
              const photo = coverUrl(imovel);
              return (
                <article key={imovel.id} className="realty-cmp-slot is-filled">
                  <button
                    type="button"
                    className="realty-cmp-slot__remove"
                    onClick={() => removeImovel(imovel.id)}
                    title="Remover"
                  >
                    <X size={14} />
                  </button>
                  <div className="realty-cmp-slot__media">
                    {photo ? (
                      <img src={photo} alt={imovel.title} />
                    ) : (
                      <div className="realty-cmp-slot__empty-img">
                        <ImageOff size={28} />
                      </div>
                    )}
                    <span className="realty-cmp-slot__badge">
                      {imovelPurposeLabel(imovel.purpose)}
                    </span>
                  </div>
                  <div className="realty-cmp-slot__body">
                    <p className="realty-cmp-slot__title">{imovel.title}</p>
                    <p className="realty-cmp-slot__loc">
                      <MapPin size={12} />
                      {imovel.neighborhood || imovel.city || "—"}
                    </p>
                    <p className="realty-cmp-slot__price">
                      {formatBRL(imovel.price)}
                    </p>
                  </div>
                </article>
              );
            }

            return (
              <button
                key={`empty-${idx}`}
                type="button"
                className="realty-cmp-slot is-empty"
                onClick={() => setSelectorOpen(true)}
              >
                <Plus size={28} />
                <span>Adicionar imóvel</span>
              </button>
            );
          })}
        </div>

        {selectorOpen && (
          <div className="realty-cmp-picker">
            <div className="realty-cmp-picker__head">
              <h3>Selecione um imóvel</h3>
              <button
                type="button"
                className="realty-cmp-picker__close"
                onClick={() => setSelectorOpen(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            {available.length === 0 ? (
              <p className="realty-cmp-picker__empty">
                Nenhum imóvel disponível para adicionar.
              </p>
            ) : (
              <div className="realty-cmp-picker__grid">
                {available.map((im) => {
                  const thumb = coverUrl(im);
                  return (
                    <button
                      key={im.id}
                      type="button"
                      className="realty-cmp-picker__item"
                      onClick={() => addImovel(im.id)}
                    >
                      <div className="realty-cmp-picker__thumb">
                        {thumb ? (
                          <img src={thumb} alt="" />
                        ) : (
                          <Building2 size={16} />
                        )}
                      </div>
                      <div className="realty-cmp-picker__meta">
                        <strong>{im.title}</strong>
                        <span>
                          {im.type || "—"} · {formatBRL(im.price)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selected.length >= 2 ? (
          <div className="realty-cmp-table-card">
            <div className="realty-cmp-table">
              <div
                className="realty-cmp-row realty-cmp-row--score"
                style={{
                  gridTemplateColumns: `180px repeat(${cols}, 1fr)`,
                }}
              >
                <div className="realty-cmp-row__label is-score">⭐ Score</div>
                {selected.map((im) => (
                  <div key={im.id} className="realty-cmp-row__cell is-score">
                    <ScoreCell imovel={im} />
                  </div>
                ))}
              </div>

              <CompareRow
                cols={cols}
                label="Tipo"
                values={selected.map((i) => i.type)}
              />
              <CompareRow
                cols={cols}
                label="Operação"
                values={selected.map((i) => imovelPurposeLabel(i.purpose))}
              />
              <CompareRow
                cols={cols}
                label="Preço"
                values={selected.map((i) => i.price)}
                type="currency"
                highlight="min"
              />
              <CompareRow
                cols={cols}
                label="Área"
                values={selected.map((i) => i.areaM2)}
                type="area"
                highlight="max"
              />
              <CompareRow
                cols={cols}
                label="Preço/m²"
                values={selected.map((i) => {
                  const area = Number(i.areaM2) || 0;
                  const price = Number(i.price) || 0;
                  return area > 0 ? Math.round(price / area) : null;
                })}
                type="currency"
                highlight="min"
              />
              <CompareRow
                cols={cols}
                label="Quartos"
                values={selected.map((i) => i.bedrooms)}
                highlight="max"
              />
              <CompareRow
                cols={cols}
                label="Suítes"
                values={selected.map((i) => i.suites)}
                highlight="max"
              />
              <CompareRow
                cols={cols}
                label="Banheiros"
                values={selected.map((i) => i.bathrooms)}
                highlight="max"
              />
              <CompareRow
                cols={cols}
                label="Vagas"
                values={selected.map((i) => i.parkingSpots)}
                highlight="max"
              />
              <CompareRow
                cols={cols}
                label="Andar"
                values={selected.map((i) => i.andar)}
              />
              <CompareRow
                cols={cols}
                label="Posição Solar"
                values={selected.map((i) => i.posicaoSolar)}
              />
              <CompareRow
                cols={cols}
                label="Bairro"
                values={selected.map((i) => i.neighborhood)}
              />
              <CompareRow
                cols={cols}
                label="Cidade"
                values={selected.map((i) => i.city)}
              />
              <CompareRow
                cols={cols}
                label="Condomínio"
                values={selected.map((i) =>
                  Number(i.condoFee) > 0 ? i.condoFee : null
                )}
                type="currency"
                highlight="min"
              />
              <CompareRow
                cols={cols}
                label="IPTU"
                values={selected.map((i) =>
                  Number(i.iptu) > 0 ? i.iptu : null
                )}
                type="currency"
                highlight="min"
              />
              <CompareRow
                cols={cols}
                label="Custo Total/mês"
                values={selected.map((i) => {
                  if (i.purpose !== "aluguel") return null;
                  return (
                    Number(i.price || 0) +
                    Number(i.condoFee || 0) +
                    Number(i.iptu || 0)
                  );
                })}
                type="currency"
                highlight="min"
              />
              <CompareRow
                cols={cols}
                label="Aceita Financiamento"
                values={selected.map((i) => i.aceitaFinanciamento)}
                type="boolean"
              />
              <CompareRow
                cols={cols}
                label="Aceita FGTS"
                values={selected.map((i) => i.aceitaFgts)}
                type="boolean"
              />
              <CompareRow
                cols={cols}
                label="Aceita Permuta"
                values={selected.map((i) => i.aceitaPermuta)}
                type="boolean"
              />
              <CompareRow
                cols={cols}
                label="Tem Escritura"
                values={selected.map((i) => i.temEscritura)}
                type="boolean"
              />
              <CompareRow
                cols={cols}
                label="Exclusivo"
                values={selected.map((i) => i.exclusivo)}
                type="boolean"
              />

              <div className="realty-cmp-legend">
                <span className="realty-cmp-legend__star">✦</span>
                = Melhor valor na comparação
              </div>
            </div>
          </div>
        ) : (
          <div className="realty-empty realty-cmp-empty">
            <ArrowLeftRight size={44} style={{ opacity: 0.3 }} />
            <p>Selecione pelo menos 2 imóveis para iniciar a comparação</p>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Comparativo;
