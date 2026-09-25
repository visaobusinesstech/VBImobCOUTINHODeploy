import { useCallback, useState } from "react";
import { buildStripeCrmCheckoutUrl } from "../../../utils/stripeCheckout";
import { CRM_BILLING_CYCLES, CRM_DEFAULT_SUBTITLE } from "./constants";

export default function useCrmPricing({ onChoose, subtitle }) {
  const [cycle, setCycle] = useState(CRM_BILLING_CYCLES[0]);

  const resolvedSubtitle = subtitle || CRM_DEFAULT_SUBTITLE;

  const handleSelectPlan = useCallback(
    (tier) => {
      if (typeof onChoose === "function") {
        onChoose(cycle, tier);
        return;
      }
      const url = buildStripeCrmCheckoutUrl(cycle, tier);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [cycle, onChoose]
  );

  return {
    cycle,
    setCycle,
    resolvedSubtitle,
    handleSelectPlan
  };
}
