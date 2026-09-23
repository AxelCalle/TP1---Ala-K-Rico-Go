-- ═══════════════════════════════════════════════════════════════════════════
-- renumerar_ids.sql  ·  Renumeración secuencial AKR_Pedidos  ·  ALAKRICO_GO_DB
-- Ejecutar DESPUÉS de datos_reales.sql
--
-- QUÉ HACE:
--   Renumera todos los Id_Pedido de forma secuencial (1, 2, 3 ...) ordenados
--   por fecha de creación, eliminando los gaps (IDs 1, 84, 89 faltantes) y
--   actualizando en cascada las FKs de Notificaciones e Incidencias.
--
-- TABLAS AFECTADAS:
--   AKR_Pedidos          → PK renumerada
--   AKR_Notificaciones   → FK Id_Pedido actualizada (nullable)
--   AKR_Incidencias      → FK Id_Pedido actualizada (NOT NULL)
--
-- INSTRUCCIONES:
--   1. Ejecutar TODO el bloque
--   2. Revisar el SELECT de verificación final
--   3. Si todo está bien → ejecutar: COMMIT TRANSACTION;
--   4. Si algo falla    → ejecutar: ROLLBACK TRANSACTION;
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN TRANSACTION;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Tabla de mapeo old_id → new_id (orden cronológico)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE #MapeoIds (
    Id_Viejo INT PRIMARY KEY,
    Id_Nuevo INT NOT NULL
);

INSERT INTO #MapeoIds (Id_Viejo, Id_Nuevo)
SELECT
    Id_Pedido,
    ROW_NUMBER() OVER (ORDER BY Creacion_Pedido ASC, Id_Pedido ASC) AS Id_Nuevo
FROM AKR_Pedidos;

PRINT CONCAT('Paso 1: mapeo creado para ', @@ROWCOUNT, ' pedidos.');

-- Previsualizar el mapeo (primeros y últimos)
SELECT TOP 5 Id_Viejo, Id_Nuevo FROM #MapeoIds ORDER BY Id_Nuevo;
SELECT TOP 5 Id_Viejo, Id_Nuevo FROM #MapeoIds ORDER BY Id_Nuevo DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Desactivar FK constraints de tablas hijas
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE AKR_Notificaciones NOCHECK CONSTRAINT ALL;
ALTER TABLE AKR_Incidencias    NOCHECK CONSTRAINT ALL;

PRINT 'Paso 2: FK constraints desactivadas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Actualizar Id_Pedido en tablas hijas
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE n SET n.Id_Pedido = m.Id_Nuevo
FROM AKR_Notificaciones n
INNER JOIN #MapeoIds m ON m.Id_Viejo = n.Id_Pedido
WHERE n.Id_Pedido IS NOT NULL;

PRINT CONCAT('Paso 3a: ', @@ROWCOUNT, ' notificaciones actualizadas.');

UPDATE i SET i.Id_Pedido = m.Id_Nuevo
FROM AKR_Incidencias i
INNER JOIN #MapeoIds m ON m.Id_Viejo = i.Id_Pedido;

PRINT CONCAT('Paso 3b: ', @@ROWCOUNT, ' incidencias actualizadas.');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Copiar pedidos con nuevos IDs a tabla temporal
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    m.Id_Nuevo          AS Id_Pedido,
    p.Id_Cliente,
    p.Id_Repartidor,
    p.Estado,
    p.Lat_Origen,
    p.Lng_Origen,
    p.Lat_Destino,
    p.Lng_Destino,
    p.Direccion_Destino,
    p.Productos,
    p.Total,
    p.Creacion_Pedido,
    p.Asignacion_Pedido,
    p.Entrega_Pedido,
    p.Cancelacion_Pedido
INTO #PedidosRenumerados
FROM AKR_Pedidos p
INNER JOIN #MapeoIds m ON m.Id_Viejo = p.Id_Pedido;

PRINT CONCAT('Paso 4: ', @@ROWCOUNT, ' pedidos copiados a tabla temporal.');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 5: Vaciar tabla original y reinsertar con nuevos IDs
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM AKR_Pedidos;
PRINT 'Paso 5a: AKR_Pedidos vaciada.';

SET IDENTITY_INSERT AKR_Pedidos ON;

INSERT INTO AKR_Pedidos (
    Id_Pedido, Id_Cliente, Id_Repartidor, Estado,
    Lat_Origen, Lng_Origen,
    Lat_Destino, Lng_Destino, Direccion_Destino,
    Productos, Total,
    Creacion_Pedido, Asignacion_Pedido, Entrega_Pedido, Cancelacion_Pedido
)
SELECT
    Id_Pedido, Id_Cliente, Id_Repartidor, Estado,
    Lat_Origen, Lng_Origen,
    Lat_Destino, Lng_Destino, Direccion_Destino,
    Productos, Total,
    Creacion_Pedido, Asignacion_Pedido, Entrega_Pedido, Cancelacion_Pedido
FROM #PedidosRenumerados
ORDER BY Id_Pedido;

SET IDENTITY_INSERT AKR_Pedidos OFF;

PRINT CONCAT('Paso 5b: ', @@ROWCOUNT, ' pedidos reinsertados con IDs secuenciales.');

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 6: Reactivar FK constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE AKR_Notificaciones CHECK CONSTRAINT ALL;
ALTER TABLE AKR_Incidencias    CHECK CONSTRAINT ALL;

PRINT 'Paso 6: FK constraints reactivadas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 7: Reseed IDENTITY al valor máximo actual
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @maxId INT = (SELECT MAX(Id_Pedido) FROM AKR_Pedidos);
DBCC CHECKIDENT ('AKR_Pedidos', RESEED, @maxId);

PRINT CONCAT('Paso 7: IDENTITY reseed a ', @maxId, '. Próximo pedido → ', @maxId + 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    COUNT(*)        AS total_pedidos,
    MIN(Id_Pedido)  AS primer_id,     -- debe ser 1
    MAX(Id_Pedido)  AS ultimo_id,     -- debe ser igual a total_pedidos (sin gaps)
    COUNT(DISTINCT Id_Pedido) AS ids_unicos
FROM AKR_Pedidos;

-- Confirmar que no hay gaps
SELECT TOP 5 Id_Pedido, Estado, CONVERT(varchar(16), Creacion_Pedido, 120) AS Creacion
FROM AKR_Pedidos ORDER BY Id_Pedido;

SELECT TOP 5 Id_Pedido, Estado, CONVERT(varchar(16), Creacion_Pedido, 120) AS Creacion
FROM AKR_Pedidos ORDER BY Id_Pedido DESC;

DROP TABLE #MapeoIds;
DROP TABLE #PedidosRenumerados;

-- ► Si todo está bien:  COMMIT TRANSACTION;
-- ► Si algo falla:      ROLLBACK TRANSACTION;
