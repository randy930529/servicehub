# Flujo de reservas

Cómo un cliente reserva un servicio, cómo se cancela, y por qué pulsar
"Reservar" dos veces no crea dos reservas.

## El camino feliz

```
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

El estado inicial es `pending`: la confirmación del proveedor llega en la
parte 2.

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

```
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
| Hueco a más de un año | `400` | Cota de cordura: es un bug o un ataque, nunca un usuario |
| `Idempotency-Key` ausente | `400` | Sin clave, un reintento es indistinguible de una segunda reserva |
| Clave con espacios | `400` | Dos claves que se ven iguales en un log y no lo son |
| Id de servicio mal formado | `404` | `findById` lanzaría `CastError`; se responde como "no existe" |
| Reserva de otro usuario | `404` | No debe aprender que existe |
| El proveedor sube el precio después | La reserva mantiene el precio pactado | `priceAtBookingCents` es una instantánea, no un join |
| El servicio cambia de dueño | La reserva mantiene su proveedor | `provider` se copia al reservar |

### Lo que *no* cubre esta parte

**Dos clientes pueden reservar el mismo hueco.** La idempotencia evita
duplicados del *mismo* cliente; no es un bloqueo de agenda. Impedirlo requiere
disponibilidad real del proveedor, que es la parte 2. Son dos problemas
distintos y conviene no confundirlos: uno es "no dupliques mi petición", el otro
es "ese hueco ya está ocupado".

Los horarios que ofrece el picker (09:00–18:00, todos los días) son un
placeholder por la misma razón.

## Endpoints

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/api/reservations` | Reserva un hueco. Requiere `Idempotency-Key` |
| `GET` | `/api/reservations` | Tus reservas. `?role=provider` para la bandeja de proveedor |
| `POST` | `/api/reservations/:id/cancel` | Cancela, desde cualquiera de las dos partes |

Todos con Bearer JWT y documentados en `/api-doc`. El `GET` está **siempre**
acotado al usuario autenticado: no existe una consulta de "todas las reservas"
que se pueda exponer por descuido.
