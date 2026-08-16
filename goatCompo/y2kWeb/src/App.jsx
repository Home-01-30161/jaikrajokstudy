import { useState, useContext, createContext, useReducer, useEffect } from "react";
import { PRODUCTS, CATEGORIES, BRANDS, ORDERS, ADMIN_ORDERS, REVIEWS, REVENUE_DATA } from "./data.js";

// ===================== CONTEXT =====================
const CartContext = createContext();
const AuthContext = createContext();

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const existing = state.find(i => i.id === action.product.id);
      if (existing) return state.map(i => i.id === action.product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...state, { ...action.product, qty: 1 }];
    }
    case "REMOVE": return state.filter(i => i.id !== action.id);
    case "UPDATE_QTY": return state.map(i => i.id === action.id ? { ...i, qty: Math.max(1, action.qty) } : i);
    case "CLEAR": return [];
    default: return state;
  }
}

// ===================== HELPERS =====================
const fmt = (n) => `฿${n.toLocaleString()}`;
const stars = (r) => Array.from({ length: 5 }, (_, i) => i < Math.floor(r) ? "★" : "☆").join("");

// ===================== ICONS (SVG) =====================
const Icon = ({ name, size = 20, className = "" }) => {
  const icons = {
    cart: <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    menu: <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>,
    minus: <line x1="5" y1="12" x2="19" y2="12"/>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    chevronRight: <polyline points="9 18 15 12 9 6"/>,
    chevronLeft: <polyline points="15 18 9 12 15 6"/>,
    chevronDown: <polyline points="6 9 12 15 18 9"/>,
    check: <polyline points="20 6 9 17 4 12"/>,
    package: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    truck: <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>,
    phone: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.65 3.39 2 2 0 013.64 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    barChart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
};

// ===================== STAR RATING =====================
const StarRating = ({ rating, size = 14 }) => (
  <span style={{ color: "#f59e0b", fontSize: size }}>
    {Array.from({ length: 5 }, (_, i) => i < Math.floor(rating) ? "★" : "☆").join("")}
  </span>
);

// ===================== BADGE =====================
const Badge = ({ children, variant = "red" }) => {
  const cls = { red: "badge-red", green: "badge-green", grey: "badge-grey", orange: "badge-orange" };
  return <span className={`badge ${cls[variant] || "badge-grey"}`}>{children}</span>;
};

// ===================== NAVBAR =====================
function Navbar({ page, setPage, cartItems, setCartOpen, mobileMenuOpen, setMobileMenuOpen }) {
  const [searchVal, setSearchVal] = useState("");
  const totalQty = cartItems.reduce((s, i) => s + i.qty, 0);

  const navLinks = [
    { label: "Shop",        p: "products" },
    { label: "Guitar",      p: "category-guitar" },
    { label: "Drums",       p: "category-drums" },
    { label: "Keys",        p: "category-keys" },
    { label: "DJ",          p: "category-dj" },
    { label: "About",       p: "about" },
  ];

  return (
    <nav style={{ background: "#080808", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, zIndex: 100 }}>
      {/* Top bar */}
      <div style={{ background: "#cc0000", padding: "4px 0", overflow: "hidden" }}>
        <div className="marquee-container">
          <span className="marquee-content font-display" style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "white" }}>
            ⚡ FREE SHIPPING OVER ฿2,000 &nbsp;•&nbsp; ⚡ NEW ARRIVALS: IBANEZ RG550 &amp; PIONEER DDJ-REV7 &nbsp;•&nbsp; ⚡ PRICE MATCH GUARANTEE &nbsp;•&nbsp; ⚡ OPEN MON-SAT 10AM-8PM &nbsp;•&nbsp; ⚡ FREE SHIPPING OVER ฿2,000 &nbsp;•&nbsp; ⚡ NEW ARRIVALS IN STOCK NOW
          </span>
        </div>
      </div>

      {/* Main nav */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", height: 64 }}>
        {/* Logo */}
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
          <span className="glitch-text" style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.05em", color: "white" }}>
            HYBRID<span style={{ color: "#cc0000" }}>FORMULA</span>
          </span>
        </button>

        {/* Nav Links — desktop */}
        <div className="hide-mobile" style={{ display: "flex", gap: "1.5rem", flex: 1 }}>
          {navLinks.map(n => (
            <button key={n.p} className={`nav-link ${page === n.p ? "active" : ""}`} onClick={() => setPage(n.p)}
              style={{ background: "none", border: "none", cursor: "pointer" }}>
              {n.label}
            </button>
          ))}
        </div>

        {/* Search — desktop */}
        <div className="hide-mobile" style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && searchVal) { setPage("search:" + searchVal); setSearchVal(""); }}}
            placeholder="SEARCH GEAR..." style={{ paddingRight: "2.5rem", fontSize: "0.75rem" }} />
          <button onClick={() => { if (searchVal) { setPage("search:" + searchVal); setSearchVal(""); }}}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#666" }}>
            <Icon name="search" size={16} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <button onClick={() => setPage("profile")} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a8b3" }}>
            <Icon name="user" size={20} />
          </button>
          <button onClick={() => setPage("orders")} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a8b3" }}>
            <Icon name="package" size={20} />
          </button>
          <button onClick={() => setCartOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a8b3", position: "relative" }}>
            <Icon name="cart" size={20} />
            {totalQty > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#cc0000", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                {totalQty}
              </span>
            )}
          </button>
          {/* Mobile menu toggle */}
          <button className="show-mobile-only" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a8a8b3" }}>
            <Icon name={mobileMenuOpen ? "x" : "menu"} size={24} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div style={{ background: "#0f0f0f", borderTop: "1px solid #1a1a1a", padding: "1rem 1.5rem" }}>
          {navLinks.map(n => (
            <button key={n.p} onClick={() => { setPage(n.p); setMobileMenuOpen(false); }}
              style={{ display: "block", width: "100%", background: "none", border: "none", cursor: "pointer", color: "#a8a8b3", fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.75rem 0", textAlign: "left", borderBottom: "1px solid #1a1a1a" }}>
              {n.label}
            </button>
          ))}
          <div style={{ marginTop: "1rem", position: "relative" }}>
            <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && searchVal) { setPage("search:" + searchVal); setSearchVal(""); setMobileMenuOpen(false); }}}
              placeholder="SEARCH GEAR..." />
          </div>
        </div>
      )}
    </nav>
  );
}

