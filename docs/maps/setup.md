# Mapas (react-native-maps + Google Maps)

Cómo el catálogo muestra servicios cercanos en un mapa, qué credencial hace falta
y cómo probarlo.

## Por qué `react-native-maps` y no `expo-maps`

Expo tiene su propia librería desde SDK 52, pero en SDK 56 sigue marcada como
**alpha**: *"this library is currently in alpha and will frequently experience
breaking changes"*. Además separa `AppleMaps.View` (solo iOS) de
`GoogleMaps.View` (solo Android), así que una pantalla de mapa tendría que
ramificar por plataforma.

`react-native-maps` es la opción madura, tiene config plugin de Expo y funciona
igual en las dos plataformas con `PROVIDER_GOOGLE`. La versión la fijó
`npx expo install react-native-maps` → **1.27.2**, que es la que Expo da por
compatible con SDK 56.

## La API key de Google Maps

**Sin ella el mapa carga en gris**, sin error visible. Es el fallo más
desconcertante de esta pantalla porque parece que el componente no funciona.

### 1. Crear la key

En [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
mismo proyecto que Firebase (`servicehub-3735a`):

1. Habilita **Maps SDK for Android** en la biblioteca de APIs.
2. **Crear credenciales → Clave de API**.

### 2. Restringirla antes de usarla

Una key de Maps sin restringir **genera factura real** si alguien la usa: a
diferencia de la de Firebase, Maps es un servicio de pago por uso. Restringir no
es opcional aquí.

| Restricción | Valor |
| --- | --- |
| APIs permitidas | Maps SDK for Android |
| Tipo de aplicación | Apps de Android |
| Paquete | `com.randy.dev.servicehub` |
| SHA-1 (keystore de debug) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |

> Mismo aviso que con la key de Firebase: el SHA-1 es **por keystore**. Un build
> de `eas build` usa otro (`eas credentials` lo muestra) y Play usa el de *App
> Integrity*. Un SHA-1 que no coincide deja el mapa en gris.

### 3. Ponerla en `app.json`

```json
[
  "react-native-maps",
  { "androidGoogleMapsApiKey": "TU_API_KEY" }
]
```

### 4. Recompilar

La key se hornea en el `AndroidManifest` durante el prebuild, así que recargar
Metro **no basta**:

```bash
npx expo run:android --device Phone
```

## Cómo funciona la proximidad

```
App                              Backend
 getCurrentCoordinates() ──► GET /api/services?lat&lng&radiusKm&sort=distance
   (expo-location)                     │
                                       ├─ sort=distance → $geoNear (ordena)
                                       └─ resto         → $geoWithin (filtra)
                                       │
                              cada resultado ← distanceKm (haversine)
```

El permiso de ubicación **se pide al activar el filtro de radio**, no al abrir la
app: quien nunca usa el filtro nunca ve el diálogo.

### `$geoNear` vs `$geoWithin`

`$geoNear` ordena por distancia, pero tiene que ser la **primera etapa** del
pipeline y **no admite `$text`**. Por eso el catálogo filtra con `$geoWithin` en
todos los casos y solo recurre a `$geoNear` cuando se pide ordenar por distancia.

Si llegan búsqueda y orden por distancia a la vez, **gana la búsqueda** y el
orden cae a relevancia. Unos resultados incorrectos son peores que un orden
sorprendente, y la distancia se sigue devolviendo igual.

El total sale de `countDocuments` con el `$geoWithin`, que cubre exactamente el
mismo conjunto que el `maxDistance` del `$geoNear` — no hace falta una segunda
agregación solo para contar.

## Lista y mapa sincronizados

Los dos leen el mismo `selectedId` del catálogo. No hay dos estados que
mantener en paralelo: hay una selección y dos formas de dibujarla.

- Tocar un marcador selecciona ese servicio y su tarjeta aparece sobre el mapa.
- La tarjeta se resuelve **desde el id en cada render**, nunca se guarda el
  objeto: la lista refetchea, y una copia guardada quedaría obsoleta tras editar
  un precio.
- Un servicio sin `location` no se pinta. Las coordenadas `0,0` caen frente a la
  costa de Ghana, y un pin ahí siempre es un bug.

## Prueba manual

- [ ] Abre **Servicios**. Debe arrancar en **Lista** — el mapa no se carga hasta
      pedirlo.
- [ ] Activa un radio (3 km, 5 km…). Acepta el permiso de ubicación.
- [ ] Las tarjetas deben mostrar la distancia (`CleanPro · a 2.3 km`) y venir
      ordenadas de más cerca a más lejos.
- [ ] Cambia a **Mapa**: debe centrarse en tu posición con el punto azul.
- [ ] Toca un marcador: se tiñe de azul y aparece su tarjeta abajo.
- [ ] Vuelve a **Lista** y de nuevo a **Mapa**: los filtros siguen aplicados.
- [ ] Deniega el permiso: la app debe quitar el chip de radio y explicarlo, en
      vez de dejar la lista sin filtrar fingiendo que el radio sigue puesto.

## Cuando el mapa sale en gris

| Síntoma | Causa habitual |
| --- | --- |
| Mapa gris, sin error | Falta la API key, o el SHA-1 no coincide con el keystore |
| Mapa gris solo en EAS | La key está restringida al SHA-1 de debug |
| Sin marcadores | Esos servicios no tienen `location` registrada |
| Distancia ausente | La petición no llevaba `lat`/`lng`/`radiusKm` |
| Orden raro con búsqueda | Esperado: con `q` manda la relevancia, no la distancia |
| Nada en web | Correcto: `react-native-maps` no renderiza en web, hay un aviso |
