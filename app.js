/* ===========================
   MIRU — Tienda de Pastas
   app.js — Firebase Edition
   =========================== */

// ===== FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBID-D84D51wDUbfWs-1zl0p4NAOasnW8o",
  authDomain: "tiendamiru-6bdc9.firebaseapp.com",
  projectId: "tiendamiru-6bdc9",
  storageBucket: "tiendamiru-6bdc9.firebasestorage.app",
  messagingSenderId: "821244932243",
  appId: "1:821244932243:web:1a4c331bac93554c7d5d66",
  measurementId: "G-Z5JHJ8SNQB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ===== ESTADO GLOBAL =====
let productos = [];
let carrito = [];
let config = { nombre: "MIRU", wa: "5491112345678", msg: "Hola! Quiero hacer un pedido en MIRU:" };
let firebaseReady = false;

// ===== CARGA DESDE FIREBASE (tiempo real) =====
function initFirebase() {
  // Escuchar productos en tiempo real
  db.collection('productos').orderBy('nombre').onSnapshot(snapshot => {
    productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (firebaseReady) {
      renderSecciones();
    }
  }, err => {
    console.error('Error cargando productos:', err);
    // Fallback a localStorage
    productos = JSON.parse(localStorage.getItem('miru_productos') || '[]');
    if (firebaseReady) renderSecciones();
  });

  // Escuchar config en tiempo real
  db.collection('config').doc('tienda').onSnapshot(doc => {
    if (doc.exists) {
      config = doc.data();
      document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;
    }
  }, err => {
    console.error('Error cargando config:', err);
  });
}

// ===== SECCIONES DE LA TIENDA =====
const SECCIONES = [
  {
    id: 'rellenas',
    nombre: 'Pastas Rellenas',
    subtitulo: 'Ravioles · Sorrentinos · Fagottinis',
    categoria: 'Rellenas',
    emoji: '🥟',
    imagen: 'https://images.unsplash.com/photo-1587740908075-9e245070dfaa?w=800&q=80',
    color: '#5c3d1e'
  },
  {
    id: 'frescas',
    nombre: 'Pasta Fresca',
    subtitulo: 'Tallarines · Pappardelles · Ñoquis',
    categoria: 'Largas',
    // Para pasta fresca mostramos Largas + Ñoquis juntas
    categorias: ['Largas', 'Ñoquis'],
    emoji: '🍝',
    imagen: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=800&q=80',
    color: '#8b6340'
  },
  {
    id: 'salsas',
    nombre: 'Salsas',
    subtitulo: 'Bolognesa · Pesto · Pomodoro · Fileto',
    categoria: 'Salsas',
    emoji: '🫙',
    imagen: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    color: '#c0392b'
  },
  {
    id: 'despensa',
    nombre: 'Despensa',
    subtitulo: 'Quesos · Vinos · Conservas · Morrones',
    categoria: 'Despensa',
    emoji: '🧀',
    imagen: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800&q=80',
    color: '#2c3e50'
  },
  {
    id: 'almacen',
    nombre: 'Almacén',
    subtitulo: 'Aceites · Harinas · Especias · Productos secos',
    categoria: 'Almacen',
    emoji: '🛒',
    imagen: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=800&q=80',
    color: '#3d2b1f'
  },
];

// ===========================
//   NAVEGACIÓN
// ===========================
function irAInicio() {
  document.getElementById('vista-secciones').style.display = 'block';
  document.getElementById('vista-productos').style.display = 'none';
  renderSecciones();
  window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });
}

function irASeccion(seccionId) {
  const seccion = SECCIONES.find(s => s.id === seccionId);
  if (!seccion) return;

  document.getElementById('vista-secciones').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'block';

  // Filtramos por una o varias categorías
  const cats = seccion.categorias || [seccion.categoria];
  const lista = productos.filter(p => cats.includes(p.categoria));

  document.getElementById('titulo-seccion').textContent = seccion.nombre.toUpperCase();
  document.getElementById('count-productos').textContent =
    lista.length + ' producto' + (lista.length !== 1 ? 's' : '');

  renderProductos(lista);
  window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });
}

