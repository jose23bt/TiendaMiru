import { useState, useReducer, useCallback, useMemo } from "react";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap";
document.head.appendChild(fontLink);

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d0f14;
    --surface: #161920;
    --surface2: #1e222d;
    --surface3: #252a38;
    --border: rgba(255,255,255,0.06);
    --accent: #ff6b35;
    --accent2: #ffd166;
    --accent3: #06d6a0;
    --accent4: #118ab2;
    --text: #f0f2f8;
    --text2: #9098b1;
    --text3: #5a6178;
    --red: #ef476f;
    --font-head: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --radius: 12px;
    --radius-lg: 18px;
    --shadow: 0 4px 24px rgba(0,0,0,0.4);
  }
  html, body { background: var(--bg); color: var(--text); font-family: var(--font-body); height: 100%; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 4px; }
  input, textarea, select {
    background: var(--surface3);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-body);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    outline: none;
    transition: border 0.2s;
    width: 100%;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); }
  button { cursor: pointer; font-family: var(--font-body); border: none; outline: none; transition: all 0.15s; }
  select option { background: var(--surface2); }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .fade-in { animation: fadeIn 0.3s ease forwards; }
  .badge {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:0.5px;
  }
  .badge-green { background:rgba(6,214,160,0.15); color:var(--accent3); }
  .badge-orange { background:rgba(255,107,53,0.15); color:var(--accent); }
  .badge-yellow { background:rgba(255,209,102,0.15); color:var(--accent2); }
  .badge-red { background:rgba(239,71,111,0.15); color:var(--red); }
  .badge-blue { background:rgba(17,138,178,0.15); color:var(--accent4); }
