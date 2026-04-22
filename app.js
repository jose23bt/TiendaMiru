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
const googleProvider = new firebase.auth.GoogleAuthProvider();

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
let config = { nombre: "MIRU", wa: "5491112345678", msg: "Hola! Quiero hacer un pedido en MIRU:" };
let firebaseReady = false;
let usuarioActual = null; // { uid, nombre, telefono, direccion, email }

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

// ===========================
//   USUARIOS — AUTH & PERFIL
// ===========================
function initAuth() {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // Usuario logueado — cargar perfil desde Firestore
      try {
        const fnObtener = firebase.app().functions('southamerica-east1').httpsCallable('obtenerUsuario');
        const result = await fnObtener({ uid: user.uid });
        if (result.data.usuario) {
          usuarioActual = { uid: user.uid, ...result.data.usuario };
        } else {
          // Tiene auth pero no completó perfil
          usuarioActual = {
            uid: user.uid,
            nombre: user.displayName || '',
            email: user.email || '',
            telefono: '',
            direccion: '',
          };
        }
      } catch (e) {
        console.error('Error cargando perfil:', e);
        usuarioActual = {
          uid: user.uid,
          nombre: user.displayName || '',
          email: user.email || '',
          telefono: '',
          direccion: '',
        };
      }
      actualizarUIUsuario();
    } else {
      usuarioActual = null;
      actualizarUIUsuario();
    }
  });
}

function actualizarUIUsuario() {
  const btnUsuario = document.getElementById('btn-usuario-hdr');
  if (!btnUsuario) return;

  if (usuarioActual && usuarioActual.nombre) {
    const iniciales = usuarioActual.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    btnUsuario.innerHTML = `<span class="usuario-avatar">${iniciales}</span>`;
    btnUsuario.title = usuarioActual.nombre;
    btnUsuario.onclick = abrirModalPerfil;
  } else {
    btnUsuario.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    btnUsuario.title = 'Iniciar sesión';
    btnUsuario.onclick = abrirModalLogin;
  }
}

function getClienteData() {
  if (!usuarioActual || !usuarioActual.nombre) return null;
  return {
    uid: usuarioActual.uid || '',
    nombre: usuarioActual.nombre || '',
    telefono: usuarioActual.telefono || '',
    direccion: usuarioActual.direccion || '',
    email: usuarioActual.email || '',
  };
}

// ── Login con Google ──
async function loginConGoogle() {
  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;
    // Verificar si ya tiene perfil
    const fnObtener = firebase.app().functions('southamerica-east1').httpsCallable('obtenerUsuario');
    const perfil = await fnObtener({ uid: user.uid });
    cerrarModalLogin();
    if (!perfil.data.usuario || !perfil.data.usuario.telefono) {
      // Necesita completar datos
      setTimeout(() => abrirModalRegistro(user.displayName || '', user.email || ''), 300);
    } else {
      toast('✓ Bienvenido/a, ' + perfil.data.usuario.nombre);
    }
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      console.error('Error login Google:', e);
      toast('⚠ Error al iniciar sesión');
    }
  }
}

// ── Registro manual ──
async function registroManual() {
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  if (!email || !pass) { toast('⚠ Completá email y contraseña'); return; }
  if (pass.length < 6) { toast('⚠ Mínimo 6 caracteres'); return; }

  const btn = document.getElementById('btn-registro-manual');
  btn.disabled = true;
  btn.textContent = 'CREANDO...';

  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    cerrarModalLogin();
    setTimeout(() => abrirModalRegistro('', email), 300);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      // Intentar login
      try {
        await auth.signInWithEmailAndPassword(email, pass);
        cerrarModalLogin();
        toast('✓ Sesión iniciada');
      } catch (e2) {
        toast('⚠ Email ya registrado. Contraseña incorrecta.');
      }
    } else {
      toast('⚠ Error: ' + (e.message || 'No se pudo crear la cuenta'));
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'CREAR CUENTA / ENTRAR';
  }
}

