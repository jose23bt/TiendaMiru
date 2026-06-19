const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

admin.initializeApp();

const db = admin.firestore();

// Secret seguro — se configura con: firebase functions:secrets:set MP_ACCESS_TOKEN
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");

// URL fija — nunca aceptar del cliente
const BASE_URL = "https://tiendamiru.com";

// ─── CONSTANTES DE SEGURIDAD ───
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

// ─── UTILIDADES ───

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Rate limiting por IP para login
async function checkRateLimit(ip) {
  const ref = db.collection("config").doc("loginAttempts");
  const doc = await ref.get();

  if (!doc.exists) return;

  const data = doc.data();
  const entry = data[ip];

  if (!entry) return;

  const { count, lastAttempt, lockedUntil } = entry;

  // Si está bloqueado y el bloqueo no expiró
  if (lockedUntil && Date.now() < lockedUntil) {
    const minutosRestantes = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new HttpsError(
      "resource-exhausted",
      `Demasiados intentos. Intentá de nuevo en ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}`
    );
  }

  // Si el bloqueo expiró, se resetea en recordFailedAttempt
}

async function recordFailedAttempt(ip) {
  const ref = db.collection("config").doc("loginAttempts");
  const doc = await ref.get();

  let data = doc.exists ? doc.data() : {};
  let entry = data[ip] || { count: 0, lastAttempt: 0, lockedUntil: 0 };

  // Si el bloqueo expiró o pasaron más de 15 min del último intento, resetear
  if (
    (entry.lockedUntil && Date.now() >= entry.lockedUntil) ||
    (Date.now() - entry.lastAttempt > LOCKOUT_MINUTES * 60 * 1000)
  ) {
    entry = { count: 0, lastAttempt: 0, lockedUntil: 0 };
  }

  entry.count += 1;
  entry.lastAttempt = Date.now();

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
  }

  data[ip] = entry;
  await ref.set(data);
}

async function resetAttempts(ip) {
  const ref = db.collection("config").doc("loginAttempts");
  const doc = await ref.get();
  if (!doc.exists) return;

  const data = doc.data();
  if (data[ip]) {
    delete data[ip];
    await ref.set(data);
  }
}

async function verificarAdmin(password) {
  if (!password || typeof password !== "string") {
    throw new HttpsError("unauthenticated", "Contraseña requerida");
  }

  const doc = await db.collection("config").doc("seguridad").get();

  if (!doc.exists) {
    // Primera vez: NO usar contraseña por defecto.
    // Se fuerza al admin a configurar su propia contraseña en el primer acceso.
    const hashed = await hashPassword(password);
    await db.collection("config").doc("seguridad").set({
      password: hashed,
      primerAcceso: true,
    });
    return true;
  }

  const stored = doc.data().password;

  // Compatibilidad: detectar si es SHA-256 legacy (64 hex chars) o texto plano
  const isBcrypt = /^\$2[aby]?\$/.test(stored);

  if (isBcrypt) {
    // Hash moderno (bcrypt)
    const match = await comparePassword(password, stored);
    if (!match) {
      throw new HttpsError("unauthenticated", "Contraseña incorrecta");
    }
  } else {
    // Legacy: SHA-256 o texto plano — verificar y migrar a bcrypt
    const isOldHash = /^[a-f0-9]{64}$/.test(stored);

    if (isOldHash) {
      const oldHash = crypto.createHash("sha256").update(password).digest("hex");
      if (oldHash !== stored) {
        throw new HttpsError("unauthenticated", "Contraseña incorrecta");
      }
    } else {
      // Texto plano
      if (password !== stored) {
        throw new HttpsError("unauthenticated", "Contraseña incorrecta");
      }
    }

    // Migrar a bcrypt automáticamente
    const newHash = await hashPassword(password);
    await db.collection("config").doc("seguridad").set({ password: newHash });
  }

  return true;
}

