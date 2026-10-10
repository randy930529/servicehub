# Reseñas y reputación

Cómo una reseña llega a la base, por qué el número que ordena el catálogo no es
el que ve el usuario, y qué impide inflar una reputación.

## Dos números, no uno

Una reseña produce estrellas. Un catálogo necesita un orden. **No es el mismo
número.**

| Campo | Qué es | Para qué |
| --- | --- | --- |
| `rating` | Media bayesiana | Ordenar el catálogo (`sort=rating`) |
| `ratingAverage` | Media simple | Mostrarla en pantalla |
| `reviewCount` | Nº de reseñas | Dar contexto a las dos anteriores |

### Por qué no basta la media simple

El catálogo se puede ordenar por valoración. Con una media simple:

```text
Servicio A: 1 reseña  de 5★   → media 5.00  ← primero
Servicio B: 50 reseñas de 4.8★ → media 4.80
```

Un servicio recién creado con **una** reseña de un amigo encabeza la lista. No
es un caso límite rebuscado: es la forma más barata de manipular un
marketplace, y por eso esto vive en la misma semana que el resto de los
controles antifraude.

### La media bayesiana

Se añaden `PRIOR_WEIGHT` reseñas imaginarias de valor `PRIOR_MEAN`:

```text
score = (PRIOR_MEAN × PRIOR_WEIGHT + suma) / (PRIOR_WEIGHT + n)
```

Con `PRIOR_MEAN = 4` y `PRIOR_WEIGHT = 5`:

```text
Servicio A: 1 reseña  de 5★   → score 4.17
Servicio B: 50 reseñas de 4.8★ → score 4.73  ← primero
```

El orden se corrige solo. Y es **simétrico**: una sola reseña de 1★ tampoco
hunde a un servicio, porque también se arrastra hacia el prior.

A medida que llegan reseñas el prior pierde peso. Con 500 reseñas de 4.6★ el
score es 4.60: el servicio ya habla por sí mismo.

### Por qué se muestra la media simple

Enseñar el score sería confuso. Si las dos únicas reseñas dicen 5★ y la ficha
muestra **4.4**, parece un bug, no un ranking. El usuario ve `★ 5.0 (2)`; el
orden usa 4.43 por dentro.

## Antifraude

La defensa es **estructural antes que heurística**. No se intenta adivinar si
una reseña es sincera; se hace imposible escribir la mayoría de las falsas.

| Control | Dónde | Qué bloquea |
| --- | --- | --- |
| La reseña cuelga de una reserva | Modelo | Reseñar sin haber contratado |
| La reserva tiene que ser tuya | `404` | Reseñar la reserva de otro |
| La reserva tiene que haber pasado | `409` | Reservar y reseñar al instante |
| No puede estar cancelada | `409` | Reservar, cancelar y reseñar igual |
| Índice único por reserva | `409` | Reseñar dos veces la misma reserva |
| No puedes reservar tu propio servicio | `409` (semana 13) | Autorreseñarse |
| Máx. 5 reseñas/hora por autor | `429` | Ráfagas con guion |
| Media bayesiana | Ranking | Que una reseña aislada encabece el catálogo |

El **único control heurístico** es el rate limit; todo lo demás es una
invariante. Eso importa: una heurística tiene falsos positivos y hay que
calibrarla, una invariante no.

La unicidad va en un **índice único**, no en un `findOne` previo — mismo
razonamiento que la idempotencia de reservas: dos envíos concurrentes pasarían
los dos la lectura.

### Lo que esto no detecta

- **Reservas de compinche.** Alguien reserva de verdad el servicio de un amigo,
  espera a que pase la fecha y reseña con 5★. Es una reserva legítima; no hay
  señal estructural que la distinga. Detectarlo requiere análisis de grafo
  (quién reseña a quién, con qué frecuencia) y está fuera del alcance.
- **Reseñas compradas** de usuarios reales con reservas reales.
- **Texto abusivo.** No hay moderación de contenido; solo límites de longitud.

El rate limit no pretende resolver nada de eso: solo evita que una cuenta con
reservas viejas acumuladas las queme todas de golpe.

## Cómo se recalcula

Al crear una reseña, en la misma petición:

```text
POST /api/reviews
  ├─ validaciones y controles
  ├─ Review.create()                 ← índice único arbitra
  ├─ aggregate: suma y nº del servicio
  └─ Service.findByIdAndUpdate({ rating, ratingAverage, reviewCount })
```

Recálculo completo en vez de contadores incrementales. Un agregado sobre las
reseñas de **un** servicio es una consulta indexada, y un contador que se
desincroniza cuesta mucho más de detectar que esto de ejecutar. Está marcado
con un comentario `ponytail:` en `services/reviews.ts` por si el volumen lo
justifica algún día.

## Endpoints

| Método | Ruta | Auth | Qué hace |
| --- | --- | --- | --- |
| `POST` | `/api/reviews` | Bearer | Reseña una reserva tuya ya pasada |
| `GET` | `/api/reviews?serviceId=…` | Pública | Reseñas de un servicio, 50 más recientes |

El `GET` es público a propósito: unas reseñas que solo ven los usuarios
registrados son reseñas que nadie lee antes de decidir registrarse.

## En la app

- **Dejar reseña**: Mis reservas → una reserva pasada y no cancelada muestra
  **Calificar**. El botón solo aparece cuando el API la aceptaría; ofrecerlo
  antes solo produciría un `409`.
- **Ver reseñas**: aparecen en la pantalla de reserva, antes de confirmar —
  que es cuando sirven de algo.
- **Sin estrellas preseleccionadas.** El formulario arranca en 0 y exige elegir.
  Un valor por defecto es como se llena un catálogo de cincos accidentales.

Las dos pantallas viven en `features/reviews/`, y la composición con
`services` y `reservations` ocurre en la capa `app/`, porque los features no
pueden importarse entre sí.
