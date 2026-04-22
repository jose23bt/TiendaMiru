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

// ===== ESTADO GLOBAL =====
let productos = [];
let carrito = [];
let config = { nombre: "MIRU", wa: "5491159076070", msg: "Hola! Quiero hacer un pedido en MIRU:" };
let firebaseReady = false;
let productosCargados = false; // true cuando llega el primer snapshot de Firebase

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
          const cats = seccion.categorias || [seccion.categoria];
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
        waLink.href = 'https://wa.me/' + config.wa + '?text=' + encodeURIComponent('Hola! Quiero ver el menú de platos ya cocinados');
      }
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

  // Fotos: la propia del producto + extras de su categoría
  const extras = FOTOS_EXTRA[p.categoria] || [];
  const fotoProducto = sanitizeURL(p.imagen);
  const fotos = fotoProducto ? [fotoProducto, ...extras] : extras;

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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ultimoLogin: firebase.firestore.FieldValue.serverTimestamp(),
        cantidadPedidos: 0
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

async function loginConGoogle(desdeCheckout) {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const errorEl = document.getElementById('modal-login-error');
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  try {
    // En móviles usamos redirect (más estable que popup en iOS Safari)
    const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (esMovil) {
      // Guardamos el contexto para volver al checkout si corresponde
      if (desdeCheckout) {
        sessionStorage.setItem('miru_login_desde_checkout', '1');
      }
      await auth.signInWithRedirect(provider);
      // El flujo continúa al volver (se maneja en initAuth via onAuthStateChanged)
    } else {
      await auth.signInWithPopup(provider);
      // Si veníamos del checkout, refrescar paso 2
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

function abrirModalUsuario() {
  if (!usuarioActual) return;
  const avatar = document.getElementById('modal-usuario-avatar');
  if (usuarioActual.photoURL) {
    avatar.style.backgroundImage = `url('${usuarioActual.photoURL}')`;
    avatar.textContent = '';
  } else {
    avatar.style.backgroundImage = '';
    avatar.textContent = (usuarioActual.nombre || 'U')[0].toUpperCase();
  }
  document.getElementById('modal-usuario-nombre').textContent = usuarioActual.nombre || '';
  document.getElementById('modal-usuario-email').textContent = usuarioActual.email || '';
  document.getElementById('modal-usuario').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function cerrarModalUsuario() {
  document.getElementById('modal-usuario').classList.remove('visible');
  document.body.style.overflow = '';
}

// ===========================
//   CHECKOUT (3 pasos)
// ===========================

function abrirCheckout() {
  if (!carrito.length) return;
  checkoutState = {
    modalidad: null,
    nombre: usuarioActual?.nombre || '',
    telefono: usuarioActual?.telefono || '',
    email: usuarioActual?.email || '',
    notas: '',
    pasoActual: 1
  };
  mostrarPasoCheckout(1);
  aplicarDatosUsuarioEnCheckout();
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
  if (btnTexto && checkoutState.modalidad === 'retiro') {
    btnTexto.textContent = 'Pagar con Mercado Pago';
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
  // Actualizar textos del paso 2 según modalidad
  const hint = document.getElementById('checkout-email-hint');
  const subtitulo = document.getElementById('checkout-subtitulo-datos');
  const labelEmail = document.getElementById('checkout-label-email');
  const emailInput = document.getElementById('checkout-email');

  if (modalidad === 'retiro') {
    hint.textContent = '(requerido para Mercado Pago)';
    subtitulo.textContent = 'Vas a pagar con Mercado Pago. Confirmá tus datos para continuar.';
    emailInput.required = true;
  } else {
    hint.textContent = '(opcional)';
    subtitulo.textContent = 'Coordinaremos el delivery del jueves por WhatsApp. Confirmá tus datos para continuar.';
    emailInput.required = false;
  }

  mostrarPasoCheckout(2);
}

function aplicarDatosUsuarioEnCheckout() {
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
      avatar.textContent = (usuarioActual.nombre || 'U')[0].toUpperCase();
    }
    document.getElementById('checkout-usuario-nombre-display').textContent = usuarioActual.nombre || '';
    document.getElementById('checkout-usuario-email-display').textContent = usuarioActual.email || '';

    document.getElementById('checkout-nombre').value = usuarioActual.nombre || '';
    document.getElementById('checkout-email').value = usuarioActual.email || '';
    document.getElementById('checkout-telefono').value = usuarioActual.telefono || '';
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
  const notas = document.getElementById('checkout-notas').value.trim();

  if (!nombre || nombre.length < 2) {
    toast('Ingresá tu nombre');
    return false;
  }
  // Validación básica de teléfono: mínimo 8 dígitos
  const telSoloNumeros = telefono.replace(/\D/g, '');
  if (telSoloNumeros.length < 8) {
    toast('Teléfono inválido (mínimo 8 dígitos)');
    return false;
  }
  if (checkoutState.modalidad === 'retiro') {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast('Email inválido (requerido para Mercado Pago)');
      return false;
    }
  }

  checkoutState.nombre = nombre;
  checkoutState.telefono = telefono;
  checkoutState.email = email;
  checkoutState.notas = notas;

  // Si está logueado, actualizar teléfono en su perfil (si cambió)
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
    : '🛵 Delivery (jueves) — a coordinar por WhatsApp';
  document.getElementById('resumen-modalidad').textContent = modalidadTxt;

  const clienteTxt = `${checkoutState.nombre} · Tel: ${checkoutState.telefono}` +
    (checkoutState.email ? ` · ${checkoutState.email}` : '') +
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

  // Botón final según modalidad
  const btnTexto = document.getElementById('checkout-confirmar-texto');
  const btn = document.getElementById('btn-checkout-confirmar');
  if (checkoutState.modalidad === 'retiro') {
    btnTexto.textContent = 'Pagar con Mercado Pago';
    btn.classList.remove('btn-confirmar-wa');
    btn.classList.add('btn-confirmar-mp');
  } else {
    btnTexto.textContent = 'Continuar por WhatsApp';
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

function iniciarDeliveryWhatsApp() {
  const lineas = carrito
    .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
    .join('\n');
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);

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
//   INICIALIZACIÓN
// ===========================
cargarCarrito();
initFirebase();
initAuth();
manejarRedirectLogin();
firebaseReady = true;
window.config = config;
renderSecciones();
actualizarBadge();
actualizarUIUsuario();
document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;

// Si venimos de Mercado Pago (back_urls), procesar el estado del pago
manejarRetornoMP();
