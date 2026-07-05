# Patterns: Estado local y React Query

> Semana 5 — Estado de UI con **Zustand** y datos remotos con **React Query** (TanStack Query).

Esta guía documenta cómo manejamos el estado en ServiceHub: qué vive en cada
capa y cómo integramos datos remotos (hoy mockeados) con caché, loading y error.
Los ejemplos están tomados del código real de `src/features/services/` y
`src/shared/`.

> La organización por features y la capa de dominio se documentan en
> [`docs/architecture/feature-based.md`](../architecture/feature-based.md).
> Los formularios y su estado local (RHF) en
> [`docs/patterns/forms-and-validation.md`](./forms-and-validation.md).

---

## 1. Tres capas de estado

No todo el estado es igual. La regla es elegir la capa por la **naturaleza** del
dato, no por comodidad:

| Capa | Herramienta | Para qué | Ejemplos |
| --- | --- | --- | --- |
| **Server state** | **React Query** | Datos que viven en un servidor y se cachean | Catálogo de servicios, detalle de un servicio |
| **UI / client state** | **Zustand** (`useUIStore`) | Estado global de la interfaz, efímero | Preferencia de tema, modal activo, filtros de la sesión |
| **Auth / secreto** | **Zustand + SecureStore** (`useAuthStore`) | Sesión persistida de forma segura | Token de autenticación |

Errores comunes que esta separación evita:

- **No** metas la respuesta de una API en Zustand: pierdes caché, refetch,
  deduplicación y estados de carga que React Query te da gratis.
- **No** guardes estado de UI puro (modal abierto, tema) en React Query: no es
  server state.
- **No** guardes tokens en el store de UI ni en `AsyncStorage`: van a
  `SecureStore` (ver [`forms-and-validation.md`](./forms-and-validation.md)).

---

## 2. React Query: el client y sus defaults

Creamos el `QueryClient` en un factory para poder instanciarlo también en tests
con opciones distintas. Los defaults se definen una sola vez y aplican a todas
las queries.

```ts
// src/shared/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,   // 5 min: datos "frescos", sin refetch
        gcTime: 1000 * 60 * 30,     // 30 min: cuánto sobrevive en caché sin uso
        retry: 2,                    // reintentos con backoff ante fallo
        refetchOnWindowFocus: false, // "window focus" no aplica en native
      },
    },
  });
}
```

**Por qué estos valores**

- `staleTime` alto evita refetches innecesarios al navegar entre pantallas: si el
  dato tiene menos de 5 min, se sirve de caché al instante.
- `gcTime` (antes `cacheTime`) controla cuándo se libera una query sin
  observadores; mientras haya algún componente montado usándola, no se recolecta.
- `refetchOnWindowFocus: false` porque en móvil no hay "foco de ventana" como en
  web; dejarlo activo dispara refetches raros.

El provider se monta una vez en la raíz, envolviendo toda la app:

```tsx
// src/app/_layout.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/shared/lib/query-client";

const queryClient = createQueryClient(); // fuera del componente: instancia estable

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ThemeProvider, Stack, etc. */}
    </QueryClientProvider>
  );
}
```

> El client se crea **fuera** del componente para que no se recree en cada
> render y la caché sobreviva a los re-renders.

---

## 3. Query keys: una factory por feature

Las query keys identifican cada entrada de la caché. Centralizarlas en una
factory evita typos y mantiene consistentes las lecturas, invalidaciones y
prefetch.

```ts
// src/features/services/queries/keys.ts
export const servicesKeys = {
  all: ["services"] as const,
  lists: () => [...servicesKeys.all, "list"] as const,
  detail: (id: string) => [...servicesKeys.all, "detail", id] as const,
};
```

- `all` es la raíz: invalidar `servicesKeys.all` invalida **todas** las queries de
  servicios (listas y detalles) de un golpe.
- `lists()` / `detail(id)` derivan de `all`, así la jerarquía queda explícita.
- `as const` hace que las keys sean tuplas tipadas, no `string[]` genéricos.

---

## 4. El caso de uso mock (dominio)

La query **no** conoce la fuente de datos: llama a un caso de uso del dominio
(TS puro). Hoy está mockeado; cuando llegue la API real, **solo cambia esta
función** — el hook y la pantalla no se tocan.

```ts
// src/features/services/domain/use-cases/get-services.ts
import type { Service } from "../types";

const MOCK_NETWORK_DELAY_MS = 600;
const MOCK_SERVICES: Service[] = [ /* … catálogo en memoria … */ ];

export async function getServices(): Promise<Service[]> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS));
  return MOCK_SERVICES;
}
```

- El `setTimeout` simula latencia de red para poder ver los estados de loading.
- El tipo `Service` vive en `domain/types.ts` y es la fuente de verdad del modelo.
- Mañana, `getServices` hará el `fetch` real; su firma (`Promise<Service[]>`) no
  cambia, así que nada más se entera.

