import { tenantSlug } from "./tenant";

type OrderCustomer = {
  name: string;
  phone: string;
  email: string;
  type: "pickup" | "delivery" | "dine_in";
  provider: "cash" | "stripe" | "jazzcash" | "easypaisa";
};

export async function createOrder(
  lines: { item: { _id: string }; quantity: number }[],
  customer: OrderCustomer,
) {
  let response: Response;
  try {
    response = await fetch(
      (import.meta.env.VITE_API_URL || "http://localhost:5000/api") +
        "/public/restaurants/" +
        tenantSlug() +
        "/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            menuItemId: line.item._id,
            quantity: line.quantity,
          })),
          type: customer.type,
          paymentMethod: customer.provider,
          customer: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
          },
        }),
      },
    );
  } catch {
    throw new Error(
      "Order server is unreachable. Please keep the API running on port 5000.",
    );
  }

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(result.message || "Order could not be sent (" + response.status + ")");
  }
  return result;
}
