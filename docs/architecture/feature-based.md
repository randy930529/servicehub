# Arquitectura: Feature-based + Domain Layer

> Semana 4 — Reorganización del código a una arquitectura **por features** con una
> **capa de dominio** explícita.

Esta guía define **cómo** y **dónde** vive el código en ServiceHub. Es la fuente de
verdad de convenciones de carpetas; si algo no encaja aquí, actualiza este documento
antes de improvisar una ubicación nueva.

---

## 1. Idea central

Antes el código se agrupaba por **tipo técnico** (`components/`, `hooks/`, `stores/`,
`lib/`). Eso escala mal: una sola funcionalidad (auth) quedaba desperdigada en 5
carpetas. Ahora agrupamos por **feature** (un trozo de producto) y dejamos en `shared/`
solo lo verdaderamente transversal.

```
Antes (por tipo)                 Ahora (por feature)
─────────────────                ───────────────────
src/components/                  src/features/auth/      ← todo lo de auth junto
src/hooks/                       src/features/home/
src/stores/                      src/shared/             ← UI kit, theming, hooks base
src/lib/                         src/app/                ← solo rutas (delgadas)
src/app/  (pantallas gordas)
```

---

## 2. Estructura de carpetas

```
src/
  app/                       # SOLO rutas de Expo Router (delgadas)
    _layout.tsx              # providers raíz (React Query, ThemeProvider)
    (auth)/
      _layout.tsx
      login.tsx             # reexporta: export { LoginScreen as default } from "@/features/auth"
      register.tsx
      onboarding.tsx
    (tabs)/
      _layout.tsx
      index.tsx            # reexporta HomeScreen desde @/features/home
      explore.tsx
    playground.tsx          # herramienta de dev (galería del UI kit)

  features/
    auth/
      screens/              # pantallas (composición de UI + hooks + use-cases)
        login-screen.tsx
        register-screen.tsx
        onboarding-screen.tsx
      domain/               # CAPA DE DOMINIO: reglas de negocio puras, sin React ni UI
        types.ts            # Credentials, RegistrationData, AuthToken, ...
        use-cases/          # una función por caso de uso
          login-user.ts
          register-user.ts
          index.ts
        index.ts
      validation/
        auth.schema.ts      # esquemas Zod (fuente de verdad de validación + tipos)
      stores/
        auth.store.ts       # estado global de la feature (Zustand)
      index.ts              # API PÚBLICA de la feature (barrel)
    home/
      screens/
        home-screen.tsx
        explore-screen.tsx
      index.ts

  shared/                    # transversal: no pertenece a ninguna feature
    components/
      themed-text.tsx, themed-view.tsx, external-link.tsx, hint-row.tsx, ...
      ui/                   # UI kit atómico: button, card, text-input, collapsible
    hooks/                  # use-theme, use-color-scheme
    constants/              # theme (Colors, Spacing, Fonts)
    lib/                    # utilidades genéricas (vacío por ahora)

  global.css                # entrada de Tailwind, se queda en la raíz de src
```

---

## 3. Reglas de dependencia

Las flechas indican "puede importar de". **Nunca** en sentido contrario.

```
app/  ─────►  features/*  ─────►  shared/
                  │
                  └─ (domain no importa de screens/stores; es el núcleo puro)
```

- **`app/` → `features/`**: las rutas solo reexportan/componen pantallas de features.
  No contienen lógica ni UI propia (excepto `_layout` y utilidades de dev como
  `playground`).
- **`features/` → `shared/`**: una feature usa el UI kit, hooks y theming compartidos.
- **`features/*` ↛ `features/*`**: una feature **no** debe importar de otra feature.
  Si dos features necesitan lo mismo, súbelo a `shared/`.
- **`domain/` es puro**: solo TypeScript. No importa React, componentes, ni el store.
  Recibe datos y devuelve datos/promesas. Esto lo hace trivial de testear.
- **`shared/` no importa de `features/`**: es la base, no conoce a nadie.

---

## 4. La capa de dominio (`domain/`)

El objetivo de la Semana 4. Separa **qué hace el negocio** de **cómo se ve** o **dónde se
guarda**.

- **`types.ts`** — modelos del dominio como tipos TS (`Credentials`, `AuthToken`, ...).
  Son la lengua franca entre pantallas, use-cases y (a futuro) la capa de datos/API.
- **`use-cases/`** — una función por acción de negocio (`loginUser`, `registerUser`).
  Reciben tipos del dominio y devuelven `Promise<Resultado>`. Hoy están **mockeados**
  (simulan latencia y devuelven un token falso); cuando exista el backend, solo cambia
  el cuerpo del use-case, **no** las pantallas.

```ts
// features/auth/domain/use-cases/login-user.ts
import type { AuthToken, Credentials } from "../types";

export async function loginUser(_credentials: Credentials): Promise<AuthToken> {
  await new Promise((r) => setTimeout(r, 800)); // TODO: reemplazar por llamada real a la API
  return "mock-token-login";
}
```

La pantalla queda declarativa: valida → llama al use-case → persiste con el store.

```tsx
async function onSubmit(data: LoginForm) {
  const token = await loginUser(data); // caso de uso (dominio)
  await login(token);                   // store (persistencia)
  router.replace("/");
}
```

---

## 5. Barrels y API pública (`index.ts`)

Cada feature expone su superficie pública en `features/<feature>/index.ts`. El resto de
la app importa **desde el barrel**, no de rutas internas profundas.

```ts
// ✅ bien
import { LoginScreen, loginUser, useAuthStore } from "@/features/auth";
// ❌ evitar
import { LoginScreen } from "@/features/auth/screens/login-screen";
```

Esto permite mover archivos dentro de la feature sin romper a sus consumidores.

---

## 6. Convenciones de nombres

- Carpetas y archivos: **kebab-case** (`login-screen.tsx`, `auth.store.ts`).
- Pantallas: sufijo `-screen`, export **nombrado** (`export function LoginScreen()`),
  para que la ruta pueda hacer `export { LoginScreen as default }`.
- Use-cases: verbo-sustantivo (`login-user.ts` → `loginUser`).
- Esquemas Zod: `*.schema.ts`; tipos derivados con `z.infer`.
- Alias de import: `@/*` → `src/*` (ya configurado). Así `@/features/...` y
  `@/shared/...` funcionan sin alias adicionales.

---

## 7. Tests

Los tests viven en `__tests__/` **espejando** la estructura de `src/`:

```
__tests__/features/auth/domain/login-user.test.ts       # dominio (rápido, sin render)
__tests__/features/auth/validation/auth.schema.test.ts  # schema Zod
__tests__/features/auth/screens/login-screen.test.tsx   # pantalla (RN Testing Library)
```

El dominio es la capa más barata y valiosa de testear: funciones puras, sin UI ni
mocks de nativo. Ver `docs/patterns/forms-and-validation.md` para el patrón de tests de
pantalla.

---

## 8. Checklist para una feature nueva

- [ ] `src/features/<feature>/` con `screens/`, y `domain/` (`types.ts` + `use-cases/`)
      si tiene lógica de negocio.
- [ ] Estado propio en `stores/`, validación en `validation/*.schema.ts`.
- [ ] `index.ts` que exporte solo la API pública.
- [ ] Rutas en `app/` que reexporten las pantallas (delgadas).
- [ ] Nada de imports entre features; lo común va a `shared/`.
- [ ] Tests en `__tests__/features/<feature>/` espejando la estructura.