---

## 5. El hook `useServicesQuery`

El hook envuelve `useQuery`, conecta la key con el caso de uso y no añade nada
más: la caché, staleness y reintentos vienen de los defaults del client.

```ts
// src/features/services/queries/use-services-query.ts
import { useQuery } from "@tanstack/react-query";
import { getServices } from "../domain/use-cases";
import { servicesKeys } from "./keys";

export function useServicesQuery() {
  return useQuery({
    queryKey: servicesKeys.lists(),
    queryFn: getServices,
  });
}
```

Devuelve el resultado estándar de React Query. Los que usamos en pantalla:

| Campo | Significado |
| --- | --- |
| `data` | El catálogo cuando la query tuvo éxito (`undefined` mientras carga) |
| `isPending` | `true` en la **primera** carga, sin datos aún |
| `isError` / `error` | La query falló (tras agotar los reintentos) |
| `isFetching` | `true` en cualquier fetch en curso (incluye refetch de fondo) |
| `refetch` | Vuelve a ejecutar la query manualmente (botón reintentar / pull-to-refresh) |

> `isPending` vs `isFetching`: usa `isPending` para el spinner de carga inicial y
> `isFetching` para indicadores de refresco cuando **ya** hay datos en pantalla.

---

## 6. Integrar la query en la pantalla de catálogo

La pantalla mapea los estados de la query a UI. Cubrimos los cuatro caminos:
**loading → error → vacío → éxito**, cada uno con su `testID` para testear.

```tsx
// src/features/services/screens/catalog-screen.tsx (resumen)
export function CatalogScreen() {
  const { data, isPending, isError, refetch, isFetching } = useServicesQuery();

  if (isPending) return <Loading testID="catalog-loading" />;

  if (isError) {
    return (
      <ErrorState testID="catalog-error">
        <Button
          label="Reintentar"
          testID="catalog-retry-button"
          loading={isFetching}
          onPress={() => refetch()}
        />
      </ErrorState>
    );
  }

  if (data.length === 0) return <Empty testID="catalog-empty" />;

  return (
    <FlatList
      testID="catalog-list"
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ServiceCard service={item} />}
      refreshing={isFetching}   // pull-to-refresh
      onRefresh={refetch}
    />
  );
}
```

**Convenciones**

- El orden de las guardas importa: `isPending` primero (aún no hay `data`), luego
  `isError`, luego vacío, y por último la lista. Así `data` ya está garantizado
  cuando renderizas la `FlatList`.
- El botón de reintentar usa `loading={isFetching}` para dar feedback mientras
  refetchea.
- `refreshing` + `onRefresh` en la `FlatList` reutilizan la misma `refetch` para
  el gesto de pull-to-refresh.
- Copia de UI en **español** y colores/espaciados vía tokens del tema, nunca
  hardcodeados (salvo el acento de marca `#3c87f7`).

---

## 7. Zustand: el store de UI

`useUIStore` centraliza el estado **de interfaz** global. Tiene tres slices bien
delimitados: tema, modales y una caché de sesión efímera.

```ts
// src/shared/stores/ui.store.ts
import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

export const useUIStore = create<UIState>((set, get) => ({
  // --- Tema ---
  themePreference: "system",
  setThemePreference: (themePreference) => set({ themePreference }),

  // --- Modales ---
  activeModal: null,
  openModal: (activeModal) => set({ activeModal }),
  closeModal: () => set({ activeModal: null }),

  // --- Caché de sesión (efímera, en memoria) ---
  sessionCache: {},
  setSessionValue: (key, value) =>
    set((state) => ({ sessionCache: { ...state.sessionCache, [key]: value } })),
  getSessionValue: <T,>(key: string) => get().sessionCache[key] as T | undefined,
  clearSession: () => set({ sessionCache: {} }),
}));
```

- **Tema**: `themePreference` guarda la elección del usuario (`system` sigue al SO).
- **Modales**: `activeModal` guarda el id del modal abierto (o `null`). Un solo
  modal a la vez mantiene la lógica simple.
- **Session cache**: un key/value en memoria para la sesión actual (p. ej. el
  último filtro seleccionado). **No se persiste** — se limpia al recargar. Para
  datos durables usa React Query (server state) o SecureStore (token).

### 7.1 Selectores: suscríbete a lo mínimo

Lee el store con un **selector** para que el componente solo se re-renderice
cuando cambia ese trozo de estado, no todo el store:

```ts
// ✅ solo re-render cuando cambia themePreference
const preference = useUIStore((state) => state.themePreference);

// ⚠️ se re-renderiza ante cualquier cambio del store
const store = useUIStore();
```

---

## 8. Flujo del tema: de la preferencia al color

