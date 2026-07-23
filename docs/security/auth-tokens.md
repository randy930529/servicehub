# Seguridad de autenticación: tokens, storage y rotación

Cómo maneja ServiceHub la sesión del usuario (Semana 8). Cubre qué tokens
existen, dónde se guardan, cómo se renuevan y cómo se revocan.

## Modelo de tokens

| Token | Formato | Vida útil | Dónde vive (cliente) | Dónde vive (servidor) |
| --- | --- | --- | --- | --- |
| **Access token** | JWT firmado (HS256) | **15 min** (`NEXT_JWT_ACCESS_TTL_SECONDS`) | `expo-secure-store`, clave `sh_auth_token` | No se guarda (stateless: solo se verifica la firma) |
| **Refresh token** | String aleatorio opaco (48 bytes, base64url) | **30 días** (`NEXT_REFRESH_TOKEN_TTL_DAYS`) | `expo-secure-store`, clave `sh_refresh_token` | Hash SHA-256 en `User.refreshTokens[]` |

Por qué dos tokens: el access token viaja en **cada** request
(`Authorization: Bearer`), así que su exposición es la más alta y su vida debe
ser corta. Si se filtra, caduca solo en minutos. El refresh token viaja
únicamente hacia `POST /api/auth/refresh` y puede revocarse server-side.

### Claims del access token

```json
{ "sub": "<userId>", "email": "...", "iat": ..., "exp": ... }
```

Se firma y verifica con `jose` usando `NEXT_JWT_SECRET` (ver
`server/.env.example`; el secreto **nunca** se commitea).

## Storage en el cliente

- Ambos tokens se persisten con **expo-secure-store** (Keychain en iOS,
  Keystore/EncryptedSharedPreferences en Android). **Nunca AsyncStorage**: no
  está cifrado y cualquier proceso con acceso al sandbox lo lee.
- El objeto `user` de la sesión vive **solo en memoria** (store de Zustand);
  al reiniciar la app se puede repoblar con `GET /api/auth/me`.
- `hydrate()` (arranque de la app) restaura el par de tokens desde
  SecureStore. La clave `sh_auth_token` se mantiene del esquema anterior para
  no perder sesiones existentes.

## Storage en el servidor

- **Passwords**: hash con `bcryptjs` (cost 10). Nunca texto plano; el mismo
  password produce hashes distintos (salt por hash).
- **Refresh tokens**: se guarda **solo el hash SHA-256** en
  `User.refreshTokens[{ tokenHash, expiresAt }]`. Un dump de la base de datos
  no contiene tokens usables. El array permite una sesión por dispositivo y se
  poda de entradas expiradas en cada emisión.

## Rotación de refresh tokens

Cada refresh token **sirve exactamente una vez**:

1. El cliente llama `POST /api/auth/refresh` con el token actual.
2. El servidor lo busca por hash (y valida `expiresAt`); si no existe → 401.
3. Emite un par nuevo, **elimina el hash presentado** y guarda el nuevo
   (`issueSession(user, replaceTokenHash)` en `server/app/lib/auth/session.ts`).
4. El cliente reemplaza **ambos** tokens en SecureStore (`setTokens`).

Beneficio: un refresh token robado y ya usado por el atacante deja de
funcionar para el usuario legítimo (o viceversa) — la sesión duplicada se
delata en el primer refresh.

## Flujo 401 → refresh → retry (cliente)

Implementado en `src/shared/lib/api-client.ts` + inyección desde
`src/features/auth/stores/auth.store.ts` (la regla de dependencias impide que
`shared/` importe `features/`):

1. Una respuesta **401** en un endpoint protegido dispara el refresher.
2. **Single-flight**: N requests que fallan a la vez comparten *un* refresh
   (con rotación, refrescar dos veces en paralelo invalidaría la sesión).
3. Con el access token nuevo se **reintenta la request original una sola vez**
   (flag `_authRetry`; si el retry vuelve a dar 401, el error se propaga).
4. Si el refresh responde **4xx** (token revocado/expirado) → `logout()`
   local + revocación server-side. Si falla por **red/5xx**, la sesión se
   conserva para reintentar más tarde.
5. Los endpoints `login/register/refresh/logout` están excluidos: su 401 es
   una respuesta de negocio (credenciales inválidas), no un token vencido.

El refresh usa un cliente axios **sin interceptores** y sin header `Bearer`
(`refresh-session.ts`) para no re-entrar en el flujo ni enviar el JWT vencido.

## Revocación (logout)

- `logout()` borra ambas claves de SecureStore, limpia el estado y hace una
  revocación *best-effort* (`POST /api/auth/logout`): el sign-out local nunca
  se bloquea por estar offline; en el peor caso el token muere por expiración.
- `POST /api/auth/logout` es idempotente (204 aunque el token ya no exista).

## Decisiones y trade-offs

- **HS256 (secreto compartido)** en lugar de RS256: hay un solo servicio que
  firma y verifica. Si aparece otro consumidor de JWTs, migrar a par de claves.
- **Login con 401 genérico** ("Invalid credentials") tanto para email
  inexistente como password incorrecto: no se filtra qué emails tienen cuenta.
- **`expiresIn` en la respuesta**: permite al cliente programar refreshes
  proactivos en el futuro; hoy el refresh es reactivo (tras un 401).
- **Pendiente** (fuera del alcance de la semana): rate-limiting de
  `login/refresh`, detección de reuso de refresh tokens (revocar la familia
  completa), y `GET /api/auth/me` al arrancar para repoblar `user`.
