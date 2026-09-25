import { useEffect } from "react";
import { scheduleTranslationPasses } from "../../translate/googleTranslate";

/** Re-traduz após modais/drawers montarem conteúdo tardio (Brain.AI, etc.). */
export default function useScheduleTranslateWhen(active) {
  useEffect(() => {
    if (active) scheduleTranslationPasses();
  }, [active]);
}
