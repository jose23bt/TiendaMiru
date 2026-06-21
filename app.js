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
const auth = firebase.auth();
auth.useDeviceLanguage();

// Persistencia local para que el usuario siga logueado entre sesiones
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => {
  console.warn('No se pudo establecer persistencia:', e);
});

// ===== UTILIDADES DE SEGURIDAD =====
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
    return '';
  } catch { return ''; }
}

function aplicarHero(tipo, url) {
  const cont = document.getElementById('hero-media');
  if (!cont) return;
  const safe = sanitizeURL(url);
  if (!safe) return; // sin URL válida, queda el default del HTML

  cont.innerHTML = '';
  if (tipo === 'foto') {
    const img = document.createElement('img');
    img.className = 'hero-video'; // misma clase: object-fit cover, ocupa todo
    img.src = safe;
    img.alt = '';
    cont.appendChild(img);
  } else {
    const v = document.createElement('video');
    v.className = 'hero-video';
    v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
    const s = document.createElement('source');
    s.src = safe;
    s.type = 'video/mp4';
    v.appendChild(s);
    cont.appendChild(v);
  }
}

// ===== ESTADO GLOBAL =====
let productos = [];
let carrito = [];
let config = { nombre: "MIRU", wa: "5491159076070", msg: "Hola! Quiero hacer un pedido en MIRU:" };
let firebaseReady = false;
let productosCargados = false; // true cuando llega el primer snapshot de Firebase

// Comida lista
let comidaLista = [];
let comidaListaCargada = false;
let comidaCategoriaActiva = 'pizzas';

// Estado de sesión
let usuarioActual = null; // { uid, nombre, email, telefono, photoURL }

// Estado del checkout
let checkoutState = {
  modalidad: null,  // 'retiro' | 'delivery'
  nombre: '',
  telefono: '',
  email: '',
  notas: '',
  pasoActual: 1
};

// ===== PERSISTENCIA DEL CARRITO =====
const CARRITO_KEY = 'miru_carrito';
const PEDIDO_PENDIENTE_KEY = 'miru_pedido_pendiente';
const PEDIDO_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

function guardarCarrito() {
  try {
    localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito));
  } catch (e) {
    console.warn('No se pudo guardar el carrito:', e);
  }
}

function cargarCarrito() {
  try {
    const raw = localStorage.getItem(CARRITO_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) carrito = parsed;
  } catch (e) {
    console.warn('No se pudo cargar el carrito:', e);
    carrito = [];
  }
}

function vaciarCarrito() {
  carrito = [];
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

// ===== CARGA DESDE FIREBASE (tiempo real) =====
function initFirebase() {
  // Escuchar productos en tiempo real
  db.collection('productos').orderBy('nombre').onSnapshot(snapshot => {
    productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    productosCargados = true;
    if (firebaseReady) {
      renderSecciones();
      // Si hay una vista de productos abierta, re-renderizarla
      if (document.getElementById('vista-productos').style.display === 'block') {
        const titulo = document.getElementById('titulo-seccion').textContent;
        const seccion = SECCIONES.find(s => s.nombre.toUpperCase() === titulo);
        if (seccion) {
          const cats = seccion.categorias || [];
          renderProductos(productos.filter(p => cats.includes(p.categoria)));
        }
      }
    }
  }, err => {
    console.error('Error cargando productos:', err);
    productosCargados = true; // no mantener "cargando" infinito
    // Fallback a localStorage
    productos = JSON.parse(localStorage.getItem('miru_productos') || '[]');
    if (firebaseReady) renderSecciones();
  });

  // Escuchar config en tiempo real
  db.collection('config').doc('tienda').onSnapshot(doc => {
    if (doc.exists) {
      config = doc.data();
      window.config = config; // exponer para manejarRetornoMP
      document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;
      // Actualizar link de WA en landing
      const waLink = document.getElementById('landing-wa-link');
      if (waLink) {
        waLink.href = 'https://wa.me/' + config.wa;
      }
    }
  }, err => {
    console.error('Error cargando config:', err);
  });

  // Escuchar comida lista en tiempo real
  db.collection('comidaLista').orderBy('orden').onSnapshot(snapshot => {
    comidaLista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    comidaListaCargada = true;
    if (firebaseReady) {
      actualizarConteosComida();
      // Si estamos viendo una categoría, re-render
      if (document.getElementById('comida-vista-platos').style.display !== 'none') {
        renderComidaLista();
      }
    }
  }, err => {
    console.error('Error cargando comida lista:', err);
    comidaListaCargada = true;
    if (firebaseReady) {
      actualizarConteosComida();
      if (document.getElementById('comida-vista-platos').style.display !== 'none') {
        renderComidaLista();
      }
    }
  });
  // Escuchar el hero (video o foto) en tiempo real
  db.collection('config').doc('hero').onSnapshot(doc => {
    if (doc.exists) {
      const d = doc.data();
      aplicarHero(d.tipo, d.url);
    }
  }, err => console.error('Error cargando hero:', err));
}

// ===== SECCIONES DE LA TIENDA =====
// Cargadas dinámicamente desde Firestore (colección 'secciones')
// Las secciones hardcodeadas de fábrica se migran con adminSeedSecciones() desde el admin
let SECCIONES = [];

async function cargarSecciones() {
  try {
    // Sin where+orderBy combinados para evitar requerir índice compuesto.
    // Filtramos activa en JS y ordenamos por orden.
    const snap = await db.collection('secciones').get();

    SECCIONES = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre,
          subtitulo: data.subtitulo || '',
          categorias: data.categorias || (data.categoria ? [data.categoria] : []),
          emoji: data.emoji || '🛒',
          imagen: data.imagen || '',
          color: data.color || '#2c3e50',
          orden: data.orden || 99,
          activa: data.activa !== false, // undefined → true (retrocompat)
        };
      })
      .filter(s => s.activa)
      .sort((a, b) => a.orden - b.orden);

  } catch (e) {
    console.error('Error cargando secciones desde Firestore:', e);
    SECCIONES = [];
  }
}

// ===========================
//   NAVEGACIÓN
// ===========================
function irAInicio() {
  document.getElementById('vista-secciones').style.display = 'block';
  document.getElementById('vista-productos').style.display = 'none';
  cerrarPerfilModal();
  cerrarEditarDireccion();
  renderSecciones();
  window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });
}

function irASeccion(seccionId) {
  const seccion = SECCIONES.find(s => s.id === seccionId);
  if (!seccion) return;

  document.getElementById('vista-secciones').style.display = 'none';
  document.getElementById('vista-productos').style.display = 'block';

  // Filtramos por una o varias categorías
  const cats = seccion.categorias || [];
  const lista = productos.filter(p => cats.includes(p.categoria));

  document.getElementById('titulo-seccion').textContent = seccion.nombre.toUpperCase();
  document.getElementById('count-productos').textContent =
    lista.length + ' producto' + (lista.length !== 1 ? 's' : '');

  renderProductos(lista);
  window.scrollTo({ top: document.querySelector('main').offsetTop - 80, behavior: 'smooth' });

  // History API: registrar entrada para interceptar botón "atrás"
  history.pushState({ tipo: 'seccion', seccionId }, '', '');
}

