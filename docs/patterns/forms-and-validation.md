# Patterns: Formularios y Validación

> Semana 3 — Formularios robustos con **React Hook Form** + **Zod**.

Esta guía documenta los patrones que usamos en ServiceHub para construir
formularios validados, con errores inline y persistencia de sesión. Los
ejemplos están tomados del código real de `src/app/(auth)/`.

---

## 1. Stack y responsabilidades

| Librería | Rol |
| --- | --- |
| **React Hook Form** | Estado del formulario, ciclo de submit, re-render mínimo |
| **Zod** | Esquema de validación type-safe (runtime + tipos) |
| **@hookform/resolvers/zod** | Puente entre el schema de Zod y RHF |
| **expo-secure-store** | Persistencia segura del token (login) |
| **Zustand** | Estado global de autenticación |

Regla de oro: **el schema de Zod es la única fuente de verdad**. De él salen
tanto la validación en runtime como los tipos de TypeScript (`z.infer`), así
nunca se desincronizan.

---

## 2. Definir el schema de validación

Los schemas viven en `src/lib/validation/`. Cada mensaje de error se declara
junto a su regla para mantenerlo cerca del contexto.

```ts
// src/lib/validation/auth.ts
import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const RegisterSchema = z
  .object({
    name: z.string().min(2, "Mínimo 2 caracteres"),
    email: z.email("Ingresa un correo válido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  // Validación cruzada entre campos: se ejecuta después de las reglas simples.
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"], // el error se asocia a este campo
  });

// Tipos derivados del schema — no se escriben a mano.
export type LoginForm = z.infer<typeof LoginSchema>;
export type RegisterForm = z.infer<typeof RegisterSchema>;
```

**Puntos clave**

- Usa `.refine()` (o `.superRefine()`) para validaciones que dependen de varios
  campos, como confirmar contraseña.
- `path: ["confirmPassword"]` hace que el error se muestre bajo el campo correcto.
- Exporta siempre el tipo con `z.infer<>` para tipar `useForm<T>()`.

---

## 3. Conectar el formulario con RHF + zodResolver

Patrón base de cualquier pantalla con formulario:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { LoginSchema, type LoginForm } from "@/lib/validation/auth";

const {
  control,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<LoginForm>({
  resolver: zodResolver(LoginSchema),
  defaultValues: { email: "", password: "" }, // siempre define defaults
});
```

- `defaultValues` evita inputs no controlados y warnings de React.
- `isSubmitting` se usa para el estado `loading` del botón.
- `errors.<campo>?.message` contiene el mensaje del schema de Zod.

---

## 4. Campos controlados con `<Controller>`

React Native no tiene inputs nativos del DOM, así que envolvemos cada campo con
`<Controller>` y lo conectamos a nuestro `<TextInput>` atómico.

```tsx
<Controller
  control={control}
  name="email"
  render={({ field: { onChange, onBlur, value } }) => (
    <TextInput
      label="Correo electrónico"
      placeholder="tu@correo.com"
      testID="login-email-input"
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={onChange}
      onBlur={onBlur}
      value={value}
      error={errors.email?.message} // error inline
    />
  )}
/>
```

**Convenciones**

- Mapea `field.onChange` → `onChangeText` (RN usa `onChangeText`, no `onChange`).
- Pasa siempre `onBlur` y `value` para que RHF controle el campo por completo.
- `error={errors.<campo>?.message}` pinta el mensaje debajo del input; el borde
  se pone rojo automáticamente (ver `src/components/ui/text-input.tsx`).
- Agrega `testID` a cada input y al botón de submit para poder testearlos.

---

## 5. Submit + persistencia del token

`handleSubmit` valida contra el schema **antes** de llamar a `onSubmit`. Si hay
errores, `onSubmit` no se ejecuta y `errors` se rellena.

```tsx
const { login } = useAuthStore();

async function onSubmit(_data: LoginForm) {
  await new Promise((r) => setTimeout(r, 800)); // simula latencia de red
  await login("mock-token-login");              // guarda token en SecureStore
  router.replace("/");
}

<Button
  label="Ingresar"
  testID="login-submit-button"
  loading={isSubmitting}
  onPress={handleSubmit(onSubmit)} // valida y luego ejecuta onSubmit
/>
```

El store persiste el token de forma segura:

```ts
// src/stores/auth.store.ts
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sh_auth_token";

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isHydrated: false,

  login: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token });
  },
  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null });
  },
  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    set({ token, isHydrated: true });
  },
}));
```

- `login` guarda el token y actualiza el estado global en un solo paso.
- `hydrate` se llama al arrancar la app para restaurar la sesión.
- Nunca guardes tokens en `AsyncStorage` en texto plano: usa `SecureStore`.

---

## 6. Testing de formularios

Los tests viven en `__tests__/`. Cubrimos tres niveles:

1. **Schema** (`__tests__/validation/auth.schema.test.ts`) — valida reglas de
   Zod aisladas, sin UI.
2. **Pantalla** (`__tests__/screens/*.test.tsx`) — render + interacción con RN
   Testing Library.
3. **Store** — mockeado en los tests de pantalla.

### 6.1 Test del schema (rápido, sin render)

```ts
import { LoginSchema } from "@/lib/validation/auth";

it("rejects invalid email", () => {
  const result = LoginSchema.safeParse({ email: "invalido", password: "123456" });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].message).toBe("Ingresa un correo válido");
  }
});
```

### 6.2 Test de pantalla (render + interacción)

Mockea el store para aislar la UI de la persistencia:

```tsx
const mockLogin = jest.fn();
jest.mock("@/stores/auth.store", () => ({
  useAuthStore: () => ({ login: mockLogin }),
}));
```

Muestra de error de validación. La validación de Zod es **asíncrona**, así que
envolvemos el `press` en `act(async ...)`:

```tsx
await act(async () => {
  fireEvent.press(submit);
});
expect(utils.getByText("Ingresa un correo válido")).toBeTruthy();
```

Cuando `onSubmit` usa `setTimeout`, controla el tiempo con fake timers:

```tsx
jest.useFakeTimers();
await act(async () => { fireEvent.press(submit); });
await act(async () => { jest.advanceTimersByTime(800); });
jest.useRealTimers();

expect(mockLogin).toHaveBeenCalledWith("mock-token-login");
```

### 6.3 Configuración de Jest

- Preset `jest-expo` (`jest.config.js`).
- Alias `@/` mapeado a `src/` vía `moduleNameMapper`.
- Mocks globales (`expo-router`, `safe-area-context`, `expo-symbols`) en
  `jest.setup.ts` para que cualquier pantalla renderice sin dependencias nativas.

---

## 7. Checklist para un nuevo formulario

- [ ] Definir el schema de Zod en `src/lib/validation/` + exportar `z.infer` type.
- [ ] `useForm<T>({ resolver: zodResolver(Schema), defaultValues })`.
- [ ] Un `<Controller>` por campo, mapeando `onChange → onChangeText`.
- [ ] `error={errors.<campo>?.message}` en cada input.
- [ ] `testID` en cada input y en el botón de submit.
- [ ] `loading={isSubmitting}` en el botón; `onPress={handleSubmit(onSubmit)}`.
- [ ] Test del schema + test de pantalla (render, error, submit válido).