`;
document.head.appendChild(globalStyle);

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INITIAL_CATEGORIES = ["Pizzas","Hamburguesas","Bebidas","Postres","Entradas","Empanadas"];
const INITIAL_PRODUCTS = [
  { id:1, name:"Pizza Mozzarella", category:"Pizzas", price:1800, cost:600, stock:50, unit:"unidad", recipe:[{insumoId:1,qty:200},{insumoId:2,qty:150}], active:true },
  { id:2, name:"Hamburguesa Clásica", category:"Hamburguesas", price:1500, cost:500, stock:30, unit:"unidad", recipe:[{insumoId:3,qty:180},{insumoId:4,qty:1}], active:true },
  { id:3, name:"Coca Cola 500ml", category:"Bebidas", price:600, cost:200, stock:100, unit:"unidad", recipe:[], active:true },
  { id:4, name:"Empanada Carne", category:"Empanadas", price:400, cost:120, stock:80, unit:"unidad", recipe:[{insumoId:3,qty:80},{insumoId:5,qty:30}], active:true },
  { id:5, name:"Tiramisú", category:"Postres", price:900, cost:300, stock:20, unit:"unidad", recipe:[], active:true },
];
const INITIAL_INSUMOS = [
  { id:1, name:"Harina 000", unit:"g", stock:5000, minStock:1000, cost:0.8, category:"Secos" },
  { id:2, name:"Mozzarella", unit:"g", stock:3000, minStock:500, cost:2.5, category:"Lácteos" },
  { id:3, name:"Carne Molida", unit:"g", stock:4000, minStock:800, cost:3.2, category:"Carnes" },
  { id:4, name:"Pan de Hamburguesa", unit:"unidad", stock:50, minStock:10, cost:120, category:"Panadería" },
  { id:5, name:"Cebolla", unit:"g", stock:2000, minStock:300, cost:0.5, category:"Verduras" },
];
const INITIAL_VENTAS = [
  { id:1, type:"mostrador", items:[{productId:1,name:"Pizza Mozzarella",qty:2,price:1800},{productId:3,name:"Coca Cola 500ml",qty:2,price:600}], total:4800, date:"2025-01-15T20:30:00", state:"pagado", payment:"efectivo", client:"" },
  { id:2, type:"delivery", items:[{productId:2,name:"Hamburguesa Clásica",qty:1,price:1500},{productId:3,name:"Coca Cola 500ml",qty:1,price:600}], total:2100, date:"2025-01-15T21:00:00", state:"entregado", payment:"transferencia", client:"Juan Pérez", address:"Av. Corrientes 1234" },
  { id:3, type:"mostrador", items:[{productId:4,name:"Empanada Carne",qty:4,price:400}], total:1600, date:"2025-01-16T12:00:00", state:"pagado", payment:"tarjeta", client:"" },
];
const INITIAL_CAJA = [
  { id:1, type:"apertura", amount:5000, desc:"Apertura de caja", date:"2025-01-16T09:00:00" },
  { id:2, type:"ingreso", amount:4800, desc:"Venta #1", date:"2025-01-16T20:30:00" },
  { id:3, type:"ingreso", amount:1600, desc:"Venta #3", date:"2025-01-16T12:00:00" },
  { id:4, type:"egreso", amount:800, desc:"Compra insumos - verduras", date:"2025-01-16T14:00:00" },
];

// ─── REDUCER ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch(action.type) {
    case "ADD_PRODUCT": return {...state, products:[...state.products, action.payload]};
    case "UPDATE_PRODUCT": return {...state, products: state.products.map(p => p.id===action.payload.id ? action.payload : p)};
    case "ADD_INSUMO": return {...state, insumos:[...state.insumos, action.payload]};
    case "UPDATE_INSUMO": return {...state, insumos: state.insumos.map(i => i.id===action.payload.id ? action.payload : i)};
    case "ADD_VENTA": return {...state, ventas:[action.payload, ...state.ventas]};
    case "UPDATE_VENTA": return {...state, ventas: state.ventas.map(v => v.id===action.payload.id ? action.payload : v)};
    case "ADD_CAJA": return {...state, caja:[...state.caja, action.payload]};
    case "ADD_CATEGORY": return {...state, categories:[...state.categories, action.payload]};
    case "SET_PEDIDO_ITEMS": return {...state, pedidoItems: action.payload};
    default: return state;
  }
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size=18, color="currentColor" }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    orders: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
    menu: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
    stock: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    sales: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    cash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
    stats: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    minus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    delivery: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>,
    store: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    warn: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    receipt: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 3 18 3 18 21 6 21 6 3"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg>,
    arrow_up: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
    arrow_down: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  };
  return icons[name] || null;
};

// ─── BTN ──────────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant="primary", size="md", icon, disabled, style={} }) => {
  const styles = {
    primary: { background:"var(--accent)", color:"#fff" },
    secondary: { background:"var(--surface3)", color:"var(--text)" },
    ghost: { background:"transparent", color:"var(--text2)" },
    danger: { background:"rgba(239,71,111,0.15)", color:"var(--red)" },
    success: { background:"rgba(6,214,160,0.15)", color:"var(--accent3)" },
  };
  const sizes = {
    sm: { padding:"5px 12px", fontSize:"12px", borderRadius:"7px" },
    md: { padding:"8px 16px", fontSize:"13px", borderRadius:"9px" },
    lg: { padding:"12px 24px", fontSize:"15px", borderRadius:"11px" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display:"inline-flex", alignItems:"center", gap:"6px", fontWeight:600,
        ...styles[variant], ...sizes[size],
        opacity: disabled ? 0.4 : 1,
        transition:"all 0.15s",
        ...style
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.filter="brightness(1.15)")}
      onMouseLeave={e => (e.currentTarget.style.filter="brightness(1)")}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
};

// ─── CARD ─────────────────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)", padding:"20px", ...style }}>
    {children}
  </div>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ title, value, sub, icon, color="#ff6b35", trend }) => (
  <Card style={{ position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, right:0, width:80, height:80, borderRadius:"0 var(--radius-lg) 0 80px", background:`${color}15`, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Icon name={icon} size={24} color={color} />
    </div>
    <div style={{ color:"var(--text3)", fontSize:"11px", fontWeight:600, letterSpacing:"0.8px", textTransform:"uppercase", marginBottom:8 }}>{title}</div>
    <div style={{ fontSize:"28px", fontWeight:800, fontFamily:"var(--font-head)", color:"var(--text)", lineHeight:1 }}>{value}</div>
    {sub && <div style={{ color:"var(--text2)", fontSize:"12px", marginTop:6 }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:8, fontSize:12, color: trend >= 0 ? "var(--accent3)" : "var(--red)" }}>
        <Icon name={trend >= 0 ? "arrow_up" : "arrow_down"} size={12} />
        {Math.abs(trend)}% vs ayer
      </div>
    )}
  </Card>
);

// ─── MODAL ────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, width=480 }) => {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)", width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto", animation:"fadeIn 0.2s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 20px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontSize:"16px", fontWeight:700, fontFamily:"var(--font-head)" }}>{title}</div>
          <button onClick={onClose} style={{ background:"transparent", color:"var(--text2)", padding:4, borderRadius:6 }}><Icon name="close" size={18} /></button>
        </div>
        <div style={{ padding:"20px" }}>{children}</div>
      </div>
    </div>
  );
};

// ─── FORM FIELD ───────────────────────────────────────────────────────────────
const Field = ({ label, children, style={} }) => (
  <div style={{ marginBottom:14, ...style }}>
    {label && <label style={{ fontSize:12, fontWeight:600, color:"var(--text2)", display:"block", marginBottom:5 }}>{label}</label>}
    {children}
  </div>
);

// ─── NUMBER FORMAT ────────────────────────────────────────────────────────────
const fmt = (n) => "$" + Number(n).toLocaleString("es-AR");
const fmtNum = (n) => Number(n).toLocaleString("es-AR");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ state }) {
  const totalVentas = state.ventas.reduce((a,v) => a + v.total, 0);
  const totalCost = state.ventas.reduce((a,v) => {
    return a + v.items.reduce((b,it) => {
      const p = state.products.find(x=>x.id===it.productId);
      return b + (p ? p.cost * it.qty : 0);
    }, 0);
  }, 0);
  const ganancia = totalVentas - totalCost;
  const deliveryCount = state.ventas.filter(v=>v.type==="delivery").length;
  const mostradorCount = state.ventas.filter(v=>v.type==="mostrador").length;
  const lowStock = state.insumos.filter(i => i.stock <= i.minStock);

  const productRanking = useMemo(() => {
    const counts = {};
    state.ventas.forEach(v => v.items.forEach(it => {
      counts[it.name] = (counts[it.name]||0) + it.qty;
    }));
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  }, [state.ventas]);

  const ventasPorDia = useMemo(() => {
    const byDay = {};
    state.ventas.forEach(v => {
      const d = v.date.split("T")[0];
      byDay[d] = (byDay[d]||0) + v.total;
    });
    return Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).slice(-7);
  }, [state.ventas]);

  const maxVenta = Math.max(...ventasPorDia.map(x=>x[1]), 1);

  const cajaActual = state.caja.reduce((a,c) => {
    if (c.type==="apertura") return a + c.amount;
    if (c.type==="ingreso") return a + c.amount;
    if (c.type==="egreso") return a - c.amount;
    return a;
  }, 0);

  return (
    <div className="fade-in">
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Dashboard</h2>
        <div style={{ color:"var(--text3)", fontSize:13 }}>Resumen general del negocio</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14, marginBottom:24 }}>
        <StatCard title="Ventas Totales" value={fmt(totalVentas)} sub={`${state.ventas.length} pedidos`} icon="sales" color="#ff6b35" trend={12} />
        <StatCard title="Ganancia Neta" value={fmt(ganancia)} sub={`${((ganancia/totalVentas)*100||0).toFixed(1)}% margen`} icon="stats" color="#06d6a0" trend={8} />
        <StatCard title="Caja Actual" value={fmt(cajaActual)} sub="Saldo disponible" icon="cash" color="#ffd166" />
        <StatCard title="Pedidos Delivery" value={deliveryCount} sub={`${mostradorCount} mostrador`} icon="delivery" color="#118ab2" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:24 }}>
        {/* Ventas por día */}
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:16 }}>Ventas últimos días</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:100 }}>
            {ventasPorDia.map(([d,v]) => (
              <div key={d} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:9, color:"var(--text3)", fontWeight:600 }}>{fmt(v).replace("$","")}</div>
                <div style={{ width:"100%", background:"var(--accent)", borderRadius:"4px 4px 0 0", height:`${(v/maxVenta)*80}px`, minHeight:4, transition:"height 0.3s", opacity:0.85 }} />
                <div style={{ fontSize:9, color:"var(--text3)" }}>{d.slice(5)}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ranking productos */}
        <Card>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Top Productos</div>
          {productRanking.map(([name, qty], i) => (
            <div key={name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:`${["#ff6b35","#ffd166","#06d6a0","#118ab2","#9098b1"][i]}25`, color:["#ff6b35","#ffd166","#06d6a0","#118ab2","#9098b1"][i], fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
              <div style={{ flex:1, fontSize:13 }}>{name}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--text2)" }}>{qty} uds</div>
              <div style={{ width:60, background:"var(--surface3)", borderRadius:4, overflow:"hidden", height:6 }}>
                <div style={{ height:"100%", background:"var(--accent)", width:`${(qty/productRanking[0][1])*100}%`, borderRadius:4 }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Alertas */}
      {lowStock.length > 0 && (
        <Card style={{ border:"1px solid rgba(239,71,111,0.3)", background:"rgba(239,71,111,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Icon name="warn" size={18} color="var(--red)" />
            <span style={{ fontSize:14, fontWeight:700, color:"var(--red)" }}>Alerta de Stock Bajo</span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {lowStock.map(i => (
              <div key={i.id} className="badge badge-red">{i.name}: {fmtNum(i.stock)} {i.unit}</div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── TOMAR PEDIDO ─────────────────────────────────────────────────────────────
function Pedidos({ state, dispatch }) {
  const [type, setType] = useState("mostrador");
  const [cart, setCart] = useState([]);
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("efectivo");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [success, setSuccess] = useState(false);
  const [note, setNote] = useState("");

  const filtered = state.products.filter(p =>
    p.active &&
    (catFilter === "Todos" || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.productId === product.id);
      if (idx >= 0) {
        const n = [...prev];
        n[idx] = {...n[idx], qty: n[idx].qty+1};
        return n;
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => {
      const n = prev.map(i => i.productId===productId ? {...i, qty:i.qty+delta} : i).filter(i=>i.qty>0);
      return n;
    });
  };

  const total = cart.reduce((a,i) => a + i.price*i.qty, 0);

  const confirmar = () => {
    if (!cart.length) return;
    const venta = {
      id: Date.now(),
      type, items: cart, total, date: new Date().toISOString(),
      state: type==="delivery" ? "en_camino" : "pagado",
      payment, client, address, note
    };
    dispatch({ type:"ADD_VENTA", payload: venta });
    if (payment === "efectivo") {
      dispatch({ type:"ADD_CAJA", payload:{ id:Date.now()+1, type:"ingreso", amount:total, desc:`Venta #${venta.id}`, date:venta.date } });
    }
    setSuccess(true);
    setTimeout(() => { setSuccess(false); setCart([]); setClient(""); setAddress(""); setNote(""); }, 2000);
  };

  return (
    <div className="fade-in" style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:14, height:"calc(100vh - 100px)" }}>
      {/* Left: productos */}
      <div style={{ display:"flex", flexDirection:"column", gap:14, overflow:"hidden" }}>
        {/* Filtros */}
        <Card style={{ padding:"14px 16px" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ position:"relative", flex:1, minWidth:160 }}>
              <div style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }}><Icon name="search" size={14} color="var(--text3)" /></div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft:32 }} />
            </div>
            {["Todos", ...state.categories].map(c => (
              <button key={c} onClick={()=>setCatFilter(c)} style={{
                padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, border:"none",
                background: catFilter===c ? "var(--accent)" : "var(--surface3)",
                color: catFilter===c ? "#fff" : "var(--text2)",
              }}>{c}</button>
            ))}
          </div>
        </Card>

        {/* Grid de productos */}
        <div style={{ overflow:"auto", flex:1 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:10 }}>
            {filtered.map(p => {
              const inCart = cart.find(i=>i.productId===p.id);
              return (
                <div key={p.id} onClick={()=>addToCart(p)} style={{
                  background:"var(--surface)", borderRadius:"var(--radius)", border:`1px solid ${inCart?"var(--accent)":"var(--border)"}`,
                  padding:"14px 12px", cursor:"pointer", transition:"all 0.15s",
                  position:"relative", overflow:"hidden"
                }}
                  onMouseEnter={e=>(e.currentTarget.style.transform="translateY(-2px)")}
                  onMouseLeave={e=>(e.currentTarget.style.transform="translateY(0)")}
                >
                  <div style={{ width:36, height:36, borderRadius:10, background:"var(--surface3)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8, fontSize:18 }}>
                    {p.category==="Pizzas"?"🍕":p.category==="Hamburguesas"?"🍔":p.category==="Bebidas"?"🥤":p.category==="Postres"?"🍰":p.category==="Empanadas"?"🫓":"🍽"}
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3, marginBottom:4 }}>{p.name}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"var(--accent)" }}>{fmt(p.price)}</div>
                  {inCart && (
                    <div style={{ position:"absolute", top:6, right:6, background:"var(--accent)", color:"#fff", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>{inCart.qty}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: carrito */}
      <Card style={{ display:"flex", flexDirection:"column", gap:12, overflow:"hidden" }}>
        {/* Tipo */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {["mostrador","delivery"].map(t => (
            <button key={t} onClick={()=>setType(t)} style={{
              padding:"10px", borderRadius:10, fontWeight:700, fontSize:13, border:"none",
              background: type===t ? (t==="delivery"?"var(--accent4)":"var(--accent)") : "var(--surface3)",
              color: type===t ? "#fff" : "var(--text2)",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6
            }}>
              <Icon name={t==="delivery"?"delivery":"store"} size={14} />
              {t==="delivery"?"Delivery":"Mostrador"}
            </button>
          ))}
        </div>

        {type==="delivery" && (
          <>
            <Field label="Cliente"><input value={client} onChange={e=>setClient(e.target.value)} placeholder="Nombre del cliente" /></Field>
            <Field label="Dirección"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección de entrega" /></Field>
          </>
        )}

        <Field label="Nota" style={{marginBottom:0}}><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Nota especial..." /></Field>

        {/* Items */}
        <div style={{ flex:1, overflow:"auto", borderTop:"1px solid var(--border)", paddingTop:12 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign:"center", color:"var(--text3)", fontSize:13, paddingTop:20 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🛒</div>
              Seleccioná productos
            </div>
          ) : cart.map(item => (
            <div key={item.productId} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div>
                <div style={{ fontSize:12, color:"var(--accent)" }}>{fmt(item.price * item.qty)}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface3)", borderRadius:8, padding:"2px 4px" }}>
                <button onClick={()=>updateQty(item.productId,-1)} style={{ background:"transparent", color:"var(--text2)", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:6, fontSize:16 }}>−</button>
                <span style={{ fontSize:13, fontWeight:700, minWidth:16, textAlign:"center" }}>{item.qty}</span>
                <button onClick={()=>updateQty(item.productId,1)} style={{ background:"transparent", color:"var(--text2)", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:6, fontSize:16 }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Total y pago */}
        <div style={{ borderTop:"1px solid var(--border)", paddingTop:12 }}>
          <Field label="Forma de pago">
            <select value={payment} onChange={e=>setPayment(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </Field>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ color:"var(--text2)", fontSize:14 }}>Total</span>
            <span style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--accent)" }}>{fmt(total)}</span>
          </div>
          <button
            onClick={confirmar}
            disabled={!cart.length}
            style={{
              width:"100%", padding:"13px", borderRadius:11, fontWeight:800, fontSize:15,
              background: success ? "var(--accent3)" : "var(--accent)",
              color:"#fff", border:"none", opacity: !cart.length ? 0.4 : 1,
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              transition:"all 0.2s"
            }}
          >
            {success ? <><Icon name="check" size={18} /> ¡Pedido confirmado!</> : "Confirmar pedido"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── PRODUCTOS / MENÚ ─────────────────────────────────────────────────────────
function Productos({ state, dispatch }) {
  const [modal, setModal] = useState(null);
  const [recipeModal, setRecipeModal] = useState(null);
  const [form, setForm] = useState({ name:"", category:"", price:"", cost:"", unit:"unidad", stock:"", active:true });
  const [catFilter, setCatFilter] = useState("Todos");
  const [newCat, setNewCat] = useState("");

  const openNew = () => { setForm({ name:"", category: state.categories[0]||"", price:"", cost:"", unit:"unidad", stock:"0", active:true }); setModal("new"); };
  const openEdit = (p) => { setForm({...p, price:String(p.price), cost:String(p.cost), stock:String(p.stock)}); setModal("edit"); };

  const save = () => {
    if (!form.name || !form.price) return;
    const payload = {...form, price:Number(form.price), cost:Number(form.cost||0), stock:Number(form.stock||0), recipe: form.recipe||[]};
    if (modal==="new") {
      dispatch({ type:"ADD_PRODUCT", payload:{ ...payload, id:Date.now() } });
    } else {
      dispatch({ type:"UPDATE_PRODUCT", payload });
    }
    setModal(null);
  };

  const toggle = (p) => dispatch({ type:"UPDATE_PRODUCT", payload:{ ...p, active:!p.active } });

  const filtered = state.products.filter(p => catFilter==="Todos" || p.category===catFilter);

  return (
    <div className="fade-in">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Menú & Productos</h2>
          <div style={{ color:"var(--text3)", fontSize:13 }}>{state.products.length} productos registrados</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" icon="plus" onClick={()=>setModal("cat")}>Categoría</Btn>
          <Btn variant="primary" icon="plus" onClick={openNew}>Nuevo Producto</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {["Todos", ...state.categories].map(c => (
          <button key={c} onClick={()=>setCatFilter(c)} style={{
            padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, border:"none",
            background: catFilter===c ? "var(--accent)" : "var(--surface3)",
            color: catFilter===c ? "#fff" : "var(--text2)",
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:12 }}>
        {filtered.map(p => (
          <Card key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>{p.name}</div>
                <div className="badge badge-orange" style={{ marginTop:4 }}>{p.category}</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setRecipeModal(p)} style={{ background:"var(--surface3)", border:"none", color:"var(--text2)", padding:"5px 7px", borderRadius:7, fontSize:16 }}>📋</button>
                <button onClick={()=>openEdit(p)} style={{ background:"var(--surface3)", border:"none", color:"var(--text2)", padding:"5px 7px", borderRadius:7 }}><Icon name="edit" size={13} /></button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--text3)", fontWeight:600 }}>PRECIO</div>
                <div style={{ fontSize:14, fontWeight:800, color:"var(--accent)" }}>{fmt(p.price)}</div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--text3)", fontWeight:600 }}>COSTO</div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--text2)" }}>{fmt(p.cost)}</div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"var(--text3)", fontWeight:600 }}>GANANCIA</div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--accent3)" }}>{fmt(p.price-p.cost)}</div>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:"var(--text3)" }}>Stock: {fmtNum(p.stock)} {p.unit}</span>
              <button onClick={()=>toggle(p)} style={{
                padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, border:"none",
                background: p.active ? "rgba(6,214,160,0.15)" : "rgba(239,71,111,0.15)",
                color: p.active ? "var(--accent3)" : "var(--red)"
              }}>{p.active ? "Activo" : "Inactivo"}</button>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal producto */}
      <Modal open={modal==="new"||modal==="edit"} onClose={()=>setModal(null)} title={modal==="new"?"Nuevo Producto":"Editar Producto"}>
        <Field label="Nombre"><input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Nombre del producto" /></Field>
        <Field label="Categoría">
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
            {state.categories.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Field label="Precio de venta"><input type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} /></Field>
          <Field label="Costo"><input type="number" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} /></Field>
          <Field label="Stock inicial"><input type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} /></Field>
          <Field label="Unidad"><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} /></Field>
        </div>
        {form.price && form.cost && (
          <div style={{ background:"rgba(6,214,160,0.1)", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:13 }}>
            Margen: <strong style={{color:"var(--accent3)"}}>{(((form.price-form.cost)/form.price)*100).toFixed(1)}%</strong> — Ganancia: <strong style={{color:"var(--accent3)"}}>{fmt(form.price-form.cost)}</strong>
          </div>
        )}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={save}>Guardar</Btn>
        </div>
      </Modal>

      {/* Modal categoría */}
      <Modal open={modal==="cat"} onClose={()=>setModal(null)} title="Nueva Categoría" width={340}>
        <Field label="Nombre de categoría"><input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Ej: Sándwiches" /></Field>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={()=>{ if(newCat.trim()){ dispatch({type:"ADD_CATEGORY",payload:newCat.trim()}); setNewCat(""); setModal(null); } }}>Agregar</Btn>
        </div>
      </Modal>

      {/* Modal receta */}
      <Modal open={!!recipeModal} onClose={()=>setRecipeModal(null)} title={`Receta: ${recipeModal?.name}`}>
        {recipeModal && (
          <RecipeEditor product={recipeModal} state={state} dispatch={dispatch} onClose={()=>setRecipeModal(null)} />
        )}
      </Modal>
    </div>
  );
}

function RecipeEditor({ product, state, dispatch, onClose }) {
  const [recipe, setRecipe] = useState(product.recipe||[]);
  const addIngredient = () => setRecipe(r=>[...r, {insumoId:state.insumos[0]?.id||1, qty:""}]);
  const save = () => {
    dispatch({ type:"UPDATE_PRODUCT", payload:{ ...product, recipe } });
    onClose();
  };
  return (
    <>
      <div style={{ marginBottom:14, fontSize:13, color:"var(--text2)" }}>Definí los insumos necesarios para preparar este producto.</div>
      {recipe.map((r,i) => (
        <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
          <select value={r.insumoId} onChange={e=>{const n=[...recipe];n[i]={...n[i],insumoId:Number(e.target.value)};setRecipe(n);}} style={{flex:2}}>
            {state.insumos.map(ins=><option key={ins.id} value={ins.id}>{ins.name}</option>)}
          </select>
          <input type="number" value={r.qty} placeholder="Cantidad" onChange={e=>{const n=[...recipe];n[i]={...n[i],qty:Number(e.target.value)};setRecipe(n);}} style={{flex:1}} />
          <span style={{ fontSize:12, color:"var(--text3)", minWidth:24 }}>{state.insumos.find(ins=>ins.id===r.insumoId)?.unit||""}</span>
          <button onClick={()=>setRecipe(r=>r.filter((_,j)=>j!==i))} style={{ background:"transparent", color:"var(--red)", border:"none", padding:4 }}><Icon name="trash" size={14} /></button>
        </div>
      ))}
      <Btn variant="secondary" icon="plus" onClick={addIngredient} style={{marginBottom:16}}>Agregar insumo</Btn>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={save}>Guardar receta</Btn>
      </div>
    </>
  );
}

// ─── INSUMOS ──────────────────────────────────────────────────────────────────
function Insumos({ state, dispatch }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name:"", unit:"g", stock:"", minStock:"", cost:"", category:"Secos" });
  const insCategories = ["Secos","Lácteos","Carnes","Panadería","Verduras","Bebidas","Otros"];
  const [catFilter, setCatFilter] = useState("Todos");

  const openEdit = (ins) => { setForm({...ins, stock:String(ins.stock), minStock:String(ins.minStock), cost:String(ins.cost)}); setModal("edit"); };
  const openNew = () => { setForm({ name:"", unit:"g", stock:"", minStock:"", cost:"", category:"Secos" }); setModal("new"); };

  const save = () => {
    if (!form.name) return;
    const payload = {...form, stock:Number(form.stock||0), minStock:Number(form.minStock||0), cost:Number(form.cost||0)};
    if (modal==="new") dispatch({ type:"ADD_INSUMO", payload:{...payload,id:Date.now()} });
    else dispatch({ type:"UPDATE_INSUMO", payload });
    setModal(null);
  };

  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");

  const doAdjust = () => {
    if (!adjustModal || adjustQty==="") return;
    dispatch({ type:"UPDATE_INSUMO", payload:{ ...adjustModal, stock: adjustModal.stock + Number(adjustQty) } });
    setAdjustModal(null); setAdjustQty("");
  };

  const filtered = state.insumos.filter(i => catFilter==="Todos" || i.category===catFilter);

  return (
    <div className="fade-in">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Control de Insumos</h2>
          <div style={{ color:"var(--text3)", fontSize:13 }}>{state.insumos.length} insumos registrados</div>
        </div>
        <Btn variant="primary" icon="plus" onClick={openNew}>Nuevo Insumo</Btn>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {["Todos",...insCategories].map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)} style={{ padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:600, border:"none", background:catFilter===c?"var(--accent)":"var(--surface3)", color:catFilter===c?"#fff":"var(--text2)" }}>{c}</button>
        ))}
      </div>

      <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)", overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 100px", gap:0, padding:"10px 16px", borderBottom:"1px solid var(--border)", fontSize:11, fontWeight:700, color:"var(--text3)", letterSpacing:"0.5px", textTransform:"uppercase" }}>
          <span>Insumo</span><span>Stock</span><span>Mín.</span><span>Costo/u</span><span>Valor Stock</span><span>Estado</span><span></span>
        </div>
        {filtered.map(ins => {
          const isLow = ins.stock <= ins.minStock;
          const valorStock = ins.stock * ins.cost;
          return (
            <div key={ins.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 100px", gap:0, padding:"12px 16px", borderBottom:"1px solid var(--border)", alignItems:"center", transition:"background 0.15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>{ins.name}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>{ins.category}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color: isLow ? "var(--red)" : "var(--text)" }}>{fmtNum(ins.stock)} {ins.unit}</div>
              <div style={{ fontSize:13, color:"var(--text2)" }}>{fmtNum(ins.minStock)} {ins.unit}</div>
              <div style={{ fontSize:13, color:"var(--text2)" }}>{fmt(ins.cost)}</div>
              <div style={{ fontSize:13, color:"var(--accent2)" }}>{fmt(valorStock)}</div>
              <div>
                {isLow ? <span className="badge badge-red"><Icon name="warn" size={10} />Bajo</span> : <span className="badge badge-green">OK</span>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button title="Ajustar stock" onClick={()=>{setAdjustModal(ins);setAdjustQty("");}} style={{ background:"var(--surface3)", border:"none", color:"var(--accent3)", padding:"5px 7px", borderRadius:7 }}><Icon name="refresh" size={13} /></button>
                <button onClick={()=>openEdit(ins)} style={{ background:"var(--surface3)", border:"none", color:"var(--text2)", padding:"5px 7px", borderRadius:7 }}><Icon name="edit" size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal==="new"||modal==="edit"} onClose={()=>setModal(null)} title={modal==="new"?"Nuevo Insumo":"Editar Insumo"}>
        <Field label="Nombre"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <Field label="Unidad">
            <select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>
              {["g","kg","ml","l","unidad","docena"].map(u=><option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Categoría">
            <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
              {insCategories.map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Stock actual"><input type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} /></Field>
          <Field label="Stock mínimo"><input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} /></Field>
          <Field label={`Costo por ${form.unit}`}><input type="number" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})} /></Field>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={save}>Guardar</Btn>
        </div>
      </Modal>

      <Modal open={!!adjustModal} onClose={()=>setAdjustModal(null)} title="Ajustar Stock" width={340}>
        {adjustModal && (
          <>
            <div style={{ marginBottom:14, fontSize:14 }}>Stock actual de <strong>{adjustModal.name}</strong>: <strong style={{color:"var(--accent)"}}>{fmtNum(adjustModal.stock)} {adjustModal.unit}</strong></div>
            <Field label="Cantidad a agregar (negativo para restar)">
              <input type="number" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="Ej: 500 o -100" />
            </Field>
            {adjustQty !== "" && <div style={{ marginBottom:12, fontSize:13, color:"var(--accent3)" }}>Nuevo stock: {fmtNum(adjustModal.stock + Number(adjustQty))} {adjustModal.unit}</div>}
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn variant="secondary" onClick={()=>setAdjustModal(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={doAdjust}>Confirmar</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── VENTAS ───────────────────────────────────────────────────────────────────
function Ventas({ state, dispatch }) {
  const [filter, setFilter] = useState("todos");
  const [detail, setDetail] = useState(null);

  const filtered = state.ventas.filter(v => filter==="todos" || v.type===filter);
  const stateColors = { pagado:"badge-green", entregado:"badge-green", en_camino:"badge-yellow", pendiente:"badge-orange", cancelado:"badge-red" };
  const stateLabels = { pagado:"Pagado", entregado:"Entregado", en_camino:"En camino", pendiente:"Pendiente", cancelado:"Cancelado" };

  const updateState = (venta, newState) => {
    dispatch({ type:"UPDATE_VENTA", payload:{ ...venta, state:newState } });
  };

  return (
    <div className="fade-in">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Registro de Ventas</h2>
          <div style={{ color:"var(--text3)", fontSize:13 }}>{state.ventas.length} ventas registradas</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {["todos","mostrador","delivery"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", background:filter===f?"var(--accent)":"var(--surface3)", color:filter===f?"#fff":"var(--text2)" }}>
              {f==="todos"?"Todos":f==="mostrador"?"Mostrador":"Delivery"}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen rápido */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total ventas", val:fmt(filtered.reduce((a,v)=>a+v.total,0)), color:"var(--accent)" },
          { label:"Efectivo", val:fmt(filtered.filter(v=>v.payment==="efectivo").reduce((a,v)=>a+v.total,0)), color:"var(--accent2)" },
          { label:"Tarjeta/Transfer", val:fmt(filtered.filter(v=>v.payment!=="efectivo").reduce((a,v)=>a+v.total,0)), color:"var(--accent4)" },
          { label:"Pedidos", val:filtered.length, color:"var(--accent3)" },
        ].map(s=>(
          <Card key={s.label} style={{padding:"14px 16px"}}>
            <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-head)", color:s.color }}>{s.val}</div>
          </Card>
        ))}
      </div>

      <div style={{ background:"var(--surface)", borderRadius:"var(--radius-lg)", border:"1px solid var(--border)", overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"60px 100px 1fr 120px 100px 120px 80px", padding:"10px 16px", borderBottom:"1px solid var(--border)", fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.5px" }}>
          <span>#</span><span>Tipo</span><span>Detalle</span><span>Fecha</span><span>Pago</span><span>Total</span><span>Estado</span>
        </div>
        {filtered.map(v=>(
          <div key={v.id} onClick={()=>setDetail(v)} style={{ display:"grid", gridTemplateColumns:"60px 100px 1fr 120px 100px 120px 80px", padding:"12px 16px", borderBottom:"1px solid var(--border)", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="var(--surface2)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >
            <span style={{ fontSize:12, color:"var(--text3)", fontWeight:700 }}>#{String(v.id).slice(-4)}</span>
            <div>
              <span className={`badge ${v.type==="delivery"?"badge-blue":"badge-orange"}`}>
                <Icon name={v.type==="delivery"?"delivery":"store"} size={10} />
                {v.type==="delivery"?"Delivery":"Mostrador"}
              </span>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{v.client || "Cliente mostrador"}</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>{v.items.map(i=>`${i.qty}x ${i.name}`).join(", ")}</div>
            </div>
            <span style={{ fontSize:12, color:"var(--text2)" }}>{new Date(v.date).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
            <span style={{ fontSize:12, color:"var(--text2)", textTransform:"capitalize" }}>{v.payment}</span>
            <span style={{ fontSize:15, fontWeight:800, color:"var(--accent)", fontFamily:"var(--font-head)" }}>{fmt(v.total)}</span>
            <span className={`badge ${stateColors[v.state]||"badge-orange"}`}>{stateLabels[v.state]||v.state}</span>
          </div>
        ))}
      </div>

      <Modal open={!!detail} onClose={()=>setDetail(null)} title={`Pedido #${String(detail?.id||"").slice(-4)}`}>
        {detail && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600 }}>TIPO</div>
                <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{detail.type==="delivery"?"Delivery 🛵":"Mostrador 🏪"}</div>
              </div>
              <div style={{ background:"var(--surface2)", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600 }}>PAGO</div>
                <div style={{ fontSize:14, fontWeight:700, marginTop:2, textTransform:"capitalize" }}>{detail.payment}</div>
              </div>
              {detail.client && <div style={{ background:"var(--surface2)", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600 }}>CLIENTE</div>
                <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{detail.client}</div>
              </div>}
              {detail.address && <div style={{ background:"var(--surface2)", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"var(--text3)", fontWeight:600 }}>DIRECCIÓN</div>
                <div style={{ fontSize:13, marginTop:2 }}>{detail.address}</div>
              </div>}
            </div>
            <div style={{ marginBottom:14 }}>
              {detail.items.map((it,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:14 }}>{it.qty}x {it.name}</span>
                  <span style={{ fontSize:14, fontWeight:700 }}>{fmt(it.price*it.qty)}</span>
                </div>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10 }}>
                <span style={{ fontSize:16, fontWeight:700 }}>Total</span>
                <span style={{ fontSize:18, fontWeight:800, color:"var(--accent)", fontFamily:"var(--font-head)" }}>{fmt(detail.total)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:8 }}>CAMBIAR ESTADO:</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["pagado","en_camino","entregado","cancelado"].map(s=>(
                  <button key={s} onClick={()=>{updateState(detail,s);setDetail({...detail,state:s});}} style={{
                    padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, border:"1px solid var(--border)",
                    background: detail.state===s ? "var(--accent)" : "var(--surface3)",
                    color: detail.state===s ? "#fff" : "var(--text2)"
                  }}>{stateLabels[s]}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── CAJA ─────────────────────────────────────────────────────────────────────
function Caja({ state, dispatch }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ type:"ingreso", amount:"", desc:"" });

  const saldo = state.caja.reduce((a,c) => {
    if (c.type==="apertura") return a + c.amount;
    if (c.type==="ingreso") return a + c.amount;
    if (c.type==="egreso") return a - c.amount;
    return a;
  }, 0);

  const totalIngresos = state.caja.filter(c=>c.type==="ingreso"||c.type==="apertura").reduce((a,c)=>a+c.amount,0);
  const totalEgresos = state.caja.filter(c=>c.type==="egreso").reduce((a,c)=>a+c.amount,0);

  const save = () => {
    if (!form.amount || !form.desc) return;
    dispatch({ type:"ADD_CAJA", payload:{ id:Date.now(), ...form, amount:Number(form.amount), date:new Date().toISOString() } });
    setModal(null);
  };

  const typeColors = { apertura:"badge-blue", ingreso:"badge-green", egreso:"badge-red", cierre:"badge-orange" };
  const typeIcons = { apertura:"arrow_up", ingreso:"arrow_up", egreso:"arrow_down", cierre:"check" };

  return (
    <div className="fade-in">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Caja</h2>
          <div style={{ color:"var(--text3)", fontSize:13 }}>Control de ingresos y egresos</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="secondary" onClick={()=>{setForm({type:"apertura",amount:"",desc:"Apertura de caja"});setModal(true);}}>Apertura</Btn>
          <Btn variant="success" icon="arrow_up" onClick={()=>{setForm({type:"ingreso",amount:"",desc:""});setModal(true);}}>Ingreso</Btn>
          <Btn variant="danger" icon="arrow_down" onClick={()=>{setForm({type:"egreso",amount:"",desc:""});setModal(true);}}>Egreso</Btn>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:20 }}>
        <Card style={{ background:"rgba(6,214,160,0.07)", border:"1px solid rgba(6,214,160,0.2)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--accent3)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Saldo Actual</div>
          <div style={{ fontSize:32, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--accent3)" }}>{fmt(saldo)}</div>
        </Card>
        <Card>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Total Ingresos</div>
          <div style={{ fontSize:24, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--text)" }}>{fmt(totalIngresos)}</div>
        </Card>
        <Card style={{ background:"rgba(239,71,111,0.07)", border:"1px solid rgba(239,71,111,0.2)" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--red)", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Total Egresos</div>
          <div style={{ fontSize:24, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--red)" }}>{fmt(totalEgresos)}</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Movimientos</div>
        {[...state.caja].reverse().map(c=>(
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
            <div style={{ width:32, height:32, borderRadius:10, background: c.type==="egreso"?"rgba(239,71,111,0.15)":"rgba(6,214,160,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name={typeIcons[c.type]||"arrow_up"} size={14} color={c.type==="egreso"?"var(--red)":"var(--accent3)"} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>{c.desc}</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>{new Date(c.date).toLocaleString("es-AR")}</div>
            </div>
            <span className={`badge ${typeColors[c.type]||"badge-blue"}`}>{c.type}</span>
            <div style={{ fontSize:16, fontWeight:800, fontFamily:"var(--font-head)", color: c.type==="egreso"?"var(--red)":"var(--accent3)", minWidth:100, textAlign:"right" }}>
              {c.type==="egreso"?"-":"+"}
              {fmt(c.amount)}
            </div>
          </div>
        ))}
      </Card>

      <Modal open={!!modal} onClose={()=>setModal(null)} title="Registrar Movimiento" width={360}>
        <Field label="Tipo">
          <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
            <option value="apertura">Apertura</option>
            <option value="cierre">Cierre</option>
          </select>
        </Field>
        <Field label="Monto"><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0" /></Field>
        <Field label="Descripción"><input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="Descripción del movimiento" /></Field>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={save}>Registrar</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────────────────────
function Estadisticas({ state }) {
  const ventas = state.ventas;

  const totalIngresos = ventas.reduce((a,v)=>a+v.total,0);
  const totalCosto = ventas.reduce((a,v)=> a + v.items.reduce((b,it)=>{
    const p = state.products.find(x=>x.id===it.productId);
    return b + (p?p.cost*it.qty:0);
  },0), 0);
  const ganancia = totalIngresos - totalCosto;
  const margen = totalIngresos > 0 ? ((ganancia/totalIngresos)*100).toFixed(1) : 0;

  const byCategory = useMemo(() => {
    const map = {};
    ventas.forEach(v => v.items.forEach(it => {
      const p = state.products.find(x=>x.id===it.productId);
      const cat = p?.category || "Otros";
      if (!map[cat]) map[cat] = { total:0, qty:0 };
      map[cat].total += it.price * it.qty;
      map[cat].qty += it.qty;
    }));
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  }, [ventas, state.products]);

  const byPayment = useMemo(() => {
    const map = {};
    ventas.forEach(v => {
      map[v.payment] = (map[v.payment]||0) + v.total;
    });
    return Object.entries(map);
  }, [ventas]);

  const maxCat = byCategory[0]?.[1]?.total || 1;
  const payColors = ["var(--accent)","var(--accent2)","var(--accent3)","var(--accent4)"];

  const valorStock = state.insumos.reduce((a,i)=>a+i.stock*i.cost,0);

  return (
    <div className="fade-in">
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-head)" }}>Estadísticas</h2>
        <div style={{ color:"var(--text3)", fontSize:13 }}>Análisis financiero del negocio</div>
      </div>

      {/* KPIs principales */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))", gap:12, marginBottom:24 }}>
        <StatCard title="Ingresos Totales" value={fmt(totalIngresos)} icon="sales" color="var(--accent)" />
        <StatCard title="Costos Totales" value={fmt(totalCosto)} icon="stock" color="var(--red)" />
        <StatCard title="Ganancia Bruta" value={fmt(ganancia)} icon="stats" color="var(--accent3)" />
        <StatCard title="Margen" value={`${margen}%`} icon="arrow_up" color="var(--accent2)" />
        <StatCard title="Valor en Stock" value={fmt(valorStock)} icon="stock" color="var(--accent4)" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Por categoría */}
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Ventas por Categoría</div>
          {byCategory.map(([cat, data]) => (
            <div key={cat} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{cat}</span>
                <span style={{ fontSize:13, color:"var(--accent)", fontWeight:700 }}>{fmt(data.total)}</span>
              </div>
              <div style={{ background:"var(--surface3)", borderRadius:4, height:7, overflow:"hidden" }}>
                <div style={{ height:"100%", background:"linear-gradient(90deg, var(--accent), var(--accent2))", width:`${(data.total/maxCat)*100}%`, borderRadius:4, transition:"width 0.6s ease" }} />
              </div>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{fmtNum(data.qty)} unidades vendidas</div>
            </div>
          ))}
        </Card>

        {/* Por método de pago */}
        <Card>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Por Método de Pago</div>
          {byPayment.map(([pay, total], i) => (
            <div key={pay} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:payColors[i%payColors.length], flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, textTransform:"capitalize" }}>{pay}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>{((total/totalIngresos)*100).toFixed(1)}% del total</div>
              </div>
              <div style={{ fontSize:15, fontWeight:800, fontFamily:"var(--font-head)", color:payColors[i%payColors.length] }}>{fmt(total)}</div>
            </div>
          ))}

          <div style={{ marginTop:16, padding:"12px", background:"var(--surface2)", borderRadius:10 }}>
            <div style={{ fontSize:12, color:"var(--text3)", fontWeight:600, marginBottom:4 }}>DELIVERY vs MOSTRADOR</div>
            <div style={{ display:"flex", gap:16 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--accent4)" }}>{ventas.filter(v=>v.type==="delivery").length}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>Delivery</div>
              </div>
              <div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--accent)" }}>{ventas.filter(v=>v.type==="mostrador").length}</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>Mostrador</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Productos más rentables */}
        <Card style={{ gridColumn:"span 2" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Rentabilidad por Producto</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:10 }}>
            {state.products.filter(p=>p.active).map(p => {
              const margin = p.price > 0 ? (((p.price-p.cost)/p.price)*100).toFixed(1) : 0;
              const color = margin > 60 ? "var(--accent3)" : margin > 40 ? "var(--accent2)" : "var(--red)";
              return (
                <div key={p.id} style={{ background:"var(--surface2)", borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                    <div style={{ fontSize:12, color:"var(--text3)" }}>{fmt(p.price)} — costo {fmt(p.cost)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18, fontWeight:800, fontFamily:"var(--font-head)", color }}>{margin}%</div>
                    <div style={{ fontSize:11, color:"var(--text3)" }}>margen</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    products: INITIAL_PRODUCTS,
    insumos: INITIAL_INSUMOS,
    ventas: INITIAL_VENTAS,
    caja: INITIAL_CAJA,
    categories: INITIAL_CATEGORIES,
  });
  const [section, setSection] = useState("dashboard");

  const nav = [
    { id:"dashboard", label:"Dashboard", icon:"dashboard" },
    { id:"pedidos", label:"Tomar Pedido", icon:"orders" },
    { id:"ventas", label:"Ventas", icon:"receipt" },
    { id:"productos", label:"Menú", icon:"menu" },
    { id:"insumos", label:"Insumos", icon:"stock" },
    { id:"caja", label:"Caja", icon:"cash" },
    { id:"stats", label:"Estadísticas", icon:"stats" },
  ];

  const sectionComponents = {
    dashboard: <Dashboard state={state} dispatch={dispatch} />,
    pedidos: <Pedidos state={state} dispatch={dispatch} />,
    ventas: <Ventas state={state} dispatch={dispatch} />,
    productos: <Productos state={state} dispatch={dispatch} />,
    insumos: <Insumos state={state} dispatch={dispatch} />,
    caja: <Caja state={state} dispatch={dispatch} />,
    stats: <Estadisticas state={state} />,
  };

  const pendingDeliveries = state.ventas.filter(v=>v.type==="delivery"&&v.state==="en_camino").length;

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:"var(--font-body)" }}>
      {/* Sidebar */}
      <div style={{ width:220, background:"var(--surface)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid var(--border)" }}>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"var(--font-head)", color:"var(--accent)", letterSpacing:"-0.5px" }}>🍽 GastroOS</div>
          <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Sistema de gestión</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"12px 10px", display:"flex", flexDirection:"column", gap:2 }}>
          {nav.map(item => {
            const active = section === item.id;
            return (
              <button key={item.id} onClick={()=>setSection(item.id)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
                borderRadius:10, background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text2)",
                fontWeight: active ? 700 : 500, fontSize:13, border:"none",
                transition:"all 0.15s", textAlign:"left", position:"relative"
              }}
                onMouseEnter={e=>!active&&(e.currentTarget.style.background="var(--surface3)")}
                onMouseLeave={e=>!active&&(e.currentTarget.style.background="transparent")}
              >
                <Icon name={item.icon} size={16} color={active?"#fff":"currentColor"} />
                {item.label}
                {item.id==="ventas" && pendingDeliveries > 0 && (
                  <span style={{ marginLeft:"auto", background:"var(--red)", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{pendingDeliveries}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)" }}>
          <div style={{ fontSize:11, color:"var(--text3)" }}>v1.0.0 · {new Date().toLocaleDateString("es-AR")}</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, overflow:"auto", background:"var(--bg)" }}>
        <div style={{ padding:"24px", maxWidth:1400, margin:"0 auto" }}>
          {sectionComponents[section]}
        </div>
      </div>
    </div>
  );
}
