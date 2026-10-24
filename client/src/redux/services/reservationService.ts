import { tenantSlug } from "./tenant";
import type { ReservationInput } from "../slice/reservationSlice";
export async function createReservation(data: ReservationInput) {
  const r = await fetch(
    (import.meta.env.VITE_API_URL || "http://localhost:5000/api") +
      "/public/restaurants/" +
      tenantSlug() +
      "/reservations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  const v = await r.json();
  if (!r.ok) throw Error(v.message || "Reservation request failed");
  return v;
}