async function verificarToken(token) {
  if (!token || typeof token !== "string") {
    throw new HttpsError("unauthenticated", "Token requerido");
  }

  const doc = await db.collection("config").doc("sesiones").get();
  if (!doc.exists) {
    throw new HttpsError("unauthenticated", "Sesión inválida");
  }

  const sesiones = doc.data();
  const expira = sesiones[token];

  if (!expira || Date.now() > expira) {
    throw new HttpsError("unauthenticated", "Sesión expirada");
  }

  return true;
}

// Limpia sesiones expiradas para que no se acumulen
async function limpiarSesionesExpiradas() {
  const doc = await db.collection("config").doc("sesiones").get();
  if (!doc.exists) return;

  const sesiones = doc.data();
  const ahora = Date.now();
  const activas = {};
  let hayExpiradas = false;

  for (const [token, expira] of Object.entries(sesiones)) {
    if (expira > ahora) {
      activas[token] = expira;
    } else {
      hayExpiradas = true;
    }
  }

  if (hayExpiradas) {
    await db.collection("config").doc("sesiones").set(activas);
  }
}

function sanitize(str, maxLen = 500) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLen);
}

const REGION = "southamerica-east1";

// ═══════════════════════════════════════
//  MERCADO PAGO — CHECKOUT PRO
// ═══════════════════════════════════════

exports.crearPreferencia = onCall(
  { region: REGION, secrets: [mpAccessToken] },
  async (request) => {
    const items = request.data.items;
    const cliente = request.data.cliente || null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Se requiere un array de items");
    }

    if (items.length > 50) {
      throw new HttpsError("invalid-argument", "Máximo 50 items por pedido");
    }

    for (const item of items) {
      if (!item.id || !item.quantity) {
        throw new HttpsError("invalid-argument", "Cada item necesita id y quantity");
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
        throw new HttpsError("invalid-argument", "Cantidad debe ser un entero entre 1 y 100");
      }
    }

    const productIds = items.map((i) => i.id);
    const productDocs = await Promise.all(
      productIds.map((id) => db.collection("productos").doc(id).get())
    );

    const itemsConPrecioReal = [];

    for (let i = 0; i < items.length; i++) {
      const doc = productDocs[i];

      if (!doc.exists) {
        throw new HttpsError("not-found", `Producto ${items[i].id} no encontrado`);
      }

      const producto = doc.data();

      if (producto.agotado === true) {
        throw new HttpsError("failed-precondition", `${producto.nombre} está agotado`);
      }

      if (!producto.precio || producto.precio <= 0) {
        throw new HttpsError("internal", `Precio inválido para ${producto.nombre}`);
      }

      itemsConPrecioReal.push({
        title: producto.nombre,
        description: producto.desc || producto.nombre,
        quantity: Number(items[i].quantity),
        currency_id: "ARS",
        unit_price: Number(producto.precio),
      });
    }

    const accessToken = mpAccessToken.value();
    if (!accessToken) {
      throw new HttpsError("failed-precondition", "Access Token de MP no configurado");
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    try {
      // Crear pedido en Firestore ANTES de la preferencia
      const pedidoRef = db.collection("pedidos").doc();
      const pedidoId = pedidoRef.id;

      const pedidoData = {
        items: itemsConPrecioReal.map((item, i) => ({
          id: items[i].id,
          nombre: item.title,
          cantidad: item.quantity,
          precioUnitario: item.unit_price,
          subtotal: item.quantity * item.unit_price,
        })),
        total: itemsConPrecioReal.reduce((s, item) => s + item.quantity * item.unit_price, 0),
        estado: "pendiente",
        metodo: "mercadopago",
        entrega: "sin_definir",
        notaCliente: "",
        notaAdmin: "",
        cliente: cliente ? {
          nombre: sanitize(cliente.nombre || "", 100),
          telefono: sanitize(cliente.telefono || "", 20),
          direccion: sanitize(cliente.direccion || "", 300),
          email: sanitize(cliente.email || "", 100),
          uid: sanitize(cliente.uid || "", 50),
        } : null,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        mpPreferenceId: null,
        mpPaymentId: null,
        mpStatus: null,
      };

      const result = await preference.create({
        body: {
          items: itemsConPrecioReal,
          back_urls: {
            success: `${BASE_URL}?pago=exitoso&pedido=${pedidoId}`,
            failure: `${BASE_URL}?pago=fallido&pedido=${pedidoId}`,
            pending: `${BASE_URL}?pago=pendiente&pedido=${pedidoId}`,
          },
          auto_return: "approved",
          statement_descriptor: "MIRU PASTAS",
          external_reference: pedidoId,
          notification_url: `https://southamerica-east1-tiendamiru-6bdc9.cloudfunctions.net/mpWebhook`,
        },
      });

      // Guardar pedido con el ID de la preferencia
      pedidoData.mpPreferenceId = result.id;
      await pedidoRef.set(pedidoData);

      return {
        id: result.id,
        init_point: result.init_point,
        pedidoId,
      };
    } catch (error) {
      console.error("Error creando preferencia MP:", error);
      throw new HttpsError("internal", "Error al crear la preferencia de pago");
    }
  }
);

