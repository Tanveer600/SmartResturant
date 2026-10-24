import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReservationInput } from "../redux/slice/reservationSlice";
import { tenantSlug } from "../redux/services/tenant";

type TableOption = { id: string; number: string; capacity: number; section?: string; bookedSeats: number; availableSeats: number };
type FloorOption = { name: string; tableCount: number; seats: number; bookedSeats: number; availableSeats: number; tables: TableOption[] };

const api = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const initialTime = () => {
  const time = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
};

export default function ReservationModal({ open, busy, error, onClose, onSubmit }: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: ReservationInput) => void;
}) {
  const { t } = useTranslation();
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [date, setDate] = useState(localDate);
  const [time, setTime] = useState(initialTime);
  const [floor, setFloor] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [floorError, setFloorError] = useState("");

  useEffect(() => {
    if (!open || !date || !time) return;
    const controller = new AbortController();
    setLoadingFloors(true);
    setFloorError("");
    const startsAt = new Date(`${date}T${time}`).toISOString();
    fetch(`${api}/public/restaurants/${tenantSlug()}/floors?startsAt=${encodeURIComponent(startsAt)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load table availability");
        return response.json() as Promise<FloorOption[]>;
      })
      .then((rows) => {
        setFloors(rows);
        setFloor((current) => rows.some((row) => row.name === current) ? current : rows[0]?.name || "");
        setSelectedTableIds((current) => current.filter((id) => rows.some((row) => row.tables.some((table) => table.id === id && table.availableSeats > 0))));
      })
      .catch((reason) => { if (!controller.signal.aborted) { setFloors([]); setFloorError(reason instanceof Error ? reason.message : "Could not load tables"); } })
      .finally(() => { if (!controller.signal.aborted) setLoadingFloors(false); });
    return () => controller.abort();
  }, [open, date, time]);

  const selectedFloor = floors.find((row) => row.name === floor);
  const selectedTables = useMemo(() => selectedFloor?.tables.filter((table) => selectedTableIds.includes(table.id)) || [], [selectedFloor, selectedTableIds]);
  const selectedSeatCapacity = selectedTables.reduce((sum, table) => sum + table.availableSeats, 0);
  const currentSeats = Math.min(guestCount, selectedSeatCapacity);

  function toggleTable(table: TableOption) {
    setSelectedTableIds((ids) => ids.includes(table.id) ? ids.filter((id) => id !== table.id) : [...ids, table.id]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!floor || !selectedTableIds.length || selectedSeatCapacity < guestCount) return;
    const form = new FormData(event.currentTarget);
    onSubmit({
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      email: String(form.get("email") || ""),
      startsAt: new Date(`${date}T${time}`).toISOString(),
      guestCount,
      floor,
      tableIds: selectedTableIds,
    });
  }

  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <form className="reservation-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close reservation"><X /></button>
      <p className="section-kicker">A SEAT IS WAITING</p><h2>Reserve a table<span>.</span></h2>
      <p className="modal-intro">Choose your time, floor, and the table seats that work for your group.</p>
      <label>Your name<input name="name" placeholder="Name" required minLength={2} /></label>
      <label>Phone number<input name="phone" type="tel" placeholder="03xx xxxxxxx" required minLength={7} /></label>
      <label>Email <span className="optional">(optional)</span><input name="email" type="email" placeholder="you@example.com" /></label>
      <div className="form-grid"><label>Date<input name="date" type="date" value={date} min={localDate()} required onChange={(event) => { setDate(event.target.value); setSelectedTableIds([]); }} /></label><label>Time<input name="time" type="time" value={time} required onChange={(event) => { setTime(event.target.value); setSelectedTableIds([]); }} /></label></div>
      <label>Floor<select value={floor} onChange={(event) => { setFloor(event.target.value); setSelectedTableIds([]); }} disabled={!floors.length} required>
        {floors.length ? floors.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.availableSeats} of {item.seats} seats free · {item.tableCount} tables</option>) : <option value="">{loadingFloors ? "Loading floors…" : "No floors configured"}</option>}
      </select></label>
      {floorError && <p className="form-error" role="alert">{floorError}</p>}
      <div className="reservation-table-heading"><div><b>Choose table(s)</b><span>Partial seats are allowed; you can select multiple tables.</span></div><small>{selectedFloor?.tableCount || 0} total</small></div>
      {loadingFloors ? <div className="reservation-table-empty">Checking table availability…</div> : <div className="reservation-table-grid">
        {selectedFloor?.tables.map((table) => {
          const chosen = selectedTableIds.includes(table.id);
          return <button type="button" key={table.id} disabled={!table.availableSeats} className={`reservation-table-card${chosen ? " selected" : ""}${table.availableSeats === 0 ? " full" : ""}`} onClick={() => toggleTable(table)}>
            <span className="reservation-table-check">{chosen && <Check size={13} />}</span><b>Table {table.number}</b><span>{table.section || "Dining"}</span><strong>{table.availableSeats} <small>of {table.capacity} seats free</small></strong>
            {table.bookedSeats > 0 && table.availableSeats > 0 && <em>{table.bookedSeats} seats reserved</em>}
            {!table.bookedSeats && table.availableSeats > 0 && <i>Full table available</i>}
            {!table.availableSeats && <i>Fully reserved</i>}
          </button>;
        })}
      </div>}
      <div className="reservation-guest-row"><label>Seats for your group<select value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))}>
        {Array.from({ length: 30 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "guest" : "guests"}</option>)}
      </select></label><div className="reservation-seat-summary"><Users size={17} /><span>{selectedSeatCapacity ? `${currentSeats} of ${selectedSeatCapacity} selected seats available` : "Select a table to continue"}</span></div></div>
      {selectedTableIds.length > 0 && selectedSeatCapacity < guestCount && <p className="form-error" role="alert">Selected tables have only {selectedSeatCapacity} free seats. Choose more tables or fewer guests.</p>}
      <button className="button button-red" disabled={busy || loadingFloors || !selectedTableIds.length || selectedSeatCapacity < guestCount}>{busy ? "Sending request…" : <>{t("sendReservation")} <ArrowRight size={16} /></>}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </div>;
}
