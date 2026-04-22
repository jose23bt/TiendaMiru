# MIRU — Deploy Cloud Function Mercado Pago

## Requisitos previos
- Node.js 18+ instalado (https://nodejs.org)
- Plan Blaze activado en Firebase

## Pasos

### 1. Instalar Firebase CLI
Abrí PowerShell/Terminal y ejecutá:
```
npm install -g firebase-tools
```

### 2. Login en Firebase
```
firebase login
```
Se abre el navegador, autorizá con tu cuenta de Google.

### 3. Crear la carpeta del proyecto Firebase
En tu carpeta del proyecto (donde tenés index.html), creá una carpeta `functions/` y copiá adentro:
- `functions/index.js`
- `functions/package.json`

Y en la raíz del proyecto copiá:
- `firebase.json`
- `.firebaserc`

La estructura queda así:
```
TiendaMiru/
├── functions/
│   ├── index.js          ← Cloud Function
│   └── package.json      ← Dependencias
├── firebase.json         ← Config Firebase
├── .firebaserc           ← Project ID
├── index.html
├── admin.html
├── app.js
└── styles.css
```

### 4. Instalar dependencias
```
cd functions
npm install
cd ..
```

### 5. Configurar el Access Token de Mercado Pago (SEGURO)
```
firebase functions:secrets:set MP_ACCESS_TOKEN
```
Te va a pedir el valor. Pegá tu Access Token de producción.
Esto lo guarda de forma segura en Firebase Secrets, NUNCA queda en el código.

### 6. Deploy de la función
```
firebase deploy --only functions
```

Esperá a que termine. Te va a mostrar la URL de la función desplegada.

### 7. Subir cambios del frontend a GitHub
```
git add .
git commit -m "integración Mercado Pago Checkout Pro segura"
git push
```

## Verificar que funciona
1. Abrí tu tienda
2. Agregá productos al carrito
3. Clickeá "Pagar con Mercado Pago"
4. Debería abrir el checkout de MP (sandbox en modo prueba)

## Pasar a producción
Cuando quieras cobrar de verdad:
1. En el panel de MP, copiá las credenciales de PRODUCCIÓN
2. Actualizá el token:
```
firebase functions:config:set mp.access_token="TU_ACCESS_TOKEN_PRODUCCION"
firebase deploy --only functions
```
3. En `app.js`, cambiá `sandbox_init_point` por `init_point` en la línea del payUrl:
```js
const payUrl = data.init_point;
```
