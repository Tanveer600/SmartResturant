import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import "./MenuManager.css";

type MenuCategory = { _id: string; name: string; nameUr?: string };
type MenuItem = { _id: string; name: string; description?: string; price: number; image?: string; category: string; available: boolean };
const api = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${api}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body as T;
}

export default function MenuManager({ slug }: { slug: string }) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const result = await request<{ categories: MenuCategory[]; items: MenuItem[] }>(`/owner/restaurants/${slug}/menu`);
    setCategories(result.categories);
    setItems(result.items);
  }, [slug]);
  useEffect(() => { load().catch((reason) => setError(reason.message)); }, [load]);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/owner/restaurants/${slug}/categories`, { method: "POST", body: JSON.stringify({ name: form.get("categoryName") }) });
      formElement.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add category"); }
    finally { setBusy(false); }
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request(`/owner/restaurants/${slug}/items`, { method: "POST", body: JSON.stringify({ name: form.get("name"), description: form.get("description"), price: Number(form.get("price")), category: form.get("category"), image: form.get("image") }) });
      formElement.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add dish"); }
    finally { setBusy(false); }
  }

  async function updateItem(item: MenuItem, changes: Partial<MenuItem>) {
    setError("");
    try {
      await request(`/owner/restaurants/${slug}/items/${item._id}`, { method: "PATCH", body: JSON.stringify(changes) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update dish"); }
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete ${item.name} from this restaurant's menu?`)) return;
    setError("");
    try { await request(`/owner/restaurants/${slug}/items/${item._id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete dish"); }
  }

  return <div className="menu-manager">
    <div className="admin-section-heading"><h2>Menu for this restaurant</h2><button onClick={() => load().catch((reason) => setError(reason.message))}><RefreshCw size={14} /> Refresh</button></div>
    {error && <p className="admin-error">{error}</p>}
    <form className="menu-category-form" onSubmit={addCategory}><label>New category<input name="categoryName" required minLength={2} maxLength={60} placeholder="e.g. Breakfast" /></label><button className="admin-primary" disabled={busy}><Plus size={15} /> Add category</button></form>
    <form className="menu-item-form" onSubmit={addItem}><h2>Add a dish</h2><label>Dish name<input name="name" required minLength={2} maxLength={120} placeholder="e.g. Chicken karahi" /></label><label>Category<select name="category" required disabled={!categories.length}><option value="">{categories.length ? "Select a category" : "Add a category first"}</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>Price (PKR)<input name="price" required type="number" min="0" step="1" /></label><label>Image URL<input name="image" type="url" placeholder="https://…" /></label><label className="menu-description-field">Description<textarea name="description" maxLength={500} rows={2} placeholder="What is in this dish?" /></label><button className="admin-primary" disabled={busy || !categories.length}><Plus size={15} /> Add dish</button></form>
    {!items.length ? <div className="admin-empty">No dishes yet. Add this restaurant’s categories and menu items above.</div> : <div className="menu-manager-list">{items.map((item) => <article key={item._id}><div className="menu-manager-item">{item.image && <img src={item.image} alt="" />}<div><b>{item.name}</b><small>{categories.find((category) => category._id === item.category)?.name || "Menu item"} · PKR {item.price.toLocaleString()}</small>{item.description && <p>{item.description}</p>}</div></div><div className="menu-manager-actions"><label><input type="checkbox" checked={item.available} onChange={(event) => updateItem(item, { available: event.target.checked })} /> {item.available ? "Available" : "Hidden"}</label><button type="button" onClick={() => deleteItem(item)} aria-label={`Delete ${item.name}`}><Trash2 size={16} /></button></div></article>)}</div>}
  </div>;
}
