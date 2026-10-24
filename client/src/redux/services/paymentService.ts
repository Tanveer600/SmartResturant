import { tenantSlug } from "./tenant";
import type { Provider, PaymentResult } from "../slice/paymentSlice";
export async function startPayment(
  orderId: string,
  provider: Provider,
): Promise<PaymentResult> {
  const root = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const r = await fetch(
    root +
      "/public/restaurants/" +
      tenantSlug() +
      "/orders/" +
      encodeURIComponent(orderId) +
      "/payments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    },
  );
  const data = await r.json();
  if (!r.ok) throw Error(data.message || "Payment could not start");
  return data;
}