// ═══════════════════════════════════════
//  ADMIN — LOGIN (con rate limiting)
// ═══════════════════════════════════════

exports.adminLogin = onCall({ region: REGION }, async (request) => {
  // Obtener IP del request para rate limiting
  const ip = request.rawRequest?.ip || request.rawRequest?.headers?.["x-forwarded-for"] || "unknown";

  // Verificar rate limit antes de intentar login
  await checkRateLimit(ip);

  const { password } = request.data;

  try {
    await verificarAdmin(password);
  } catch (error) {
    // Registrar intento fallido
    if (error.code === "unauthenticated") {
      await recordFailedAttempt(ip);
    }
    throw error;
  }

  // Login exitoso: resetear intentos
  await resetAttempts(ip);

  // Limpiar sesiones expiradas en cada login exitoso
  await limpiarSesionesExpiradas();

  const token = crypto.randomBytes(32).toString("hex");
  const expira = Date.now() + SESSION_DURATION_MS;

  await db.collection("config").doc("sesiones").set(
    { [token]: expira },
    { merge: true }
  );

  return { token, expira };
});

// ═══════════════════════════════════════
//  ADMIN — AGREGAR PRODUCTO
// ═══════════════════════════════════════

exports.adminAgregarProducto = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { nombre, categoria, desc, precio, emoji, imagen, fotos } = request.data;

  const nombreSan = sanitize(nombre, 100);
  const catSan = sanitize(categoria, 50);
  const descSan = sanitize(desc, 300);
  const emojiSan = sanitize(emoji, 10) || "🍽️";
  const imagenSan = sanitize(imagen, 500);
  const precioNum = Number(precio);

  // Sanitizar array de fotos adicionales (máx 3, máx 500 chars cada una)
  const fotosSan = Array.isArray(fotos)
    ? fotos.slice(0, 3).map(f => sanitize(f, 500)).filter(Boolean)
    : [];

  if (!nombreSan || !catSan || !precioNum || precioNum <= 0) {
    throw new HttpsError("invalid-argument", "Nombre, categoría y precio válido son requeridos");
  }

  const ref = await db.collection("productos").add({
    nombre: nombreSan,
    categoria: catSan,
    desc: descSan,
    precio: precioNum,
    emoji: emojiSan,
    imagen: imagenSan,
    fotos: fotosSan,
    agotado: false,
  });

  return { id: ref.id };
});

// ═══════════════════════════════════════
//  ADMIN — ELIMINAR PRODUCTO
// ═══════════════════════════════════════

