/**
 * Módulo ACO — Ant Colony Optimization para routing de delivery en moto
 * Variante: ACS (Ant Colony System) con refuerzo elitista y piso de feromona.
 *
 * Arquitectura del módulo:
 *   1. construirGrafo()  — genera un grafo urbano reproducible y siempre conexo
 *   2. ejecutarACO()     — corre el algoritmo y devuelve la ruta óptima encontrada
 *
 * Basado en: Dorigo & Gambardella (1997), "Ant Colony System".
 */

// ─── Constantes de dominio ────────────────────────────────────────────────────

/** Escala grafo normalizado (0..1) → km. Calibrado para SMP, Lima (~2–6 km). */
export const KM_SCALE = 5;

/** Velocidad promedio de moto en zona urbana de Lima con tráfico (km/h). */
export const MOTO_KMH = 25;

export function calcularETA(km: number): number {
  return Math.max(1, Math.round((km / MOTO_KMH) * 60));
}

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface AcoNode {
  id: number;
  x: number; // normalizado 0..1
  y: number; // normalizado 0..1
  label?: string;
}

export interface AcoEdge {
  from: number;
  to: number;
  distance: number;
}

export interface AcoGraph {
  nodes: AcoNode[];
  edges: AcoEdge[];
  adj: Map<number, number[]>; // lista de adyacencia — siempre consistente con edges
}

export interface AcoResult {
  path: number[];       // IDs de nodos en orden
  distanceKm: number;
  etaMin: number;
  pheromones: Map<string, number>;
  iterations: number;
}

// ─── Parámetros del algoritmo ─────────────────────────────────────────────────

interface AcoParams {
  numAnts: number;
  iterations: number;
  alpha: number;    // exponente de feromona τ^α
  beta: number;     // exponente heurístico  η^β = (1/d)^β
  rho: number;      // tasa de evaporación (0..1)
  Q: number;        // constante de depósito de feromona
  elite: number;    // refuerzo extra para la mejor ruta global
  tauMin: number;   // piso mínimo de feromona (evita estagnación)
}

/**
 * Parámetros calibrados para grafos pequeños de reparto urbano:
 * - beta=3 favorece aristas cortas fuertemente → rutas más directas
 * - tauMin=0.02 evita que aristas queden con feromona ≈ 0 y pierdan exploración
 * - elite=4 refuerza la mejor solución global para convergencia rápida
 */
const PARAMS: AcoParams = {
  numAnts: 20,
  iterations: 60,
  alpha: 1.0,
  beta: 3.0,
  rho: 0.3,
  Q: 1.0,
  elite: 4,
  tauMin: 0.02,
};

// ─── Utilidades internas ──────────────────────────────────────────────────────

/** PRNG determinístico Mulberry32 — mismo seed ⇒ mismo grafo siempre */
function prng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function euclidean(a: AcoNode, b: AcoNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Clave canónica para una arista sin importar la dirección */
function eid(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Construye la lista de adyacencia desde cero a partir del arreglo de aristas */
function buildAdj(nodes: AcoNode[], edges: AcoEdge[]): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  });
  return adj;
}

/** BFS — devuelve el conjunto de nodos alcanzables desde `start` */
function reachable(start: number, adj: Map<number, number[]>): Set<number> {
  const visited = new Set<number>();
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    (adj.get(cur) ?? []).forEach((v) => queue.push(v));
  }
  return visited;
}

// ─── Construcción del grafo ───────────────────────────────────────────────────

/**
 * Genera un grafo de ciudad reproducible con conectividad garantizada A→B.
 *
 * Estrategia de construcción en tres capas:
 *   1. Camino base: A → nodos intermedios ordenados por X → B
 *      Garantiza que siempre exista al menos un camino válido.
 *   2. Aristas de proximidad: conecta nodos cercanos (simula calles del barrio).
 *      Añade rutas alternativas para que el ACO tenga qué optimizar.
 *   3. Verificación final con BFS: si aún hubiera componentes desconectados
 *      (no debería ocurrir), se añaden puentes adicionales.
 *
 * El mismo `semillaStr` (ID de pedido) siempre produce el mismo grafo.
 */
