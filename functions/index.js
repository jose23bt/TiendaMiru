const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require("mercadopago");

admin.initializeApp();

// Secret seguro — se configura con: firebase functions:secrets:set MP_ACCESS_TOKEN
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");

// Orígenes permitidos
const ALLOWED_ORIGINS = [
  "https://jose23bt.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

exports.crearPreferencia = onRequest(
  {
    region: "southamerica-east1",
    secrets: [mpAccessToken],
  },
  async (req, res) => {
    // CORS
    const origin = req.headers.origin || "";
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Preflight
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // onRequest recibe el body directo, no envuelto como onCall
      const body = req.body;
      // Compatible con formato onCall del SDK: { data: { items: [...] } }
      const items = body.data?.items || body.items;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Se requiere un array de items" });
        return;
      }

      for (const item of items) {
        if (!item.title || !item.quantity || !item.unit_price) {
          res.status(400).json({ error: "Cada item necesita title, quantity y unit_price" });
          return;
        }
        if (item.quantity < 1 || item.unit_price <= 0) {
          res.status(400).json({ error: "Cantidad y precio deben ser positivos" });
          return;
        }
      }

      const accessToken = mpAccessToken.value();
      if (!accessToken) {
        res.status(500).json({ error: "Access Token de MP no configurado" });
        return;
      }

      const client = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(client);

      const baseUrl = (body.data?.baseUrl || body.baseUrl) || "https://jose23bt.github.io/TiendaMiru";

      const result = await preference.create({
        body: {
          items: items.map((item) => ({
            title: item.title,
            description: item.description || item.title,
            quantity: Number(item.quantity),
            currency_id: "ARS",
            unit_price: Number(item.unit_price),
          })),
          back_urls: {
            success: `${baseUrl}?pago=exitoso`,
            failure: `${baseUrl}?pago=fallido`,
            pending: `${baseUrl}?pago=pendiente`,
          },
          auto_return: "approved",
          statement_descriptor: "MIRU PASTAS",
          external_reference: `MIRU-${Date.now()}`,
        },
      });

      // Responder en formato compatible con onCall SDK
      res.status(200).json({
        result: {
          id: result.id,
          init_point: result.init_point,
          sandbox_init_point: result.sandbox_init_point,
        },
      });
    } catch (error) {
      console.error("Error creando preferencia MP:", error);
      res.status(500).json({ error: "Error al crear la preferencia de pago" });
    }
  }
);