exports.adminEliminarProducto = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { productoId } = request.data;
  if (!productoId) {
    throw new HttpsError("invalid-argument", "ID de producto requerido");
  }

  const doc = await db.collection("productos").doc(productoId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Producto no encontrado");
  }

  await db.collection("productos").doc(productoId).delete();
  return { eliminado: true };
});

// ═══════════════════════════════════════
//  ADMIN — ELIMINAR IMAGEN DE STORAGE
// ═══════════════════════════════════════

exports.adminEliminarImagen = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { url } = request.data;
  if (!url || typeof url !== "string") {
    throw new HttpsError("invalid-argument", "URL requerida");
  }

  const bucket = admin.storage().bucket();
  const prefijo = `https://storage.googleapis.com/${bucket.name}/`;

  // Si la URL no es de nuestro Storage (ej. una de Unsplash), no hay nada que borrar.
  if (!url.startsWith(prefijo)) {
    return { eliminado: false, motivo: "externa" };
  }

  const ruta = decodeURIComponent(url.slice(prefijo.length).split("?")[0]);

  // Acotar: solo se puede borrar dentro de imagenes/ (no videos ni otras rutas).
  if (!ruta.startsWith("imagenes/")) {
    throw new HttpsError("invalid-argument", "Ruta no permitida");
  }

  try {
    await bucket.file(ruta).delete({ ignoreNotFound: true });
  } catch (err) {
    console.error("Error borrando imagen:", err);
    throw new HttpsError("internal", "No se pudo borrar la imagen");
  }

  return { eliminado: true };
});

// ═══════════════════════════════════════
//  ADMIN — TOGGLE AGOTADO
// ═══════════════════════════════════════

exports.adminToggleAgotado = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { productoId, agotado } = request.data;
  if (!productoId || typeof agotado !== "boolean") {
    throw new HttpsError("invalid-argument", "ID y estado agotado requeridos");
  }

  const doc = await db.collection("productos").doc(productoId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Producto no encontrado");
  }

  await db.collection("productos").doc(productoId).update({ agotado });
  return { agotado };
});

// ═══════════════════════════════════════
//  ADMIN — GUARDAR CONFIG TIENDA
// ═══════════════════════════════════════

exports.adminGuardarConfig = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { nombre, wa, msg } = request.data;

  const config = {
    nombre: sanitize(nombre, 100) || "MIRU",
    wa: sanitize(wa, 20),
    msg: sanitize(msg, 300),
  };

  if (!/^\d{10,15}$/.test(config.wa)) {
    throw new HttpsError("invalid-argument", "Número de WhatsApp inválido (solo dígitos, 10-15)");
  }

  await db.collection("config").doc("tienda").set(config);
  return { guardado: true };
});

// ═══════════════════════════════════════
//  ADMIN — CAMBIAR CONTRASEÑA
//  (invalida TODAS las sesiones activas)
// ═══════════════════════════════════════

exports.adminCambiarPassword = onCall({ region: REGION }, async (request) => {
  const { token, actual, nueva } = request.data;
  await verificarToken(token);
  await verificarAdmin(actual);

  const nuevaSan = sanitize(nueva, 100);
  if (nuevaSan.length < 6) {
    throw new HttpsError("invalid-argument", "Mínimo 6 caracteres");
  }

  const newHash = await hashPassword(nuevaSan);

  // Actualizar contraseña
  await db.collection("config").doc("seguridad").set({
    password: newHash,
  });

  // Invalidar TODAS las sesiones activas (forzar re-login)
  await db.collection("config").doc("sesiones").set({});

  return { cambiada: true };
});

// ═══════════════════════════════════════
//  MERCADO PAGO — WEBHOOK (IPN)
// ═══════════════════════════════════════

