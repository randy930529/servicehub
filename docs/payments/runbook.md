# Runbook de pagos

Qué hacer cuando algo va mal con el dinero. Pensado para leerse con prisa.

**Regla primera:** Stripe es la fuente de verdad. Nuestra base es un espejo.
Cuando discrepen, gana Stripe y lo que hay que arreglar es el espejo.

**Regla segunda:** nada en este documento repara nada automáticamente. Una
corrección equivocada mueve dinero real; un diagnóstico equivocado cuesta cinco
minutos.

## Diagnóstico rápido

| Síntoma | Causa más probable | Sección |
| --- | --- | --- |
| Pagos atascados en "Procesando" | El webhook no llega | [1](#1-los-webhooks-no-llegan) |
| Webhooks con `400` en el Dashboard | `whsec_` desincronizado | [2](#2-los-webhooks-llegan-pero-dan-400) |
| Cliente dice que pagó y no consta | Evento perdido o descartado | [3](#3-un-pago-no-aparece) |
| Hay que devolver dinero | — | [4](#4-emitir-un-reembolso) |
| Sospecha de descuadre general | — | [5](#5-reconciliación) |

## 1. Los webhooks no llegan

**Síntoma:** los pagos se quedan en `processing` o `requires_payment` aunque el
cliente completó la hoja.

Recuerda que **cerrar la hoja no es haber pagado**: la app espera al webhook a
propósito. Si no llega, espera para siempre, y es correcto.

1. Mira el Dashboard → **Developers → Webhooks** → tu endpoint. ¿Hay intentos?
   - **No hay intentos:** Stripe no tiene registrado el endpoint, o en local no
     hay túnel. Arranca `stripe listen` (ver `pci.md`).
   - **Hay intentos fallidos:** ve a la sección 2.
2. En local, confirma que el túnel sigue vivo. `stripe listen` muere con la
   terminal y nadie avisa.
3. Comprueba que el contenedor tiene las claves:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/webhooks/stripe
   ```
   - `400` → bien: hay claves y falta la firma, que es lo esperado.
   - `503` → **no hay claves cargadas**. Revisa `server/.env.local` y
     `docker compose up -d --build server`.

## 2. Los webhooks llegan pero dan 400

Casi siempre es el **secreto de firma desincronizado**.

`stripe listen` genera un `whsec_` **nuevo en cada sesión**. Si reiniciaste el
CLI y no actualizaste `server/.env.local`, todas las firmas fallan.

1. Copia el `whsec_` que imprime `stripe listen` al arrancar.
2. Actualiza `server/.env.local`.
3. `docker compose up -d --build server`.

Si no es eso, verifica que nada reescribe el cuerpo de la petición. La firma
cubre los **bytes exactos**; un proxy que reformatee el JSON la invalida. Por
eso el handler usa `request.text()` y no `request.json()`.

> Un `400` en este endpoint **no** es un incidente de dinero: significa que el
> endpoint rechazó algo que no pudo probar que viniera de Stripe. Eso es que
> funciona.

## 3. Un pago no aparece

1. Busca el `PaymentIntent` en el Dashboard por importe o fecha.
2. Si existe en Stripe y no en nuestra base, mira si el evento llegó:
   ```js
   db.webhookevents.find({ createdAt: { $gte: new Date(Date.now() - 3600e3) } })
   ```
   - **El evento está registrado** → se procesó. El pago debería existir; si no,
     el `paymentIntentId` no coincide (¿otro entorno apuntando al mismo
     endpoint?).
   - **No está** → nunca llegó. Reenvíalo desde el Dashboard
     (**Webhooks → el evento → Resend**).
3. Reenviar es seguro: el dedupe por `event.id` hace que un evento ya procesado
   no se aplique dos veces.

## 4. Emitir un reembolso

Hace falta un usuario con `role: "admin"`. No hay forma de dárselo desde la app,
a propósito — el camino a mover dinero hacia atrás no debe ser autoservicio:

```js
db.users.updateOne({ email: "..." }, { $set: { role: "admin" } })
```

Reembolso total (omite el importe):

```bash
curl -X POST localhost:3000/api/payments/<paymentId>/refund \
  -H "Authorization: Bearer <token-admin>"
```

Parcial:

```bash
curl -X POST localhost:3000/api/payments/<paymentId>/refund \
  -H "Authorization: Bearer <token-admin>" \
  -H "Content-Type: application/json" \
  -d '{"amountCents": 10000}'
```

**Es seguro repetir la misma petición.** La clave de idempotencia incluye el
importe ya reembolsado, así que un doble clic reproduce el mismo reembolso en
vez de emitir otro. Dos parciales *distintos* sí pasan, que es lo que se quiere.

Respuestas:

| Código | Significa |
| --- | --- |
| `409` | El pago no está en `succeeded`, ya se devolvió todo, o pides más de lo que queda |
| `404` | No existe — **o no eres admin** |
| `503` | El servidor no tiene claves de Stripe |

> El `404` para un no-admin es deliberado. Un `403` confirmaría que el endpoint
> existe, y eso es una invitación.

## 5. Reconciliación

Compara nuestros registros con Stripe. **Solo informa**, nunca corrige.

```bash
curl -s "localhost:3000/api/payments/reconcile?limit=100" \
  -H "Authorization: Bearer <token-admin>"
```

| `kind` | Qué significa | Qué hacer |
| --- | --- | --- |
| `missing_in_stripe` | Tenemos un pago que Stripe no reconoce | **El peor.** ¿Claves de otra cuenta? ¿Datos de otro entorno? |
| `status_drift` | El estado no coincide | Reenvía el evento desde el Dashboard |
| `refund_drift` | Un reembolso que no registramos | Reenvía `charge.refunded` |
| `amount_drift` | El importe no coincide | **Investigar a mano.** No debería ocurrir: el importe lo fija el servidor desde la reserva |

Un `amount_drift` sin explicación merece parar y mirar antes de tocar nada.

## Rotar claves comprometidas

Si la `sk_` se filtra, alguien puede mover tu dinero.

1. Dashboard → **API keys** → rota la secreta. Hay 7 días de gracia en que
   ambas funcionan.
2. Actualiza `server/.env.local` y redespliega.
3. Vigila los logs de peticiones hasta que el volumen de la vieja sea cero.
4. Haz vencer la antigua.

La **publicable** no es un secreto: viaja en la respuesta del checkout y
cualquiera puede leerla en el tráfico de la app. No hace falta rotarla.

El `whsec_` filtrado permite **falsificar pagos**. Rótalo en
**Webhooks → el endpoint → Roll secret**.

## Lo que este sistema todavía no hace

- **No hay reembolso automático al cancelar.** Cancelar una reserva pagada deja
  el pago en `succeeded`. Hay que reembolsar a mano con la sección 4.
- **El dinero no llega al proveedor.** Se queda en la cuenta de la plataforma;
  repartirlo necesita Stripe Connect.
- **Pagar no confirma la reserva.** Siguen siendo dos acciones distintas.

Los tres son deliberados y están en `pci.md`. Conviene decirlo en voz alta: una
reserva que dice "pagada" y un proveedor que nunca cobra es peor que no tener
pagos.
