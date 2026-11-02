/**
 * Configuración del negocio (GET /api/config/negocio): ubicación del local,
 * dirección, nombre y radio de cobertura. Cada pyme la edita en Admin →
 * Configuración. Mientras carga (o sin backend) se usan los valores de
 * constants.ts, que son los mismos que la semilla de la base de datos.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, type NegocioApi } from "./api";
import { RADIO_COBERTURA_KM, RESTAURANTE_COORDS, RESTAURANTE_DIRECCION } from "./constants";

export const NEGOCIO_DEFECTO: NegocioApi = {
  nombre: "Ala K' Rico GO",
  direccion: RESTAURANTE_DIRECCION,
  lat: RESTAURANTE_COORDS[0],
  lng: RESTAURANTE_COORDS[1],
  radioKm: RADIO_COBERTURA_KM,
  telefono: null,
};

export const CLAVE_NEGOCIO = ["config-negocio"] as const;

export function useNegocio() {
  const q = useQuery({
    queryKey: CLAVE_NEGOCIO,
    queryFn: () => api.obtenerNegocio(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  // Objeto estable entre renders: los mapas lo usan como dependencia de efectos
  return useMemo(() => {
    const n = q.data ?? NEGOCIO_DEFECTO;
    return { ...n, coords: [n.lat, n.lng] as [number, number], cargado: !!q.data };
  }, [q.data]);
}