exports.mpWebhook = onRequest(
  { region: REGION, secrets: [mpAccessToken] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const { type, data } = req.body;

      if (type === "payment" && data?.id) {
        const accessToken = mpAccessToken.value();
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);
        const pago = await payment.get({ id: data.id });

        const pedidoId = pago.external_reference;
        if (!pedidoId) {
          res.status(200).send("OK - sin referencia");
          return;
        }

        const pedidoRef = db.collection("pedidos").doc(pedidoId);
        const pedidoDoc = await pedidoRef.get();

        if (!pedidoDoc.exists) {
          res.status(200).send("OK - pedido no encontrado");
          return;
        }

        const estadoMP = pago.status; // approved, pending, rejected, etc.
        let estadoPedido = "pendiente";

        if (estadoMP === "approved") {
          estadoPedido = "pagado";
        } else if (estadoMP === "rejected" || estadoMP === "cancelled") {
          estadoPedido = "cancelado";
        } else if (estadoMP === "in_process" || estadoMP === "pending") {
          estadoPedido = "pendiente";
        }

        await pedidoRef.update({
          estado: estadoPedido,
          mpPaymentId: String(data.id),
          mpStatus: estadoMP,
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("Error en webhook MP:", error);
      res.status(200).send("OK");
    }
  }
);

// ═══════════════════════════════════════
//  ADMIN — LISTAR PEDIDOS
// ═══════════════════════════════════════

exports.adminListarPedidos = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { filtroEstado, limite } = request.data;
  let query = db.collection("pedidos");

  if (filtroEstado && filtroEstado !== "todos") {
    query = query.where("estado", "==", filtroEstado);
  }

  query = query.orderBy("creadoEn", "desc");

  const lim = Math.min(Number(limite) || 50, 200);
  query = query.limit(lim);

  const snapshot = await query.get();
  const pedidos = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      creadoEn: data.creadoEn?.toDate?.()?.toISOString() || null,
      actualizadoEn: data.actualizadoEn?.toDate?.()?.toISOString() || null,
    };
  });

  return { pedidos };
});

// ═══════════════════════════════════════
//  ADMIN — ACTUALIZAR ESTADO PEDIDO
// ═══════════════════════════════════════

exports.adminActualizarPedido = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { pedidoId, estado, entrega, notaAdmin } = request.data;

  if (!pedidoId) {
    throw new HttpsError("invalid-argument", "ID de pedido requerido");
  }

  const pedidoRef = db.collection("pedidos").doc(pedidoId);
  const pedidoDoc = await pedidoRef.get();

  if (!pedidoDoc.exists) {
    throw new HttpsError("not-found", "Pedido no encontrado");
  }

  const updates = {
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  };

  const estadosValidos = ["pendiente", "pagado", "preparando", "listo", "entregado", "cancelado"];
  if (estado && estadosValidos.includes(estado)) {
    updates.estado = estado;
  }

  const entregasValidas = ["sin_definir", "delivery_jueves", "retira_local"];
  if (entrega && entregasValidas.includes(entrega)) {
    updates.entrega = entrega;
  }

  if (typeof notaAdmin === "string") {
    updates.notaAdmin = sanitize(notaAdmin, 500);
  }

  await pedidoRef.update(updates);
  return { actualizado: true };
});

// ═══════════════════════════════════════
//  GUARDAR PEDIDO POR WHATSAPP
//  (para registrar pedidos que no pasan por MP)
// ═══════════════════════════════════════