// ===========================
//   RENDER SECCIONES
// ===========================
function renderSecciones() {
  const grid = document.getElementById('grid-secciones');
  grid.innerHTML = SECCIONES.map((s, i) => {
    const cantCats = s.categorias || [];
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

  if (!productosCargados) {
    grid.innerHTML = '<div class="no-productos">CARGANDO PRODUCTOS…</div>';
    return;
  }

  if (lista.length === 0) {
    grid.innerHTML = '<div class="no-productos">SIN PRODUCTOS EN ESTA SECCIÓN AÚN</div>';
    return;
  }

  grid.innerHTML = lista.map((p, i) => {
    const agotado = p.agotado === true;
    const nombre = escapeHTML(p.nombre);
    const desc = escapeHTML(p.desc);
    const categoria = escapeHTML(p.categoria);
    const emoji = escapeHTML(p.emoji);
    const imagen = sanitizeURL(p.imagen);
    return `
    <div class="card ${agotado ? 'card-agotado' : ''}" style="animation-delay:${i * 0.06}s" onclick="${agotado ? '' : `abrirModalProducto('${escapeHTML(p.id)}')`}">
      <div class="card-img-wrap">
        <span class="card-cat-badge">${categoria}</span>
        ${agotado ? '<span class="card-agotado-badge">AGOTADO</span>' : ''}
        ${imagen
          ? `<img
               src="${imagen}"
               alt="${nombre}"
               class="card-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
             />
             <div class="card-emoji-fallback" style="display:none">${emoji}</div>`
          : `<div class="card-emoji-fallback">${emoji}</div>`
        }
      </div>
      <div class="card-body">
        <div class="card-nombre">${nombre}</div>
        <div class="card-desc">${desc}</div>
        <div class="card-footer">
          <div>
            <div class="precio">$${Number(p.precio).toLocaleString('es-AR')}</div>
            <div class="precio-unit">${categoria === 'Bebidas' ? 'por unidad' : 'por porción'}</div>
          </div>
          ${agotado
            ? '<span class="btn-agotado-label">No disponible</span>'
            : `<button class="btn-agregar" onclick="event.stopPropagation(); agregarRapido('${escapeHTML(p.id)}')">+ Agregar</button>`
          }
        </div>
      </div>
    </div>
  `}).join('');
}

// ===========================
//   COMIDA LISTA — Navegación + Render + Modal
// ===========================

const FUDO_URL = 'https://menu.fu.do/mirupizzaypasta';

// Actualiza los contadores de pizzas/pastas en las cards de categoría
function actualizarConteosComida() {
  const pizzas = comidaLista.filter(p => p.categoria === 'pizzas' && p.disponible !== false).length;
  const pastas = comidaLista.filter(p => p.categoria === 'pastas' && p.disponible !== false).length;
  const elP = document.getElementById('count-pizzas');
  const elPa = document.getElementById('count-pastas');
  if (elP)  elP.textContent  = pizzas + (pizzas === 1 ? ' plato' : ' platos');
  if (elPa) elPa.textContent = pastas + (pastas === 1 ? ' plato' : ' platos');
}

// Entrar a una categoría (pizzas o pastas)
function irACategoriaComida(categoria) {
  comidaCategoriaActiva = categoria;

  document.getElementById('comida-vista-categorias').style.display = 'none';
  document.getElementById('comida-vista-platos').style.display = 'block';

  const titulo = categoria === 'pizzas' ? '🍕 PIZZAS' : '🍝 PASTAS';
  document.getElementById('comida-platos-titulo').textContent = titulo;

  renderComidaLista();

  // Scroll suave al inicio de la sección
  const sec = document.getElementById('comida-lista');
  if (sec) {
    window.scrollTo({ top: sec.offsetTop - 70, behavior: 'smooth' });
  }

  // History API: registrar entrada para interceptar botón "atrás"
  history.pushState({ tipo: 'categoria-comida', categoria }, '', '');
}

// Volver a la vista de categorías
function volverACategoriasComida() {
  document.getElementById('comida-vista-platos').style.display = 'none';
  document.getElementById('comida-vista-categorias').style.display = 'block';
  const sec = document.getElementById('comida-lista');
  if (sec) {
    window.scrollTo({ top: sec.offsetTop - 70, behavior: 'smooth' });
  }
}

function renderComidaLista() {
  const grid = document.getElementById('comida-grid');
  if (!grid) return;

  if (!comidaListaCargada) {
    grid.innerHTML = '<div class="comida-loading">Cargando menú...</div>';
    return;
  }

  const lista = comidaLista.filter(p => p.categoria === comidaCategoriaActiva);

  // Contador arriba del grid
  const countEl = document.getElementById('comida-platos-count');
  if (countEl) {
    countEl.textContent = lista.length + (lista.length === 1 ? ' plato' : ' platos');
  }

  if (lista.length === 0) {
    grid.innerHTML = `<div class="comida-loading">Pronto vamos a tener ${comidaCategoriaActiva} 🍳</div>`;
    return;
  }

  grid.innerHTML = lista.map((p, i) => {
    const nombre = escapeHTML(p.nombre);
    const imagen = sanitizeURL(p.imagen);
    const esVideo = p.esVideo === true;
    const disponible = p.disponible !== false;

    const mediaHTML = esVideo
      ? `<video class="comida-card-media" src="${imagen}" muted loop playsinline preload="metadata" onmouseover="this.play().catch(()=>{})" onmouseout="this.pause()"></video>`
      : `<img class="comida-card-media" src="${imagen}" alt="${nombre}" loading="lazy" />`;

    return `
      <div class="comida-card ${disponible ? '' : 'comida-card-no-disp'}" style="animation-delay:${i * 0.05}s" onclick="abrirModalComida('${escapeHTML(p.id)}')">
        ${mediaHTML}
        <div class="comida-card-overlay">
          <div class="comida-card-nombre">${nombre}</div>
          ${!disponible ? '<div class="comida-card-no-disp-tag">No disponible hoy</div>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function abrirModalComida(id) {
  const p = comidaLista.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('modal-comida');
  const media = document.getElementById('modal-comida-media');
  const badge = document.getElementById('modal-comida-badge');
  const nombre = document.getElementById('modal-comida-nombre');
  const desc = document.getElementById('modal-comida-desc');
  const precioWrap = document.getElementById('modal-comida-precio-wrap');
  const precio = document.getElementById('modal-comida-precio');
  const btnFudo = document.getElementById('modal-comida-btn-fudo');

  const imgURL = sanitizeURL(p.imagen);
  if (p.esVideo) {
    media.innerHTML = `<video src="${imgURL}" controls autoplay muted loop playsinline class="modal-comida-video"></video>`;
  } else {
    media.innerHTML = `<img src="${imgURL}" alt="${escapeHTML(p.nombre)}" class="modal-comida-img" />`;
  }

  badge.textContent = p.categoria === 'pizzas' ? '🍕 Pizza' : '🍝 Pasta';
  nombre.textContent = p.nombre || '';
  desc.textContent = p.desc || '';

  if (p.precio && p.precio > 0) {
    precio.textContent = '$' + Number(p.precio).toLocaleString('es-AR');
    precioWrap.style.display = 'flex';
  } else {
    precioWrap.style.display = 'none';
  }

  // Botón siempre va a Fudo (la tienda online gestiona precios, delivery y cobros)
  if (btnFudo) btnFudo.href = FUDO_URL;

  modal.classList.add('visible');
  document.body.style.overflow = 'hidden';

  // History API: registrar entrada para interceptar botón "atrás"
  history.pushState({ tipo: 'modal-comida' }, '', '');
}

function cerrarModalComida() {
  const modal = document.getElementById('modal-comida');
  modal.classList.remove('visible');
  document.body.style.overflow = '';
  // Detener videos
  const media = document.getElementById('modal-comida-media');
  if (media) {
    const video = media.querySelector('video');
    if (video) { video.pause(); video.currentTime = 0; }
  }
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
  guardarCarrito();
  actualizarBadge();
  mostrarModalAgregado(p, 1);
}

function agregarAlCarrito(id, qty = 1) {
  const p = productos.find(x => x.id === id);
  if (!p || p.agotado) return;
  const item = carrito.find(x => x.id === id);
  if (item) { item.qty += qty; } else { carrito.push({ ...p, qty }); }
  guardarCarrito();
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

  // Fotos: la propia del producto + fotos adicionales subidas en el admin
  const fotoProducto = sanitizeURL(p.imagen);
  const fotosExtras = Array.isArray(p.fotos)
    ? p.fotos.map(f => sanitizeURL(f)).filter(Boolean)
    : [];
  const fotos = fotoProducto ? [fotoProducto, ...fotosExtras] : fotosExtras;

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
    miniaturas.innerHTML = fotos.map((f, i) => {
      const safeSrc = escapeHTML(f);
      return `<img src="${safeSrc}" class="modal-prod-miniatura ${i === 0 ? 'activa' : ''}"
            onclick="cambiarFotoModal('${safeSrc}', this)" alt="foto ${i+1}" />`;
    }).join('');
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

  // History API: registrar entrada para interceptar botón "atrás"
  history.pushState({ tipo: 'modal-producto' }, '', '');
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
      <span>${i.qty}× ${escapeHTML(i.nombre)}</span>
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
      <div class="item-emoji">${escapeHTML(item.emoji)}</div>
      <div class="item-info">
        <div class="item-nombre">${escapeHTML(item.nombre)}</div>
        <div class="item-precio">$${(item.precio * item.qty).toLocaleString('es-AR')}</div>
        <div class="item-controles">
          <button class="btn-qty" onclick="cambiarQty('${escapeHTML(item.id)}', -1)">−</button>
          <span class="qty">${item.qty}</span>
          <button class="btn-qty" onclick="cambiarQty('${escapeHTML(item.id)}', 1)">+</button>
          <button class="btn-eliminar" onclick="eliminarItem('${escapeHTML(item.id)}')">✕</button>
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
  guardarCarrito();
  actualizarBadge();
  renderCarrito();
}

function eliminarItem(id) {
  carrito = carrito.filter(x => x.id !== id);
  guardarCarrito();
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
//   AUTENTICACIÓN (Google, opcional)
// ===========================

function initAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Usuario logueado: leer/crear perfil en Firestore
      const perfil = await leerOCrearPerfilUsuario(user);
      usuarioActual = {
        uid: user.uid,
        nombre: perfil.nombre || user.displayName || '',
        email: perfil.email || user.email || '',
        telefono: perfil.telefono || '',
        photoURL: user.photoURL || ''
      };
    } else {
      usuarioActual = null;
    }
    actualizarUIUsuario();
  });
}

async function leerOCrearPerfilUsuario(user) {
  const ref = db.collection('usuarios').doc(user.uid);
  try {
    const doc = await ref.get();
    if (doc.exists) {
      // Actualizar último login
      await ref.set({ ultimoLogin: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return doc.data();
    } else {
      // Primera vez: crear perfil
      const nuevo = {
        nombre: user.displayName || '',
        email: user.email || '',
        telefono: '',
        photoURL: user.photoURL || '',
        direccion: {
          calle: '',
          numero: '',
          piso: '',
          ciudad: 'Buenos Aires',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ultimoLogin: firebase.firestore.FieldValue.serverTimestamp(),
        cantidadPedidos: 0,
        gastTotal: 0
      };
      await ref.set(nuevo);
      return nuevo;
    }
  } catch (e) {
    console.error('Error leyendo/creando perfil:', e);
    return { nombre: user.displayName || '', email: user.email || '', telefono: '' };
  }
}

async function guardarTelefonoUsuario(telefono) {
  if (!usuarioActual || !telefono) return;
  try {
    await db.collection('usuarios').doc(usuarioActual.uid).set(
      { telefono },
      { merge: true }
    );
    usuarioActual.telefono = telefono;
  } catch (e) {
    console.warn('No se pudo guardar el teléfono:', e);
  }
}

async function guardarDireccionUsuario(calle, numero, piso, ciudad) {
  if (!usuarioActual) return false;
  try {
    await db.collection('usuarios').doc(usuarioActual.uid).set(
      {
        direccion: {
          calle: calle || '',
          numero: numero || '',
          piso: piso || '',
          ciudad: ciudad || '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('No se pudo guardar la dirección:', e);
    return false;
  }
}

async function cargarDireccionUsuario() {
  if (!usuarioActual) return null;
  try {
    const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
    if (doc.exists && doc.data().direccion) {
      return doc.data().direccion;
    }
    return null;
  } catch (e) {
    console.error('Error cargando dirección:', e);
    return null;
  }
}

async function guardarPedido(items, total, modalidad, datosCliente) {
  try {
    const pedidoData = {
      uid: usuarioActual?.uid || null,
      email: datosCliente.email,
      nombre: datosCliente.nombre,
      telefono: datosCliente.telefono,
      modalidad: modalidad,
      items: items.map(i => ({
        id: i.id,
        nombre: i.nombre,
        qty: i.qty,
        precio: i.precio
      })),
      total: total,
      notas: datosCliente.notas || '',
      estado: 'pendiente',
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (modalidad === 'delivery' && datosCliente.direccion) {
      pedidoData.direccion = datosCliente.direccion;
    }
    
    const docRef = await db.collection('pedidos').add(pedidoData);
    return docRef.id;
  } catch (e) {
    console.error('Error guardando pedido:', e);
    return null;
  }
}

async function cargarHistorialPedidos(uid) {
  try {
    const snap = await db.collection('pedidos')
      .where('uid', '==', uid)
      .orderBy('creadoEn', 'desc')
      .limit(50)
      .get();
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (e) {
    console.error('Error cargando historial:', e);
    return [];
  }
}

async function cargarTodosPedidos() {
  try {
    const snap = await db.collection('pedidos')
      .orderBy('creadoEn', 'desc')
      .limit(100)
      .get();
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (e) {
    console.error('Error cargando todos los pedidos:', e);
    return [];
  }
}

async function actualizarEstadoPedido(pedidoId, nuevoEstado) {
  try {
    await db.collection('pedidos').doc(pedidoId).update({
      estado: nuevoEstado,
      ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error('Error actualizando pedido:', e);
    return false;
  }
}

async function loginConGoogle(desdeCheckout) {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const errorEl = document.getElementById('modal-login-error');
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  try {
    // Redirect solo en iOS Safari (popup no funciona ahí)
    // En Android Chrome y desktop siempre popup
    const esIOSSafari = /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
      /Safari/i.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

    if (esIOSSafari) {
      if (desdeCheckout) sessionStorage.setItem('miru_login_desde_checkout', '1');
      await auth.signInWithRedirect(provider);
    } else {
      await auth.signInWithPopup(provider);
      if (desdeCheckout) {
        setTimeout(() => aplicarDatosUsuarioEnCheckout(), 300);
      } else {
        cerrarModalLogin();
      }
    }
  } catch (err) {
    console.error('Error login Google:', err);
    let msg = 'No se pudo iniciar sesión. ';
    if (err.code === 'auth/popup-closed-by-user') msg = 'Cerraste la ventana antes de completar el login.';
    else if (err.code === 'auth/popup-blocked') msg = 'Tu navegador bloqueó la ventana. Permití popups e intentá de nuevo.';
    else if (err.code === 'auth/network-request-failed') msg = 'Sin conexión. Revisá tu internet.';
    else if (err.code === 'auth/unauthorized-domain') msg = 'Dominio no autorizado. Contactá al administrador.';
    else msg += (err.message || '');

    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    } else {
      toast(msg);
    }
  }
}

async function cerrarSesion() {
  try {
    await auth.signOut();
    cerrarModalUsuario();
    toast('Sesión cerrada');
  } catch (e) {
    console.error(e);
  }
}

// ===========================
//   LOGIN / REGISTRO MANUAL
// ===========================

function toggleModoLogin() {
  const esRegistro = document.getElementById('modal-login-modo').dataset.modo === 'registro';
  setModoLogin(esRegistro ? 'login' : 'registro');
}

function setModoLogin(modo) {
  const contenedor = document.getElementById('modal-login-modo');
  contenedor.dataset.modo = modo;
  const titulo = document.getElementById('modal-login-titulo');
  const btnSubmit = document.getElementById('btn-login-manual-submit');
  const toggleTxt = document.getElementById('login-toggle-texto');
  const toggleBtn = document.getElementById('login-toggle-btn');
  const campoNombre = document.getElementById('login-campo-nombre');

  if (modo === 'registro') {
    titulo.textContent = 'Crear cuenta en MIRU';
    btnSubmit.textContent = 'Crear cuenta';
    toggleTxt.textContent = '¿Ya tenés cuenta?';
    toggleBtn.textContent = 'Iniciá sesión';
    campoNombre.style.display = 'block';
    document.getElementById('login-input-nombre').required = true;
  } else {
    titulo.textContent = 'Iniciá sesión en MIRU';
    btnSubmit.textContent = 'Ingresar';
    toggleTxt.textContent = '¿No tenés cuenta?';
    toggleBtn.textContent = 'Registrate';
    campoNombre.style.display = 'none';
    document.getElementById('login-input-nombre').required = false;
  }
  limpiarErrorLogin();
}

function limpiarErrorLogin() {
  const errorEl = document.getElementById('modal-login-error');
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
}

function mostrarErrorLogin(msg) {
  const errorEl = document.getElementById('modal-login-error');
  if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
}

function traducirErrorAuth(code) {
  const errores = {
    'auth/invalid-email': 'El email no es válido.',
    'auth/user-disabled': 'Esta cuenta está deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con ese email.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Email o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
    'auth/popup-closed-by-user': 'Cerraste la ventana antes de completar el login.',
    'auth/popup-blocked': 'Tu navegador bloqueó la ventana. Permití popups e intentá de nuevo.',
    'auth/unauthorized-domain': 'Dominio no autorizado. Contactá al administrador.',
  };
  return errores[code] || 'Error inesperado. Intentá de nuevo.';
}

async function submitLoginManual() {
  const contenedor = document.getElementById('modal-login-modo');
  const modo = contenedor.dataset.modo || 'login';
  const email = document.getElementById('login-input-email').value.trim();
  const password = document.getElementById('login-input-password').value;
  const nombre = document.getElementById('login-input-nombre').value.trim();
  const btnSubmit = document.getElementById('btn-login-manual-submit');

  limpiarErrorLogin();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    mostrarErrorLogin('Ingresá un email válido.'); return;
  }
  if (!password || password.length < 6) {
    mostrarErrorLogin('La contraseña debe tener al menos 6 caracteres.'); return;
  }
  if (modo === 'registro' && !nombre) {
    mostrarErrorLogin('Ingresá tu nombre.'); return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = modo === 'registro' ? 'Creando cuenta...' : 'Ingresando...';

  try {
    if (modo === 'registro') {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (nombre) await cred.user.updateProfile({ displayName: nombre });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    cerrarModalLogin();
  } catch (err) {
    console.error('Error login manual:', err);
    mostrarErrorLogin(traducirErrorAuth(err.code));
  } finally {
    btnSubmit.disabled = false;
    setModoLogin(modo);
  }
}

// Manejar retorno de signInWithRedirect (móvil)
async function manejarRedirectLogin() {
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      const veniaDelCheckout = sessionStorage.getItem('miru_login_desde_checkout') === '1';
      sessionStorage.removeItem('miru_login_desde_checkout');
      if (veniaDelCheckout) {
        // Reabrir checkout en paso 2 y pre-cargar
        setTimeout(() => {
          if (carrito.length > 0) {
            abrirCheckout();
            // Si ya eligió modalidad antes del redirect, podríamos restaurarla
            // Por simplicidad, vuelve al paso 1
          }
        }, 200);
      }
    }
  } catch (e) {
    console.warn('Error en redirect result:', e);
  }
}

// ===========================
//   UI DE USUARIO EN HEADER
// ===========================

function actualizarUIUsuario() {
  const btn = document.getElementById('btn-usuario-hdr');
  const nombre = document.getElementById('nombre-usuario');
  const avatar = document.getElementById('avatar-usuario');
  const iconoUsuario = btn ? btn.querySelector('.icono-usuario') : null;
  if (!btn) return;

  if (usuarioActual) {
    const primerNombre = (usuarioActual.nombre || '').split(' ')[0] || 'Cuenta';
    nombre.textContent = primerNombre;
    btn.classList.add('logueado');
    if (usuarioActual.photoURL) {
      avatar.src = usuarioActual.photoURL;
      avatar.style.display = 'block';
      avatar.alt = usuarioActual.nombre || '';
      if (iconoUsuario) iconoUsuario.style.display = 'none';
    } else {
      avatar.style.display = 'none';
      if (iconoUsuario) iconoUsuario.style.display = 'block';
    }
  } else {
    nombre.textContent = 'Ingresar';
    btn.classList.remove('logueado');
    avatar.style.display = 'none';
    if (iconoUsuario) iconoUsuario.style.display = 'block';
  }
}

function manejarClickUsuario() {
  if (usuarioActual) {
    abrirModalUsuario();
  } else {
    abrirModalLogin();
  }
}

function abrirModalLogin() {
  document.getElementById('modal-login').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarModalLogin() {
  document.getElementById('modal-login').classList.remove('visible');
  document.body.style.overflow = '';
}

async function abrirModalUsuario() {
  if (!usuarioActual) return;
  
  // Abrir modal del perfil en lugar de vista
  const modal = document.getElementById('perfil-modal');
  if (modal) {
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  
  // Cargar datos del perfil
  await cargarVistaPerfilUsuario();
  
  // Registrar en history
  history.pushState({ tipo: 'perfil' }, '', '');
}

function cerrarPerfilModal() {
  const modal = document.getElementById('perfil-modal');
  if (modal) {
    modal.classList.remove('visible');
    document.body.style.overflow = '';
  }
}

// ===========================
//   CHECKOUT (3 pasos)
// ===========================

async function abrirCheckout() {
  if (!carrito.length) return;
  
  // Verificar si usuario está logueado
  if (!usuarioActual) {
    toast('Debes iniciar sesión para hacer un pedido');
    abrirModalLogin();
    return;
  }
  
  // Cargar datos del usuario desde Firestore
  let datosFirestore = {
    nombre: usuarioActual.displayName || '',
    telefono: '',
    email: usuarioActual.email || '',
    direccion: ''
  };
  
  try {
    const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
    if (doc.exists) {
      const userData = doc.data();
      datosFirestore.nombre = userData.nombre || usuarioActual.displayName || '';
      datosFirestore.telefono = userData.telefono || '';
      datosFirestore.email = userData.email || usuarioActual.email || '';
      
      // Si tiene dirección guardada, usar esa también
      if (userData.direccion) {
        const dir = userData.direccion;
        datosFirestore.direccion = `${dir.calle} ${dir.numero}${dir.piso ? ', ' + dir.piso : ''}, ${dir.ciudad || 'Buenos Aires'}`;
      }
    }
  } catch (e) {
    console.error('Error cargando datos del usuario:', e);
    // Continuar con datos básicos si hay error
  }
  
  // Usuario logueado, proceder con checkout
  checkoutState = {
    modalidad: null,
    nombre: datosFirestore.nombre,
    telefono: datosFirestore.telefono,
    email: datosFirestore.email,
    notas: '',
    pasoActual: 1
  };
  
  mostrarPasoCheckout(1);
  aplicarDatosUsuarioEnCheckout(datosFirestore);
  cerrarCarrito();
  document.getElementById('modal-checkout').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarModalCheckout() {
  document.getElementById('modal-checkout').classList.remove('visible');
  document.body.style.overflow = '';
  // Limpiar error y restaurar estado del botón confirmar
  const err = document.getElementById('checkout-error');
  if (err) {
    err.style.display = 'none';
    err.innerHTML = '';
    err.removeAttribute('style'); // resetea estilos inline que pudimos aplicar
  }
  const btn = document.getElementById('btn-checkout-confirmar');
  if (btn) {
    btn.style.display = '';
    btn.disabled = false;
  }
  const btnTexto = document.getElementById('checkout-confirmar-texto');
  if (btnTexto) {
    btnTexto.textContent = checkoutState.modalidad === 'retiro'
      ? 'Pagar con Mercado Pago'
      : 'Coordinar por WhatsApp';
  }
}

function mostrarPasoCheckout(n) {
  checkoutState.pasoActual = n;
  [1, 2, 3].forEach(i => {
    const panel = document.getElementById(`checkout-paso-${i}`);
    const step = document.querySelector(`.checkout-step[data-step="${i}"]`);
    if (panel) panel.style.display = i === n ? 'block' : 'none';
    if (step) {
      step.classList.toggle('activo', i === n);
      step.classList.toggle('completado', i < n);
    }
  });
}

function seleccionarModalidad(modalidad) {
  checkoutState.modalidad = modalidad;
  const hint = document.getElementById('checkout-email-hint');
  const subtitulo = document.getElementById('checkout-subtitulo-datos');
  const emailInput = document.getElementById('checkout-email');
  const labelDireccion = document.getElementById('checkout-label-direccion');
  const inputDireccion = document.getElementById('checkout-direccion');

  if (modalidad === 'retiro') {
    hint.textContent = '(requerido para Mercado Pago)';
    subtitulo.textContent = 'Te pasamos la dirección exacta para el retiro por WhatsApp. Confirmá tus datos para continuar.';
    emailInput.required = true;
    labelDireccion.style.display = 'none';
    inputDireccion.required = false;
    inputDireccion.value = '';
  } else {
    hint.textContent = '(opcional)';
    subtitulo.textContent = 'Coordinaremos el delivery del jueves por WhatsApp. Confirmá tus datos para continuar.';
    emailInput.required = false;
    labelDireccion.style.display = 'block';
    inputDireccion.required = true;
  }

  mostrarPasoCheckout(2);
}

function aplicarDatosUsuarioEnCheckout(datosUsuario) {
  const loginSugerido = document.getElementById('checkout-login-sugerido');
  const logueadoBox = document.getElementById('checkout-usuario-logueado');

  if (usuarioActual) {
    loginSugerido.style.display = 'none';
    logueadoBox.style.display = 'flex';

    const avatar = document.getElementById('checkout-usuario-avatar');
    if (usuarioActual.photoURL) {
      avatar.style.backgroundImage = `url('${usuarioActual.photoURL}')`;
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = (datosUsuario?.nombre || 'U')[0].toUpperCase();
    }
    
    document.getElementById('checkout-usuario-nombre-display').textContent = datosUsuario?.nombre || '';
    document.getElementById('checkout-usuario-email-display').textContent = datosUsuario?.email || '';

    // PRE-CARGAR DATOS EN LOS INPUTS (desde Firestore)
    document.getElementById('checkout-nombre').value = datosUsuario?.nombre || '';
    document.getElementById('checkout-email').value = datosUsuario?.email || '';
    document.getElementById('checkout-telefono').value = datosUsuario?.telefono || '';
  } else {
    loginSugerido.style.display = 'flex';
    logueadoBox.style.display = 'none';
  }
}

function volverAPaso(n) {
  mostrarPasoCheckout(n);
}

function irAPasoConfirmar(event) {
  if (event) event.preventDefault();

  const nombre = document.getElementById('checkout-nombre').value.trim();
  const telefono = document.getElementById('checkout-telefono').value.trim();
  const email = document.getElementById('checkout-email').value.trim();
  const direccion = document.getElementById('checkout-direccion').value.trim();
  const notas = document.getElementById('checkout-notas').value.trim();

  if (!nombre || nombre.length < 2) { toast('Ingresá tu nombre'); return false; }
  const telSoloNumeros = telefono.replace(/\D/g, '');
  if (telSoloNumeros.length < 8) { toast('Teléfono inválido (mínimo 8 dígitos)'); return false; }
  if (checkoutState.modalidad === 'retiro') {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast('Email inválido (requerido para Mercado Pago)');
      return false;
    }
  }
  if (checkoutState.modalidad === 'delivery' && !direccion) {
    toast('Ingresá la dirección de entrega');
    return false;
  }

  checkoutState.nombre = nombre;
  checkoutState.telefono = telefono;
  checkoutState.email = email;
  checkoutState.direccion = direccion;
  checkoutState.notas = notas;

  if (usuarioActual && telefono && telefono !== usuarioActual.telefono) {
    guardarTelefonoUsuario(telefono);
  }

  renderPasoConfirmar();
  mostrarPasoCheckout(3);
  return false;
}

function renderPasoConfirmar() {
  const modalidadTxt = checkoutState.modalidad === 'retiro'
    ? '🏪 Retiro en Lomas de Zamora'
    : '🛵 Delivery (jueves)';
  document.getElementById('resumen-modalidad').textContent = modalidadTxt;

  const clienteTxt = `${checkoutState.nombre} · Tel: ${checkoutState.telefono}` +
    (checkoutState.email ? ` · ${checkoutState.email}` : '') +
    (checkoutState.direccion ? `\nDirección: ${checkoutState.direccion}` : '') +
    (checkoutState.notas ? `\nNotas: ${checkoutState.notas}` : '');
  document.getElementById('resumen-cliente').textContent = clienteTxt;

  const itemsDiv = document.getElementById('resumen-items');
  itemsDiv.innerHTML = carrito.map(i => `
    <div class="checkout-resumen-item">
      <span>${i.qty}× ${escapeHTML(i.nombre)}</span>
      <span>$${(i.precio * i.qty).toLocaleString('es-AR')}</span>
    </div>
  `).join('');

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  document.getElementById('resumen-total').textContent = '$' + total.toLocaleString('es-AR');

  const btnTexto = document.getElementById('checkout-confirmar-texto');
  const btn = document.getElementById('btn-checkout-confirmar');
  if (checkoutState.modalidad === 'retiro') {
    btnTexto.textContent = 'Pagar con Mercado Pago';
    btn.classList.remove('btn-confirmar-wa');
    btn.classList.add('btn-confirmar-mp');
  } else {
    btnTexto.textContent = 'Coordinar por WhatsApp';
    btn.classList.remove('btn-confirmar-mp');
    btn.classList.add('btn-confirmar-wa');
  }
}

// Función unificada — el carrito tiene un solo botón principal que abre este flujo
function iniciarCheckout() {
  if (!carrito.length) return;
  abrirCheckout();
}

async function confirmarCheckout() {
  const errorEl = document.getElementById('checkout-error');
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (checkoutState.modalidad === 'retiro') {
    await iniciarPagoMP();
  } else {
    iniciarDeliveryWhatsApp();
  }
}

async function iniciarDeliveryWhatsApp() {
  const lineas = carrito
    .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
    .join('\n');
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);

  // Guardar pedido en Firestore
  const datosCliente = {
    nombre: checkoutState.nombre,
    telefono: checkoutState.telefono,
    email: checkoutState.email,
    notas: checkoutState.notas,
    direccion: checkoutState.direccion || ''
  };

  await guardarPedido(carrito, total, 'delivery', datosCliente);

  const msg = `Hola! Quiero hacer un pedido con *DELIVERY* (jueves) en MIRU 🛵

*Cliente:* ${checkoutState.nombre}
*Teléfono:* ${checkoutState.telefono}
${checkoutState.notas ? '*Notas:* ' + checkoutState.notas + '\n' : ''}
*Pedido:*
${lineas}

*TOTAL: $${total.toLocaleString('es-AR')}*

¿Me confirmás dirección de entrega, horario y forma de pago?`;

  const waURL = `https://wa.me/${config.wa}?text=${encodeURIComponent(msg)}`;
  window.location.href = waURL;
}

async function iniciarPagoMP() {
  if (!carrito.length) return;
  const btn = document.getElementById('btn-checkout-confirmar');
  const errorEl = document.getElementById('checkout-error');
  const btnTexto = document.getElementById('checkout-confirmar-texto');

  btn.disabled = true;
  btnTexto.textContent = 'Generando link de pago...';
  errorEl.style.display = 'none';
  errorEl.innerHTML = '';

  const items = carrito.map(item => ({ id: item.id, quantity: item.qty }));
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);

  // Snapshot del pedido para usar al volver de MP
  const pedidoSnapshot = {
    items: carrito.map(i => ({ id: i.id, nombre: i.nombre, qty: i.qty, precio: i.precio })),
    total,
    timestamp: Date.now(),
    modalidad: 'retiro',
    cliente: {
      nombre: checkoutState.nombre,
      telefono: checkoutState.telefono,
      email: checkoutState.email,
      notas: checkoutState.notas,
      uid: usuarioActual?.uid || null
    }
  };
  try {
    localStorage.setItem(PEDIDO_PENDIENTE_KEY, JSON.stringify(pedidoSnapshot));
  } catch (e) {
    console.warn('No se pudo guardar pedido pendiente:', e);
  }

  try {
    const crearPreferencia = firebase.app().functions('southamerica-east1').httpsCallable('crearPreferencia');
    const result = await crearPreferencia({
      items,
      payer: {
        name: checkoutState.nombre,
        email: checkoutState.email
      }
    });
    const data = result.data;
    if (!data.init_point) throw new Error('Sin link de pago');

    // IMPORTANTE: en móvil, después del await Safari/Chrome bloquean la navegación automática
    // porque consideran que ya no hay "user gesture". Solución: mostrar un botón intermedio
    // que el usuario toca explícitamente y así la navegación queda ligada a ese click.
    mostrarBotonIrAMP(data.init_point);

  } catch (err) {
    console.error('Error MP:', err);
    try { localStorage.removeItem(PEDIDO_PENDIENTE_KEY); } catch (e) {}

    const lineas = carrito.map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`).join('\n');
    const msgWA = `Hola! Tuve un problema con Mercado Pago en MIRU.

*Cliente:* ${checkoutState.nombre}
*Teléfono:* ${checkoutState.telefono}

*Pedido:*
${lineas}

*TOTAL: $${total.toLocaleString('es-AR')}*

¿Podemos coordinar el pago por acá?`;
    const waURL = `https://wa.me/${config.wa}?text=${encodeURIComponent(msgWA)}`;

    errorEl.innerHTML = `
      <div style="margin-bottom:10px">⚠ No se pudo conectar con Mercado Pago. Tu carrito está intacto.</div>
      <a href="${waURL}" class="btn-whatsapp" style="display:inline-flex;text-decoration:none;justify-content:center;width:100%;padding:.8rem 1rem;background:#25d366;color:white;border-radius:10px;font-weight:600">
        Continuar por WhatsApp
      </a>
    `;
    errorEl.style.display = 'block';

    btn.disabled = false;
    btnTexto.textContent = 'Pagar con Mercado Pago';
  }
}

// Muestra un botón explícito "Ir a Mercado Pago" para garantizar user gesture en móvil
function mostrarBotonIrAMP(initPoint) {
  const btn = document.getElementById('btn-checkout-confirmar');
  const btnTexto = document.getElementById('checkout-confirmar-texto');
  const errorEl = document.getElementById('checkout-error');

  // Ocultar el botón de confirmar
  btn.style.display = 'none';

  // Inyectar un anchor <a> grande que navega con click real del usuario
  errorEl.innerHTML = `
    <div class="checkout-mp-listo">
      <div class="checkout-mp-listo-titulo">✓ Link de pago listo</div>
      <div class="checkout-mp-listo-desc">Tocá el botón para ir a Mercado Pago y completar tu pago.</div>
      <a href="${initPoint}" class="checkout-btn-ir-mp" onclick="cerrarModalCheckout()">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="white"/>
          <path d="M7 16.5C7 16.5 10.5 10 16 10C21.5 10 25 16.5 25 16.5C25 16.5 21.5 23 16 23C10.5 23 7 16.5 7 16.5Z" fill="#009EE3"/>
          <circle cx="16" cy="16.5" r="3.5" fill="white"/>
        </svg>
        Ir a Mercado Pago
      </a>
    </div>
  `;
  errorEl.style.display = 'block';
  errorEl.style.background = 'transparent';
  errorEl.style.border = 'none';
  errorEl.style.padding = '0';
  errorEl.style.color = 'inherit';
}

// ===========================
//   MERCADO PAGO — ENTRADA VIEJA (ahora abre checkout)
// ===========================

async function pagarConMP() {
  // Ahora el flujo pasa por el modal de checkout
  if (!carrito.length) return;
  abrirCheckout();
}

// ===========================
//   RETORNO DE MERCADO PAGO
// ===========================

function manejarRetornoMP() {
  const params = new URLSearchParams(window.location.search);
  const estado = params.get('pago');
  if (!estado) return;

  // Leer snapshot del pedido
  let pedido = null;
  try {
    const raw = localStorage.getItem(PEDIDO_PENDIENTE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Descartar si tiene más de 2 horas (quedó colgado)
      if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < PEDIDO_TTL_MS)) {
        pedido = parsed;
      }
    }
  } catch (e) {
    console.warn('No se pudo leer pedido pendiente:', e);
  }

  // Limpiar la URL (sin recargar) para que si el usuario refresca no se re-dispare
  const urlLimpia = window.location.pathname + window.location.hash;
  window.history.replaceState({}, '', urlLimpia);

  if (estado === 'exitoso') {
    mostrarRetornoPago('exitoso', pedido);
    try { localStorage.removeItem(PEDIDO_PENDIENTE_KEY); } catch (e) {}
    vaciarCarrito();
  } else if (estado === 'pendiente') {
    mostrarRetornoPago('pendiente', pedido);
    try { localStorage.removeItem(PEDIDO_PENDIENTE_KEY); } catch (e) {}
    vaciarCarrito();
  } else if (estado === 'fallido') {
    mostrarRetornoPago('fallido', pedido);
    // NO vaciamos carrito ni borramos snapshot — el cliente puede reintentar
  }
}

function mostrarRetornoPago(estado, pedido) {
  const overlay = document.getElementById('modal-retorno-pago');
  if (!overlay) return; // por si el HTML aún no tiene el modal (fallback a toast)

  const config = {
    exitoso: {
      icono: '✓',
      titulo: '¡Gracias por tu compra!',
      mensaje: 'Tu pago fue aprobado. Estamos preparando tu pedido con todo el cariño de Miru.',
      etiquetaEstado: '✅ PAGO APROBADO',
      textoBoton: 'Enviar confirmación a Miru',
      claseColor: 'retorno-exitoso'
    },
    pendiente: {
      icono: '⏳',
      titulo: '¡Gracias por tu pedido!',
      mensaje: 'Tu pago quedó en proceso. Te avisaremos apenas se acredite. Mientras tanto, podés confirmarle el pedido a Miru por WhatsApp.',
      etiquetaEstado: '⏳ PAGO PENDIENTE',
      textoBoton: 'Avisar a Miru por WhatsApp',
      claseColor: 'retorno-pendiente'
    },
    fallido: {
      icono: '✕',
      titulo: 'El pago no se completó',
      mensaje: 'Tu carrito quedó guardado. Podés reintentar con Mercado Pago o coordinar por WhatsApp.',
      etiquetaEstado: '❌ PAGO RECHAZADO',
      textoBoton: 'Coordinar por WhatsApp',
      claseColor: 'retorno-fallido'
    }
  };

  const cfg = config[estado];
  if (!cfg) return;

  // Construir mensaje de WhatsApp con datos del pedido
  let lineas = '';
  let total = 0;
  let datosCliente = '';
  if (pedido && pedido.items && pedido.items.length) {
    lineas = pedido.items
      .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
      .join('\n');
    total = pedido.total;

    if (pedido.cliente) {
      const c = pedido.cliente;
      datosCliente = `\n*Cliente:* ${c.nombre || ''}\n*Teléfono:* ${c.telefono || ''}` +
        (c.email ? `\n*Email:* ${c.email}` : '') +
        (c.notas ? `\n*Notas:* ${c.notas}` : '');
    }
  }

  const modalidadLinea = pedido?.modalidad === 'retiro' ? '\n*Modalidad:* 🏪 Retiro en local' : '';

  const msgWA = pedido
    ? `Hola! Te confirmo mi pedido en MIRU:${datosCliente}${modalidadLinea}\n\n*Pedido:*\n${lineas}\n\n*TOTAL: $${total.toLocaleString('es-AR')}*\n\n${cfg.etiquetaEstado}`
    : `Hola! Hice un pedido en MIRU.\n\n${cfg.etiquetaEstado}`;

  const waURL = `https://wa.me/${(window.config && window.config.wa) || '5491159076070'}?text=${encodeURIComponent(msgWA)}`;

  // Render del modal
  overlay.querySelector('[data-retorno-icono]').textContent = cfg.icono;
  overlay.querySelector('[data-retorno-titulo]').textContent = cfg.titulo;
  overlay.querySelector('[data-retorno-mensaje]').textContent = cfg.mensaje;
  const btnWA = overlay.querySelector('[data-retorno-wa]');
  btnWA.textContent = cfg.textoBoton;
  btnWA.href = waURL;

  const inner = overlay.querySelector('.modal-retorno');
  inner.classList.remove('retorno-exitoso', 'retorno-pendiente', 'retorno-fallido');
  inner.classList.add(cfg.claseColor);

  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarModalRetornoPago() {
  const overlay = document.getElementById('modal-retorno-pago');
  if (overlay) overlay.classList.remove('visible');
  document.body.style.overflow = '';
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
//   CHECKOUT WHATSAPP (modal independiente)
// ===========================

let waCheckoutState = {
  modalidad: null,
  nombre: '',
  telefono: '',
  direccion: '',
  notas: '',
  pasoActual: 1
};

async function abrirCheckoutWA() {
  if (!carrito.length) return;
  
  // Verificar si usuario está logueado
  if (!usuarioActual) {
    toast('Debes iniciar sesión para hacer un pedido');
    abrirModalLogin();
    return;
  }
  
  // Cargar datos del usuario desde Firestore
  let datosFirestore = {
    nombre: usuarioActual.displayName || '',
    telefono: '',
    email: usuarioActual.email || '',
    direccion: ''
  };
  
  try {
    const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
    if (doc.exists) {
      const userData = doc.data();
      datosFirestore.nombre = userData.nombre || usuarioActual.displayName || '';
      datosFirestore.telefono = userData.telefono || '';
      datosFirestore.email = userData.email || usuarioActual.email || '';
      
      // Si tiene dirección guardada, usar esa también
      if (userData.direccion) {
        const dir = userData.direccion;
        datosFirestore.direccion = `${dir.calle} ${dir.numero}${dir.piso ? ', ' + dir.piso : ''}, ${dir.ciudad || 'Buenos Aires'}`;
      }
    }
  } catch (e) {
    console.error('Error cargando datos del usuario:', e);
    // Continuar con datos básicos si hay error
  }
  
  // Usuario logueado, proceder con checkout
  waCheckoutState = {
    modalidad: null,
    nombre: datosFirestore.nombre,
    telefono: datosFirestore.telefono,
    direccion: datosFirestore.direccion,
    notas: '',
    pasoActual: 1
  };
  waMostrarPaso(1);
  waAplicarDatosUsuario(datosFirestore);
  cerrarCarrito();
  document.getElementById('modal-checkout-wa').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarModalCheckoutWA() {
  document.getElementById('modal-checkout-wa').classList.remove('visible');
  document.body.style.overflow = '';
}

function waMostrarPaso(n) {
  waCheckoutState.pasoActual = n;
  [1, 2, 3].forEach(i => {
    const panel = document.getElementById(`wa-checkout-paso-${i}`);
    const step = document.querySelector(`#wa-checkout-steps .checkout-step[data-step="${i}"]`);
    if (panel) panel.style.display = i === n ? 'block' : 'none';
    if (step) {
      step.classList.toggle('activo', i === n);
      step.classList.toggle('completado', i < n);
    }
  });
}

function waAplicarDatosUsuario(datosUsuario) {
  const loginSugerido = document.getElementById('wa-checkout-login-sugerido');
  const logueadoBox = document.getElementById('wa-checkout-usuario-logueado');

  if (usuarioActual) {
    loginSugerido.style.display = 'none';
    logueadoBox.style.display = 'flex';
    const avatar = document.getElementById('wa-checkout-usuario-avatar');
    if (usuarioActual.photoURL) {
      avatar.style.backgroundImage = `url('${usuarioActual.photoURL}')`;
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = (datosUsuario?.nombre || 'U')[0].toUpperCase();
    }
    document.getElementById('wa-checkout-usuario-nombre-display').textContent = datosUsuario?.nombre || '';
    document.getElementById('wa-checkout-usuario-email-display').textContent = datosUsuario?.email || '';
    
    // PRE-CARGAR DATOS EN LOS INPUTS (desde Firestore)
    document.getElementById('wa-checkout-nombre').value = datosUsuario?.nombre || '';
    document.getElementById('wa-checkout-telefono').value = datosUsuario?.telefono || '';
    document.getElementById('wa-checkout-direccion').value = datosUsuario?.direccion || '';
  } else {
    loginSugerido.style.display = 'flex';
    logueadoBox.style.display = 'none';
  }
}

function waSeleccionarModalidad(modalidad) {
  waCheckoutState.modalidad = modalidad;
  const subtitulo = document.getElementById('wa-checkout-subtitulo-datos');
  const labelDireccion = document.getElementById('wa-checkout-label-direccion');
  const inputDireccion = document.getElementById('wa-checkout-direccion');

  if (modalidad === 'retiro') {
    subtitulo.textContent = 'Coordinamos el retiro y el pago por WhatsApp. Confirmá tus datos para continuar.';
    labelDireccion.style.display = 'none';
    inputDireccion.required = false;
    inputDireccion.value = '';
  } else {
    subtitulo.textContent = 'Coordinaremos el delivery del jueves por WhatsApp. Confirmá tus datos para continuar.';
    labelDireccion.style.display = 'block';
    inputDireccion.required = true;
  }

  waMostrarPaso(2);
}

function waIrAPasoConfirmar(event) {
  if (event) event.preventDefault();

  const nombre = document.getElementById('wa-checkout-nombre').value.trim();
  const telefono = document.getElementById('wa-checkout-telefono').value.trim();
  const direccion = document.getElementById('wa-checkout-direccion').value.trim();
  const notas = document.getElementById('wa-checkout-notas').value.trim();

  if (!nombre || nombre.length < 2) { toast('Ingresá tu nombre'); return false; }
  const telSoloNumeros = telefono.replace(/\D/g, '');
  if (telSoloNumeros.length < 8) { toast('Teléfono inválido (mínimo 8 dígitos)'); return false; }
  if (waCheckoutState.modalidad === 'delivery' && !direccion) {
    toast('Ingresá la dirección de entrega');
    return false;
  }

  waCheckoutState.nombre = nombre;
  waCheckoutState.telefono = telefono;
  waCheckoutState.direccion = direccion;
  waCheckoutState.notas = notas;

  if (usuarioActual && telefono && telefono !== usuarioActual.telefono) {
    guardarTelefonoUsuario(telefono);
  }

  waRenderPasoConfirmar();
  waMostrarPaso(3);
  return false;
}

function waRenderPasoConfirmar() {
  const modalidadTxt = waCheckoutState.modalidad === 'retiro'
    ? '🏪 Retiro en Lomas de Zamora'
    : '🛵 Delivery (jueves)';
  document.getElementById('wa-resumen-modalidad').textContent = modalidadTxt;

  const clienteTxt = `${waCheckoutState.nombre} · Tel: ${waCheckoutState.telefono}` +
    (waCheckoutState.direccion ? `\nDirección: ${waCheckoutState.direccion}` : '') +
    (waCheckoutState.notas ? `\nNotas: ${waCheckoutState.notas}` : '');
  document.getElementById('wa-resumen-cliente').textContent = clienteTxt;

  const itemsDiv = document.getElementById('wa-resumen-items');
  itemsDiv.innerHTML = carrito.map(i => `
    <div class="checkout-resumen-item">
      <span>${i.qty}× ${escapeHTML(i.nombre)}</span>
      <span>$${(i.precio * i.qty).toLocaleString('es-AR')}</span>
    </div>
  `).join('');

  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  document.getElementById('wa-resumen-total').textContent = '$' + total.toLocaleString('es-AR');
}

function waConfirmarCheckout() {
  const lineas = carrito
    .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
    .join('\n');
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const modalidadTxt = waCheckoutState.modalidad === 'retiro'
    ? 'RETIRO en Lomas de Zamora 🏪'
    : 'DELIVERY (jueves) 🛵';

  const msg = `Hola! Quiero hacer un pedido en MIRU.

*Modalidad:* ${modalidadTxt}
*Cliente:* ${waCheckoutState.nombre}
*Teléfono:* ${waCheckoutState.telefono}${waCheckoutState.direccion ? `\n*Dirección:* ${waCheckoutState.direccion}` : ''}${waCheckoutState.notas ? `\n*Notas:* ${waCheckoutState.notas}` : ''}

*Pedido:*
${lineas}

*TOTAL: $${total.toLocaleString('es-AR')}*`;

  cerrarModalCheckoutWA();
  window.open(`https://wa.me/${config.wa}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ===========================
//   INICIALIZACIÓN
// ===========================
cargarCarrito();
initFirebase();
initAuth();
manejarRedirectLogin();

// Cargar secciones desde Firestore antes de renderizar
cargarSecciones().then(() => {
  firebaseReady = true;
  window.config = config;
  renderSecciones();
  renderComidaLista();
  actualizarBadge();
  actualizarUIUsuario();
  document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;
  // Si venimos de Mercado Pago (back_urls), procesar el estado del pago
  manejarRetornoMP();

  // Registrar estado base para que el primer "atrás" no salga de la página
  history.replaceState({ tipo: 'inicio' }, '', '');
});

// ===========================
//   VISTA DE PERFIL USUARIO
// ===========================

async function cargarVistaPerfilUsuario() {
  if (!usuarioActual) {
    irAInicio();
    return;
  }

  // Cargar datos del usuario desde Firestore
  try {
    const doc = await db.collection('usuarios').doc(usuarioActual.uid).get();
    const userData = doc.data();
    
    // Mostrar datos personales
    document.getElementById('perfil-nombre').textContent = userData.nombre || usuarioActual.nombre || '';
    document.getElementById('perfil-email').textContent = userData.email || usuarioActual.email || '';
    document.getElementById('perfil-telefono').textContent = userData.telefono || '(no registrado)';
    
    // Mostrar dirección
    if (userData.direccion && userData.direccion.calle) {
      const dir = userData.direccion;
      const direccionTexto = `${dir.calle} ${dir.numero}${dir.piso ? ', ' + dir.piso : ''}, ${dir.ciudad || 'Buenos Aires'}`;
      document.getElementById('perfil-direccion').textContent = direccionTexto;
      document.getElementById('perfil-direccion-estado').textContent = '✓ Guardada';
      document.getElementById('perfil-direccion-estado').className = 'perfil-estado-guardada';
    } else {
      document.getElementById('perfil-direccion').textContent = '(sin dirección)';
      document.getElementById('perfil-direccion-estado').textContent = '(sin guardar)';
      document.getElementById('perfil-direccion-estado').className = 'perfil-estado-vacía';
    }
    
    // Mostrar historial de pedidos
    const pedidos = await cargarHistorialPedidos(usuarioActual.uid);
    renderHistorialPedidos(pedidos);
    
  } catch (e) {
    console.error('Error cargando perfil:', e);
    toast('Error al cargar el perfil');
  }
}

function renderHistorialPedidos(pedidos) {
  const contenedor = document.getElementById('perfil-historial-contenedor');
  
  if (!pedidos || pedidos.length === 0) {
    contenedor.innerHTML = '<div class="historial-vacio">Aún no tienes pedidos registrados</div>';
    return;
  }
  
  contenedor.innerHTML = pedidos.map(pedido => {
    const fecha = pedido.creadoEn ? new Date(pedido.creadoEn.toDate()).toLocaleDateString('es-AR') : 'Fecha desconocida';
    const items = pedido.items || [];
    const itemsTexto = items.map(i => `${i.qty}x ${i.nombre}`).join(', ');
    
    let estadoClase = 'estado-pendiente';
    let estadoTexto = pedido.estado || 'pendiente';
    if (pedido.estado === 'confirmado') estadoClase = 'estado-confirmado';
    if (pedido.estado === 'entregado') estadoClase = 'estado-entregado';
    if (pedido.estado === 'cancelado') estadoClase = 'estado-cancelado';
    
    return `
      <div class="historial-item">
        <div class="historial-header">
          <div class="historial-fecha">${fecha}</div>
          <div class="historial-estado ${estadoClase}">${estadoTexto.toUpperCase()}</div>
        </div>
        <div class="historial-items">${itemsTexto}</div>
        <div class="historial-footer">
          <div class="historial-total">$${(pedido.total || 0).toLocaleString('es-AR')}</div>
          <div class="historial-modalidad">${pedido.modalidad === 'delivery' ? '🚗 Delivery' : '🏪 Retiro'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function abrirEditarDireccion() {
  document.getElementById('perfil-editar-modal').classList.add('visible');
  document.body.style.overflow = 'hidden';
  
  // Pre-cargar datos si existen
  const direccionInput = document.querySelector('[data-field="direccion-calle"]');
  if (direccionInput && usuarioActual) {
    db.collection('usuarios').doc(usuarioActual.uid).get().then(doc => {
      if (doc.exists && doc.data().direccion) {
        const dir = doc.data().direccion;
        document.querySelector('[data-field="direccion-calle"]').value = dir.calle || '';
        document.querySelector('[data-field="direccion-numero"]').value = dir.numero || '';
        document.querySelector('[data-field="direccion-piso"]').value = dir.piso || '';
        document.querySelector('[data-field="direccion-ciudad"]').value = dir.ciudad || 'Buenos Aires';
      }
    });
  }
}

function cerrarEditarDireccion() {
  document.getElementById('perfil-editar-modal').classList.remove('visible');
  document.body.style.overflow = '';
}

async function guardarCambiosDireccion() {
  if (!usuarioActual) return;
  
  const calle = document.querySelector('[data-field="direccion-calle"]').value.trim();
  const numero = document.querySelector('[data-field="direccion-numero"]').value.trim();
  const piso = document.querySelector('[data-field="direccion-piso"]').value.trim();
  const ciudad = document.querySelector('[data-field="direccion-ciudad"]').value.trim();
  
  if (!calle || !numero) {
    toast('Completá calle y número');
    return;
  }
  
  const btn = document.getElementById('btn-guardar-direccion');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  
  const success = await guardarDireccionUsuario(calle, numero, piso, ciudad);
  
  if (success) {
    toast('Dirección guardada ✓');
    cerrarEditarDireccion();
    await cargarVistaPerfilUsuario();
  } else {
    toast('Error al guardar dirección');
  }
  
  btn.disabled = false;
  btn.textContent = 'Guardar dirección';
}

// ===========================
//   PANEL ADMIN — HISTORIAL DE PEDIDOS
// ===========================

async function cargarPanelPedidos() {
  const contenedor = document.getElementById('admin-pedidos-contenedor');
  if (!contenedor) return;
  
  contenedor.innerHTML = '<div class="admin-loading">Cargando pedidos...</div>';
  
  try {
    const pedidos = await cargarTodosPedidos();
    
    if (!pedidos || pedidos.length === 0) {
      contenedor.innerHTML = '<div class="admin-vacio">Sin pedidos aún</div>';
      return;
    }
    
    contenedor.innerHTML = pedidos.map(pedido => {
      const fecha = pedido.creadoEn ? new Date(pedido.creadoEn.toDate()).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Desconocida';
      
      const items = pedido.items || [];
      const itemsTexto = items.map(i => `${i.qty}x ${i.nombre}`).join(', ');
      
      let estadoClase = 'estado-pendiente';
      let estadoTexto = pedido.estado || 'pendiente';
      if (pedido.estado === 'confirmado') estadoClase = 'estado-confirmado';
      if (pedido.estado === 'entregado') estadoClase = 'estado-entregado';
      if (pedido.estado === 'cancelado') estadoClase = 'estado-cancelado';
      
      return `
        <div class="admin-pedido-item">
          <div class="admin-pedido-header">
            <div class="admin-pedido-fecha">${fecha}</div>
            <select class="admin-pedido-estado ${estadoClase}" onchange="cambiarEstadoPedido('${pedido.id}', this.value)">
              <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
              <option value="confirmado" ${pedido.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
              <option value="entregado" ${pedido.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
              <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
          <div class="admin-pedido-cliente">
            <strong>${pedido.nombre || 'Cliente'}</strong> — ${pedido.telefono || 'Sin teléfono'}
            ${pedido.email ? `<br><span class="admin-pedido-email">${pedido.email}</span>` : ''}
          </div>
          <div class="admin-pedido-items">${itemsTexto}</div>
          <div class="admin-pedido-footer">
            <div class="admin-pedido-total">$${(pedido.total || 0).toLocaleString('es-AR')}</div>
            <div class="admin-pedido-modalidad">${pedido.modalidad === 'delivery' ? '🚗 Delivery' : '🏪 Retiro'}</div>
            ${pedido.direccion ? `<div class="admin-pedido-direccion">📍 ${pedido.direccion}</div>` : ''}
          </div>
          ${pedido.notas ? `<div class="admin-pedido-notas"><em>Notas: ${pedido.notas}</em></div>` : ''}
        </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('Error cargando pedidos:', e);
    contenedor.innerHTML = '<div class="admin-error">Error al cargar pedidos</div>';
  }
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
  const success = await actualizarEstadoPedido(pedidoId, nuevoEstado);
  if (success) {
    toast('Estado actualizado');
    // Recargar panel
    cargarPanelPedidos();
  } else {
    toast('Error al actualizar estado');
  }
}

// ===========================
//   HISTORY API — Botón "atrás" del navegador/celular
// ===========================
window.addEventListener('popstate', function(e) {
  const state = e.state;

  // Volver a perfil si estamos en esa vista
  if (state && state.tipo === 'perfil' && usuarioActual) {
    document.getElementById('vista-secciones').style.display = 'none';
    document.getElementById('vista-productos').style.display = 'none';
    document.getElementById('vista-perfil').style.display = 'block';
    return;
  }

  // Cerrar modal de producto si está abierto
  const overlayProducto = document.getElementById('modal-producto-overlay');
  if (overlayProducto && overlayProducto.classList.contains('visible')) {
    cerrarModalProductoSilencioso();
    return;
  }

  // Cerrar modal de comida si está abierto
  const modalComida = document.getElementById('modal-comida');
  if (modalComida && modalComida.classList.contains('visible')) {
    cerrarModalComida();
    return;
  }

  // Cerrar modal de checkout si está abierto
  const modalCheckout = document.getElementById('modal-checkout-overlay');
  if (modalCheckout && modalCheckout.classList.contains('visible')) {
    cerrarModalCheckout();
    return;
  }

  // Cerrar modal de login si está abierto
  const modalLogin = document.getElementById('modal-login');
  if (modalLogin && modalLogin.classList.contains('visible')) {
    cerrarModalLogin();
    return;
  }

  // Manejar categoría de comida
  if (state && state.tipo === 'categoria-comida') {
    irACategoriaComida(state.categoria);
    return;
  }

  // Manejar sección
  if (state && state.tipo === 'seccion') {
    irASeccion(state.seccionId);
    return;
  }

  // Volver a categorías desde vista de platos (Comida Lista)
  if (document.getElementById('comida-vista-platos').style.display === 'block') {
    volverACategoriasComida();
    return;
  }

  // Volver a inicio desde vista de productos (Tienda)
  if (document.getElementById('vista-productos').style.display === 'block') {
    irAInicio();
    return;
  }

  // Volver a inicio desde perfil
  if (document.getElementById('vista-perfil').style.display === 'block') {
    irAInicio();
    return;
  }

  // Si ya estamos en el inicio, re-empujar estado base para no salir de la página
  history.pushState({ tipo: 'inicio' }, '', '');
});
