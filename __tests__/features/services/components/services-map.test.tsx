import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

import { ServicesMap } from "@/features/services/components/services-map";
import type { Service } from "@/features/services/domain/types";

function buildService(overrides: Partial<Service> = {}): Service {
  return {
    id: "s1",
    name: "Limpieza de hogar",
    description: "Limpieza profunda",
    category: "hogar",
    priceFromCents: 45000,
    rating: 4.5,
    ratingAverage: 4.5,
    reviewCount: 3,
    providerName: "Clean Co",
    imageUrl: null,
    ownerId: null,
    location: { lat: 20.6736, lng: -103.344 },
    ...overrides,
  };
}

const CENTER = { lat: 20.6597, lng: -103.3496 };

describe("ServicesMap", () => {
  test("drops a marker per service that has coordinates", async () => {
    const { getByTestId } = await render(
      <ServicesMap
        services={[
          buildService({ id: "a" }),
          buildService({ id: "b", location: { lat: 20.7, lng: -103.3 } }),
        ]}
        center={CENTER}
        radiusKm={5}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );

    expect(getByTestId("services-map-marker-a")).toBeTruthy();
    expect(getByTestId("services-map-marker-b")).toBeTruthy();
  });

  test("skips services without a location instead of pinning them at 0,0", async () => {
    const { queryByTestId } = await render(
      <ServicesMap
        services={[buildService({ id: "a" }), buildService({ id: "b", location: null })]}
        center={CENTER}
        radiusKm={5}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );

    expect(queryByTestId("services-map-marker-a")).toBeTruthy();
    // Null Island is off the coast of Ghana; a pin there is always a bug.
    expect(queryByTestId("services-map-marker-b")).toBeNull();
  });

  test("reports the tapped service so the list can follow", async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(
      <ServicesMap
        services={[buildService({ id: "a" })]}
        center={CENTER}
        radiusKm={5}
        selectedId={null}
        onSelect={onSelect}
      />,
    );

    await fireEvent.press(getByTestId("services-map-marker-a"));

    expect(onSelect).toHaveBeenCalledWith("a");
  });

  test("falls back to the first result when the device location is unknown", async () => {
    // Denying location must not leave the map framed on the ocean.
    const { getByTestId } = await render(
      <ServicesMap
        services={[buildService({ id: "a" })]}
        center={null}
        radiusKm={null}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );

    expect(getByTestId("services-map")).toBeTruthy();
  });

  test("explains an empty map instead of rendering a blank one", async () => {
    const { getByTestId, queryByTestId } = await render(
      <ServicesMap
        services={[buildService({ id: "a", location: null })]}
        center={null}
        radiusKm={null}
        selectedId={null}
        onSelect={jest.fn()}
      />,
    );

    expect(getByTestId("services-map-empty")).toBeTruthy();
    expect(queryByTestId("services-map")).toBeNull();
  });
});
