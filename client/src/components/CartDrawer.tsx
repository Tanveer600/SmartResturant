import { ArrowRight, Minus, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import type { Line } from "../redux/types";

type CartDrawerProps = {
  open: boolean;
  lines: Line[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onAdd: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: (data: { name: string; phone: string; email: string; type: "pickup" | "delivery" | "dine_in"; provider: "cash" | "stripe" | "jazzcash" | "easypaisa" }) => void;
};

export default function CartDrawer({ open, lines, busy, error, onClose, onAdd, onDecrement, onRemove, onCheckout }: CartDrawerProps) {
  if (!open) return null;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="drawer-heading">
          <div><span className="section-kicker">YOUR TABLE</span><h2 id="cart-title">Your order <span>({itemCount})</span></h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close order"><X /></button>
        </header>
        {!lines.length ? (
          <div className="empty-cart"><span className="empty-icon">+</span><h3>Your order starts here</h3><p>Choose something delicious from our menu.</p><button className="button button-dark" onClick={onClose}>Explore menu <ArrowRight size={16} /></button></div>
        ) : (
          <>
            <div className="cart-lines">
              {lines.map(({ item, quantity }) => <article className="cart-line" key={item._id}>
                <div className="cart-line-image"><img src={item.image} alt={item.name} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add("image-unavailable"); }} /><span className="cart-image-fallback" aria-hidden="true"><UtensilsCrossed size={24} /></span></div>
                <div className="cart-line-info"><div className="cart-line-meta"><span className="cart-line-category">{item.category || "Menu"}</span><span className="cart-line-price">PKR {item.price.toLocaleString()} each</span></div><h3>{item.name?.trim() || "Menu item"}</h3>
                  <div className="cart-line-footer"><div className="quantity-control" role="group" aria-label="Quantity controls"><button onClick={() => onDecrement(item._id)} aria-label="Decrease quantity"><Minus size={14} /></button><b>{quantity}</b><button onClick={() => onAdd(item._id)} aria-label="Increase quantity"><Plus size={14} /></button></div><strong className="cart-line-total">PKR {(item.price * quantity).toLocaleString()}</strong></div>
                </div>
                <button className="remove-line" onClick={() => onRemove(item._id)} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button>
              </article>)}
            </div>
            <div className="cart-summary"><div><span>Subtotal</span><strong>PKR {total.toLocaleString()}</strong></div><small>Taxes and delivery are confirmed at checkout.</small></div>
            <form className="checkout-form" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onCheckout({ name: String(form.get("name")), phone: String(form.get("phone")), email: String(form.get("email") || ""), type: form.get("type") as "pickup" | "delivery" | "dine_in", provider: form.get("provider") as "cash" | "stripe" | "jazzcash" | "easypaisa" });
            }}>
              <h3>Where should we send it?</h3>
              <div className="form-grid"><label>Your name<input name="name" placeholder="e.g. Ayesha Khan" required minLength={2} /></label><label>Phone number<input name="phone" type="tel" placeholder="03xx xxxxxxx" required minLength={7} /></label></div>
              <label>Email <span className="optional">(receipt and order updates)</span><input name="email" type="email" placeholder="you@example.com" required /></label>
              <div className="form-grid"><label>Order type<select name="type"><option value="delivery">Delivery</option><option value="pickup">Pickup</option><option value="dine_in">Dine in</option></select></label><label>Payment<select name="provider"><option value="cash">Pay at restaurant</option><option value="stripe">Card</option><option value="jazzcash">JazzCash</option><option value="easypaisa">Easypaisa</option></select></label></div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-red checkout-button" disabled={busy}>{busy ? "Sending your orderÃ¢â‚¬Â¦" : <>Place order Ã‚Â· PKR {total.toLocaleString()} <ArrowRight size={17} /></>}</button>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