export function construirGrafo(semillaStr: string, numNodos = 16): AcoGraph {
  const rng = prng(hashStr(semillaStr));

  // Nodos fijos: A a la izquierda, B a la derecha
  const nodes: AcoNode[] = [
    { id: 0, x: 0.05, y: 0.50, label: "A" },
    { id: 1, x: 0.95, y: 0.50, label: "B" },
  ];

  // Nodos intermedios: distribuidos progresivamente de izquierda a derecha
  // con ruido vertical. La distribución progresiva asegura que el camino
  // base (por orden de X) sea natural y no cruce en zigzag.
  for (let i = 2; i < numNodos; i++) {
    const t = (i - 1) / (numNodos - 1);          // progreso 0..1
    const xBase = 0.10 + t * 0.80;               // columna base
    const xNoise = (rng() - 0.5) * 0.12;         // ruido horizontal pequeño
    nodes.push({
      id: i,
      x: Math.max(0.08, Math.min(0.92, xBase + xNoise)),
      y: 0.08 + rng() * 0.84,
    });
  }

  // Reordenar intermedios por X y reasignar IDs para que node[k].id === k siempre
  const intermedios = nodes.slice(2).sort((a, b) => a.x - b.x);
  intermedios.forEach((n, i) => {
    n.id = i + 2;
    nodes[i + 2] = n;
  });

  const seen = new Set<string>();
  const edges: AcoEdge[] = [];

  const addEdge = (i: number, j: number) => {
    if (i === j) return;
    const k = eid(i, j);
    if (!seen.has(k)) {
      seen.add(k);
      edges.push({ from: i, to: j, distance: euclidean(nodes[i], nodes[j]) });
    }
  };

  // Capa 1 — camino base garantizado (backbone)
  const backbone = [0, ...intermedios.map((n) => n.id), 1];
  for (let i = 0; i < backbone.length - 1; i++) addEdge(backbone[i], backbone[i + 1]);

  // Capa 2 — aristas de proximidad (rutas alternativas para el ACO)
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (euclidean(nodes[i], nodes[j]) < 0.33) addEdge(i, j);

  // Construir adj inicial
  let adj = buildAdj(nodes, edges);

  // Capa 3 — verificación de conectividad (defensa en profundidad)
  // En condiciones normales nunca se activa porque el backbone ya lo garantiza.
  const alcanzables = reachable(0, adj);
  if (!alcanzables.has(1)) {
    // Conectar el componente de A con el componente de B usando el nodo más cercano
    const enA = [...alcanzables];
    const enB = nodes.map((n) => n.id).filter((id) => !alcanzables.has(id));
    let minDist = Infinity, puente: [number, number] = [0, 1];
    for (const a of enA)
      for (const b of enB) {
        const d = euclidean(nodes[a], nodes[b]);
        if (d < minDist) { minDist = d; puente = [a, b]; }
      }
    addEdge(puente[0], puente[1]);
    adj = buildAdj(nodes, edges); // reconstruir adj limpio
  }

  return { nodes, edges, adj };
}

// ─── Algoritmo ACS con elitismo y piso de feromona ───────────────────────────

/**
 * Ejecuta el Ant Colony System y devuelve la ruta más corta encontrada de A a B.
 *
 * Cada iteración sigue tres fases:
 *   1. Construcción: cada hormiga recorre el grafo de A a B eligiendo el
 *      siguiente nodo con probabilidad ∝ τ^α · η^β (feromona × heurística).
 *   2. Evaporación: todas las feromonas se reducen por factor (1-ρ).
 *   3. Depósito: hormigas exitosas refuerzan su camino (Δτ = Q/distancia).
 *      La mejor ruta global recibe refuerzo extra (×elite) cada iteración.
 *
 * El piso τ_min evita que aristas prometedoras queden sin exploración.
 *
 * @returns AcoResult con ruta, distancia en km y ETA en moto, o null si el grafo
 *          no tiene solución (no debería ocurrir con construirGrafo).
 */
