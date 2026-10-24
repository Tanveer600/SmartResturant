export const tenantSlug = () => {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] === "kitchen" || segments[0] === "admin") return "copper-spoon";
  return segments[0] || "copper-spoon";
};
