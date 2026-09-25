import api from "../../services/api";
import toastError from "../../errors/toastError";

const useQueues = () => {
  const findAll = async () => {
    try {
      const { data } = await api.get("/queue");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      toastError(err);
      return [];
    }
  };

  return { findAll };
};

export default useQueues;