exports.guardarPedido = onCall({ region: REGION }, async (request) => {
  const { items, metodo, notaCliente, cliente } = request.data;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Se requiere un array de items");
  }

  if (items.length > 50) {
    throw new HttpsError("invalid-argument", "Máximo 50 items por pedido");
  }

  // Validar items contra DB
  const productIds = items.map((i) => i.id);
  const productDocs = await Promise.all(
    productIds.map((id) => db.collection("productos").doc(id).get())
  );

  const itemsValidados = [];
  let total = 0;

  for (let i = 0; i < items.length; i++) {
    const doc = productDocs[i];
    if (!doc.exists) {
      throw new HttpsError("not-found", `Producto ${items[i].id} no encontrado`);
    }
    const producto = doc.data();
    const qty = Number(items[i].quantity);
    const subtotal = producto.precio * qty;
    itemsValidados.push({
      id: items[i].id,
      nombre: producto.nombre,
      cantidad: qty,
      precioUnitario: producto.precio,
      subtotal,
    });
    total += subtotal;
  }

  // Datos del cliente (si está registrado)
  const clienteData = cliente ? {
    nombre: sanitize(cliente.nombre || "", 100),
    telefono: sanitize(cliente.telefono || "", 20),
    direccion: sanitize(cliente.direccion || "", 300),
    email: sanitize(cliente.email || "", 100),
    uid: sanitize(cliente.uid || "", 50),
  } : null;

  const pedidoRef = await db.collection("pedidos").add({
    items: itemsValidados,
    total,
    estado: "pendiente",
    metodo: sanitize(metodo || "whatsapp", 20),
    entrega: "sin_definir",
    notaCliente: sanitize(notaCliente || "", 500),
    notaAdmin: "",
    cliente: clienteData,
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    mpPreferenceId: null,
    mpPaymentId: null,
    mpStatus: null,
  });

  return { pedidoId: pedidoRef.id };
});

// ═══════════════════════════════════════
//  USUARIOS — REGISTRO / ACTUALIZACIÓN
// ═══════════════════════════════════════

exports.registrarUsuario = onCall({ region: REGION }, async (request) => {
  const { uid, nombre, telefono, direccion, email, metodoAuth } = request.data;

  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "UID requerido");
  }

  const nombreSan = sanitize(nombre, 100);
  const telSan = sanitize(telefono, 20);
  const dirSan = sanitize(direccion, 300);
  const emailSan = sanitize(email, 100);

  if (!nombreSan) {
    throw new HttpsError("invalid-argument", "Nombre requerido");
  }
  if (!telSan || !/^\d{8,15}$/.test(telSan.replace(/\D/g, ""))) {
    throw new HttpsError("invalid-argument", "Teléfono inválido");
  }

  const userData = {
    nombre: nombreSan,
    telefono: telSan,
    direccion: dirSan,
    email: emailSan,
    metodoAuth: sanitize(metodoAuth || "manual", 20),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  };

  const userRef = db.collection("usuarios").doc(uid);
  const existing = await userRef.get();

  if (!existing.exists) {
    userData.creadoEn = admin.firestore.FieldValue.serverTimestamp();
  }

  await userRef.set(userData, { merge: true });
  return { guardado: true };
});

exports.obtenerUsuario = onCall({ region: REGION }, async (request) => {
  const { uid } = request.data;

  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "UID requerido");
  }

  const doc = await db.collection("usuarios").doc(uid).get();

  if (!doc.exists) {
    return { usuario: null };
  }

  return { usuario: doc.data() };
});

// ═══════════════════════════════════════
//  ADMIN — LISTAR USUARIOS
// ═══════════════════════════════════════

exports.adminListarUsuarios = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const snapshot = await db.collection("usuarios")
    .orderBy("creadoEn", "desc")
    .limit(200)
    .get();

  const usuarios = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      creadoEn: data.creadoEn?.toDate?.()?.toISOString() || null,
      actualizadoEn: data.actualizadoEn?.toDate?.()?.toISOString() || null,
    };
  });

  return { usuarios };
});

// ═══════════════════════════════════════
//  ADMIN — COMIDA LISTA: AGREGAR
// ═══════════════════════════════════════

