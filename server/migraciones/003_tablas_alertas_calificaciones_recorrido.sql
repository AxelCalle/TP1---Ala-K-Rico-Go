-- ===========================================================================
-- Migración 003 — Tablas faltantes en Azure (incidencias 0002322 / 0002370)
-- AKR_Alertas_Admin, AKR_Calificaciones y AKR_Recorrido.
-- Idempotente: si una tabla ya existe no se toca.
-- ===========================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Calificaciones')
CREATE TABLE AKR_Calificaciones (
    Id_Calificacion INT           IDENTITY(1,1) PRIMARY KEY,
    Id_Pedido       INT           NOT NULL UNIQUE REFERENCES AKR_Pedidos(Id_Pedido),
    Id_Repartidor   INT           NOT NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Puntuacion      TINYINT       NOT NULL CHECK (Puntuacion BETWEEN 1 AND 5),
    Detalle         NVARCHAR(200) NULL,
    Creacion        DATETIME      NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Alertas_Admin')
CREATE TABLE AKR_Alertas_Admin (
    Id_Alerta   INT           IDENTITY(1,1) PRIMARY KEY,
    Tipo        NVARCHAR(60)  NOT NULL,
    Mensaje     NVARCHAR(500) NOT NULL,
    Datos       NVARCHAR(MAX) NULL,
    Leida       BIT           NOT NULL DEFAULT 0,
    Creacion    DATETIME      NOT NULL DEFAULT GETDATE()
);

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

-- Verificación: deben salir las 3 tablas
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('AKR_Alertas_Admin','AKR_Calificaciones','AKR_Recorrido');
