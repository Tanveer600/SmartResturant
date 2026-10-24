import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowRight, Check, Clock3, MapPin, Menu as MenuIcon, Moon, Search, ShoppingBag, Sun, Utensils, X } from "lucide-react";
import { RootState } from "./redux/rootReducer";
import { menuActions } from "./redux/slice/menuSlice";
import { cartActions } from "./redux/slice/cartSlice";
import { reservationActions } from "./redux/slice/reservationSlice";
import { preferenceActions } from "./redux/slice/preferencesSlice";
import type { Item } from "./redux/types";
import i18n from "./i18n";
import KitchenDashboard from "./KitchenDashboard";
import ProductCard from "./components/ProductCard";
import CartDrawer from "./components/CartDrawer";
import ReservationModal from "./components/ReservationModal";
import ContactSection from "./components/ContactSection";
import { tenantSlug } from "./redux/services/tenant";

const urNames = ["برراٹا اور موسمی پھل", "تندور کی گرم روٹی", "مکھن والی راویولی", "آہستہ بھنا مرغ", "گھر کا لیمونیڈ", "زیتون کے تیل کا کیک"];
const urDescriptions = ["دیسی ٹماٹر، آڑو اور تلسی کا تیل", "کلچرڈ مکھن اور سمندری نمک", "ریکوٹا، سیج اور بھنے ہیزل نٹس", "لیموں، آلو اور تازہ جڑی بوٹیاں", "لیموں، روزمیری اور ہلکی سی چمک", "مسکارپونے اور موسمی بیریز"];
const demo: Item[] = [
  ["Burrata & stone fruit", "Heirloom tomato, grilled peach, basil oil", "Starters", 1850, "photo-1608039829572-78524f79c4c7"],
  ["Wood-fired sourdough", "Cultured butter, flaky salt, warm from oven", "Starters", 680, "photo-1585478259715-876acc5be8eb"],
  ["Brown butter ravioli", "Ricotta, sage, toasted hazelnut", "Mains", 2450, "photo-1551183053-bf91a1d81141"],
  ["Slow-roast chicken", "Lemon jus, crispy potatoes, garden herbs", "Mains", 2850, "photo-1532550907401-a500c9a57435"],
  ["House-made lemonade", "Meyer lemon, rosemary, sparkle", "Drinks", 620, "photo-1513558161293-cdaf765edfd7"],
  ["Olive oil cake", "Whipped mascarpone, seasonal berries", "Desserts", 950, "photo-1578985545062-69928b1d9587"],
].map((x, i) => ({ _id: `demo-${i + 1}`, nameUr: urNames[i], descriptionUr: urDescriptions[i], name: x[0] as string, description: x[1] as string, category: x[2] as string, price: x[3] as number, image: `https://images.unsplash.com/${x[4]}?auto=format&fit=crop&w=900&q=85`, popular: i === 0 || i === 2 }));
type RestaurantProfile = { name: string; phone?: string; email?: string; address?: string; description?: string };

