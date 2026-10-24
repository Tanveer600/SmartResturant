import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ChefHat, CircleUserRound, Download, Eye, LayoutDashboard, LogOut, Plus, Printer, RefreshCw, Search, Utensils, Users, X } from "lucide-react";
import MenuManager from "./components/MenuManager";
import HistorySearch from "./components/HistorySearch";
import "./orderDetails.css";

type Order = { _id: string; status: string; type: string; paymentMethod?: string; paymentStatus?: string; total: number; createdAt: string; notes?: string; customer?: { name?: string; phone?: string; email?: string }; items: { name: string; quantity: number; unitPrice?: number }[] };
type Reservation = { _id: string; status: string; cancellationReason?: string; startsAt: string; guestCount: number; floor: string; customer?: { name?: string; phone?: string; email?: string } };
type Floor = { floor: string; tableCount: number; seats: number; bookings: number; bookedSeats: number; availableSeats: number; bookedTables: number; availableTables: number; tables: { number: string; capacity: number; section?: string; bookedSeats: number; availableSeats: number; status: "available" | "partial" | "full" }[] };
type PublicFloor = { name: string; tableCount: number; seats: number };
const api = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const today = () => new Date().toLocaleDateString("en-CA");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(api + path, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body as T;
}

export default function KitchenDashboard({ slug = "copper-spoon" }: { slug?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState(slug);
  const [setupKey, setSetupKey] = useState("");
  const [setupMode, setSetupMode] = useState(false);
  const [logged, setLogged] = useState(false);
  const [tab, setTab] = useState<"overview" | "orders" | "reservations" | "floors" | "menu" | "history">("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [publicFloors, setPublicFloors] = useState<PublicFloor[]>([]);
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [error, setError] = useState("");
  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [tableNo, setTableNo] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [floorName, setFloorName] = useState("First Floor");
  const [section, setSection] = useState("Main dining");

  const load = useCallback(async () => {
    const [orderRows, reservationRows, floorRows, publicFloorRows] = await Promise.all([
      request<Order[]>(`/owner/restaurants/${restaurantSlug}/orders`),
      request<Reservation[]>(`/owner/restaurants/${restaurantSlug}/reservations`),
      request<Floor[]>(`/owner/restaurants/${restaurantSlug}/floor-summary?date=${date}&time=${time}`),
      request<PublicFloor[]>(`/public/restaurants/${restaurantSlug}/floors`),
    ]);
    setOrders(orderRows);
    setReservations(reservationRows);
    setFloors(floorRows);
    setPublicFloors(publicFloorRows);
  }, [date, time, restaurantSlug]);

  useEffect(() => {
    if (!logged) return;
    load().catch((reason) => setError(reason.message));
  }, [logged, load]);

  useEffect(() => {
    if (!logged) return;
    const stream = new EventSource(`${api}/owner/restaurants/${restaurantSlug}/events`, { withCredentials: true });
    stream.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as { type?: string };
        if (update.type === "orders" || update.type === "reservations")
          load().catch((reason) => setError(reason.message));
      } catch { /* Ignore malformed stream messages and keep the connection alive. */ }
    };
    return () => stream.close();
  }, [logged, load, restaurantSlug]);

  useEffect(() => {
    if (!logged) return;
    request<{ configured: boolean }>(`/owner/restaurants/${restaurantSlug}/integrations/email`)
      .then((result) => setEmailReady(result.configured))
      .catch(() => setEmailReady(false));
  }, [logged, restaurantSlug]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password, slug: restaurantSlug }) }); window.history.replaceState({}, "", restaurantSlug === "copper-spoon" ? "/kitchen" : `/${restaurantSlug}/kitchen`); setLogged(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Sign in failed"); }
    finally { setBusy(false); }
  }

  async function bootstrap(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request("/auth/bootstrap-owner", { method: "POST", body: JSON.stringify({ setupKey, slug: restaurantSlug, restaurantName, name, email, password }) });
      window.history.replaceState({}, "", restaurantSlug === "copper-spoon" ? "/kitchen" : `/${restaurantSlug}/kitchen`); setSetupMode(false); setError("Owner account created. Sign in with the email and password you chose."); setPassword(""); setSetupKey("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Owner setup failed"); }
    finally { setBusy(false); }
  }

  async function updateStatus(kind: "orders" | "reservations", id: string, status: string, cancellationReason?: string) {
    setError("");
    try {
      await request(`/owner/restaurants/${restaurantSlug}/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, cancellationReason }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update status"); }
  }

  async function addTable(event: FormEvent) {
    event.preventDefault(); setError("");
    try {
      await request(`/owner/restaurants/${restaurantSlug}/tables`, { method: "POST", body: JSON.stringify({ number: tableNo, capacity: Number(capacity), floor: floorName, section }) });
      setTableNo(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add table"); }
  }

  async function logout() {
    try { await request("/auth/logout", { method: "POST" }); } finally { setLogged(false); setOrders([]); setReservations([]); }
  }

  if (!logged) return <main className="admin-login-shell"><a className="admin-back" href={restaurantSlug === "copper-spoon" ? "/" : `/${restaurantSlug}`}><ArrowLeft size={16} /> {restaurantSlug}</a><form className="admin-login" onSubmit={setupMode ? bootstrap : login}>
    <span className="admin-brand-mark"><ChefHat size={22} /></span><p className="section-kicker">{(restaurantName || restaurantSlug).toUpperCase()} ? STAFF PORTAL</p><h1>{setupMode ? "Set up your admin" : "Welcome back"}</h1><p className="admin-subtitle">{setupMode ? "Create a restaurant and its first owner account." : "Sign in to manage orders, reservations, and floor capacity."}</p>
    {<label>Restaurant slug<input required minLength={2} pattern="[a-z0-9-]+" value={restaurantSlug} onChange={(e) => setRestaurantSlug(e.target.value.toLowerCase())} placeholder="e.g. copper-spoon" /></label>}
    {setupMode && <><label>Restaurant name<input required minLength={2} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="e.g. Copper Spoon" /></label><label>Owner name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label><label>One-time setup key<input required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="From server/.env" /></label></>}
    <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" /></label><label>Password<input required minLength={setupMode ? 12 : 1} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={setupMode ? "At least 12 characters" : "Your password"} /></label>
    {error && <p className={error.startsWith("Owner account created") ? "admin-notice" : "form-error"}>{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? "Please wait…" : setupMode ? "Create owner account" : "Sign in"}</button><button type="button" className="admin-switch" onClick={() => { setError(""); setSetupMode(!setupMode); }}>{setupMode ? "Already set up? Sign in" : "First time? Set up owner access"}</button>
  </form></main>;

  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const activeReservations = reservations.filter((booking) => !["completed", "cancelled"].includes(booking.status));
  return <main className="admin-shell"><header className="admin-topbar"><a className="admin-brand" href={restaurantSlug === "copper-spoon" ? "/" : `/${restaurantSlug}`}><span className="brand-mark"><Utensils size={18} /></span><span>{restaurantName || restaurantSlug}<small>ADMIN & STAFF</small></span></a><div className="admin-user"><CircleUserRound size={18} /> Restaurant staff<button onClick={logout} aria-label="Sign out"><LogOut size={17} /></button></div></header>
    <div className="admin-layout"><aside className="admin-sidebar"><p>WORKSPACE</p>{(["overview", "orders", "reservations", "menu", "history", "floors"] as const).map((value) => <button key={value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>{value === "overview" ? <LayoutDashboard size={17} /> : value === "orders" ? <ChefHat size={17} /> : value === "reservations" ? <CalendarDays size={17} /> : value === "menu" ? <Utensils size={17} /> : value === "history" ? <Search size={17} /> : <Users size={17} />}{value[0].toUpperCase() + value.slice(1)}{value === "orders" && <b>{activeOrders.length}</b>}{value === "reservations" && <b>{activeReservations.length}</b>}</button>)}<small>Live updates connected</small></aside>
    <section className="admin-content"><div className="admin-page-head"><div><p className="section-kicker">RESTAURANT OPERATIONS</p><h1>{tab === "overview" ? "Overview" : tab === "orders" ? "Orders" : tab === "reservations" ? "Reservations" : "Floor & tables"}</h1></div><div className="admin-head-actions"><label><CalendarDays size={15} /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label><input aria-label="Table availability time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label><button onClick={() => load().catch((reason) => setError(reason.message))}><RefreshCw size={15} /> Refresh</button></div></div>
      {emailReady === false && <div className="admin-email-warning"><b>Order emails are not connected.</b><span>Add GMAIL_USER and a Gmail App Password to <code>server/.env</code>, then restart the API. The owner and customer will receive new order emails after setup.</span></div>}
      {error && <p className="admin-error">{error}</p>}
      {tab === "overview" && <><div className="admin-stats"><article><span>Active orders</span><strong>{activeOrders.length}</strong><small>Need kitchen attention</small></article><article><span>Reservations today</span><strong>{activeReservations.filter((b) => b.startsAt.slice(0, 10) === date).length}</strong><small>Pending, confirmed, or seated</small></article><article><span>Reserved guests today</span><strong>{floors.reduce((sum, f) => sum + f.bookedSeats, 0)}</strong><small>Across all floors</small></article><article><span>Available seats today</span><strong>{floors.reduce((sum, f) => sum + f.availableSeats, 0)}</strong><small>Based on floor capacity</small></article></div><FloorCards floors={floors} /><div className="admin-section-heading"><h2>Latest orders</h2><button onClick={() => setTab("orders")}>All orders →</button></div><OrderList orders={orders.slice(0, 5)} onStatus={updateStatus} /></>}
      {tab === "orders" && <OrderList orders={orders} onStatus={updateStatus} />}
      {tab === "reservations" && <ReservationList rows={reservations} onStatus={updateStatus} />}{tab === "menu" && <MenuManager slug={restaurantSlug} />}{tab === "history" && <HistorySearch orders={orders} reservations={reservations} />}
      {tab === "floors" && <><FloorCards floors={floors} /><div className="floor-table-grid">{floors.flatMap((floor) => floor.tables.map((table) => <article className={`floor-table-card ${table.status}`} key={floor.floor + table.number}><span>{floor.floor}</span><strong>Table {table.number}</strong><small>{table.bookedSeats} reserved · {table.availableSeats} of {table.capacity} seats free</small><b>{table.status === "full" ? "Fully reserved" : table.status === "partial" ? "Partially available" : "Available"}</b></article>))}</div><form className="table-create-form" onSubmit={addTable}><h2><Plus size={18} /> Add a table</h2><label>Table no.<input required value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="e.g. 06" /></label><label>Seats<input required type="number" min="1" max="30" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label><label>Floor<input required value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="First Floor" /></label><label>Section<input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Main dining" /></label><button className="admin-primary"><Plus size={15} /> Add table</button></form><div className="admin-floor-table">{publicFloors.map((f) => <article key={f.name}><div><b>{f.name}</b><small>{f.tableCount} tables · {f.seats} seats</small></div><span>Available capacity: {Math.max(0, f.seats - (floors.find((x) => x.floor === f.name)?.bookedSeats || 0))} today</span></article>)}</div></>}
    </section></div></main>;
}

function FloorCards({ floors }: { floors: Floor[] }) {
  if (!floors.length) return <div className="admin-empty">No floor tables yet. Add tables under Floor & tables.</div>;
  return <div className="floor-card-grid">{floors.map((floor) => <article className="floor-card" key={floor.floor}><div className="floor-card-title"><span>{floor.floor}</span><small>{floor.bookings} bookings</small></div><div className="floor-capacity"><strong>{floor.availableSeats}</strong><span>available <i>of {floor.seats} seats</i></span></div><div className="floor-progress"><span style={{ width: `${floor.seats ? Math.min(100, floor.bookedSeats / floor.seats * 100) : 0}%` }} /></div><div className="floor-foot"><span>{floor.bookedSeats} seats booked</span><span>{floor.availableTables} / {floor.tableCount} tables available*</span></div></article>)}</div>;
}
function OrderList({ orders, onStatus }: { orders: Order[]; onStatus: (kind: "orders" | "reservations", id: string, status: string) => void }) {
  const [selected, setSelected] = useState<Order | null>(null);
  if (!orders.length) return <div className="admin-empty">No orders yet. New customer orders will appear here automatically.</div>;
  return <><div className="record-list">{orders.map((o) => <article key={o._id}><div className="record-primary"><small>{o.type.replace("_", " ").toUpperCase()} · {new Date(o.createdAt).toLocaleString()}</small><h2>{o.customer?.name || "Guest"}</h2><span>{o.customer?.phone}</span><p>{o.items?.map((item) => `${item.quantity} × ${item.name}`).join(" · ")}</p></div><div className="record-side"><strong>PKR {o.total.toLocaleString()}</strong><small>{(o.paymentMethod || "cash").toUpperCase()} · {(o.paymentStatus || "unpaid").toUpperCase()}</small><select value={o.status} onChange={(e) => onStatus("orders", o._id, e.target.value)}><option value="pending">Pending</option><option value="preparing">Preparing</option><option value="ready">Ready</option><option value="out_for_delivery">Out for delivery</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button className="order-detail-button" onClick={() => setSelected(o)}><Eye size={15} /> Order details</button></div></article>)}</div>{selected && <OrderDetails order={selected} onClose={() => setSelected(null)} />}</>;
}
function OrderDetails({ order, onClose }: { order: Order; onClose: () => void }) {
  const money = (amount: number) => `PKR ${Number(amount || 0).toLocaleString()}`;
  const download = () => {
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
    const rows = order.items.map((item) => `<tr><td>${esc(item.name)}</td><td>${item.quantity}</td><td>${money(item.unitPrice || 0)}</td><td>${money((item.unitPrice || 0) * item.quantity)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order ${esc(order._id)}</title><style>body{font:15px Arial,sans-serif;color:#26241f;background:#f7f5f0;margin:0;padding:36px}.receipt{max-width:720px;margin:auto;background:#fff;padding:38px;border:1px solid #e7e1d6}.brand{color:#a83b2d;letter-spacing:3px;font-size:12px;font-weight:bold}.muted{color:#777}.head{display:flex;justify-content:space-between;border-bottom:1px solid #e7e1d6;padding-bottom:22px}h1{font:32px Georgia,serif;margin:8px 0}table{width:100%;border-collapse:collapse;margin:28px 0}th,td{text-align:left;padding:13px 8px;border-bottom:1px solid #eee}th{color:#777;font-size:12px;text-transform:uppercase}.right{text-align:right}.total{font-size:20px;font-weight:bold}.meta{line-height:1.8}.actions{max-width:720px;margin:12px auto;text-align:right}.actions button{padding:10px 16px}@media print{body{background:white;padding:0}.receipt{border:0}}</style></head><body><div class="receipt"><div class="head"><div><div class="brand">COPPER SPOON · RESTAURANT & KITCHEN</div><h1>Order receipt</h1><div class="muted">Order #${esc(order._id)}</div></div><div class="right"><b>${esc(order.status.toUpperCase())}</b><p class="muted">${esc(new Date(order.createdAt).toLocaleString())}</p></div></div><p class="meta"><b>Customer:</b> ${esc(order.customer?.name || "Guest")}<br><b>Phone:</b> ${esc(order.customer?.phone || "—")}<br><b>Email:</b> ${esc(order.customer?.email || "—")}<br><b>Order type:</b> ${esc(order.type.replace(/_/g, " "))}<br><b>Payment:</b> ${esc(order.paymentMethod || "cash")} · ${esc(order.paymentStatus || "unpaid")}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>${order.notes ? `<p><b>Notes:</b> ${esc(order.notes)}</p>` : ""}<p class="right total">Total: ${money(order.total)}</p><p class="muted">Thank you for your order.</p></div><div class="actions"><button onclick="window.print()">Print receipt</button></div></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `order-${order._id}.html`; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="order-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title"><header><div><span className="section-kicker">ORDER RECEIPT</span><h2 id="order-modal-title">Order details</h2><small>#{order._id}</small></div><button className="order-modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button></header><div className="order-modal-summary"><div><small>Customer</small><b>{order.customer?.name || "Guest"}</b><span>{order.customer?.phone || "—"}</span>{order.customer?.email && <span>{order.customer.email}</span>}</div><div><small>Placed</small><b>{new Date(order.createdAt).toLocaleString()}</b><span>{order.type.replace(/_/g, " ")}</span></div><div><small>Status & payment</small><b>{order.status.replace(/_/g, " ")}</b><span>{(order.paymentMethod || "cash").toUpperCase()} · {(order.paymentStatus || "unpaid").toUpperCase()}</span></div></div><div className="order-item-card-list">{order.items.map((item, index) => <article className="order-item-card" key={`${item.name}-${index}`}><div className="order-item-card-head"><div><span>ITEM {String(index + 1).padStart(2, "0")}</span><h3>{item.name}</h3></div><strong>{money((item.unitPrice || 0) * item.quantity)}</strong></div><div className="order-item-card-details"><div><small>Quantity</small><b>{item.quantity}</b></div><div><small>Unit price</small><b>{money(item.unitPrice || 0)}</b></div><div><small>Line total</small><b>{money((item.unitPrice || 0) * item.quantity)}</b></div></div></article>)}</div>{order.notes && <p className="order-modal-notes"><b>Customer note:</b> {order.notes}</p>}<footer><span>Total amount</span><strong>{money(order.total)}</strong></footer><div className="order-modal-actions"><button onClick={download}><Download size={16} /> Download receipt</button><button onClick={() => window.print()}><Printer size={16} /> Print</button></div></section></div>;
}
function ReservationList({ rows, onStatus }: { rows: Reservation[]; onStatus: (kind: "orders" | "reservations", id: string, status: string, cancellationReason?: string) => void }) {
  if (!rows.length) return <div className="admin-empty">No reservations yet. Customer table requests will appear here.</div>;
  return <div className="record-list">{rows.map((booking) => {
    const cancelValue = booking.cancellationReason === "no_show" ? "cancel_no_show" : booking.cancellationReason === "staff_cancelled" ? "cancel_staff" : "cancel_customer";
    const value = booking.status === "cancelled" ? cancelValue : booking.status;
    return <article key={booking._id}><div className="record-primary"><small>{new Date(booking.startsAt).toLocaleString()} ? {booking.floor || "First Floor"}</small><h2>{booking.customer?.name || "Guest"}</h2><span>{booking.customer?.phone} ? {booking.guestCount} guests</span>{booking.status === "cancelled" && <p>Cancelled: {(booking.cancellationReason || "staff_cancelled").replace(/_/g, " ")}</p>}</div><div className="record-side"><select value={value} onChange={(event) => { const next = event.target.value; if (next.startsWith("cancel_")) onStatus("reservations", booking._id, "cancelled", next === "cancel_no_show" ? "no_show" : next === "cancel_staff" ? "staff_cancelled" : "customer_cancelled"); else onStatus("reservations", booking._id, next); }}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="seated">Seated</option><option value="completed">Completed</option><option value="cancel_no_show">Cancel ? No show</option><option value="cancel_customer">Cancel ? Customer</option><option value="cancel_staff">Cancel ? Staff</option></select></div></article>;
  })}</div>;
}
