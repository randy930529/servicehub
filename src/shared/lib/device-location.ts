import * as Location from "expo-location";

/**
 * Reading the device's position is platform I/O (permissions, GPS), so it lives
 * in `shared/lib` — the domain layer stays pure and never touches a sensor.
 */

export type Coordinates = {
  lat: number;
  lng: number;
};

export type DeviceLocationResult =
  | { status: "granted"; coordinates: Coordinates }
  | { status: "denied" }
  | { status: "unavailable" };

/**
 * Asks for foreground permission and returns the current position.
 *
 * The last known position is tried first: it comes back instantly, while a
 * fresh GPS fix can take several seconds indoors — and for a "servicios cerca
 * de mí" radius, a slightly stale position is more than accurate enough.
 */
export async function getCurrentCoordinates(): Promise<DeviceLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  try {
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({}));

    return {
      status: "granted",
      coordinates: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
    };
  } catch {
    // Location services off, no fix available, or the web geolocation prompt
    // was dismissed: all "we can't locate you", none of them fatal.
    return { status: "unavailable" };
  }
}
