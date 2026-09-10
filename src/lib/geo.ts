/** Geocodifica una dirección contra Nominatim + Photon (Lima, Perú). */
export async function geocodificarDireccion(dir: string): Promise<[number, number] | undefined> {
  const intentos = [
    dir.toLowerCase().includes("peru") || dir.toLowerCase().includes("perú")
      ? dir
      : `${dir}, Lima, Peru`,
    dir.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\b\d{4,5}\b/g, "").replace(/,\s*,/g, ",").trim() + ", Lima, Peru",
  ];

  for (const q of intentos) {
    try {
      const params = new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "pe" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "Accept-Language": "es" },
      });
      if (!res.ok) continue;
      const data: { lat: string; lon: string }[] = await res.json();
      if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch { /* siguiente intento */ }
  }

  try {
    const sinNum = dir.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b\d{4,5}\b/g, "").trim();
    const params = new URLSearchParams({ q: `${sinNum}, Lima, Peru`, limit: "1", lang: "es" });
    const res = await fetch(`https://photon.komoot.io/api?${params}&bbox=-77.5,-12.3,-76.7,-11.6`);
    if (res.ok) {
      const data: { features: { geometry: { coordinates: [number, number] } }[] } = await res.json();
      if (data.features?.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
    }
  } catch { /* sin coords */ }

  return undefined;
}
