# Notificaciones push (Expo + FCM/APNs)

Cómo ServiceHub registra dispositivos y les envía notificaciones, qué permisos
hacen falta y cómo probarlo a mano.

## Por dónde pasa una notificación

```
App (expo-notifications)          Backend (Next.js)          Expo Push Service
   getExpoPushTokenAsync  ──────► POST /api/users/me/devices
                                     guarda DeviceToken
                                  POST /api/notifications/test
                                     ─────────────────────────► exp.host/--/api/v2/push/send
                                                                      │
                                                                      ▼
                                                                 FCM / APNs
                                                                      │
   addNotificationResponseReceivedListener ◄──────────────────────────┘
   → resolveNotificationRoute → router.push
```

El backend **no habla con Google ni con Apple**: envía a Expo y Expo reparte.
Eso nos ahorra credenciales por plataforma en el servidor, pero cambia cómo se
ven los errores — no llegan como HTTP, llegan como _tickets_ (ver más abajo).

## Requisito que sorprende a todo el mundo

> Desde SDK 53, **Expo Go en Android no puede recibir push**. Hace falta un
> [development build](https://docs.expo.dev/develop/development-builds/introduction/).

Las notificaciones **locales** (programadas dentro de la app) sí funcionan en
Expo Go. Las remotas no. La app detecta este caso y lo dice en la pantalla de
notificaciones en vez de mostrar un error genérico: `status: "unsupported"`.

Emuladores: un emulador de Android **con Google Play** sí puede recibir push. Uno
sin Play Services, no.

## Checklist de permisos

### Android

- [ ] **El canal se crea antes de pedir permiso.** En Android 13+ el diálogo no
      aparece hasta que existe al menos un canal. `push-token.ts` llama a
      `setNotificationChannelAsync("default", …)` antes de
      `requestPermissionsAsync`, y ese orden **no se puede invertir**.
- [ ] **El `channelId` del backend coincide con el de la app.** Ambos usan
      `"default"` (`expo-push.ts` ↔ `push-token.ts`). Si no coinciden, la
      notificación llega **en silencio**: sin sonido y sin banner. Es el fallo
      más difícil de diagnosticar porque parece que no llegó.
- [ ] `POST_NOTIFICATIONS` lo pide `requestPermissionsAsync` en Android 13+.
- [ ] `RECEIVE_BOOT_COMPLETED` lo añade la librería sola.
- [ ] El plugin en `app.json` fija `color` y `defaultChannel`.

### iOS

- [ ] No hace falta cadena de permiso en `Info.plist`.
- [ ] Fíjate en `ios.status`, no en el `status` raíz: iOS distingue
      `PROVISIONAL` y `EPHEMERAL`, que conceden permiso parcial.
- [ ] La entitlement de APNs siempre se genera como `development`; Xcode la
      cambia a `production` al archivar una release.

## Puesta en marcha

Verificado contra la [doc de SDK 56](https://docs.expo.dev/push-notifications/fcm-credentials/).

### Lo que ya está resuelto en el repo

- [x] Plugin `expo-notifications` en `app.json`.
- [x] `extra.eas.projectId` en `app.json` — sin él Expo no emite token y la app
      lo reporta como `unsupported`.
- [x] `push-token.ts` crea el canal _antes_ de pedir permiso y pasa el
      `projectId` a `getExpoPushTokenAsync`, que es lo que exige la doc.
- [x] Development build compilando en local (ver
      [`../setup/android-dev-build-windows.md`](../setup/android-dev-build-windows.md)).

### Lo que falta: credenciales de Android

**1. Proyecto de Firebase.** En [console.firebase.google.com](https://console.firebase.google.com),
crea el proyecto y añade una app **Android** con el package exacto:
Video en youtube: [Video](https://www.youtube.com/watch?v=OLDKr13spSY&t=10s)

```
com.randy.dev.servicehub
```

Descarga el `google-services.json` a la raíz del repo.

**2. Referenciarlo en `app.json`:**

```json
"android": {
  "package": "com.randy.dev.servicehub",
  "googleServicesFile": "./google-services.json"
}
```

**3. Subir la clave de servicio FCM V1 a EAS.** Es lo que permite al servicio de
Expo entregar en _tu_ proyecto de Firebase, y **hace falta aunque compiles en
local**. En Firebase: **Configuración del proyecto → Cuentas de servicio →
Generar nueva clave privada**. Después:

```bash
eas credentials
# Android → production → Google Service Account
# → Manage your Google Service Account Key for Push Notifications (FCM V1)
# → Set up... → Upload a new service account key
```

Aunque el menú diga `production`, la clave se guarda por _application
identifier_, así que también sirve para el development build.

**4. Recompilar.** `google-services.json` se hornea en tiempo de compilación:
recargar Metro **no** basta.

```bash
npx expo run:android --device Phone
```

> `Phone` es el nombre del AVD, no el serial `emulator-5554`; `--device` espera
> lo primero y falla con `Could not find device with name`.

### Dos trampas de las credenciales de Android

- **`google-services.json` sí se puede commitear** — solo lleva identificadores
  públicos. La **service account key JSON no**: añádela a `.gitignore` _antes_ de
  descargarla.
- Si la API key de `google-services.json` está restringida en Google Cloud,
  habilita **FCM Registration API** y **Firebase Installations API**. Si no, la
  Firebase Installations API responde `403 PERMISSION_DENIED` y la app **nunca
  llega a obtener token**.

Sin el paso 3, los recibos traen `MismatchSenderId` o `InvalidCredentials`.

### Credenciales de iOS

- [ ] `eas credentials` genera la push key. Revocarla rompe el push de todas las
      apps que la compartan.
- [ ] Hace falta una cuenta de Apple Developer de pago.

## Endpoints

| Método   | Ruta                      | Qué hace                                                  |
| -------- | ------------------------- | --------------------------------------------------------- |
| `POST`   | `/api/users/me/devices`   | Registra o refresca el token de este dispositivo          |
| `DELETE` | `/api/users/me/devices`   | Da de baja este dispositivo                               |
| `POST`   | `/api/notifications/test` | Envía una notificación de prueba a todos tus dispositivos |

Todos protegidos con Bearer JWT y documentados en `/api-doc`.

### Por qué el upsert va por token y no por usuario

Expo devuelve **el mismo token en cada arranque**. Si el registro se indexara
por usuario, un teléfono compartido acabaría con dos filas y seguiría recibiendo
las notificaciones del usuario anterior. Con la clave en el token, iniciar
sesión con otra cuenta **mueve** el token a su nuevo dueño.

## Tickets, recibos y tokens muertos

`send` responde con un **ticket** por mensaje, _en el mismo orden_ en que se
enviaron. Ese orden es lo único que une un ticket con su token — por eso
`collectUnregisteredTokens` empareja por índice y nada puede reordenar los
arrays entre el envío y la lectura.

- `status: "ok"` significa **que Expo lo aceptó**, no que llegara al teléfono.
- `DeviceNotRegistered` significa que el dispositivo ya no puede recibir: el
  backend borra ese token en la misma pasada, así que la colección se limpia
  sola.
- Otros errores (`MessageTooBig`, `MessageRateExceeded`) son problemas nuestros,
  no dispositivos muertos, y **no** borran el token.

Los **recibos** (`/getReceipts`, 15 minutos después) son los que confirman la
entrega a FCM/APNs. Este proyecto todavía no los consulta: es la siguiente
mejora natural si el envío empieza a fallar de forma no obvia.

## Deep links

El backend manda el destino en `data.url`, no en la raíz del mensaje: solo lo que
va dentro de `data` sobrevive el viaje por FCM/APNs.

La app lo enruta en `useNotificationObserver`, montado en el layout raíz. Dos
caminos, los dos necesarios:

- `getLastNotificationResponse()` — la app se **abrió** desde la notificación (el
  listener se registraría demasiado tarde para verlo).
- `addNotificationResponseReceivedListener` — la app ya estaba abierta.

`resolveNotificationRoute` filtra el destino contra una **allowlist** de rutas
que la app tiene de verdad. Una notificación llega de fuera y se toca cuando
nadie está mirando: navegar a la cadena que venga sería un redirect abierto. Se
rechaza todo lo que no sea una ruta relativa conocida — `https://…`,
`//host`, `servicehub://…` y rutas inexistentes.

## Prueba manual

```bash
# 1. Development build (Expo Go en Android no vale)
npx expo run:android            # o: eas build --profile development -p android

# 2. Backend
docker compose up -d --build
```

- [ ] Entra con una cuenta. Al iniciar sesión, el dispositivo se registra solo.
- [ ] Perfil → **Notificaciones**: el estado debe decir "Activas" y mostrar el
      token abreviado.
- [ ] Pulsa **Enviar notificación de prueba** con la app **en primer plano**:
      debe aparecer el banner (lo permite `configureNotificationHandler`).
- [ ] Manda la app a segundo plano y repite: debe llegar a la bandeja del
      sistema, con sonido.
- [ ] **Toca la notificación**: la app debe abrir "Mis servicios".
- [ ] Cierra la app del todo y repite: al tocarla debe abrir también en "Mis
      servicios" (esta es la rama de `getLastNotificationResponse`).
- [ ] Deniega el permiso en los ajustes del sistema y vuelve a la pantalla: debe
      decir "Bloqueadas" y ofrecer abrir los ajustes.

## Cuando no llega

| Síntoma                             | Causa habitual                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| La app dice "No disponibles aquí"   | Expo Go en Android, emulador sin Play Services, o falta `projectId` |
| Estado "Bloqueadas"                 | Permiso denegado en el sistema                                      |
| El envío responde 409               | Este usuario no tiene ningún dispositivo registrado                 |
| Llega pero **sin sonido ni banner** | El `channelId` del mensaje no existe en el dispositivo              |
| Recibo con `MismatchSenderId`       | El `google-services.json` y la clave FCM son de proyectos distintos |
| Recibo con `InvalidCredentials`     | Credenciales revocadas o mal subidas a EAS                          |
| Nada, y los tickets salen `ok`      | Los tickets solo confirman que Expo lo aceptó; mira los recibos     |

## Variables de entorno

`EXPO_ACCESS_TOKEN` (opcional, en `server/.env.local`): si activas _enhanced push
security_ en el dashboard de Expo, los envíos sin este token se rechazan. Es lo
que impide que un token de push filtrado permita a cualquiera suplantar a
nuestro servidor.