exports.adminAgregarComida = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { nombre, categoria, desc, precio, imagen, orden } = request.data;

  const nombreSan = sanitize(nombre, 100);
  const descSan = sanitize(desc, 400);
  const imagenSan = sanitize(imagen, 500);
  const catSan = sanitize(categoria, 20);
  const precioNum = Number(precio) || 0;
  const ordenNum = Number.isFinite(Number(orden)) ? Number(orden) : 999;

  if (!nombreSan) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }
  if (catSan !== "pizzas" && catSan !== "pastas") {
    throw new HttpsError("invalid-argument", "Categoría inválida (debe ser 'pizzas' o 'pastas')");
  }
  if (precioNum < 0 || precioNum > 10000000) {
    throw new HttpsError("invalid-argument", "Precio inválido");
  }

  const ref = await db.collection("comidaLista").add({
    nombre: nombreSan,
    categoria: catSan,
    desc: descSan,
    precio: precioNum,
    imagen: imagenSan,
    orden: ordenNum,
    disponible: true,
    esVideo: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: ref.id };
});

// ═══════════════════════════════════════
//  ADMIN — COMIDA LISTA: EDITAR
// ═══════════════════════════════════════

exports.adminEditarComida = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { platoId, nombre, categoria, desc, precio, imagen, orden } = request.data;

  if (!platoId) {
    throw new HttpsError("invalid-argument", "ID del plato requerido");
  }

  const docRef = db.collection("comidaLista").doc(platoId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Plato no encontrado");
  }

  const nombreSan = sanitize(nombre, 100);
  const descSan = sanitize(desc, 400);
  const imagenSan = sanitize(imagen, 500);
  const catSan = sanitize(categoria, 20);
  const precioNum = Number(precio) || 0;
  const ordenNum = Number.isFinite(Number(orden)) ? Number(orden) : 999;

  if (!nombreSan) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }
  if (catSan !== "pizzas" && catSan !== "pastas") {
    throw new HttpsError("invalid-argument", "Categoría inválida");
  }

  await docRef.update({
    nombre: nombreSan,
    categoria: catSan,
    desc: descSan,
    precio: precioNum,
    imagen: imagenSan,
    orden: ordenNum,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { editado: true };
});

// ═══════════════════════════════════════
//  ADMIN — COMIDA LISTA: ELIMINAR
// ═══════════════════════════════════════

exports.adminEliminarComida = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { platoId } = request.data;
  if (!platoId) {
    throw new HttpsError("invalid-argument", "ID del plato requerido");
  }

  const doc = await db.collection("comidaLista").doc(platoId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Plato no encontrado");
  }

  await db.collection("comidaLista").doc(platoId).delete();
  return { eliminado: true };
});

// ═══════════════════════════════════════
//  ADMIN — COMIDA LISTA: TOGGLE DISPONIBLE
// ═══════════════════════════════════════

exports.adminToggleComidaDisponible = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { platoId, disponible } = request.data;
  if (!platoId || typeof disponible !== "boolean") {
    throw new HttpsError("invalid-argument", "ID y estado disponible requeridos");
  }

  const doc = await db.collection("comidaLista").doc(platoId).get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Plato no encontrado");
  }

  await db.collection("comidaLista").doc(platoId).update({ disponible });
  return { disponible };
});

// ═══════════════════════════════════════
//  ADMIN — EDITAR PRODUCTO (tienda)
// ═══════════════════════════════════════

exports.adminEditarProducto = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { productoId, nombre, categoria, desc, precio, emoji, imagen, fotos } = request.data;

  if (!productoId) {
    throw new HttpsError("invalid-argument", "ID de producto requerido");
  }

  const docRef = db.collection("productos").doc(productoId);
  const doc = await docRef.get();
  if (!doc.exists) {
    throw new HttpsError("not-found", "Producto no encontrado");
  }

  const nombreSan = sanitize(nombre, 100);
  const catSan = sanitize(categoria, 50);
  const descSan = sanitize(desc, 300);
  const emojiSan = sanitize(emoji, 10) || "🍽️";
  const imagenSan = sanitize(imagen, 500);
  const precioNum = Number(precio);

  // Sanitizar array de fotos adicionales (máx 3, máx 500 chars cada una)
  const fotosSan = Array.isArray(fotos)
    ? fotos.slice(0, 3).map(f => sanitize(f, 500)).filter(Boolean)
    : [];

  if (!nombreSan || !catSan || !precioNum || precioNum <= 0) {
    throw new HttpsError("invalid-argument", "Nombre, categoría y precio válido son requeridos");
  }

  await docRef.update({
    nombre: nombreSan,
    categoria: catSan,
    desc: descSan,
    precio: precioNum,
    emoji: emojiSan,
    imagen: imagenSan,
    fotos: fotosSan,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { editado: true };
});