// ── Guardar perfil ──
async function guardarPerfil() {
  const nombre = document.getElementById('perfil-nombre').value.trim();
  const telefono = document.getElementById('perfil-telefono').value.trim().replace(/\D/g, '');
  const direccion = document.getElementById('perfil-direccion').value.trim();

  if (!nombre) { toast('⚠ Ingresá tu nombre'); return; }
  if (!telefono || telefono.length < 8) { toast('⚠ Ingresá un teléfono válido'); return; }

  const btn = document.getElementById('btn-guardar-perfil');
  btn.disabled = true;
  btn.textContent = 'GUARDANDO...';

  try {
    const user = auth.currentUser;
    const fnRegistrar = firebase.app().functions('southamerica-east1').httpsCallable('registrarUsuario');
    await fnRegistrar({
      uid: user.uid,
      nombre,
      telefono,
      direccion,
      email: user.email || '',
      metodoAuth: user.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
    });

    usuarioActual = { uid: user.uid, nombre, telefono, direccion, email: user.email || '' };
    actualizarUIUsuario();
    cerrarModalRegistro();
    toast('✓ Perfil guardado');
  } catch (e) {
    console.error('Error guardando perfil:', e);
    toast('⚠ Error al guardar');
  } finally {
    btn.disabled = false;
    btn.textContent = 'GUARDAR';
  }
}

function cerrarSesionUsuario() {
  auth.signOut();
  usuarioActual = null;
  actualizarUIUsuario();
  cerrarModalPerfil();
  toast('Sesión cerrada');
}

