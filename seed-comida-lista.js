/**
 * MIRU — Seed de Comida Lista
 * ─────────────────────────────────────────────
 * Sube los platos del archivo comida-lista.json a la colección
 * "comidaLista" de Firestore usando Firebase Admin SDK.
 *
 * Uso:
 *   node seed-comida-lista.js          → agrega los platos (no duplica, usa merge por nombre)
 *   node seed-comida-lista.js --limpiar → borra todos los platos de la colección
 *   node seed-comida-lista.js --reset   → borra todo y carga de nuevo
 *
 * Requiere:
 *   1) Node.js instalado
 *   2) Haber logueado firebase CLI: firebase login
 *   3) firebase-admin instalado: npm install firebase-admin
 *   4) Credenciales: usa Application Default Credentials del CLI
 *      (si no funciona, ver mensaje al final de este archivo)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'tiendamiru-6bdc9';
const COLLECTION = 'comidaLista';
const JSON_FILE = path.join(__dirname, 'comida-lista.json');

// ─── Init Admin SDK ───
try {
  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
    console.log('🔑 Usando credenciales de service-account.json');
  } else {
    // Usa Application Default Credentials (firebase login)
    admin.initializeApp({
      projectId: PROJECT_ID,
    });
  }
} catch (e) {
  console.error('❌ Error inicializando Firebase Admin:', e.message);
  process.exit(1);
}

const db = admin.firestore();

// ─── Helpers ───
function log(msg, tipo = 'info') {
  const colors = {
    ok: '\x1b[32m',   // verde
    err: '\x1b[31m',  // rojo
    warn: '\x1b[33m', // amarillo
    info: '\x1b[36m', // cian
    dim: '\x1b[2m',   // gris
  };
  const reset = '\x1b[0m';
  console.log(`${colors[tipo] || ''}${msg}${reset}`);
}

async function limpiarColeccion() {
  log(`\n🗑  Borrando todos los documentos de "${COLLECTION}"...`, 'warn');
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) {
    log('   (colección ya estaba vacía)', 'dim');
    return 0;
  }
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  log(`   ✓ ${snapshot.size} documentos borrados`, 'ok');
  return snapshot.size;
}

async function cargarPlatos() {
  // Leer JSON
  if (!fs.existsSync(JSON_FILE)) {
    log(`❌ No encontré el archivo: ${JSON_FILE}`, 'err');
    process.exit(1);
  }
  const raw = fs.readFileSync(JSON_FILE, 'utf8');
  const data = JSON.parse(raw);
  const platos = data.platos || [];

  if (platos.length === 0) {
    log('⚠  El JSON no contiene platos.', 'warn');
    return;
  }

  log(`\n📦 Subiendo ${platos.length} platos a Firestore...`, 'info');

  let ok = 0, err = 0;

  for (const plato of platos) {
    try {
      // Validación básica
      if (!plato.nombre || !plato.categoria) {
        log(`   ✕ Saltado: falta nombre o categoría`, 'err');
        err++;
        continue;
      }

      // Usar el nombre normalizado como ID del documento.
      // Esto evita duplicados: correr el script dos veces actualiza en lugar de duplicar.
      const docId = plato.nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')       // quitar acentos
        .replace(/[^a-z0-9]+/g, '-')           // no alfanumérico → guion
        .replace(/^-+|-+$/g, '');              // sin guiones al inicio/fin

      const payload = {
        ...plato,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection(COLLECTION).doc(docId).set(payload, { merge: true });
      log(`   ✓ ${plato.nombre}`, 'ok');
      ok++;
    } catch (e) {
      log(`   ✕ ${plato.nombre}: ${e.message}`, 'err');
      err++;
    }
  }

  log(`\n═══════════════════════════════════`, 'dim');
  log(`  Subidos: ${ok}   Errores: ${err}`, ok > 0 ? 'ok' : 'err');
  log(`═══════════════════════════════════\n`, 'dim');
}

// ─── Main ───
(async () => {
  const args = process.argv.slice(2);
  const limpiar = args.includes('--limpiar');
  const reset = args.includes('--reset');

  try {
    log(`\n🌱 MIRU — Seed de Comida Lista`, 'info');
    log(`   Proyecto: ${PROJECT_ID}`, 'dim');
    log(`   Colección: ${COLLECTION}`, 'dim');

    if (limpiar) {
      await limpiarColeccion();
      log('✅ Listo.\n', 'ok');
      process.exit(0);
    }

    if (reset) {
      await limpiarColeccion();
    }

    await cargarPlatos();
    log('✅ Listo. Refrescá tu web para ver los cambios.\n', 'ok');
    process.exit(0);
  } catch (e) {
    log(`\n❌ Error: ${e.message}`, 'err');
    if (e.code === 16 || /credential|auth|authenticate/i.test(e.message)) {
      log(`\nPosibles soluciones:`, 'warn');
      log(`  1) Corré:  firebase login`, 'info');
      log(`  2) Si seguís viendo este error, generá una service account key:`, 'info');
      log(`     Firebase Console → ⚙ Configuración → Cuentas de servicio`, 'dim');
      log(`     → Generar nueva clave privada → descargar JSON`, 'dim');
      log(`     → guardarlo como  service-account.json  en esta carpeta`, 'dim');
      log(`     → correr de nuevo:  node seed-comida-lista.js`, 'dim');
      log(`\n  (El script detecta automáticamente service-account.json si existe)\n`, 'dim');
    }
    process.exit(1);
  }
})();