export function ejecutarACO(
  grafo: AcoGraph,
  params: Partial<AcoParams> = {},
): AcoResult | null {
  const p: AcoParams = { ...PARAMS, ...params };
  const { nodes, edges, adj } = grafo;

  // Inicializar mapas de feromona y distancia con acceso O(1)
  const tau = new Map<string, number>();   // feromona por arista
  const dist = new Map<string, number>();  // distancia por arista
  for (const e of edges) {
    const k = eid(e.from, e.to);
    tau.set(k, 1.0);
    dist.set(k, e.distance);
  }

  let bestPath: number[] = [];
  let bestDist = Infinity;

  // ── Bucle principal ───────────────────────────────────────────────────────────
  for (let iter = 0; iter < p.iterations; iter++) {

    // ── Fase 1: Construcción de caminos ──────────────────────────────────────
    const solutions: { path: number[]; cost: number }[] = [];

    for (let a = 0; a < p.numAnts; a++) {
      const visited = new Set<number>([0]);
      const path: number[] = [0];
      let cur = 0;
      let cost = 0;
      // maxSteps = total de nodos + margen para que la hormiga nunca quede
      // atrapada en una rama sin salida antes de explorar otros vecinos
      const maxSteps = nodes.length + 5;

      for (let step = 0; step < maxSteps; step++) {
        if (cur === 1) break;

        const neighbors = (adj.get(cur) ?? []).filter((n) => !visited.has(n));
        if (neighbors.length === 0) break; // callejón sin salida

        // Calcular score de atracción para cada vecino: τ^α · (1/d)^β
        const scores: number[] = neighbors.map((n) => {
          const t = tau.get(eid(cur, n)) ?? p.tauMin;
          const d = dist.get(eid(cur, n)) ?? 1;
          const eta = d > 0 ? 1 / d : 1;
          return Math.pow(t, p.alpha) * Math.pow(eta, p.beta);
        });

        // Selección por ruleta con guard para suma=0 (distribución uniforme)
        const total = scores.reduce((s, v) => s + v, 0);
        let next: number;
        if (total === 0) {
          // Todos los scores son 0: elegir uniformemente
          next = neighbors[Math.floor(Math.random() * neighbors.length)];
        } else {
          let r = Math.random() * total;
          next = neighbors[neighbors.length - 1]; // fallback al último
          for (let i = 0; i < neighbors.length; i++) {
            r -= scores[i];
            if (r <= 0) { next = neighbors[i]; break; }
          }
        }

        cost += dist.get(eid(cur, next)) ?? 0;
        visited.add(next);
        path.push(next);
        cur = next;
      }

      // Solo registrar soluciones que llegaron a B
      if (cur === 1 && cost > 0) {
        solutions.push({ path, cost });
        if (cost < bestDist) {
          bestDist = cost;
          bestPath = [...path];
        }
      }
    }

    // ── Fase 2: Evaporación global ────────────────────────────────────────────
    for (const [k, v] of tau) {
      tau.set(k, Math.max(p.tauMin, v * (1 - p.rho)));
    }

    // ── Fase 3a: Depósito estándar (todas las hormigas exitosas) ──────────────
    for (const { path, cost } of solutions) {
      const deposit = p.Q / cost;
      for (let i = 0; i < path.length - 1; i++) {
        const k = eid(path[i], path[i + 1]);
        tau.set(k, Math.max(p.tauMin, (tau.get(k) ?? p.tauMin) + deposit));
      }
    }

    // ── Fase 3b: Depósito elitista (mejor ruta global, cada iteración) ────────
    if (bestPath.length > 1) {
      const eliteDeposit = (p.elite * p.Q) / bestDist;
      for (let i = 0; i < bestPath.length - 1; i++) {
        const k = eid(bestPath[i], bestPath[i + 1]);
        tau.set(k, Math.max(p.tauMin, (tau.get(k) ?? p.tauMin) + eliteDeposit));
      }
    }
  }

  if (bestPath.length === 0) return null;

  const distanceKm = parseFloat((bestDist * KM_SCALE).toFixed(1));

  return {
    path: bestPath,
    distanceKm,
    etaMin: calcularETA(distanceKm),
    pheromones: tau,
    iterations: p.iterations,
  };
}