// ═══════════════════════════════════════
//  ADMIN — COMIDA LISTA: BULK SEED
//  Carga múltiples platos en batch (idempotente por nombre)
// ═══════════════════════════════════════

exports.adminCargarComidaEjemplo = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { platos } = request.data;

  if (!Array.isArray(platos) || platos.length === 0) {
    throw new HttpsError("invalid-argument", "Array de platos requerido");
  }

  if (platos.length > 100) {
    throw new HttpsError("invalid-argument", "Máximo 100 platos por llamada");
  }

  // Traer los platos existentes para evitar duplicados por nombre
  const snap = await db.collection("comidaLista").get();
  const existentes = new Set(
    snap.docs.map(d => (d.data().nombre || "").toLowerCase().trim())
  );

  let creados = 0;
  let saltados = 0;
  const batch = db.batch();

  for (const p of platos) {
    const nombreSan = sanitize(p.nombre, 100);
    const catSan = sanitize(p.categoria, 20);
    const descSan = sanitize(p.desc, 400);
    const imagenSan = sanitize(p.imagen, 500);
    const precioNum = Number(p.precio) || 0;
    const ordenNum = Number.isFinite(Number(p.orden)) ? Number(p.orden) : 999;

    if (!nombreSan) { saltados++; continue; }
    if (catSan !== "pizzas" && catSan !== "pastas") { saltados++; continue; }

    if (existentes.has(nombreSan.toLowerCase())) {
      saltados++;
      continue;
    }

    const docRef = db.collection("comidaLista").doc();
    batch.set(docRef, {
      nombre: nombreSan,
      categoria: catSan,
      desc: descSan,
      precio: precioNum,
      imagen: imagenSan,
      orden: ordenNum,
      disponible: true,
      esVideo: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    creados++;
  }

  if (creados > 0) {
    await batch.commit();
  }

  return { creados, saltados };
});



// ═══════════════════════════════════════
//  ADMIN — SUBIR IMAGEN A STORAGE
//  Recibe base64, sube con admin SDK, devuelve URL pública
// ═══════════════════════════════════════

exports.adminSubirImagen = onCall({ region: REGION }, async (request) => {
  await verificarToken(request.data.token);

  const { base64, mimeType, carpeta, nombre } = request.data;

  if (!base64 || !mimeType || !carpeta || !nombre) {
    throw new HttpsError("invalid-argument", "Faltan datos requeridos");
  }

  const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
  if (!MIME_PERMITIDOS.includes(mimeType)) {
    throw new HttpsError("invalid-argument", "Tipo de archivo no permitido");
  }

  const buffer = Buffer.from(base64, "base64");

  if (buffer.length > 5 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "La imagen supera 5 MB");
  }

  const carpetasSeg = ["productos", "comida", "logo", "hero", "general"];
  if (!carpetasSeg.includes(carpeta)) {
    throw new HttpsError("invalid-argument", "Carpeta no válida");
  }

  const nombreLimpio = nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ruta = `imagenes/${carpeta}/${Date.now()}_${nombreLimpio}`;

  const bucket = admin.storage().bucket();
  const file = bucket.file(ruta);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
  });

  await file.makePublic();

  const url = `https://storage.googleapis.com/${bucket.name}/${ruta}`;

  return { url };
});