export default function App() {
  const dispatch = useDispatch<any>();
  const { t } = useTranslation();
  const { items, category, loading: menuLoading } = useSelector((s: RootState) => s.menu);
  const { lines, sending, error: cartError, orderPlaced } = useSelector((s: RootState) => s.cart);
  const { language, dark } = useSelector((s: RootState) => s.preferences);
  const { status: reservationStatus, loading: reservationLoading, error: reservationError } = useSelector((s: RootState) => s.reservations);
  const payment = useSelector((s: RootState) => s.payment);
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeSlug = tenantSlug();
  const restaurantHome = activeSlug === "copper-spoon" && window.location.pathname === "/" ? "/" : `/${activeSlug}`;
  const catalog = items;
  const categories = ["All", ...Array.from(new Set(catalog.map((item) => item.category)))];
  const visibleItems = useMemo(() => catalog.filter((item) => (category === "All" || item.category === category) && `${item.name} ${item.nameUr || ""} ${item.description}`.toLowerCase().includes(query.toLowerCase())), [catalog, category, query]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => { dispatch(menuActions.loadMenuRequest()); }, [dispatch]);
  useEffect(() => { fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/public/restaurants/${activeSlug}`).then((response) => response.ok ? response.json() : Promise.reject(new Error("Restaurant not found"))).then((data) => setRestaurantProfile(data.restaurant)).catch(() => setRestaurantProfile(null)); }, [activeSlug]);
  useEffect(() => { if (items.length) dispatch(cartActions.syncCatalogItems(items)); }, [items, dispatch]);
  useEffect(() => { document.documentElement.dir = language === "ur" ? "rtl" : "ltr"; document.documentElement.lang = language; void i18n.changeLanguage(language); }, [language]);
  useEffect(() => { if (reservationStatus === "success") { setReservationOpen(false); setToast("Your table request has been received."); } }, [reservationStatus]);
  useEffect(() => { if (orderPlaced) { setCartOpen(false); setToast("Your order has been placed. Thank you!"); dispatch(cartActions.resetOrderStatus()); } }, [orderPlaced, dispatch]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(""), 3200); return () => window.clearTimeout(timeout); }, [toast]);
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.getElementById("menu-search")?.focus(); } if (event.key === "Escape") { setCartOpen(false); setReservationOpen(false); setMobileNavOpen(false); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, []);
  useEffect(() => { if (payment.error) setToast(payment.error); }, [payment.error]);
  if (window.location.pathname.split("/").filter(Boolean).at(-1) === "kitchen") return <KitchenDashboard slug={tenantSlug()} />;

  const addProduct = (item: Item) => { dispatch(cartActions.addItem(item)); setToast(`${language === "ur" && item.nameUr ? item.nameUr : item.name} added to your order`); };
  const quantityFor = (id: string) => lines.find((line) => line.item._id === id)?.quantity || 0;

  return <div className={dark ? "app dark" : "app"}>
    <div className="announcement"><span>GOOD FOOD, GOOD COMPANY</span><span className="announcement-detail"><MapPin size={13} /> Gulberg III, Lahore <i /> <Clock3 size={13} /> Daily, 11 am — 10 pm</span></div>
    <header className="site-header">
      <a className="brand" href={`${restaurantHome}#top`} aria-label={`${restaurantProfile?.name || activeSlug} home`}><span className="brand-mark"><Utensils size={20} /></span><span className="brand-name">{restaurantProfile?.name || activeSlug}<small>RESTAURANT & KITCHEN</small></span></a>
      <nav className={mobileNavOpen ? "primary-nav nav-open" : "primary-nav"} aria-label="Main navigation"><a href="#menu" onClick={() => setMobileNavOpen(false)}>{t("menu")}</a><a href="#story" onClick={() => setMobileNavOpen(false)}>{t("about")}</a><a href="#contact" onClick={() => setMobileNavOpen(false)}>Contact</a><button className="nav-reserve" onClick={() => { setReservationOpen(true); setMobileNavOpen(false); }}>{t("reserve")}</button></nav>
      <div className="header-actions"><button className="header-icon" onClick={() => dispatch(preferenceActions.toggleTheme())} aria-label={dark ? "Use light theme" : "Use dark theme"}>{dark ? <Sun /> : <Moon />}</button><button className="language-button" onClick={() => dispatch(preferenceActions.setLanguage(language === "en" ? "ur" : "en"))}>{language === "en" ? "اردو" : "English"}</button><button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Open order, ${count} items`}><ShoppingBag size={18} /><span className="cart-label">Your order</span><b className="cart-count">{count}</b></button><button className="mobile-menu-toggle" onClick={() => setMobileNavOpen(!mobileNavOpen)} aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}>{mobileNavOpen ? <X /> : <MenuIcon />}</button></div>
    </header>

    <main id="top">
      <section className="hero-shell"><div className="hero-content"><p className="eyebrow"><span /> {t("fresh")}</p><h1>Gather around<br /><em>something good.</em></h1><p className="hero-description">Season-led plates, warm bread, and a seat saved just for you. Come hungry, leave happy.</p><div className="hero-actions"><a className="button button-red" href="#menu">Explore the menu <ArrowRight size={17} /></a><button className="text-link" onClick={() => setReservationOpen(true)}>Book a table <ArrowDown size={15} /></button></div><div className="hero-note"><span className="note-stars">★★★★★</span><span>Made fresh daily <i /> Loved around Lahore</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=90" alt="Warmly lit Copper Spoon dining room" /><div className="hero-caption"><span>THE NEIGHBORHOOD TABLE</span><b>Good things happen here.</b></div><div className="hero-stamp"><span>COOKED WITH CARE</span><Utensils size={18} /><span>SHARED WITH LOVE</span></div></div></section>

      <section id="menu" className="menu-section"><div className="section-heading"><div><p className="section-kicker">FROM OUR KITCHEN</p><h2>A little something<br className="desktop-break" /> for every appetite<span>.</span></h2></div><p className="menu-intro">Thoughtful ingredients, generous portions, and flavors worth slowing down for.</p></div>
        <div className="menu-toolbar"><div className="category-list" role="group" aria-label="Filter menu by category">{categories.map((cat) => <button key={cat} className={category === cat ? "category-chip active" : "category-chip"} onClick={() => dispatch(menuActions.setCategory(cat))}>{cat === "All" ? t("all") : cat}</button>)}</div><label className="search-box"><Search size={17} /><input ref={searchRef} id="menu-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} /><span>⌘ K</span></label></div>
        {menuLoading && !items.length && <div className="menu-status">Preparing the menu…</div>}
        {!menuLoading && !items.length && <div className="demo-notice">{activeSlug === "copper-spoon" ? "Preview menu · Start the API to load the live restaurant menu." : `${restaurantProfile?.name || activeSlug} has not published its menu yet.`}</div>}
        {visibleItems.length ? <div className="product-grid">{visibleItems.map((item) => <ProductCard key={item._id} item={item} language={language} quantity={quantityFor(item._id)} onAdd={addProduct} />)}</div> : <div className="menu-status">No dishes match that search. Try another name.</div>}
        <div className="menu-bottom"><span>All dishes are prepared fresh when ordered.</span><a href={`/${tenantSlug()}/kitchen`}>Staff portal <ArrowRight size={14} /></a></div>
      </section>

      <section id="story" className="story-section"><div className="story-image"><img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1100&q=85" alt="Seasonal dishes served at a shared table" /><span>OUR PLACE · LAHORE</span></div><div className="story-copy"><p className="section-kicker">A TABLE FOR EVERYONE</p><h2>Good food is<br /><em>our way of saying hello.</em></h2><p>We cook with the seasons, work with our neighborhood growers, and make room at the table for everyone. Whether it is a quick lunch or a long evening, you are always welcome here.</p><button className="button button-outline" onClick={() => setReservationOpen(true)}>Save your seat <ArrowRight size={16} /></button><div className="story-detail"><span><b>01</b> Seasonal ingredients</span><span><b>02</b> Made fresh, every day</span></div></div></section>
    </main>

    <ContactSection name={restaurantProfile?.name || activeSlug} email={restaurantProfile?.email} phone={restaurantProfile?.phone} address={restaurantProfile?.address} home={restaurantHome} />
    {count > 0 && <button className="mobile-cart-bar" onClick={() => setCartOpen(true)}><span><ShoppingBag size={17} /> View your order <b>{count}</b></span><strong>PKR {lines.reduce((sum, line) => sum + line.quantity * line.item.price, 0).toLocaleString()} <ArrowRight size={16} /></strong></button>}
    {restaurantProfile?.phone && <a className="whatsapp-button" href={`https://wa.me/${restaurantProfile.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hello ${restaurantProfile.name}`)}`} target="_blank" rel="noreferrer" aria-label={`Contact ${restaurantProfile.name} on WhatsApp`}>wa</a>}
    {toast && <div className="toast-message" role="status"><Check size={17} /> {toast}</div>}
    <CartDrawer open={cartOpen} lines={lines} busy={sending || payment.loading} error={cartError || payment.error} onClose={() => setCartOpen(false)} onAdd={(id) => { const line = lines.find((entry) => entry.item._id === id); if (line) dispatch(cartActions.addItem(line.item)); }} onDecrement={(id) => dispatch(cartActions.decrementItem(id))} onRemove={(id) => dispatch(cartActions.removeItem(id))} onCheckout={(data) => dispatch(cartActions.placeOrderRequest(data))} />

    {reservationOpen && <ReservationModal open={reservationOpen} busy={reservationLoading} error={reservationError} onClose={() => setReservationOpen(false)} onSubmit={(input) => dispatch(reservationActions.submitRequest(input))} />}
  </div>;
}