// ===========================
//   RENDER SECCIONES
// ===========================
function renderSecciones() {
  const grid = document.getElementById('grid-secciones');
  grid.innerHTML = SECCIONES.map((s, i) => {
    const cantCats = s.categorias || [s.categoria];
    const cant = productos.filter(p => cantCats.includes(p.categoria)).length;
    return `
      <div class="card-seccion" style="animation-delay:${i * 0.1}s" onclick="irASeccion('${s.id}')">
        <div class="card-seccion-bg" style="background-image:url('${s.imagen}')"></div>
        <div class="card-seccion-overlay"></div>
        <div class="card-seccion-content">
          <span class="card-seccion-emoji">${s.emoji}</span>
          <div class="card-seccion-nombre">${s.nombre}</div>
          <span class="card-seccion-sub">${s.subtitulo}</span>
          <div class="card-seccion-footer">
            <span class="card-seccion-cant">${cant} producto${cant !== 1 ? 's' : ''}</span>
            <span class="card-seccion-arrow">Ver todo →</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===========================
//   RENDER PRODUCTOS
// ===========================
function renderProductos(lista) {
  const grid = document.getElementById('grid-productos');

  if (lista.length === 0) {
    grid.innerHTML = '<div class="no-productos">SIN PRODUCTOS EN ESTA SECCIÓN AÚN</div>';
    return;
  }

  grid.innerHTML = lista.map((p, i) => {
    const agotado = p.agotado === true;
    return `
    <div class="card ${agotado ? 'card-agotado' : ''}" style="animation-delay:${i * 0.06}s" onclick="${agotado ? '' : `abrirModalProducto('${p.id}')`}">
      <div class="card-img-wrap">
        <span class="card-cat-badge">${p.categoria}</span>
        ${agotado ? '<span class="card-agotado-badge">AGOTADO</span>' : ''}
        ${p.imagen
          ? `<img
               src="${p.imagen}"
               alt="${p.nombre}"
               class="card-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
             />
             <div class="card-emoji-fallback" style="display:none">${p.emoji}</div>`
          : `<div class="card-emoji-fallback">${p.emoji}</div>`
        }
      </div>
      <div class="card-body">
        <div class="card-nombre">${p.nombre}</div>
        <div class="card-desc">${p.desc}</div>
        <div class="card-footer">
          <div>
            <div class="precio">$${Number(p.precio).toLocaleString('es-AR')}</div>
            <div class="precio-unit">${p.categoria === 'Bebidas' ? 'por unidad' : 'por porción'}</div>
          </div>
          ${agotado
            ? '<span class="btn-agotado-label">No disponible</span>'
            : `<button class="btn-agregar" onclick="event.stopPropagation(); agregarRapido('${p.id}')">+ Agregar</button>`
          }
        </div>
      </div>
    </div>
  `}).join('');
}

// ===========================
//   CARRITO
// ===========================

// Agregar rápido desde el botón discreto (sin modal de detalle)
function agregarRapido(id) {
  const p = productos.find(x => x.id === id);
  if (!p || p.agotado) return;
  const item = carrito.find(x => x.id === id);
  if (item) { item.qty++; } else { carrito.push({ ...p, qty: 1 }); }
  actualizarBadge();
  mostrarModalAgregado(p, 1);
}

function agregarAlCarrito(id, qty = 1) {
  const p = productos.find(x => x.id === id);
  if (!p || p.agotado) return;
  const item = carrito.find(x => x.id === id);
  if (item) { item.qty += qty; } else { carrito.push({ ...p, qty }); }
  actualizarBadge();
  mostrarModalAgregado(p, qty);
}

// ===========================
//   MODAL DETALLE PRODUCTO
// ===========================
let modalProductoId = null;
let modalCantidad = 1;

// Fotos extra por categoria para la galería
const FOTOS_EXTRA = {
  'Rellenas': [
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91798d047e?w=600&q=80',
    'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80',
  ],
  'Ñoquis': [
    'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80',
    'https://images.unsplash.com/photo-1598866594230-a7c12756260f?w=600&q=80',
  ],
  'Largas': [
    'https://images.unsplash.com/photo-1567608285969-48e4bbe0d197?w=600&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=600&q=80',
  ],
  'Salsas': [
    'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600&q=80',
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=600&q=80',
  ],
  'Bebidas': [
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80',
    'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&q=80',
  ],
};

function abrirModalProducto(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;

  modalProductoId = id;
  modalCantidad = 1;

  // Fotos: la propia del producto + extras de su categoría
  const extras = FOTOS_EXTRA[p.categoria] || [];
  const fotos = p.imagen ? [p.imagen, ...extras] : extras;

  // Foto principal
  const fotoPrincipal = document.getElementById('modal-prod-foto-principal');
  if (fotos.length > 0) {
    fotoPrincipal.src = fotos[0];
    fotoPrincipal.style.display = 'block';
  } else {
    fotoPrincipal.style.display = 'none';
  }

  // Miniaturas
  const miniaturas = document.getElementById('modal-prod-miniaturas');
  if (fotos.length > 1) {
    miniaturas.innerHTML = fotos.map((f, i) =>
      `<img src="${f}" class="modal-prod-miniatura ${i === 0 ? 'activa' : ''}"
            onclick="cambiarFotoModal('${f}', this)" alt="foto ${i+1}" />`
    ).join('');
  } else {
    miniaturas.innerHTML = '';
  }

  // Info
  document.getElementById('modal-prod-categoria').textContent = p.categoria;
  document.getElementById('modal-prod-nombre').textContent = p.nombre;
  document.getElementById('modal-prod-precio').textContent = '$' + Number(p.precio).toLocaleString('es-AR');
  document.getElementById('modal-prod-precio-unit').textContent = p.categoria === 'Bebidas' ? 'por unidad' : 'por porción';
  document.getElementById('modal-prod-desc').textContent = p.desc;
  document.getElementById('modal-prod-qty').textContent = '1';

  document.getElementById('modal-producto-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cambiarFotoModal(src, el) {
  const foto = document.getElementById('modal-prod-foto-principal');
  foto.classList.add('cambiando');
  setTimeout(() => {
    foto.src = src;
    foto.classList.remove('cambiando');
  }, 200);
  document.querySelectorAll('.modal-prod-miniatura').forEach(m => m.classList.remove('activa'));
  el.classList.add('activa');
}

function cambiarCantidadModal(delta) {
  modalCantidad = Math.max(1, modalCantidad + delta);
  document.getElementById('modal-prod-qty').textContent = modalCantidad;
}

function agregarDesdeModal() {
  if (!modalProductoId) return;
  agregarAlCarrito(modalProductoId, modalCantidad);
  cerrarModalProductoSilencioso();
}

function cerrarModalProducto(e) {
  if (e && e.target !== document.getElementById('modal-producto-overlay')) return;
  cerrarModalProductoSilencioso();
}

function cerrarModalProductoSilencioso() {
  document.getElementById('modal-producto-overlay').classList.remove('visible');
  document.body.style.overflow = '';
  modalProductoId = null;
}

// ===========================
//   MODAL CONFIRMACIÓN
// ===========================
function mostrarModalAgregado(p, qty) {
  document.getElementById('magg-producto').textContent =
    `${qty > 1 ? qty + 'x ' : ''}${p.nombre} agregado al carrito`;

  // Resumen carrito
  const itemsEl = document.getElementById('magg-items');
  itemsEl.innerHTML = carrito.map(i =>
    `<div class="modal-agregado-item">
      <span>${i.qty}× ${i.nombre}</span>
      <span>$${(i.precio * i.qty).toLocaleString('es-AR')}</span>
    </div>`
  ).join('');

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  document.getElementById('magg-total').textContent = '$' + total.toLocaleString('es-AR');

  document.getElementById('modal-agregado-overlay').classList.add('visible');
}

function cerrarModalAgregado() {
  document.getElementById('modal-agregado-overlay').classList.remove('visible');
}

function irAlCarritoDesdeModal() {
  cerrarModalAgregado();
  abrirCarrito();
}



function actualizarBadge() {
  document.getElementById('badge').textContent =
    carrito.reduce((s, i) => s + i.qty, 0);
}

function abrirCarrito() {
  renderCarrito();
  document.getElementById('panel-carrito').classList.add('abierto');
  document.getElementById('overlay').classList.add('visible');
}

function cerrarCarrito() {
  document.getElementById('panel-carrito').classList.remove('abierto');
  document.getElementById('overlay').classList.remove('visible');
}

function renderCarrito() {
  const body   = document.getElementById('cuerpo-carrito');
  const footer = document.getElementById('footer-carrito');

  if (carrito.length === 0) {
    body.innerHTML = `
      <div class="carrito-vacio">
        <span class="icono">VACÍO</span>
        <p style="font-size:.85rem;letter-spacing:2px;text-transform:uppercase">
          Agregá algo rico del menú
        </p>
      </div>`;
    footer.style.display = 'none';
    return;
  }

  body.innerHTML = carrito.map(item => `
    <div class="item-carrito">
      <div class="item-emoji">${item.emoji}</div>
      <div class="item-info">
        <div class="item-nombre">${item.nombre}</div>
        <div class="item-precio">$${(item.precio * item.qty).toLocaleString('es-AR')}</div>
        <div class="item-controles">
          <button class="btn-qty" onclick="cambiarQty('${item.id}', -1)">−</button>
          <span class="qty">${item.qty}</span>
          <button class="btn-qty" onclick="cambiarQty('${item.id}', 1)">+</button>
          <button class="btn-eliminar" onclick="eliminarItem('${item.id}')">✕</button>
        </div>
      </div>
    </div>
  `).join('');

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  document.getElementById('total-carrito').textContent = '$' + total.toLocaleString('es-AR');
  footer.style.display = 'block';
}

function cambiarQty(id, delta) {
  const item = carrito.find(x => x.id === id);
  item.qty += delta;
  if (item.qty <= 0) carrito = carrito.filter(x => x.id !== id);
  actualizarBadge();
  renderCarrito();
}

function eliminarItem(id) {
  carrito = carrito.filter(x => x.id !== id);
  actualizarBadge();
  renderCarrito();
}

function pedirPorWhatsApp() {
  if (!carrito.length) return;
  const lineas = carrito
    .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
    .join('\n');
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const msg = `${config.msg}\n\n${lineas}\n\n*TOTAL: $${total.toLocaleString('es-AR')}*`;
  window.open(`https://wa.me/${config.wa}?text=${encodeURIComponent(msg)}`, '_blank');
}

function cerrarTodo() {
  cerrarCarrito();
  cerrarModalProductoSilencioso();
  cerrarModalAgregado();
}

// ===========================
//   MERCADO PAGO — CHECKOUT PRO (via Cloud Function)
// ===========================
const crearPreferencia = firebase.functions('southamerica-east1').httpsCallable('crearPreferencia');

async function pagarConMP() {
  if (!carrito.length) return;

  const btnMP   = document.getElementById('btn-mp');
  const loading = document.getElementById('mp-loading');
  const errorDiv = document.getElementById('mp-error');

  btnMP.disabled = true;
  btnMP.style.display = 'none';
  loading.style.display = 'flex';
  errorDiv.style.display = 'none';

  // Solo enviar IDs y cantidades — los precios se validan en el servidor
  const items = carrito.map(item => ({
    id: item.id,
    quantity: item.qty
  }));

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);

  try {
    const result = await crearPreferencia({ items });
    const data = result.data;

    if (!data.init_point) {
      throw new Error('Sin link de pago');
    }

    window.open(data.init_point, '_blank');

    // Notificar pedido por WhatsApp
    const lineas = carrito.map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`).join('\n');
    const msgWA = `${config.msg}\n\n${lineas}\n\n*TOTAL: $${total.toLocaleString('es-AR')}*\n\n✅ El cliente va a pagar por Mercado Pago.`;
    window.open(`https://wa.me/${config.wa}?text=${encodeURIComponent(msgWA)}`, '_blank');

  } catch (err) {
    console.error('Error MP:', err);
    errorDiv.textContent = '⚠ No se pudo conectar con Mercado Pago. Usá WhatsApp para continuar.';
    errorDiv.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    btnMP.style.display = 'flex';
    btnMP.disabled = false;
  }
}

// ===========================
//   TOAST
// ===========================
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ===========================
//   INICIALIZACIÓN
// ===========================
initFirebase();
firebaseReady = true;
renderSecciones();
document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;
