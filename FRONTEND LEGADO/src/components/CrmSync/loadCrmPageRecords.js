import activitiesService from "../../services/activitiesService";
import leadsSalesService from "../../services/leadsSalesService";
import projectsService from "../../services/projectsService";
import inventoryService from "../../services/inventoryService";
import api from "../../services/api";

export async function loadCrmPageRecords(pageKey) {
  try {
    switch (pageKey) {
      case "activities": {
        const data = await activitiesService.list({ pageNumber: 1 });
        return Array.isArray(data?.activities) ? data.activities : Array.isArray(data) ? data : [];
      }
      case "leads": {
        const data = await leadsSalesService.list({ pageNumber: 1 });
        return Array.isArray(data?.leads) ? data.leads : Array.isArray(data) ? data : [];
      }
      case "projects": {
        const data = await projectsService.list({ pageNumber: 1 });
        return Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
      }
      case "inventory": {
        const data = await inventoryService.list({ pageNumber: 1 });
        if (Array.isArray(data?.inventory)) return data.inventory;
        if (Array.isArray(data?.inventories)) return data.inventories;
        return Array.isArray(data) ? data : [];
      }
      case "calendar": {
        const data = await activitiesService.list({ pageNumber: 1 });
        const rows = Array.isArray(data?.activities) ? data.activities : [];
        return rows.filter((a) => String(a.type || "").toLowerCase() === "event");
      }
      case "companies": {
        const { data } = await api.get("/contacts/list");
        return Array.isArray(data) ? data : [];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}
