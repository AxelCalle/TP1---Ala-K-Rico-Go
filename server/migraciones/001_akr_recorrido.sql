-- ===========================================================================
-- Migración 001 — Historial GPS del repartidor (AKR_Recorrido)
-- Idempotente: se puede ejecutar varias veces. Ejecutar en Azure SQL ANTES de
-- desplegar el backend que la usa (Query editor del portal o sqlcmd).
-- El mismo bloque está en schema.sql para instalaciones nuevas.
-- ===========================================================================

-- Un punto por cada posición GPS recibida durante "Navegar con GPS".
-- AKR_Ubicaciones sigue guardando solo la última posición (seguimiento en vivo).
-- Id_Pedido no tiene FK a propósito: es un registro histórico y no debe
-- bloquear los scripts que vacían o renumeran AKR_Pedidos.
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Recorrido')
CREATE TABLE AKR_Recorrido (
    Id_Punto        BIGINT          IDENTITY(1,1) PRIMARY KEY,
    Id_Repartidor   INT             NOT NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Id_Pedido       INT             NULL,
    Lat             FLOAT           NOT NULL,
    Lng             FLOAT           NOT NULL,
    Precision_M     FLOAT           NULL,
    Fecha           DATETIME2(0)    NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AKR_Recorrido_Repartidor_Fecha')
CREATE INDEX IX_AKR_Recorrido_Repartidor_Fecha ON AKR_Recorrido (Id_Repartidor, Fecha);
