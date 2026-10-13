/**
 * Mapa del recorrido GPS real de un repartidor (historial AKR_Recorrido):
 * la línea azul es por donde pasó; los pins verdes, las entregas del día.
 */
import { useEffect, useRef } from "react";
import type { RecorridoApi } from "@/lib/api";
import type { Coords } from "@/lib/gps";
import { tramosRecorrido } from "@/lib/recorrido";

const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, HERE, Garmin, © OpenStreetMap contributors';

function escaparHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

export function MapaRecorrido({
  recorrido,
  centro,
  altura = 360,
}: {
  recorrido: RecorridoApi;
  /** Centro si no hay puntos (p. ej. el local) */
  centro: Coords;
  altura?: number;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activo = true;
    let mapa: any = null;
    let observador: ResizeObserver | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!activo || !contenedorRef.current) return;
      mapa = L.map(contenedorRef.current).setView(centro, 14);
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(mapa);

      const limites: Coords[] = [];
      const tramos = tramosRecorrido(recorrido.puntos);
      for (const tramo of tramos) {
        L.polyline(tramo, { color: "#ffffff", weight: 8, opacity: 0.7 }).addTo(mapa);
        L.polyline(tramo, { color: "#2563eb", weight: 4, opacity: 0.95 }).addTo(mapa);
        limites.push(...tramo);
      }
      const primero = tramos[0]?.[0];
      const ultimo = tramos.at(-1)?.at(-1);
      if (primero) {
        L.circleMarker(primero, {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#16a34a",
          fillOpacity: 1,
        })
          .bindTooltip("Inicio del recorrido")
          .addTo(mapa);
      }
      if (ultimo) {
        L.circleMarker(ultimo, {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#dc2626",
          fillOpacity: 1,
        })
          .bindTooltip("Última posición")
          .addTo(mapa);
      }

      recorrido.entregas.forEach((e, i) => {
        const coords: Coords = [e.Lat_Destino, e.Lng_Destino];
        limites.push(coords);
        const cliente = `${e.Nombre_Cliente ?? ""} ${e.Apellido_Cliente ?? ""}`.trim();
        const hora = new Date(e.Entrega_Pedido).toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Lima",
        });
        L.marker(coords, {
          icon: L.divIcon({
            html: `<div class="akr-pin-wrap"><div class="akr-pin akr-pin--done"><span>${i + 1}</span></div></div>`,
            className: "",
            iconSize: [44, 52],
            iconAnchor: [22, 48],
          }),
          title: `Entrega ${i + 1}: pedido ${e.Id_Pedido}`,
        })
          .bindPopup(
            `<strong>Pedido #${e.Id_Pedido}</strong><br>${escaparHtml(cliente || "Cliente")}<br>${escaparHtml(e.Direccion_Destino ?? "")}<br>Entregado ${hora}`,
          )
          .addTo(mapa);
      });

      // Dentro de un diálogo el contenedor puede no tener tamaño todavía: se encuadra
      // cuando lo tiene y se recalcula el tamaño si cambia (rotación, ventana)
      const encuadre = limites.length ? L.latLngBounds(limites).pad(0.15) : null;
      let encuadrado = false;
      observador = new ResizeObserver(() => {
        const el = contenedorRef.current;
        if (!activo || !mapa || !el || el.clientWidth === 0 || el.clientHeight === 0) return;
        mapa.invalidateSize();
        if (!encuadrado && encuadre) {
          mapa.fitBounds(encuadre, { maxZoom: 17 });
          encuadrado = true;
        }
      });
      observador.observe(contenedorRef.current);
    })();
    return () => {
      activo = false;
      observador?.disconnect();
      mapa?.remove();
    };
  }, [recorrido, centro]);

  return (
    <div
      ref={contenedorRef}
      role="region"
      aria-label="Mapa del recorrido real del repartidor"
      className="isolate w-full overflow-hidden rounded-xl border border-border"
      style={{ height: altura }}
    />
  );
}