// ===================== FOOTER =====================
function Footer({ setPage }) {
  return (
    <footer style={{ background: "#050505", borderTop: "1px solid #1a1a1a", padding: "3rem 1.5rem 1.5rem", marginTop: "auto" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem", marginBottom: "2rem" }}>
          <div>
            <div className="glitch-text" style={{ fontSize: "1.2rem", fontWeight: 900, color: "white", marginBottom: "0.75rem" }}>
              HYBRID<span style={{ color: "#cc0000" }}>FORMULA</span>
            </div>
            <p style={{ color: "#666", fontSize: "0.75rem", lineHeight: 1.7 }}>The heaviest gear shop in Thailand. Built for players who refuse to compromise.</p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              {["FB", "IG", "YT", "TW"].map(s => (
                <div key={s} style={{ width: 32, height: 32, border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.65rem", color: "#666", fontFamily: "var(--font-display)" }}>{s}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>NAVIGATION</div>
            {["Products", "Guitar", "Bass", "Drums", "Keys", "DJ / Electronic", "Accessories"].map(l => (
              <button key={l} onClick={() => setPage(l === "Products" ? "products" : "category-" + l.toLowerCase().split(" ")[0])}
                style={{ display: "block", background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: "0.75rem", padding: "0.25rem 0", fontFamily: "var(--font-body)" }}>{l}</button>
            ))}
          </div>
          <div>
            <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>SUPPORT</div>
            {["My Account", "Order History", "Shipping Info", "Returns Policy", "Contact Us", "FAQ"].map(l => (
              <div key={l} style={{ color: "#666", fontSize: "0.75rem", padding: "0.25rem 0", cursor: "pointer" }}>{l}</div>
            ))}
          </div>
          <div>
            <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", marginBottom: "1rem" }}>NEWSLETTER</div>
            <p style={{ color: "#666", fontSize: "0.75rem", marginBottom: "0.75rem" }}>New drops. Exclusive deals. No spam.</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input placeholder="your@email.com" style={{ flex: 1, fontSize: "0.75rem" }} />
              <button className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.65rem" }}>JOIN</button>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <span style={{ color: "#444", fontSize: "0.7rem", fontFamily: "var(--font-display)" }}>© 2024 HYBRIDFORMULA.COM — ALL RIGHTS RESERVED</span>
          <span style={{ color: "#444", fontSize: "0.7rem" }}>VISA • MASTERCARD • PROMPTPAY • BANK TRANSFER</span>
        </div>
      </div>
    </footer>
  );
}

// ===================== PRODUCT CARD =====================
function ProductCard({ product, onAddToCart, onClick }) {
  const discount = product.salePrice ? Math.round((1 - product.salePrice / product.price) * 100) : null;
  return (
    <div className="card-product" style={{ cursor: "pointer" }} onClick={() => onClick(product.id)}>
      <div className="card-image" style={{ position: "relative", aspectRatio: "1/1", overflow: "hidden", background: "#0d0d0d" }}>
        <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, transition: "opacity 0.2s" }}
          onMouseEnter={e => e.target.style.opacity = 1} onMouseLeave={e => e.target.style.opacity = 0.85} />
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {discount && <Badge variant="red">-{discount}%</Badge>}
          {product.isNew && <Badge variant="green">NEW</Badge>}
        </div>
        <button onClick={e => { e.stopPropagation(); }}
          style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.7)", border: "1px solid #2a2a2a", borderRadius: 2, padding: 6, cursor: "pointer", color: "#666", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#cc0000"; e.currentTarget.style.borderColor = "#cc0000"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#2a2a2a"; }}>
          <Icon name="heart" size={14} />
        </button>
      </div>
      <div style={{ padding: "0.875rem" }}>
        <div style={{ color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>{product.brand}</div>
        <div style={{ color: "#e8e8e8", fontSize: "0.8rem", marginBottom: "0.5rem", lineHeight: 1.3, fontFamily: "var(--font-body)" }}>{product.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <StarRating rating={product.rating} size={11} />
          <span style={{ color: "#666", fontSize: "0.65rem" }}>({product.reviews})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {product.salePrice ? (
              <div>
                <span style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700 }}>{fmt(product.salePrice)}</span>
                <span style={{ color: "#555", fontSize: "0.7rem", textDecoration: "line-through", marginLeft: 6 }}>{fmt(product.price)}</span>
              </div>
            ) : (
              <span style={{ color: "#e8e8e8", fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700 }}>{fmt(product.price)}</span>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); onAddToCart(product); }}
            className="btn-primary" style={{ padding: "0.4rem 0.75rem", fontSize: "0.6rem" }}>ADD</button>
        </div>
      </div>
    </div>
  );
}

// ===================== CART DRAWER =====================
function CartDrawer({ items, open, onClose, dispatch, setPage }) {
  const subtotal = items.reduce((s, i) => s + (i.salePrice || i.price) * i.qty, 0);
  return (
    <>
      <div className={`overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`cart-drawer ${open ? "open" : ""}`}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.15em", color: "white" }}>
            CART <span style={{ color: "#cc0000" }}>({items.reduce((s,i) => s + i.qty, 0)})</span>
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Icon name="x" size={20} /></button>
        </div>

        {items.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#444", padding: "2rem" }}>
            <pre style={{ fontSize: "0.7rem", color: "#333", lineHeight: 1.4, textAlign: "center" }}>
{`    |\\
    | \\
    |  \\
   /|   |
  / |   |
 |  |   |
  \\ |   /
   \\|  /
    |_/
   /___\\`}
            </pre>
            <div style={{ marginTop: "1rem", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em", color: "#444" }}>NO GEAR IN CART</div>
            <button onClick={onClose} className="btn-outline" style={{ marginTop: "1.5rem", fontSize: "0.65rem" }}>CONTINUE SHOPPING</button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #1a1a1a" }}>
                  <img src={item.image} alt={item.name} style={{ width: 72, height: 72, objectFit: "cover", opacity: 0.85, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.75rem", color: "#e8e8e8", marginBottom: "0.25rem", lineHeight: 1.3 }}>{item.name}</div>
                    <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{fmt(item.salePrice || item.price)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button className="qty-btn" onClick={() => dispatch({ type: "UPDATE_QTY", id: item.id, qty: item.qty - 1 })}><Icon name="minus" size={12} /></button>
                      <span style={{ fontSize: "0.8rem", minWidth: 24, textAlign: "center" }}>{item.qty}</span>
                      <button className="qty-btn" onClick={() => dispatch({ type: "UPDATE_QTY", id: item.id, qty: item.qty + 1 })}><Icon name="plus" size={12} /></button>
                      <button onClick={() => dispatch({ type: "REMOVE", id: item.id })} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#444" }}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #1a1a1a" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ color: "#666", fontSize: "0.75rem" }}>SUBTOTAL</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "white" }}>{fmt(subtotal)}</span>
              </div>
              {subtotal < 2000 && (
                <div style={{ background: "#1a1a0a", border: "1px solid #3a3a00", padding: "0.5rem", marginBottom: "0.75rem", fontSize: "0.7rem", color: "#f59e0b" }}>
                  Add {fmt(2000 - subtotal)} more for FREE shipping
                </div>
              )}
              <button onClick={() => { onClose(); setPage("cart"); }} className="btn-outline" style={{ width: "100%", marginBottom: "0.5rem" }}>VIEW CART</button>
              <button onClick={() => { onClose(); setPage("checkout"); }} className="btn-primary" style={{ width: "100%" }}>CHECKOUT →</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ===================== HOME PAGE =====================
function HomePage({ setPage, onAddToCart }) {
  const featured = PRODUCTS.filter(p => p.isFeatured);
  const newArrivals = PRODUCTS.filter(p => p.isNew);

  return (
    <div>
      {/* HERO */}
      <div className="hero-bg diagonal-stripe" style={{ minHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "4rem 1.5rem", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url('https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=1600&auto=format')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.08 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center", marginBottom: "1.5rem" }}>
            <div style={{ height: 1, width: 60, background: "#cc0000" }} />
            <span style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.3em" }}>ESTABLISHED 2001</span>
            <div style={{ height: 1, width: 60, background: "#cc0000" }} />
          </div>

          <h1 className="glitch-text" style={{ fontSize: "clamp(2.5rem, 10vw, 7rem)", fontWeight: 900, lineHeight: 0.9, marginBottom: "1rem", letterSpacing: "-0.02em" }}>
            HYBRID<br /><span style={{ color: "#cc0000", WebkitTextStroke: "2px #cc0000", WebkitTextFillColor: "transparent" }}>FORMULA</span>
            <span style={{ color: "#39ff14", fontSize: "0.3em", display: "block", letterSpacing: "0.5em", WebkitTextStroke: "1px #39ff14", WebkitTextFillColor: "transparent" }}>.COM</span>
          </h1>

          <p style={{ color: "#a8a8b3", fontFamily: "var(--font-heading)", fontSize: "clamp(0.9rem, 2.5vw, 1.4rem)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "2.5rem", maxWidth: 600, margin: "0 auto 2.5rem" }}>
            Gear For The Heavy.<br />
            <span style={{ color: "#555", fontSize: "0.8em" }}>Thailand's Premier Metal & Rock Instrument Store</span>
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => setPage("products")} style={{ fontSize: "0.8rem", padding: "1rem 2.5rem" }}>
              SHOP NOW ⚡
            </button>
            <button className="btn-outline" onClick={() => setPage("products")} style={{ fontSize: "0.8rem", padding: "1rem 2.5rem" }}>
              EXPLORE GEAR →
            </button>
          </div>

          <div style={{ display: "flex", gap: "3rem", justifyContent: "center", marginTop: "4rem", flexWrap: "wrap" }}>
            {[["500+", "PRODUCTS"], ["50K+", "CUSTOMERS"], ["10YRS", "EXPERIENCE"], ["FREE", "SHIPPING ฿2K+"]].map(([n, l]) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 900, color: "#cc0000" }}>{n}</div>
                <div style={{ color: "#555", fontSize: "0.65rem", letterSpacing: "0.2em" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CATEGORIES */}
      <div style={{ background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ height: 2, width: 30, background: "#cc0000" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#cc0000" }}>SHOP BY CATEGORY</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {CATEGORIES.map(cat => (
              <button key={cat.slug} onClick={() => setPage("category-" + cat.slug)}
                style={{ background: "#111", border: "1px solid #2a2a2a", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", cursor: "pointer", transition: "all 0.15s", borderRadius: 2 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#cc0000"; e.currentTarget.style.boxShadow = "0 0 20px rgba(204,0,0,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.boxShadow = "none"; }}>
                <span style={{ fontSize: "2rem" }}>{cat.icon}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.1em", color: "#a8a8b3", textTransform: "uppercase" }}>{cat.label}</span>
                <span style={{ color: "#555", fontSize: "0.65rem" }}>{cat.count} items</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURED PRODUCTS */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ height: 2, width: 30, background: "#cc0000" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#cc0000" }}>FEATURED GEAR</span>
          </div>
          <button className="btn-outline" onClick={() => setPage("products")} style={{ fontSize: "0.65rem", padding: "0.4rem 1rem" }}>VIEW ALL →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {featured.slice(0, 8).map(p => (
            <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onClick={id => setPage("product-" + id)} />
          ))}
        </div>
      </div>

      {/* PROMO BANNER */}
      <div style={{ background: "#cc0000", padding: "1.25rem 0", overflow: "hidden" }}>
        <div className="marquee-container">
          <span className="marquee-content font-display" style={{ fontSize: "0.8rem", letterSpacing: "0.3em", color: "white", fontWeight: 700 }}>
            ⚡ FREE SHIPPING OVER ฿2,000 &nbsp;///&nbsp; PRICE MATCH GUARANTEE &nbsp;///&nbsp; EMI AVAILABLE &nbsp;///&nbsp; AUTHORIZED DEALER &nbsp;///&nbsp; SAME-DAY DISPATCH BEFORE 2PM &nbsp;///&nbsp;
            ⚡ FREE SHIPPING OVER ฿2,000 &nbsp;///&nbsp; PRICE MATCH GUARANTEE &nbsp;///&nbsp; EMI AVAILABLE &nbsp;///&nbsp;
          </span>
        </div>
      </div>

      {/* NEW ARRIVALS */}
      <div style={{ background: "#0a0a0a", padding: "3rem 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ height: 2, width: 30, background: "#39ff14" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#39ff14" }}>NEW ARRIVALS</span>
          </div>
          <div className="scrollbar-hide" style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
            {newArrivals.map(p => (
              <div key={p.id} style={{ minWidth: 220, flexShrink: 0 }}>
                <ProductCard product={p} onAddToCart={onAddToCart} onClick={id => setPage("product-" + id)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BRANDS */}
      <div style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", padding: "2rem 0", overflow: "hidden" }}>
        <div className="marquee-container">
          <span className="marquee-content" style={{ display: "inline-flex", gap: "3rem", alignItems: "center" }}>
            {[...BRANDS, ...BRANDS].map((b, i) => (
              <span key={i} style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.2em", color: "#333", fontWeight: 700, whiteSpace: "nowrap" }}>{b}</span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUCTS PAGE =====================
function ProductsPage({ setPage, onAddToCart, initialCategory = null, searchQuery = null }) {
  const [filters, setFilters] = useState({ category: initialCategory || "", brand: "", minPrice: 0, maxPrice: 200000, condition: "", rating: 0 });
  const [sort, setSort] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 9;

  let filtered = PRODUCTS;
  if (filters.category) filtered = filtered.filter(p => p.category === filters.category);
  if (filters.brand) filtered = filtered.filter(p => p.brand === filters.brand);
  if (filters.rating) filtered = filtered.filter(p => p.rating >= filters.rating);
  filtered = filtered.filter(p => (p.salePrice || p.price) >= filters.minPrice && (p.salePrice || p.price) <= filters.maxPrice);
  if (searchQuery) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase()) || p.tags.some(t => t.includes(searchQuery.toLowerCase())));

  if (sort === "price-asc") filtered = [...filtered].sort((a,b) => (a.salePrice||a.price)-(b.salePrice||b.price));
  else if (sort === "price-desc") filtered = [...filtered].sort((a,b) => (b.salePrice||b.price)-(a.salePrice||a.price));
  else if (sort === "rating") filtered = [...filtered].sort((a,b) => b.rating-a.rating);
  else if (sort === "popular") filtered = [...filtered].sort((a,b) => b.reviews-a.reviews);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((currentPage-1)*PER_PAGE, currentPage*PER_PAGE);

  const activeFilters = [
    filters.category && { label: filters.category, key: "category" },
    filters.brand && { label: filters.brand, key: "brand" },
    filters.rating && { label: `${filters.rating}+ stars`, key: "rating" },
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem", fontSize: "0.7rem", color: "#555" }}>
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontFamily: "var(--font-body)" }}>HOME</button>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "#cc0000" }}>{searchQuery ? `SEARCH: ${searchQuery.toUpperCase()}` : initialCategory ? initialCategory.toUpperCase() : "ALL PRODUCTS"}</span>
      </div>

      {/* Search bar if search mode */}
      {searchQuery !== null && (
        <div style={{ marginBottom: "1.5rem" }}>
          <input defaultValue={searchQuery} style={{ fontSize: "1rem", padding: "0.875rem 1rem" }} placeholder="SEARCH GEAR..." />
          <div style={{ color: "#666", fontSize: "0.75rem", marginTop: "0.5rem" }}>{filtered.length} results for "<span style={{ color: "#e8e8e8" }}>{searchQuery}</span>"</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "2rem" }}>
        {/* Sidebar */}
        <div className="hide-mobile">
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.25rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1.25rem" }}>FILTER</div>

            {/* Category */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#666", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>CATEGORY</div>
              {CATEGORIES.map(c => (
                <label key={c.slug} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" className="checkbox-custom" checked={filters.category === c.slug}
                    onChange={() => setFilters(f => ({ ...f, category: f.category === c.slug ? "" : c.slug }))} />
                  <span style={{ fontSize: "0.75rem", color: "#a8a8b3" }}>{c.label}</span>
                  <span style={{ color: "#555", fontSize: "0.65rem", marginLeft: "auto" }}>{c.count}</span>
                </label>
              ))}
            </div>

            {/* Brand */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#666", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>BRAND</div>
              <select value={filters.brand} onChange={e => setFilters(f => ({ ...f, brand: e.target.value }))}>
                <option value="">All Brands</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Price Range */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#666", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                PRICE RANGE: {fmt(filters.minPrice)} – {fmt(filters.maxPrice)}
              </div>
              <input type="range" className="range-input" min={0} max={200000} step={1000} value={filters.maxPrice}
                onChange={e => setFilters(f => ({ ...f, maxPrice: +e.target.value }))} style={{ width: "100%" }} />
            </div>

            {/* Rating */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#666", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>MIN RATING</div>
              {[4, 3, 2].map(r => (
                <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer" }}>
                  <input type="radio" name="rating" checked={filters.rating === r} onChange={() => setFilters(f => ({ ...f, rating: r }))}
                    style={{ accentColor: "#cc0000" }} />
                  <StarRating rating={r} size={11} />
                  <span style={{ color: "#666", fontSize: "0.7rem" }}>& up</span>
                </label>
              ))}
            </div>

            <button onClick={() => setFilters({ category: "", brand: "", minPrice: 0, maxPrice: 200000, condition: "", rating: 0 })}
              className="btn-outline" style={{ width: "100%", fontSize: "0.65rem" }}>CLEAR FILTERS</button>
          </div>
        </div>

        {/* Main content */}
        <div>
          {/* Sort bar + active filters */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span style={{ color: "#555", fontSize: "0.75rem" }}>{filtered.length} products</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#666", fontSize: "0.7rem" }}>SORT:</span>
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ fontSize: "0.7rem", padding: "0.4rem 0.6rem", width: "auto" }}>
                <option value="latest">Latest</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
                <option value="popular">Popularity</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {activeFilters.map(f => (
                <span key={f.key} style={{ background: "#1a0000", border: "1px solid #cc0000", color: "#cc0000", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.05em", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}
                  onClick={() => setFilters(filt => ({ ...filt, [f.key]: "" }))}>
                  {f.label} <Icon name="x" size={10} />
                </span>
              ))}
            </div>
          )}

          {/* Grid */}
          {paged.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#444" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "#2a2a2a", marginBottom: "1rem" }}>404</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>NO GEAR FOUND</div>
              <div style={{ fontSize: "0.75rem", color: "#555" }}>Try adjusting your filters or search terms.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
              {paged.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onClick={id => setPage("product-" + id)} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "2rem" }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="btn-outline" style={{ padding: "0.4rem 0.75rem" }}>
                <Icon name="chevronLeft" size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i+1} onClick={() => setCurrentPage(i+1)}
                  style={{ width: 36, height: 36, background: currentPage === i+1 ? "#cc0000" : "#111", border: `1px solid ${currentPage === i+1 ? "#cc0000" : "#2a2a2a"}`, color: "white", fontFamily: "var(--font-display)", fontSize: "0.75rem", cursor: "pointer", borderRadius: 2 }}>
                  {i+1}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} className="btn-outline" style={{ padding: "0.4rem 0.75rem" }}>
                <Icon name="chevronRight" size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== PRODUCT DETAIL PAGE =====================
function ProductDetailPage({ productId, setPage, onAddToCart }) {
  const product = PRODUCTS.find(p => p.id === productId);
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [mainImg, setMainImg] = useState(0);
  const [activeSpec, setActiveSpec] = useState(null);
  const related = PRODUCTS.filter(p => p.category === product?.category && p.id !== product?.id).slice(0, 4);

  if (!product) return <div style={{ padding: "4rem", textAlign: "center", color: "#666" }}>Product not found</div>;

  const discount = product.salePrice ? Math.round((1 - product.salePrice / product.price) * 100) : null;
  const productReviews = REVIEWS.filter(r => r.productId === product.id);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.5rem", fontSize: "0.7rem", color: "#555" }}>
        <button onClick={() => setPage("home")} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontFamily: "var(--font-body)" }}>HOME</button>
        <Icon name="chevronRight" size={12} />
        <button onClick={() => setPage("products")} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", fontFamily: "var(--font-body)" }}>PRODUCTS</button>
        <Icon name="chevronRight" size={12} />
        <span style={{ color: "#cc0000" }}>{product.name.toUpperCase()}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem" }}>
        {/* Gallery */}
        <div>
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", aspectRatio: "1/1", overflow: "hidden", marginBottom: "0.75rem", position: "relative" }}>
            <img src={product.images[mainImg] || product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
              onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.target.style.transform = "scale(1)"} />
            {discount && (
              <div style={{ position: "absolute", top: 12, left: 12 }}><Badge variant="red">SAVE {discount}%</Badge></div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {product.images.map((img, i) => (
              <button key={i} onClick={() => setMainImg(i)}
                style={{ width: 72, height: 72, overflow: "hidden", border: `2px solid ${mainImg === i ? "#cc0000" : "#1a1a1a"}`, background: "none", cursor: "pointer", borderRadius: 2, padding: 0 }}>
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>{product.brand}</div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.2rem, 3vw, 1.8rem)", color: "white", marginBottom: "0.75rem", lineHeight: 1.2 }}>{product.name}</h1>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <StarRating rating={product.rating} size={14} />
            <span style={{ color: "#666", fontSize: "0.75rem" }}>{product.rating} ({product.reviews} reviews)</span>
            <span style={{ color: "#555", fontSize: "0.7rem" }}>SKU: {product.sku}</span>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            {product.salePrice ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 900, color: "#cc0000" }}>{fmt(product.salePrice)}</span>
                <span style={{ color: "#555", fontSize: "1rem", textDecoration: "line-through" }}>{fmt(product.price)}</span>
                <Badge variant="red">SAVE {fmt(product.price - product.salePrice)}</Badge>
              </div>
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 900, color: "#e8e8e8" }}>{fmt(product.price)}</span>
            )}
          </div>

          {/* Stock */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: product.stock > 0 ? "#39ff14" : "#cc0000", boxShadow: product.stock > 0 ? "0 0 6px #39ff14" : "0 0 6px #cc0000" }} />
            <span style={{ fontSize: "0.75rem", color: product.stock > 0 ? "#39ff14" : "#cc0000" }}>
              {product.stock > 5 ? "IN STOCK" : product.stock > 0 ? `ONLY ${product.stock} LEFT` : "OUT OF STOCK"}
            </span>
          </div>

          {/* Quantity */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #2a2a2a", borderRadius: 2 }}>
              <button className="qty-btn" onClick={() => setQty(q => Math.max(1, q-1))} style={{ borderRadius: 0 }}><Icon name="minus" size={14} /></button>
              <span style={{ padding: "0 1rem", fontFamily: "var(--font-display)", fontSize: "0.9rem", minWidth: 40, textAlign: "center" }}>{qty}</span>
              <button className="qty-btn" onClick={() => setQty(q => q+1)} style={{ borderRadius: 0 }}><Icon name="plus" size={14} /></button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => { for(let i=0;i<qty;i++) onAddToCart(product); }}
              style={{ flex: 1, fontSize: "0.8rem", padding: "1rem", minWidth: 160, animation: "pulse-red 2s infinite" }}>
              ADD TO CART ⚡
            </button>
            <button className="btn-outline" style={{ padding: "1rem" }}><Icon name="heart" size={16} /></button>
          </div>

          {/* Shipping info */}
          <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {[
              { icon: "truck", text: "Free shipping on orders over ฿2,000" },
              { icon: "check", text: "In stock — ships within 1-2 business days" },
              { icon: "zap", text: "Same-day dispatch on orders before 2PM" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Icon name={icon} size={14} className="text-primary" style={{ color: "#cc0000", flexShrink: 0 }} />
                <span style={{ fontSize: "0.75rem", color: "#a8a8b3" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: "3rem" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", marginBottom: "1.5rem", gap: "0" }}>
          {["description", "specs", "reviews", "shipping"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.75rem 1.5rem", fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase" }}
              className={activeTab === tab ? "tab-active" : "tab-inactive"}>
              {tab === "reviews" ? `Reviews (${productReviews.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "description" && (
          <div style={{ color: "#a8a8b3", fontSize: "0.875rem", lineHeight: 1.8, maxWidth: 800 }}>{product.description}</div>
        )}

        {activeTab === "specs" && (
          <div style={{ maxWidth: 600 }}>
            {Object.entries(product.specs).map(([key, val]) => (
              <div key={key} style={{ display: "flex", borderBottom: "1px solid #1a1a1a", padding: "0.75rem 0" }}>
                <span style={{ width: 160, color: "#666", fontSize: "0.75rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{key}</span>
                <span style={{ color: "#e8e8e8", fontSize: "0.8rem" }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginBottom: "2rem", background: "#0d0d0d", padding: "1.5rem", border: "1px solid #1a1a1a" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "3rem", fontWeight: 900, color: "#cc0000" }}>{product.rating}</div>
                <StarRating rating={product.rating} size={16} />
                <div style={{ color: "#666", fontSize: "0.7rem", marginTop: 4 }}>{product.reviews} reviews</div>
              </div>
              <div style={{ flex: 1 }}>
                {[5,4,3,2,1].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ color: "#666", fontSize: "0.7rem", width: 8 }}>{s}</span>
                    <div style={{ flex: 1, height: 4, background: "#1a1a1a" }}>
                      <div style={{ width: s === 5 ? "70%" : s === 4 ? "20%" : "10%", height: "100%", background: "#f59e0b" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {productReviews.map(r => (
              <div key={r.id} style={{ borderBottom: "1px solid #1a1a1a", padding: "1.25rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: 32, height: 32, background: "#cc0000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "white" }}>
                      {r.user.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: "#e8e8e8", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{r.user}</div>
                      <StarRating rating={r.rating} size={11} />
                    </div>
                  </div>
                  <span style={{ color: "#555", fontSize: "0.7rem" }}>{r.date}</span>
                </div>
                <p style={{ color: "#a8a8b3", fontSize: "0.8rem", lineHeight: 1.7 }}>{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "shipping" && (
          <div style={{ maxWidth: 600, color: "#a8a8b3", fontSize: "0.8rem", lineHeight: 1.9 }}>
            <p><strong style={{ color: "#e8e8e8" }}>Standard Shipping (2-3 business days):</strong> ฿150 for orders under ฿2,000. FREE for orders over ฿2,000.</p>
            <p style={{ marginTop: "0.75rem" }}><strong style={{ color: "#e8e8e8" }}>Express Shipping (next business day):</strong> ฿350 flat rate. Order before 2PM for same-day dispatch.</p>
            <p style={{ marginTop: "0.75rem" }}><strong style={{ color: "#e8e8e8" }}>Returns:</strong> 30-day returns on all new, unused items in original packaging. Some exceptions apply for electronics.</p>
          </div>
        )}
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div style={{ marginTop: "4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ height: 2, width: 30, background: "#cc0000" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#cc0000" }}>YOU MIGHT ALSO LIKE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
            {related.map(p => (
              <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} onClick={id => setPage("product-" + id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== CART PAGE =====================
function CartPage({ items, dispatch, setPage }) {
  const subtotal = items.reduce((s, i) => s + (i.salePrice || i.price) * i.qty, 0);
  const shipping = subtotal >= 2000 ? 0 : 150;
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState(0);

  const applyCode = () => {
    if (code.toUpperCase() === "METAL10") setDiscount(Math.round(subtotal * 0.1));
    else setDiscount(0);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ height: 2, width: 30, background: "#cc0000" }} />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.2em", color: "white" }}>SHOPPING CART</h1>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
          <pre style={{ fontSize: "0.8rem", color: "#2a2a2a", lineHeight: 1.5, marginBottom: "1.5rem" }}>
{`    |\\      _,,,---,,_
/,\`.-'\`'    -.  ;-;;,_
|,4-  ) )-,_..;\\ (  \`'-'
'---''(_/--'  \`-'\\_)
     
   NO GEAR HERE`}
          </pre>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.2em", color: "#444", marginBottom: "1rem" }}>YOUR CART IS EMPTY</div>
          <button onClick={() => setPage("products")} className="btn-primary">CONTINUE SHOPPING →</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "2rem" }}>
          {/* Items */}
          <div>
            <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a" }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ padding: "1.25rem", borderBottom: idx < items.length-1 ? "1px solid #1a1a1a" : "none", display: "flex", gap: "1rem", alignItems: "center" }}>
                  <img src={item.image} alt={item.name} style={{ width: 80, height: 80, objectFit: "cover", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", color: "#e8e8e8", marginBottom: "0.25rem" }}>{item.name}</div>
                    <div style={{ color: "#555", fontSize: "0.7rem", marginBottom: "0.5rem" }}>{item.brand}</div>
                    <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.8rem" }}>{fmt(item.salePrice || item.price)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button className="qty-btn" onClick={() => dispatch({ type: "UPDATE_QTY", id: item.id, qty: item.qty-1 })}><Icon name="minus" size={12} /></button>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", width: 28, textAlign: "center" }}>{item.qty}</span>
                    <button className="qty-btn" onClick={() => dispatch({ type: "UPDATE_QTY", id: item.id, qty: item.qty+1 })}><Icon name="plus" size={12} /></button>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "white", minWidth: 100, textAlign: "right" }}>
                    {fmt((item.salePrice || item.price) * item.qty)}
                  </div>
                  <button onClick={() => dispatch({ type: "REMOVE", id: item.id })}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#444", transition: "color 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#cc0000"}
                    onMouseLeave={e => e.currentTarget.style.color = "#444"}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setPage("products")} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: "0.75rem", marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "var(--font-body)" }}>
              <Icon name="chevronLeft" size={14} /> CONTINUE SHOPPING
            </button>
          </div>

          {/* Summary */}
          <div>
            <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.5rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#cc0000", marginBottom: "1.25rem" }}>ORDER SUMMARY</div>

              <div style={{ marginBottom: "1.25rem" }}>
                {[["Subtotal", fmt(subtotal)], ["Shipping", shipping === 0 ? "FREE" : fmt(shipping)], discount ? ["Discount", `-${fmt(discount)}`] : null].filter(Boolean).map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "#666", fontSize: "0.75rem" }}>{l}</span>
                    <span style={{ color: l === "Discount" ? "#39ff14" : "#e8e8e8", fontSize: "0.8rem", fontFamily: "var(--font-display)" }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "1rem", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>TOTAL</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 900, color: "#cc0000" }}>{fmt(subtotal + shipping - discount)}</span>
                </div>
              </div>

              {/* Discount code */}
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input value={code} onChange={e => setCode(e.target.value)} placeholder="PROMO CODE" style={{ fontSize: "0.75rem", flex: 1 }} />
                  <button onClick={applyCode} className="btn-outline" style={{ padding: "0.5rem 0.75rem", fontSize: "0.65rem", flexShrink: 0 }}>APPLY</button>
                </div>
                {discount > 0 && <div style={{ color: "#39ff14", fontSize: "0.7rem", marginTop: "0.4rem" }}>✓ Code METAL10 applied!</div>}
              </div>

              <button onClick={() => setPage("checkout")} className="btn-primary" style={{ width: "100%", fontSize: "0.8rem", padding: "1rem" }}>
                PROCEED TO CHECKOUT →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== CHECKOUT PAGE =====================
function CheckoutPage({ items, dispatch, setPage }) {
  const [step, setStep] = useState(1);
  const [orderNum] = useState("HF-" + Date.now().toString().slice(-8));
  const [shipping, setShipping] = useState({ name: "", address: "", province: "", postcode: "", phone: "", method: "standard" });
  const [payment, setPayment] = useState({ method: "card", cardNum: "", expiry: "", cvv: "" });
  const subtotal = items.reduce((s, i) => s + (i.salePrice || i.price) * i.qty, 0);
  const shippingFee = shipping.method === "express" ? 350 : subtotal >= 2000 ? 0 : 150;
  const total = subtotal + shippingFee;

  const steps = ["SHIPPING", "PAYMENT", "REVIEW", "CONFIRMED"];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "2.5rem", gap: 0 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
              <div style={{ width: 32, height: 32, border: `2px solid ${step > i+1 ? "#39ff14" : step === i+1 ? "#cc0000" : "#2a2a2a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "0.7rem", color: step > i+1 ? "#39ff14" : step === i+1 ? "#cc0000" : "#555", background: step === i+1 ? "rgba(204,0,0,0.1)" : "transparent" }}>
                {step > i+1 ? "✓" : i+1}
              </div>
              <span style={{ fontSize: "0.55rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", color: step === i+1 ? "#cc0000" : "#555" }}>{s}</span>
            </div>
            {i < steps.length-1 && <div style={{ flex: 1, height: 1, background: step > i+1 ? "#39ff14" : "#1a1a1a", margin: "0 0.5rem", marginBottom: "1.2rem" }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Shipping */}
      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#cc0000", marginBottom: "1.5rem" }}>SHIPPING INFORMATION</div>
          </div>
          {[["Full Name", "name", "1 / -1"], ["Address", "address", "1 / -1"], ["Province", "province", "1 / 2"], ["Postcode", "postcode", "2 / 3"], ["Phone", "phone", "1 / -1"]].map(([l, k, col]) => (
            <div key={k} style={{ gridColumn: col }}>
              <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>{l.toUpperCase()}</label>
              <input value={shipping[k]} onChange={e => setShipping(s => ({ ...s, [k]: e.target.value }))} placeholder={l} />
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>SHIPPING METHOD</label>
            <div style={{ display: "flex", gap: "1rem" }}>
              {[["standard", "Standard (2-3 days)", subtotal >= 2000 ? "FREE" : "฿150"], ["express", "Express (next day)", "฿350"]].map(([v, l, p]) => (
                <label key={v} style={{ flex: 1, border: `1px solid ${shipping.method === v ? "#cc0000" : "#2a2a2a"}`, padding: "1rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.75rem", background: shipping.method === v ? "rgba(204,0,0,0.08)" : "transparent" }}>
                  <input type="radio" name="shipping" value={v} checked={shipping.method === v} onChange={() => setShipping(s => ({ ...s, method: v }))} style={{ accentColor: "#cc0000" }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#e8e8e8" }}>{l}</div>
                    <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{p}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setStep(2)} className="btn-primary" style={{ fontSize: "0.8rem" }}>NEXT: PAYMENT →</button>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#cc0000", marginBottom: "1.5rem" }}>PAYMENT METHOD</div>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[["card", "💳 Credit Card"], ["transfer", "🏦 Bank Transfer"], ["promptpay", "📱 PromptPay"]].map(([v, l]) => (
              <button key={v} onClick={() => setPayment(p => ({ ...p, method: v }))}
                style={{ flex: 1, padding: "0.875rem", border: `1px solid ${payment.method === v ? "#cc0000" : "#2a2a2a"}`, background: payment.method === v ? "rgba(204,0,0,0.08)" : "#0f0f0f", color: "#e8e8e8", fontFamily: "var(--font-body)", fontSize: "0.8rem", cursor: "pointer", borderRadius: 2 }}>
                {l}
              </button>
            ))}
          </div>

          {payment.method === "card" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>CARD NUMBER</label>
                <input value={payment.cardNum} onChange={e => setPayment(p => ({ ...p, cardNum: e.target.value.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19) }))} placeholder="0000 0000 0000 0000" maxLength={19} />
              </div>
              <div>
                <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>EXPIRY DATE</label>
                <input value={payment.expiry} onChange={e => setPayment(p => ({ ...p, expiry: e.target.value }))} placeholder="MM/YY" maxLength={5} />
              </div>
              <div>
                <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>CVV</label>
                <input value={payment.cvv} onChange={e => setPayment(p => ({ ...p, cvv: e.target.value }))} placeholder="000" maxLength={4} type="password" />
              </div>
            </div>
          )}

          {payment.method === "transfer" && (
            <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#a8a8b3", lineHeight: 1.9 }}>
                <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>BANK TRANSFER DETAILS</div>
                <div>Bank: <span style={{ color: "#e8e8e8" }}>Kasikorn Bank (KBank)</span></div>
                <div>Account: <span style={{ color: "#e8e8e8" }}>xxx-x-xxxxx-x</span></div>
                <div>Name: <span style={{ color: "#e8e8e8" }}>HYBRIDFORMULA CO., LTD.</span></div>
                <div style={{ marginTop: "0.75rem", color: "#f59e0b" }}>⚠️ Please upload proof of payment after completing transfer.</div>
              </div>
            </div>
          )}

          {payment.method === "promptpay" && (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <div style={{ width: 160, height: 160, background: "white", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
                <svg viewBox="0 0 100 100" width={128} height={128}>
                  {/* QR code placeholder */}
                  {Array.from({ length: 10 }, (_, r) =>
                    Array.from({ length: 10 }, (_, c) => (
                      <rect key={`${r}-${c}`} x={c*10} y={r*10} width={9} height={9} fill={Math.random() > 0.5 ? "#000" : "#fff"} />
                    ))
                  )}
                </svg>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em", color: "#666" }}>SCAN WITH YOUR BANKING APP</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", color: "#cc0000", marginTop: "0.5rem" }}>{fmt(total)}</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
            <button onClick={() => setStep(1)} className="btn-outline" style={{ fontSize: "0.75rem" }}>← BACK</button>
            <button onClick={() => setStep(3)} className="btn-primary" style={{ fontSize: "0.8rem" }}>REVIEW ORDER →</button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#cc0000", marginBottom: "1.5rem" }}>REVIEW YOUR ORDER</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.25rem" }}>
              <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.15em", color: "#666", marginBottom: "0.75rem" }}>SHIP TO</div>
              <div style={{ fontSize: "0.8rem", color: "#e8e8e8", lineHeight: 1.7 }}>
                <div>{shipping.name || "—"}</div>
                <div style={{ color: "#a8a8b3" }}>{shipping.address || "—"}</div>
                <div style={{ color: "#a8a8b3" }}>{shipping.province} {shipping.postcode}</div>
                <div style={{ color: "#a8a8b3" }}>{shipping.phone}</div>
              </div>
            </div>
            <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.25rem" }}>
              <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.15em", color: "#666", marginBottom: "0.75rem" }}>PAYMENT</div>
              <div style={{ fontSize: "0.8rem", color: "#e8e8e8" }}>
                {payment.method === "card" ? `💳 •••• ${payment.cardNum.slice(-4) || "****"}` : payment.method === "transfer" ? "🏦 Bank Transfer" : "📱 PromptPay"}
              </div>
            </div>
          </div>
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.15em", color: "#666", marginBottom: "1rem" }}>ORDER ITEMS</div>
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <img src={item.image} alt="" style={{ width: 48, height: 48, objectFit: "cover" }} />
                  <div>
                    <div style={{ fontSize: "0.8rem", color: "#e8e8e8" }}>{item.name}</div>
                    <div style={{ color: "#666", fontSize: "0.7rem" }}>Qty: {item.qty}</div>
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "#cc0000" }}>{fmt((item.salePrice || item.price) * item.qty)}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>TOTAL</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 900, color: "#cc0000" }}>{fmt(total)}</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep(2)} className="btn-outline" style={{ fontSize: "0.75rem" }}>← BACK</button>
            <button onClick={() => { dispatch({ type: "CLEAR" }); setStep(4); }} className="btn-primary" style={{ fontSize: "0.8rem", animation: "pulse-red 2s infinite" }}>
              CONFIRM ORDER ⚡
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ width: 80, height: 80, border: "3px solid #39ff14", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", boxShadow: "0 0 30px rgba(57,255,20,0.4)" }}>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#39ff14" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: "checkmark-draw 0.5s ease forwards" }} />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "#39ff14", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>ORDER CONFIRMED</h2>
          <div style={{ color: "#a8a8b3", fontSize: "0.8rem", marginBottom: "0.5rem" }}>Your order has been placed successfully.</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#cc0000", marginBottom: "2rem" }}>Order #{orderNum}</div>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => setPage("orders")} className="btn-neon" style={{ fontSize: "0.75rem" }}>TRACK YOUR ORDER</button>
            <button onClick={() => setPage("home")} className="btn-outline" style={{ fontSize: "0.75rem" }}>CONTINUE SHOPPING</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== PROFILE PAGE =====================
function ProfilePage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [profile, setProfile] = useState({ name: "Thanapat K.", email: "thanapat@email.com", phone: "081-234-5678" });
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ height: 2, width: 30, background: "#cc0000" }} />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.2em", color: "white" }}>MY ACCOUNT</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "2rem" }}>
        {/* Sidebar */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1rem", height: "fit-content" }}>
          <div style={{ width: 80, height: 80, background: "#cc0000", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "white" }}>
            TK
          </div>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ color: "#e8e8e8", fontSize: "0.8rem" }}>{profile.name}</div>
            <div style={{ color: "#666", fontSize: "0.7rem" }}>{profile.email}</div>
          </div>
          {[["profile", "Profile"], ["addresses", "Addresses"], ["security", "Security"]].map(([t, l]) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`admin-sidebar-link ${activeTab === t ? "active" : ""}`} style={{ width: "100%" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.5rem" }}>
          {activeTab === "profile" && (
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1.5rem" }}>PROFILE INFORMATION</div>
              <div style={{ display: "grid", gap: "1rem" }}>
                {[["Full Name", "name"], ["Email", "email"], ["Phone", "phone"]].map(([l, k]) => (
                  <div key={k}>
                    <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>{l}</label>
                    <input value={profile[k]} onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "1.5rem" }}>
                <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="btn-primary">
                  {saved ? "✓ SAVED" : "SAVE CHANGES"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "addresses" && (
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1.5rem" }}>ADDRESS BOOK</div>
              <div style={{ border: "1px solid #1a1a1a", padding: "1rem", marginBottom: "1rem", position: "relative" }}>
                <Badge variant="red">DEFAULT</Badge>
                <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#a8a8b3", lineHeight: 1.8 }}>
                  <div style={{ color: "#e8e8e8" }}>Thanapat K.</div>
                  <div>123 Sukhumvit Road</div>
                  <div>Klongtoey, Bangkok 10110</div>
                  <div>081-234-5678</div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button className="btn-outline" style={{ fontSize: "0.65rem", padding: "0.3rem 0.75rem" }}>EDIT</button>
                  <button className="btn-outline" style={{ fontSize: "0.65rem", padding: "0.3rem 0.75rem" }}>DELETE</button>
                </div>
              </div>
              <button className="btn-neon" style={{ fontSize: "0.7rem" }}>+ ADD NEW ADDRESS</button>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1.5rem" }}>CHANGE PASSWORD</div>
              <div style={{ display: "grid", gap: "1rem", maxWidth: 400 }}>
                {["Current Password", "New Password", "Confirm New Password"].map(l => (
                  <div key={l}>
                    <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>{l.toUpperCase()}</label>
                    <input type="password" placeholder="••••••••" />
                  </div>
                ))}
              </div>
              <button className="btn-primary" style={{ marginTop: "1.5rem" }}>UPDATE PASSWORD</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== ORDERS PAGE =====================
function OrdersPage({ setPage }) {
  const [expanded, setExpanded] = useState(null);
  const statusColors = { Delivered: "green", Shipped: "orange", Processing: "grey", Cancelled: "red" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ height: 2, width: 30, background: "#cc0000" }} />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.2em", color: "white" }}>ORDER HISTORY</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {ORDERS.map(order => (
          <div key={order.id} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a" }}>
            <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
              <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>{order.id}</div>
                  <div style={{ color: "#555", fontSize: "0.7rem" }}>{order.date}</div>
                </div>
                <div style={{ color: "#a8a8b3", fontSize: "0.8rem" }}>{order.items.length} item{order.items.length > 1 ? "s" : ""}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "white" }}>{fmt(order.total)}</div>
                <Badge variant={statusColors[order.status] || "grey"}>{order.status}</Badge>
              </div>
              <Icon name={expanded === order.id ? "chevronDown" : "chevronRight"} size={16} style={{ color: "#555" }} />
            </div>

            {expanded === order.id && (
              <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid #1a1a1a" }}>
                <div style={{ marginTop: "1rem" }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #1a1a1a", fontSize: "0.8rem" }}>
                      <span style={{ color: "#a8a8b3" }}>{item.name} × {item.qty}</span>
                      <span style={{ color: "#e8e8e8", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{fmt(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                {order.tracking && (
                  <div style={{ marginTop: "0.875rem", background: "#0d0d0d", border: "1px solid #1a1a1a", padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Icon name="truck" size={14} style={{ color: "#cc0000" }} />
                    <span style={{ fontSize: "0.75rem", color: "#a8a8b3" }}>Tracking: <span style={{ color: "#e8e8e8", fontFamily: "var(--font-display)" }}>{order.tracking}</span></span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== CATEGORY PAGE =====================
function CategoryPage({ slug, setPage, onAddToCart }) {
  const cat = CATEGORIES.find(c => c.slug === slug);
  return (
    <div>
      <div className="hero-bg" style={{ padding: "4rem 1.5rem", textAlign: "center", borderBottom: "1px solid #1a1a1a", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(204,0,0,0.03) 6px, rgba(204,0,0,0.03) 12px)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>{cat?.icon}</div>
          <h1 className="glitch-text" style={{ fontSize: "clamp(2rem, 6vw, 4rem)", fontWeight: 900, color: "white", letterSpacing: "0.05em" }}>
            {cat?.label?.toUpperCase() || slug?.toUpperCase()}
          </h1>
          <p style={{ color: "#666", fontSize: "0.8rem", marginTop: "0.5rem" }}>{cat?.count} products available</p>
        </div>
      </div>

      {/* Sub-cat chips */}
      <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1a1a1a", padding: "0.875rem 1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {["All", "New Arrivals", "On Sale", "Top Rated", "Under ฿5,000"].map(c => (
          <span key={c} style={{ background: c === "All" ? "#cc0000" : "#111", border: "1px solid", borderColor: c === "All" ? "#cc0000" : "#2a2a2a", color: c === "All" ? "white" : "#a8a8b3", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", padding: "0.3rem 0.75rem", cursor: "pointer", borderRadius: 2 }}>{c}</span>
        ))}
      </div>

      <ProductsPage setPage={setPage} onAddToCart={onAddToCart} initialCategory={slug} />
    </div>
  );
}

// ===================== ADMIN DASHBOARD =====================
function AdminDashboard({ setPage, adminPage, setAdminPage }) {
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "products",  label: "Products",  icon: "tag" },
    { id: "orders",    label: "Orders",    icon: "package" },
    { id: "customers", label: "Customers", icon: "user" },
    { id: "settings",  label: "Settings",  icon: "settings" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#060606", borderRight: "1px solid #1a1a1a", padding: "1.5rem 0", flexShrink: 0 }}>
        <div style={{ padding: "0 1rem 1.5rem", borderBottom: "1px solid #1a1a1a", marginBottom: "1rem" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#cc0000" }}>ADMIN PANEL</span>
        </div>
        {sidebarItems.map(item => (
          <button key={item.id} onClick={() => setAdminPage(item.id)} className={`admin-sidebar-link ${adminPage === item.id ? "active" : ""}`} style={{ width: "100%" }}>
            <Icon name={item.icon} size={14} />
            {item.label}
          </button>
        ))}
        <div style={{ position: "absolute", bottom: "1.5rem", left: 0, width: 220, padding: "0 1rem", borderTop: "1px solid #1a1a1a", paddingTop: "1rem" }}>
          <button onClick={() => setPage("home")} className="admin-sidebar-link" style={{ width: "100%" }}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} />
            Back to Store
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {adminPage === "dashboard" && <AdminDashboardHome />}
        {adminPage === "products" && <AdminProducts />}
        {adminPage === "orders" && <AdminOrders />}
        {(adminPage === "customers" || adminPage === "settings") && (
          <div style={{ color: "#555", textAlign: "center", padding: "4rem", fontFamily: "var(--font-display)", fontSize: "0.8rem" }}>
            {adminPage.toUpperCase()} — COMING SOON
          </div>
        )}
      </div>
    </div>
  );
}

function AdminDashboardHome() {
  const stats = [
    { label: "TOTAL REVENUE", value: "฿842,900", sub: "+12% this month", color: "#cc0000" },
    { label: "ORDERS TODAY",  value: "24",       sub: "5 pending dispatch", color: "#ff4500" },
    { label: "LOW STOCK",     value: "7 items",  sub: "Needs reorder",     color: "#f59e0b" },
    { label: "NEW CUSTOMERS", value: "48",       sub: "Last 30 days",      color: "#39ff14" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ height: 2, width: 30, background: "#cc0000" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.2em", color: "white" }}>DASHBOARD OVERVIEW</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.25rem", borderLeft: `3px solid ${s.color}` }}>
            <div style={{ color: "#666", fontSize: "0.6rem", fontFamily: "var(--font-display)", letterSpacing: "0.2em", marginBottom: "0.5rem" }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 900, color: s.color, marginBottom: "0.25rem" }}>{s.value}</div>
            <div style={{ color: "#555", fontSize: "0.7rem" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart (simple bars) */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1.5rem" }}>REVENUE — LAST 12 DAYS</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: 120 }}>
          {REVENUE_DATA.map((d, i) => {
            const max = Math.max(...REVENUE_DATA.map(x => x.revenue));
            const h = (d.revenue / max) * 100;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
                <div title={`฿${d.revenue.toLocaleString()}`} style={{ width: "100%", height: `${h}%`, background: i === REVENUE_DATA.length-1 ? "#cc0000" : "#2a2a2a", transition: "background 0.2s", cursor: "pointer", borderRadius: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#cc0000"}
                  onMouseLeave={e => e.currentTarget.style.background = i === REVENUE_DATA.length-1 ? "#cc0000" : "#2a2a2a"} />
                <span style={{ fontSize: "0.55rem", color: "#444", transform: "rotate(-45deg)", transformOrigin: "center", whiteSpace: "nowrap" }}>{d.day.split(" ")[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", padding: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.15em", color: "#cc0000", marginBottom: "1rem" }}>RECENT ORDERS</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {["ORDER #", "CUSTOMER", "DATE", "TOTAL", "STATUS"].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ADMIN_ORDERS.slice(0, 5).map(o => (
                <tr key={o.id}>
                  <td style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{o.id}</td>
                  <td style={{ color: "#e8e8e8", fontSize: "0.8rem" }}>{o.customer}</td>
                  <td style={{ color: "#666" }}>{o.date}</td>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "white" }}>{fmt(o.total)}</td>
                  <td><Badge variant={o.fulfillment === "Delivered" ? "green" : o.fulfillment === "Shipped" ? "orange" : o.fulfillment === "Cancelled" ? "red" : "grey"}>{o.fulfillment}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminProducts() {
  const [showDrawer, setShowDrawer] = useState(false);
  const [search, setSearch] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", brand: "", category: "", price: "", stock: "", sku: "", description: "", status: "active" });

  const filtered = PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ height: 2, width: 30, background: "#cc0000" }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.2em", color: "white" }}>PRODUCT MANAGEMENT</h2>
        </div>
        <button onClick={() => setShowDrawer(true)} className="btn-primary" style={{ fontSize: "0.7rem" }}>+ ADD PRODUCT</button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." style={{ maxWidth: 300 }} />
      </div>

      <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", overflowX: "auto" }}>
        <table>
          <thead>
            <tr>{["IMAGE", "NAME", "SKU", "BRAND", "PRICE", "STOCK", "STATUS", "ACTIONS"].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td><img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} /></td>
                <td style={{ color: "#e8e8e8", fontSize: "0.8rem", maxWidth: 200 }}>{p.name}</td>
                <td style={{ color: "#666", fontSize: "0.7rem", fontFamily: "var(--font-display)" }}>{p.sku}</td>
                <td style={{ color: "#a8a8b3" }}>{p.brand}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "#cc0000" }}>{fmt(p.salePrice || p.price)}</td>
                <td>
                  <span style={{ color: p.stock > 5 ? "#39ff14" : p.stock > 0 ? "#f59e0b" : "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{p.stock}</span>
                </td>
                <td><Badge variant={p.stock > 0 ? "green" : "red"}>{p.stock > 0 ? "ACTIVE" : "OOS"}</Badge></td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.65rem", borderRadius: 2 }}>EDIT</button>
                    <button style={{ background: "none", border: "1px solid #cc0000", color: "#cc0000", padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.65rem", borderRadius: 2 }}>DEL</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Product Drawer */}
      {showDrawer && (
        <>
          <div className="overlay open" onClick={() => setShowDrawer(false)} />
          <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(520px, 95vw)", background: "#0c0c0c", borderLeft: "1px solid #1a1a1a", zIndex: 1000, overflowY: "auto", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", letterSpacing: "0.15em", color: "white" }}>ADD NEW PRODUCT</span>
              <button onClick={() => setShowDrawer(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#666" }}><Icon name="x" size={20} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {[["Product Name", "name"], ["Brand", "brand"], ["SKU", "sku"], ["Price (฿)", "price"], ["Stock Qty", "stock"]].map(([l, k]) => (
                <div key={k}>
                  <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>{l}</label>
                  <input value={newProduct[k]} onChange={e => setNewProduct(p => ({ ...p, [k]: e.target.value }))} placeholder={l} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>CATEGORY</label>
                <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Select Category</option>
                  {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>DESCRIPTION</label>
                <textarea value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} rows={4} placeholder="Product description..." />
              </div>

              {/* Image Upload Zone */}
              <div style={{ border: "2px dashed #2a2a2a", padding: "2rem", textAlign: "center", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#cc0000"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#2a2a2a"}>
                <Icon name="upload" size={24} style={{ color: "#555", margin: "0 auto 0.75rem", display: "block" }} />
                <div style={{ color: "#666", fontSize: "0.75rem" }}>DRAG & DROP IMAGE</div>
                <div style={{ color: "#444", fontSize: "0.7rem", marginTop: "0.25rem" }}>or click to browse</div>
              </div>

              <div style={{ display: "flex", gap: "1rem" }}>
                <button className="btn-primary" style={{ flex: 1, fontSize: "0.75rem" }} onClick={() => setShowDrawer(false)}>SAVE PRODUCT</button>
                <button className="btn-outline" style={{ flex: 1, fontSize: "0.75rem" }} onClick={() => setShowDrawer(false)}>SAVE DRAFT</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AdminOrders() {
  const [selected, setSelected] = useState(null);
  const [statuses, setStatuses] = useState({});
  const statusOptions = ["Processing", "On Hold", "Shipped", "Delivered", "Cancelled", "Refunded"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ height: 2, width: 30, background: "#cc0000" }} />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", letterSpacing: "0.2em", color: "white" }}>ORDER MANAGEMENT</h2>
      </div>

      <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", overflowX: "auto" }}>
        <table>
          <thead>
            <tr>{["ORDER #", "CUSTOMER", "DATE", "ITEMS", "TOTAL", "PAYMENT", "STATUS", "ACTIONS"].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ADMIN_ORDERS.map(o => (
              <tr key={o.id}>
                <td style={{ color: "#cc0000", fontFamily: "var(--font-display)", fontSize: "0.75rem" }}>{o.id}</td>
                <td style={{ color: "#e8e8e8" }}>{o.customer}</td>
                <td style={{ color: "#666" }}>{o.date}</td>
                <td style={{ color: "#a8a8b3" }}>{o.items}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "white" }}>{fmt(o.total)}</td>
                <td><Badge variant={o.payment === "Paid" ? "green" : o.payment === "Refunded" ? "grey" : "orange"}>{o.payment}</Badge></td>
                <td>
                  <select value={statuses[o.id] || o.fulfillment}
                    onChange={e => setStatuses(s => ({ ...s, [o.id]: e.target.value }))}
                    style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", width: "auto", color: "#e8e8e8" }}>
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <button onClick={() => setSelected(selected === o.id ? null : o.id)}
                    style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.65rem", borderRadius: 2 }}>
                    DETAILS
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (() => {
        const o = ADMIN_ORDERS.find(x => x.id === selected);
        return (
          <div style={{ background: "#0d0d0d", border: "1px solid #cc0000", padding: "1.5rem", marginTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "#cc0000", letterSpacing: "0.1em" }}>ORDER DETAILS: {o.id}</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><Icon name="x" size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <div style={{ color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>CUSTOMER</div>
                <div style={{ color: "#e8e8e8", fontSize: "0.8rem" }}>{o.customer}</div>
              </div>
              <div>
                <div style={{ color: "#666", fontSize: "0.65rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>ADD TRACKING</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input placeholder="Tracking number" style={{ fontSize: "0.75rem" }} />
                  <button className="btn-neon" style={{ fontSize: "0.65rem", padding: "0.4rem 0.75rem", flexShrink: 0 }}>SAVE</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  const [page, setPage] = useState("home");
  const [cartItems, dispatch] = useReducer(cartReducer, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminPage, setAdminPage] = useState("dashboard");

  const onAddToCart = (product) => {
    dispatch({ type: "ADD", product });
    setCartOpen(true);
  };

  const isAdmin = page === "admin" || page.startsWith("admin-");

  // Parse page string
  let currentPage = page;
  let productId = null;
  let categorySlug = null;
  let searchQuery = null;

  if (page.startsWith("product-")) {
    productId = parseInt(page.split("product-")[1]);
    currentPage = "product-detail";
  } else if (page.startsWith("category-")) {
    categorySlug = page.split("category-")[1];
    currentPage = "category";
  } else if (page.startsWith("search:")) {
    searchQuery = page.split("search:")[1];
    currentPage = "search";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {!isAdmin && (
        <Navbar page={page} setPage={setPage} cartItems={cartItems} setCartOpen={setCartOpen}
          mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      )}

      <main style={{ flex: 1 }}>
        {currentPage === "home" && <HomePage setPage={setPage} onAddToCart={onAddToCart} />}
        {(currentPage === "products") && <ProductsPage setPage={setPage} onAddToCart={onAddToCart} />}
        {currentPage === "product-detail" && <ProductDetailPage productId={productId} setPage={setPage} onAddToCart={onAddToCart} />}
        {currentPage === "category" && <CategoryPage slug={categorySlug} setPage={setPage} onAddToCart={onAddToCart} />}
        {currentPage === "search" && <ProductsPage setPage={setPage} onAddToCart={onAddToCart} searchQuery={searchQuery} />}
        {currentPage === "cart" && <CartPage items={cartItems} dispatch={dispatch} setPage={setPage} />}
        {currentPage === "checkout" && <CheckoutPage items={cartItems} dispatch={dispatch} setPage={setPage} />}
        {currentPage === "profile" && <ProfilePage />}
        {currentPage === "orders" && <OrdersPage setPage={setPage} />}
        {(currentPage === "admin" || page.startsWith("admin")) && (
          <AdminDashboard setPage={setPage} adminPage={adminPage} setAdminPage={setAdminPage} />
        )}
      </main>

      {!isAdmin && <Footer setPage={setPage} />}

      <CartDrawer items={cartItems} open={cartOpen} onClose={() => setCartOpen(false)} dispatch={dispatch} setPage={setPage} />
    </div>
  );
}
