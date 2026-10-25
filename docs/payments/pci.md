# Pagos con Stripe: claves, alcance PCI y por qué

Qué toca una tarjeta en este sistema (nada), qué clave va dónde, y cuáles son
las dos decisiones que sostienen todo lo demás.

## Lo esencial en una frase

**Ningún dato de tarjeta pasa por este servidor ni por nuestro código de app.**
El SDK de Stripe los recoge en su propia UI y los manda directo a Stripe; aquí
solo viaja un identificador.

```text
App                      Nuestro backend                 Stripe
 │                              │                           │
 │  POST /api/payments/intent   │                           │
 ├─────────────────────────────►│                           │
 │  { reservationId }           ├── importe ← de la reserva │
 │                              ├──────────────────────────►│ crea PaymentIntent
 │  { clientSecret }  ◄─────────┤◄──────────────────────────┤
 │                                                          │
 │  tarjeta ────────────────────────────────────────────────►  (nunca nos toca)
 │                                                          │
 │                              │◄─ webhook firmado ────────┤
 │                              ├── verifica firma          │
 │                              └── actualiza el pago       │
 │  GET /api/payments ──────────►                           │
```

Eso nos deja en el alcance PCI más pequeño posible (**SAQ A**): no
transmitimos, procesamos ni almacenamos datos de titular de tarjeta.

## Las dos decisiones que lo sostienen

### 1. El importe lo pone el servidor, nunca el cliente

`POST /api/payments/intent` recibe **solo** un `reservationId`. El importe sale
de `reservation.priceAtBookingCents`.

Un importe que el cliente puede enviar es un importe que el cliente puede poner
a un centavo. No hay validación que arregle eso: el único diseño correcto es
que el dato no venga de ahí.

### 2. Todo webhook se verifica antes de leerse

`/api/webhooks/stripe` es una URL pública. Sin verificación de firma, cualquiera
puede hacer `POST` con `"payment_intent.succeeded"` y cobrar gratis.

```ts
const raw = await request.text();           // bytes exactos
stripe.webhooks.constructEvent(raw, signature, secret);
```

Dos detalles que no son opcionales:

- **`request.text()`, no `request.json()`.** La firma cubre los bytes que
  Stripe envió. Parsear y volver a serializar produce un JSON equivalente pero
  no idéntico, y la verificación falla. Hay un test que lo demuestra.
- **El rechazo es escueto.** Un error detallado le dice al falsificador qué
  corregir.

Stripe incluye un timestamp en la firma y rechaza las viejas, así que una
petición capturada no se puede reenviar más tarde.

## Las tres claves

| Clave | Dónde vive | Qué puede hacer | Si se filtra |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` (`sk_…`) | **Solo servidor**, `server/.env.local` | Mover dinero | Crítico — rotar ya |
| `STRIPE_PUBLISHABLE_KEY` (`pk_…`) | Servidor → app | Crear métodos de pago | Nada: es pública por diseño |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | **Solo servidor** | Verificar webhooks | Permite falsificar pagos |

La publicable **no se hardcodea en la app**: la entrega el backend en la
respuesta del checkout. Así, cambiar de cuenta Stripe o rotar claves no exige
publicar una versión nueva.

Las otras dos nunca salen de `server/.env.local`, que está en `.gitignore`.

> En modo test las claves empiezan por `sk_test_` / `pk_test_`. Nunca pongas
> claves `live` en un entorno de desarrollo: los webhooks de test y los de
> producción llegan a la misma URL si la configuras así, y acabarías marcando
> reservas reales como pagadas con tarjetas de prueba.

## Estados de un pago

Stripe distingue más estados de los que esta app necesita. `mapStripeStatus`
los reduce:

| Nuestro | Stripe | Qué ve el usuario |
| --- | --- | --- |
| `requires_payment` | `requires_payment_method`, `requires_confirmation`, `requires_action`, `requires_capture` | "Pendiente de pago" |
| `processing` | `processing` | "Procesando" |
| `succeeded` | `succeeded` | "Pagado" |
| `failed` | — (vía `payment_intent.payment_failed`) | El motivo del rechazo |
| `canceled` | `canceled` | "Cancelado" |

Un estado desconocido —de una versión futura de la API— se trata como
**pendiente**, no como fallo: decirle a alguien que su pago murió cuando quizá
está bien es el peor error de los dos.

### Reintentos y orden

Stripe **reintenta hasta recibir un 2xx** y **no garantiza el orden**. Las dos
cosas pasan de verdad, y `shouldApplyStatus` las cubre:

- Un evento repetido no vuelve a escribir.
- `succeeded` y `canceled` son terminales: un `payment_failed` rezagado **no**
  puede despagar un pedido.
- `failed` **no** es terminal — el cliente puede reintentar con otra tarjeta
  sobre el mismo intent.

Un evento que no manejamos se responde `200`. Un `4xx` haría que Stripe
reintentara para siempre algo que nunca nos va a importar.

## Probar en local

El webhook necesita llegar a tu máquina, y Stripe no puede ver `localhost`:

```bash
# 1. Una sola vez
stripe login

# 2. Reenvía los eventos y te imprime el whsec_ que va en server/.env.local
stripe listen \
  --events payment_intent.succeeded,payment_intent.payment_failed,payment_intent.processing,payment_intent.canceled \
  --forward-to localhost:3000/api/webhooks/stripe

# 3. En otra terminal, dispara eventos
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

> **`--events` es obligatorio** en el CLI actual: sin él falla con
> *"must specify events to forward"*. Existen `--all-snapshot` y `--all-thin`,
> pero no los uses aquí — reenviarían decenas de tipos que el endpoint
> responde con `200` e ignora, y el log queda ilegible justo cuando lo
> necesitas para depurar.
>
> Esa lista es la misma que `HANDLED_EVENTS` en `helpers/payment-status.ts`.
> Es el único sitio donde está duplicada: si añades un evento al handler,
> añádelo también al comando.

Tarjetas de prueba:

| Número | Qué hace |
| --- | --- |
| `4242 4242 4242 4242` | Pago correcto |
| `4000 0000 0000 9995` | Rechazo por fondos insuficientes |
| `4000 0025 0000 3155` | Exige 3-D Secure |

Cualquier CVC, cualquier fecha futura.

## Lo que esta parte no hace

- **No hay reembolsos.** Cancelar una reserva pagada no devuelve el dinero
  todavía; el pago queda `succeeded` y la reserva `cancelled`.
- **No hay transferencia al proveedor.** El dinero se queda en la cuenta de la
  plataforma. Repartirlo necesita Stripe Connect.
- **No se confirma la reserva al pagar.** Pagar y que el proveedor acepte
  siguen siendo dos cosas distintas.

Los tres son parte 2, y conviene no fingir lo contrario: una reserva que dice
"pagada" y un proveedor que nunca cobra es peor que no tener pagos.
