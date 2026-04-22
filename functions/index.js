const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require("mercadopago");
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
      const result = await preference.create({
        body: {
          items: itemsConPrecioReal,
          back_urls: {
            success: `${BASE_URL}?pago=exitoso`,
            failure: `${BASE_URL}?pago=fallido`,
            pending: `${BASE_URL}?pago=pendiente`,
          },
          auto_return: "approved",
          statement_descriptor: "MIRU PASTAS",
          external_reference: `MIRU-${Date.now()}`,
        },
      });

      return {
        id: result.id,
        init_point: result.init_point,
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

  const { nombre, categoria, desc, precio, emoji, imagen } = request.data;

  const nombreSan = sanitize(nombre, 100);
  const catSan = sanitize(categoria, 50);
  const descSan = sanitize(desc, 300);
  const emojiSan = sanitize(emoji, 10) || "🍽️";
  const imagenSan = sanitize(imagen, 500);
  const precioNum = Number(precio);

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
