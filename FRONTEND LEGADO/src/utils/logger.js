// Simple structured logger for frontend
export const logInfo = (msg, data = {}) => {
  try {
    // eslint-disable-next-line no-console
    console.info(`[INFO] ${msg}`, data);
  } catch {}
};

export const logWarn = (msg, data = {}) => {
  try {
    // eslint-disable-next-line no-console
    console.warn(`[WARN] ${msg}`, data);
  } catch {}
};

export const logError = (msg, err = {}) => {
  try {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${msg}`, err);
  } catch {}
};

const logger = { logInfo, logWarn, logError };
export default logger;

