import { tenantSlug } from "./tenant";
const apiRoot = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export async function fetchMenu() {
  const response = await fetch(`${apiRoot}/public/restaurants/${tenantSlug()}`);
  if (!response.ok) throw Error("Menu unavailable");
  return response.json();
}
