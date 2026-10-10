# Flujo de reservas

Cómo un cliente reserva un servicio, cómo se cancela, y por qué pulsar
"Reservar" dos veces no crea dos reservas.

## El camino feliz

```text
App                                   Backend
 │
 │  Catálogo → toca un servicio
 ├──────────────────────────────────► GET /api/services/:id
 │
 │  Paso 1: elige día y hora
 │  (slots locales, sin red)
 │
 │  Paso 2: confirma
 │  genera Idempotency-Key  ◄── una vez, aquí
 │
 ├──────────────────────────────────► POST /api/reservations
 │     Idempotency-Key: rsv-…              │
 │     { serviceId, scheduledFor }         ├─ ¿existe el servicio?
 │                                         ├─ ¿tiene proveedor?
 │                                         ├─ ¿no es tuyo?
 │                                         └─ insert (índice único)
 │  ◄────────────────────────────────── 201 { reservation }
 │
 └─ router.replace("/my-reservations")
```

El estado inicial es `pending`. El proveedor la acepta desde su bandeja
(**Mis reservas → Me reservaron**), y eso cierra el ciclo cliente → proveedor.

Confirmar es **idempotente**: hacerlo dos veces deja el mismo estado, así que
un reintento desde una conexión mala no falla. No se puede confirmar una
reserva cancelada ni una que ya pasó.

## Idempotencia

El problema que resuelve es concreto: el usuario pulsa "Reservar", la red
tarda, vuelve a pulsar. Sin protección eso son **dos reservas** para el mismo
hueco.

### Dónde vive la garantía

En un **índice único** sobre `{ customer, idempotencyKey }`, no en una
comprobación previa:

```js
reservationSchema.index({ customer: 1, idempotencyKey: 1 }, { unique: true });
```

Esto importa. Un `findOne` antes del `create` parece equivalente pero no lo es:

```text
         reintento A              reintento B
            │                         │
            ├─ findOne → nada         │
            │                         ├─ findOne → nada   ← los dos pasan
            ├─ create ✓               │
            │                         ├─ create ✓         ← duplicado
```

Con el índice único, el segundo `create` falla con `E11000` y el servidor
responde con la reserva que creó el primero. **La base de datos es el árbitro**,
y es la única que ve las dos escrituras.

### Las tres respuestas

| Situación | Código | Qué devuelve |
| --- | --- | --- |
| Clave nueva | `201` | La reserva recién creada |
| Misma clave, mismo cuerpo | `200` | La reserva original — no se creó nada |
| Misma clave, **cuerpo distinto** | `409` | Error |

El `409` del tercer caso es deliberado. Devolver la reserva original ahí sería
decirle al usuario que reservó algo que **no** reservó: pidió el martes a las
10:00 y le confirmamos el lunes a las 15:00. Un error es honesto; un éxito
falso, no.

### Del lado de la app

La clave se genera **una vez, al entrar al paso de confirmación**, y se reusa en
cada reintento de ese intento:

- Reintentar tras un fallo de red → **misma clave** (es el mismo intento).
- Volver atrás y cambiar de hueco → **clave nueva** (es otra reserva).

Las dos reglas están cubiertas por tests en
`__tests__/integration/reservations.test.tsx`.

La clave se genera con `Math.random`, no con una fuente criptográfica. No es un
secreto ni una capacidad: el API la acota al cliente autenticado, así que
adivinar la de otro no sirve de nada. El único riesgo es una autocolisión, y un
timestamp más dos segmentos aleatorios la dejan muy por debajo de la
probabilidad de que la petición falle por cualquier otro motivo.

## Cancelación

Cualquiera de las dos partes puede cancelar. Es **idempotente por naturaleza**:
cancelar dos veces deja el mismo estado, así que la segunda llamada responde
`200` en vez de error. Por eso no necesita clave de idempotencia.

Quien no participa en la reserva recibe **404, no 403**: un 403 confirmaría que
la reserva existe.

## Edge cases

