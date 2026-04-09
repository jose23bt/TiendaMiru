const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require("mercadopago");

admin.initializeApp();

// Secret seguro — se configura con: firebase functions:secrets:set MP_ACCESS_TOKEN
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");

exports.crearPreferencia = onCall(
  { region: "southamerica-east1", secrets: [mpAccessToken] },
  async (request) => {
    const items = request.data.items;

    // Validar datos
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Se requiere un array de items");
    }

    for (const item of items) {
      if (!item.title || !item.quantity || !item.unit_price) {
        throw new HttpsError("invalid-argument", "Cada item necesita title, quantity y unit_price");
      }
      if (item.quantity < 1 || item.unit_price <= 0) {
        throw new HttpsError("invalid-argument", "Cantidad y precio deben ser positivos");
      }
    }

    // Configurar Mercado Pago
    const accessToken = mpAccessToken.value();
    if (!accessToken) {
      throw new HttpsError("failed-precondition", "Access Token de MP no configurado");
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const baseUrl = request.data.baseUrl || "https://jose23bt.github.io/TiendaMiru";

    try {
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

      return {
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
      };
    } catch (error) {
      console.error("Error creando preferencia MP:", error);
      throw new HttpsError("internal", "Error al crear la preferencia de pago");
    }
  }
);
