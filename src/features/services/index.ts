// Public API of the services feature.

// Screens
export { CatalogScreen } from "./screens/catalog-screen";
export { MyServicesScreen } from "./screens/my-services-screen";
export { ServiceFormScreen } from "./screens/service-form-screen";

// Components
export { FilterChip } from "./components/filter-chip";
export { SearchBar } from "./components/search-bar";
export { ServiceCard } from "./components/service-card";
export { ServiceFiltersBar } from "./components/service-filters-bar";
export { ServicesMap } from "./components/services-map";
export { ViewModeToggle, type ViewMode } from "./components/view-mode-toggle";

// Queries
export { servicesKeys } from "./queries/keys";
export {
  useCreateServiceMutation,
  useDeleteServiceMutation,
  useUpdateServiceMutation,
  useUploadServiceImageMutation,
} from "./queries/use-service-mutations";
export { useServiceQuery } from "./queries/use-service-query";
export { useServicesQuery } from "./queries/use-services-query";

// Domain (types + use-cases)
export * from "./domain";

// Validation
export {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_VALUES,
  ServiceSchema,
  centsToPrice,
  priceToCents,
  type ServiceForm,
} from "./validation/service.schema";
