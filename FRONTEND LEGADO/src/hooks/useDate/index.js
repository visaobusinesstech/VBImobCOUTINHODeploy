import { useCallback } from "react";
import moment from "moment";

export function useDate() {
  const dateToClient = useCallback((strDate) => {
    if (!strDate) return strDate;
    // Evita parse de "Sun Mar 01..." (bug de String(Date).slice) como ano 2001
    if (typeof strDate === "string") {
      const iso = strDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (iso) return moment(iso[1], "YYYY-MM-DD").format("DD/MM/YYYY");
    }
    if (moment(strDate).isValid()) {
      return moment(strDate).format("DD/MM/YYYY");
    }
    return strDate;
  }, []);

  const datetimeToClient = useCallback((strDate) => {
    if (moment(strDate).isValid()) {
      return moment(strDate).format("DD/MM/YYYY HH:mm");
    }
    return strDate;
  }, []);

  const dateToDatabase = useCallback((strDate) => {
    if (moment(strDate, "DD/MM/YYYY").isValid()) {
      return moment(strDate).format("YYYY-MM-DD HH:mm:ss");
    }
    return strDate;
  }, []);

  const returnDays = useCallback((date) => {
    let data1 = new Date()
    let data2 = new Date(date)
    let result = data2.getTime() - data1.getTime();
    let days = Math.ceil(result / (1000 * 60 * 60 * 24));

    if (days === -0) {
      days = 0
    }
    return days;
  }, []);

  return {
    dateToClient,
    datetimeToClient,
    dateToDatabase,
    returnDays
  };
}
