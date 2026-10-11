const PREFERRED_CITIES = [
  "Anand",
  "Nadiad",
  "Ahmedabad",
  "Vadodara",
  "Surat",
  "Gandhinagar",
];

export function getPreferredStation<T extends { city?: string; station: string }>(
  stations: T[],
): T | undefined {
  for (const city of PREFERRED_CITIES) {
    const match = stations.find(
      (station) => station.city?.toLocaleLowerCase() === city.toLocaleLowerCase(),
    );
    if (match) return match;
  }
  return stations[0];
}

export function getNearestStation<
  T extends { latitude: number; longitude: number },
>(stations: T[], latitude: number, longitude: number): T | undefined {
  return stations.reduce<T | undefined>((nearest, station) => {
    const stationDistance = distanceInKm(
      latitude,
      longitude,
      station.latitude,
      station.longitude,
    );
    const nearestDistance = nearest
      ? distanceInKm(latitude, longitude, nearest.latitude, nearest.longitude)
      : Infinity;
    return stationDistance < nearestDistance ? station : nearest;
  }, undefined);
}

function distanceInKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude1)) *
      Math.cos(radians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
