interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

export const shouldPreloadAdminRoutes = (
  connection?: NetworkInformationLike,
): boolean => {
  if (connection?.saveData) return false;
  return connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
};
