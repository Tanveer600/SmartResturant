import { FormEvent, useMemo, useState } from "react";
import { Search } from "lucide-react";

type Entry = { type: "Order" | "Reservation"; id: string; name: string; phone: string; date: string; status: string; detail: string; searchText: string };
export default function HistorySearch({ orders, reservations }: { orders: any[]; reservations: any[] }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const entries = useMemo<Entry[]>(() => [
    ...orders.map((order) => ({ type: "Order" as const, id: order._id, name: order.customer?.name || "Guest", phone: order.customer?.phone || "", date: order.createdAt, status: order.status, detail: `PKR ${Number(order.total || 0).toLocaleString()}`, searchText: `${order._id} ${order.customer?.name || ""} ${order.customer?.phone || ""} ${order.status}`.toLowerCase() })),
    ...reservations.map((booking) => ({ type: "Reservation" as const, id: booking._id, name: booking.customer?.name || "Guest", phone: booking.customer?.phone || "", date: booking.startsAt, status: booking.status === "cancelled" ? `cancelled (${(booking.cancellationReason || "staff_cancelled").replace(/_/g, " ")})` : booking.status, detail: `${booking.guestCount} guests · ${booking.floor || "First Floor"}`, searchText: `${booking._id} ${booking.customer?.name || ""} ${booking.customer?.phone || ""} ${booking.status} ${booking.cancellationReason || ""} ${booking.floor || ""}`.toLowerCase() })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [orders, reservations]);
  const matches = entries.filter((entry) => !applied || entry.searchText.includes(applied.toLowerCase().trim()));
  function search(event: FormEvent) { event.preventDefault(); setApplied(query); }
  return <section className="history-search"><div className="admin-section-heading"><div><h2>Orders & reservation history</h2><small>Search the latest records by customer, phone, ID, or status.</small></div></div><form onSubmit={search}><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, order/reservation ID…" /></label><button className="admin-primary">Search</button></form>{!matches.length ? <div className="admin-empty">No matching records. Try another search.</div> : <div className="history-table-wrap"><table><thead><tr><th>Type / ID</th><th>Customer</th><th>Date & time</th><th>Status</th><th>Details</th></tr></thead><tbody>{matches.map((entry) => <tr key={`${entry.type}-${entry.id}`}><td><b>{entry.type}</b><small>{entry.id}</small></td><td>{entry.name}<small>{entry.phone}</small></td><td>{new Date(entry.date).toLocaleString()}</td><td><span className={`history-status ${entry.status.split(" ")[0]}`}>{entry.status}</span></td><td>{entry.detail}</td></tr>)}</tbody></table></div>}</section>;
}
