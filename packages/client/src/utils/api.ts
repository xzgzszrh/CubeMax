export const getApiBaseUrl = () => {
  const isDev = import.meta.env.DEV;
  const devBase = import.meta.env.VITE_DEVELOP_APP_BASE_URL || "http://127.0.0.1:9001";
  const prodBase = import.meta.env.VITE_PRODUCTION_APP_BASE_URL || "";
  return isDev ? devBase : prodBase;
};
