-- =============================================================================
-- SCRIPT: Limpiar pedidos de prueba y resetear numeración
-- Ejecutar en Azure SQL sobre ALAKRICO_GO_DB
-- PASO 1 primero (verificar), luego PASO 2 si está de acuerdo
-- =============================================================================

-- ─── PASO 1: Ver qué pedidos activos hay antes de borrar ──────────────────────
SELECT
    Id_Pedido,
    Estado,
    Direccion_Destino,
    Total,
    Creacion_Pedido,
    Nombre_Cliente = (SELECT Nombre_Usuario FROM AKR_Usuarios WHERE Id_Usuario = p.Id_Cliente)
FROM AKR_Pedidos p
WHERE Estado IN ('en_camino', 'asignado', 'sin_asignar')
ORDER BY Id_Pedido DESC;

-- ─── PASO 2A (opcional): Cancelar todos los activos si no se usó el botón del admin ──
/*
UPDATE AKR_Pedidos SET
    Estado             = 'cancelado',
    Cancelacion_Pedido = GETDATE()
WHERE Estado IN ('en_camino','asignado','sin_asignar');
*/

-- ─── PASO 2B: Eliminar TODOS los pedidos de prueba (irreversible) ─────────────
-- Solo si quieres borrar físicamente y reiniciar desde cero.
-- Las notificaciones e incidencias relacionadas se borran primero por FK.
/*
DELETE FROM AKR_Notificaciones WHERE Id_Pedido IS NOT NULL;
DELETE FROM AKR_Incidencias;
DELETE FROM AKR_Pedidos;
*/

-- ─── PASO 3: Resetear el contador IDENTITY ────────────────────────────────────
-- Después de borrar pedidos, el próximo INSERT empezará desde 1.
-- Si solo cancelaste (no borraste), el ID seguirá subiendo desde el último.
-- Cambia el segundo parámetro al número desde el que quieres empezar MENOS 1.
-- Ej: para que el próximo sea 1 → RESEED, 0
--     para que el próximo sea 100 → RESEED, 99
/*
DBCC CHECKIDENT ('AKR_Pedidos', RESEED, 0);
*/

-- ─── VERIFICAR resultado ──────────────────────────────────────────────────────
SELECT
    COUNT(*)                              AS total_pedidos,
    SUM(CASE WHEN Estado='cancelado'  THEN 1 ELSE 0 END) AS cancelados,
    SUM(CASE WHEN Estado='entregado'  THEN 1 ELSE 0 END) AS entregados,
    SUM(CASE WHEN Estado='en_camino'  THEN 1 ELSE 0 END) AS en_camino,
    SUM(CASE WHEN Estado='asignado'   THEN 1 ELSE 0 END) AS asignados,
    SUM(CASE WHEN Estado='sin_asignar' THEN 1 ELSE 0 END) AS sin_asignar,
    MAX(Id_Pedido)                        AS ultimo_id
FROM AKR_Pedidos;