| Caso | Comportamiento | Por qué |
| --- | --- | --- |
| Reservar tu propio servicio | `409` | No tiene sentido y rompería el flujo cliente → proveedor |
| Servicio del catálogo sembrado (sin `owner`) | `409` | No hay nadie que se presente; fallar cerrado |
| Hueco en el pasado | `400` | Validado en el esquema, no solo en la UI |
| Hueco ya tomado por otro | `409` | Índice único sobre `activeSlot` |
| Confirmar sin ser el proveedor | `404` | No debe aprender que existe |
| Confirmar una reserva ya pasada | `409` | No significa nada |
| Confirmar dos veces | `200` | Idempotente: mismo estado, retry seguro |
| Hueco a más de un año | `400` | Cota de cordura: es un bug o un ataque, nunca un usuario |
| `Idempotency-Key` ausente | `400` | Sin clave, un reintento es indistinguible de una segunda reserva |
| Clave con espacios | `400` | Dos claves que se ven iguales en un log y no lo son |
| Id de servicio mal formado | `404` | `findById` lanzaría `CastError`; se responde como "no existe" |
| Reserva de otro usuario | `404` | No debe aprender que existe |
| El proveedor sube el precio después | La reserva mantiene el precio pactado | `priceAtBookingCents` es una instantánea, no un join |
| El servicio cambia de dueño | La reserva mantiene su proveedor | `provider` se copia al reservar |

## Disponibilidad: el otro problema

La idempotencia evita duplicados del *mismo* cliente. **No** es un bloqueo de
agenda: que dos clientes distintos no pisen el mismo hueco es un problema
aparte, y se resuelve aparte.

### Un hueco, una reserva viva

Cada reserva activa guarda un `activeSlot` (`servicioId:instante`) con un
**índice único**. Mismo razonamiento que la clave de idempotencia: dos clientes
enviando a la vez pasarían los dos una comprobación de tipo "¿está libre?".

Cancelar **borra el campo** (no lo pone a `null`), y el índice parcial
—`partialFilterExpression: { activeSlot: { $exists: true } }`— deja de verlo.
Eso es lo que libera la hora.

Los dos índices únicos pueden saltar en el mismo `create` y significan cosas
opuestas, así que el handler los distingue por el mensaje del error:

| Índice | Significado | Respuesta |
| --- | --- | --- |
| `activeSlot` | Otro cliente ya tiene esa hora | `409` |
| `customer + idempotencyKey` | Tú enviaste dos veces | replay (`200`) |

Confundirlos devolvería al usuario una reserva que no es suya.

### Horarios reales, no inventados

La app ya no genera huecos. `GET /api/services/:id/availability` devuelve los
horarios del proveedor menos lo que ya está reservado, y el picker pinta eso.

Antes se ofrecía 09:00–18:00 fijo desde el cliente, lo que significaba enseñar
horas que el proveedor no trabaja y horas que otro ya había tomado: el error
solo aparecía **después** de confirmar.

La disponibilidad se calcula en cada petición, nunca se guarda: una tabla
cacheada está desactualizada en cuanto alguien reserva, y las dos entradas
(horario del proveedor, reservas vivas) están a una consulta indexada.

Un proveedor edita sus horarios en **Perfil → Mis horarios**.

> **Una simplificación consciente:** las horas se interpretan en un único huso,
> UTC−6. El producto sirve a Guadalajara y México eliminó el horario de verano
> en 2022, así que es correcto además de cómodo. Un proveedor en otro huso
> necesitaría una zona IANA por usuario; la constante
> `MARKET_UTC_OFFSET_HOURS` es la costura por donde entraría.

## Endpoints

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/api/reservations` | Reserva un hueco. Requiere `Idempotency-Key` |
| `GET` | `/api/reservations` | Tus reservas. `?role=provider` para la bandeja de proveedor |
| `POST` | `/api/reservations/:id/cancel` | Cancela, desde cualquiera de las dos partes |
| `POST` | `/api/reservations/:id/confirm` | El **proveedor** acepta la reserva |
| `GET` | `/api/services/:id/availability` | Horas libres (pública) |

Todos con Bearer JWT y documentados en `/api-doc`. El `GET` está **siempre**
acotado al usuario autenticado: no existe una consulta de "todas las reservas"
que se pueda exponer por descuido.