El tema conecta el store de UI con el esquema del sistema operativo mediante un
hook que resuelve el color final. La cadena es:

```
useUIStore.themePreference  ─┐
                             ├─►  useResolvedColorScheme()  ─►  useTheme()  ─►  Colors[scheme]
useColorScheme() (del SO)   ─┘
```

```ts
// src/shared/hooks/use-resolved-color-scheme.ts
export function useResolvedColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();               // esquema del SO
  const preference = useUIStore((s) => s.themePreference);

  if (preference !== "system") return preference;      // elección explícita gana
  return systemScheme === "dark" ? "dark" : "light";   // "system" sigue al SO
}
```

- `useResolvedColorScheme` siempre devuelve un `light | dark` concreto (nunca
  `null`), así los consumidores no manejan casos nulos.
- `useTheme()` lo usa para devolver el objeto de colores activo; los componentes
  consumen colores vía `useTheme()`, no leen el store directamente.
- El `ThemeProvider` de la raíz y `app-tabs` también resuelven su esquema con este
  mismo hook, así todo cambia de forma coherente al tocar `setThemePreference`.

> Cuando exista una pantalla de ajustes, bastará con llamar a
> `setThemePreference("dark" | "light" | "system")` y toda la app reaccionará.

---

## 9. Testing

Los tests viven en `__tests__/` reflejando la estructura de `src/`. Cubrimos
cuatro niveles de esta feature:

1. **Dominio** — el caso de uso mock, puro (`get-services.test.ts`).
2. **Store** — la lógica de Zustand sin render (`ui.store.test.ts`).
3. **Query hook** — con `renderHook` y un `QueryClient` de test (`use-services-query.test.tsx`).
4. **Pantalla** — render + interacción con RN Testing Library (`catalog-screen.test.tsx`).

### 9.1 Store (sin render)

Zustand se testea llamando al estado directamente. Resetea el estado en
`beforeEach` para aislar cada test:

```ts
import { useUIStore } from "@/shared/stores/ui.store";

beforeEach(() => {
  useUIStore.setState({ themePreference: "system", activeModal: null, sessionCache: {} });
});

it("opens and closes a modal", () => {
  useUIStore.getState().openModal("filters");
  expect(useUIStore.getState().activeModal).toBe("filters");
  useUIStore.getState().closeModal();
  expect(useUIStore.getState().activeModal).toBeNull();
});
```

### 9.2 Query hook y pantalla (client de test propio)

**Clave**: cada test crea su propio `QueryClient` con `retry: false` y `gcTime: 0`
para que los tests sean deterministas y no compartan caché. Se limpia en
`afterEach`.

```tsx
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});
```

- `retry: false` evita esperar los reintentos con backoff al testear el camino de
  error (si no, el test tarda y se vuelve flaky).
- El caso de uso se mockea con `jest.mock` para controlar éxito/fallo/vacío:

```tsx
jest.mock("@/features/services/domain/use-cases", () => ({ getServices: jest.fn() }));
const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;

// loading: promesa que nunca resuelve
mockGetServices.mockReturnValue(new Promise(() => {}));
// error: mockGetServices.mockRejectedValue(new Error("network down"));
// éxito: mockGetServices.mockResolvedValue(SERVICES);
// vacío: mockGetServices.mockResolvedValue([]);
```

- Como los estados son asíncronos, usa `findByTestId` / `waitFor` para esperar la
  transición (loading → error/éxito) en vez de `getByTestId` inmediato.

---

## 10. Checklist para una nueva query

- [ ] Definir el modelo en `domain/types.ts` y el caso de uso en `domain/use-cases/` (mock o API real, `Promise<T>`).
- [ ] Añadir la key a la factory `queries/keys.ts` (derivada de `all`).
- [ ] Crear el hook `useXxxQuery` que une `queryKey` + `queryFn`, sin lógica extra.
- [ ] En pantalla, cubrir `isPending → isError → vacío → éxito`, cada uno con su `testID`.
- [ ] Botón de reintentar (`onPress={() => refetch()}`, `loading={isFetching}`) y/o pull-to-refresh.
- [ ] Copia en español y estilos con tokens del tema.
- [ ] Tests: caso de uso, hook (client de test con `retry:false`), y pantalla (loading/error/éxito/vacío).

---

## 11. Cuándo usar cada capa (resumen)

| ¿El dato…? | Capa |
| --- | --- |
| viene de un servidor / se cachea / se refetchea | **React Query** |
| es estado de UI global y efímero (tema, modal, filtro de sesión) | **Zustand `useUIStore`** |
| es un secreto que debe persistir (token) | **Zustand `useAuthStore` + SecureStore** |
| es local a un formulario | **React Hook Form** (ver [`forms-and-validation.md`](./forms-and-validation.md)) |
