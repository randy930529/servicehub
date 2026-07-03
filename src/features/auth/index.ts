// Public API of the auth feature. Import from here, not from internal paths.

// Screens
export { LoginScreen } from "./screens/login-screen";
export { RegisterScreen } from "./screens/register-screen";
export { OnboardingScreen } from "./screens/onboarding-screen";

// State
export { useAuthStore } from "./stores/auth.store";

// Domain (types + use-cases)
export * from "./domain";

// Validation
export {
  LoginSchema,
  RegisterSchema,
  type LoginForm,
  type RegisterForm,
} from "./validation/auth.schema";