// ── Modales ──
function abrirModalLogin() {
  document.getElementById('modal-login-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function cerrarModalLogin() {
  document.getElementById('modal-login-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}
function abrirModalRegistro(nombre, email) {
  document.getElementById('perfil-nombre').value = nombre || '';
  document.getElementById('perfil-telefono').value = '';
  document.getElementById('perfil-direccion').value = '';
  document.getElementById('modal-registro-titulo').textContent = 'COMPLETÁ TUS DATOS';
  document.getElementById('modal-registro-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function cerrarModalRegistro() {
  document.getElementById('modal-registro-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}
function abrirModalPerfil() {
  if (!usuarioActual) return;
  document.getElementById('perfil-nombre').value = usuarioActual.nombre || '';
  document.getElementById('perfil-telefono').value = usuarioActual.telefono || '';
  document.getElementById('perfil-direccion').value = usuarioActual.direccion || '';
  document.getElementById('modal-registro-titulo').textContent = 'MI PERFIL';
  document.getElementById('modal-registro-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function cerrarModalPerfil() {
  document.getElementById('modal-registro-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}
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
  actualizarBadge();
  renderCarrito();
}

function eliminarItem(id) {
  carrito = carrito.filter(x => x.id !== id);
  actualizarBadge();
  renderCarrito();
}

async function pedirPorWhatsApp() {
  if (!carrito.length) return;

  const items = carrito.map(i => ({ id: i.id, quantity: i.qty }));
  const lineas = carrito
    .map(i => `• ${i.qty}x ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-AR')}`)
    .join('\n');
  const total = carrito.reduce((s, i) => s + i.precio * i.qty, 0);

  const clienteData = getClienteData();

  // Armar info del cliente para el mensaje de WA
  let infoCliente = '';
  if (clienteData && clienteData.nombre) {
    infoCliente = `\n\n👤 *${clienteData.nombre}*`;
    if (clienteData.telefono) infoCliente += `\n📱 ${clienteData.telefono}`;
    if (clienteData.direccion) infoCliente += `\n📍 ${clienteData.direccion}`;
  }

  // Guardar pedido en servidor
  try {
    const guardarPedido = firebase.app().functions('southamerica-east1').httpsCallable('guardarPedido');
    const result = await guardarPedido({ items, metodo: 'whatsapp', cliente: clienteData });
    const pedidoId = result.data.pedidoId;

    const msg = `${config.msg}\n\n${lineas}\n\n*TOTAL: $${total.toLocaleString('es-AR')}*${infoCliente}\n\n📋 Pedido #${pedidoId.slice(-6).toUpperCase()}`;
    window.open(`https://wa.me/${config.wa}?text=${encodeURIComponent(msg)}`, '_blank');

    // Limpiar carrito
    carrito = [];
    actualizarBadge();
    cerrarCarrito();
    toast('✓ Pedido registrado');
  } catch (err) {
    console.error('Error guardando pedido:', err);
    // Fallback: abrir WA sin guardar
    const msg = `${config.msg}\n\n${lineas}\n\n*TOTAL: $${total.toLocaleString('es-AR')}*${infoCliente}`;
    window.open(`https://wa.me/${config.wa}?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

function cerrarTodo() {
  cerrarCarrito();
  cerrarModalProductoSilencioso();
  cerrarModalAgregado();
}

// ===========================
//   MERCADO PAGO — CHECKOUT PRO (via Cloud Function)
// ===========================

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

  try {
    const crearPreferencia = firebase.app().functions('southamerica-east1').httpsCallable('crearPreferencia');
    const result = await crearPreferencia({ items, cliente: getClienteData() });
    const data = result.data;

    if (!data.init_point) {
      throw new Error('Sin link de pago');
    }

    // Guardar el pedidoId para referencia post-pago
    sessionStorage.setItem('miru_ultimo_pedido', data.pedidoId);

    // Limpiar carrito antes de redirigir
    carrito = [];
    actualizarBadge();
    cerrarCarrito();

    // Redirigir al checkout de MP
    window.location.href = data.init_point;

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
initAuth();
firebaseReady = true;
renderSecciones();
document.getElementById('footer-wa').textContent = 'WA: +' + config.wa;

// ===========================
//   MANEJO RETORNO MERCADO PAGO
// ===========================
(function manejarRetornoMP() {
  const params = new URLSearchParams(window.location.search);
  const pago = params.get('pago');
  const pedidoId = params.get('pedido');
  const paymentId = params.get('payment_id');

  if (!pago) return;

  // Limpiar URL sin recargar
  window.history.replaceState({}, '', window.location.pathname);

  // Mostrar modal de resultado
  const modal = document.getElementById('modal-pago-resultado');
  if (!modal) return;

  const icono = document.getElementById('pago-res-icono');
  const titulo = document.getElementById('pago-res-titulo');
  const mensaje = document.getElementById('pago-res-mensaje');
  const codigo = document.getElementById('pago-res-codigo');

  if (pago === 'exitoso') {
    icono.textContent = '✓';
    icono.style.color = '#27ae60';
    titulo.textContent = '¡PAGO EXITOSO!';
    mensaje.textContent = 'Tu pedido fue registrado. Te vamos a contactar por WhatsApp para coordinar la entrega.';
    if (pedidoId) {
      codigo.textContent = 'Pedido #' + pedidoId.slice(-6).toUpperCase();
      codigo.style.display = 'block';
    }
    // Limpiar carrito por si quedó algo
    carrito = [];
    actualizarBadge();
  } else if (pago === 'pendiente') {
    icono.textContent = '⏳';
    icono.style.color = '#f39c12';
    titulo.textContent = 'PAGO PENDIENTE';
    mensaje.textContent = 'Tu pago está siendo procesado. Te avisamos cuando se confirme.';
    if (pedidoId) {
      codigo.textContent = 'Pedido #' + pedidoId.slice(-6).toUpperCase();
      codigo.style.display = 'block';
    }
  } else {
    icono.textContent = '✕';
    icono.style.color = '#c0392b';
    titulo.textContent = 'PAGO NO COMPLETADO';
    mensaje.textContent = 'El pago no se pudo procesar. Podés intentar de nuevo o coordinar por WhatsApp.';
    codigo.style.display = 'none';
  }

  modal.classList.add('visible');
})();

function cerrarModalPagoResultado() {
  document.getElementById('modal-pago-resultado').classList.remove('visible');
}
