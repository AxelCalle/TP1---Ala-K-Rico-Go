-- ===========================================================================
-- Migración 002 — Configuración del negocio (AKR_ConfigNegocio)
-- Idempotente. Ejecutar en Azure SQL ANTES de desplegar el backend que la usa.
-- Si no se ejecuta, el backend sigue funcionando con los valores por defecto
-- (los mismos de la semilla) y el PUT de configuración responde 503.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 13. CONFIGURACIÓN DEL NEGOCIO (una fila: cada pyme tiene su propia instalación)
-- Ubicación del local (origen de las rutas ACO), dirección y radio de cobertura.
-- Editable solo por el administrador (PUT /api/config/negocio).
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_ConfigNegocio')
CREATE TABLE AKR_ConfigNegocio (
    Id              TINYINT         NOT NULL PRIMARY KEY CHECK (Id = 1),
    Nombre_Local    NVARCHAR(100)   NOT NULL,
    Direccion       NVARCHAR(300)   NOT NULL,
    Lat             FLOAT           NOT NULL CHECK (Lat BETWEEN -90 AND 90),
    Lng             FLOAT           NOT NULL CHECK (Lng BETWEEN -180 AND 180),
    Radio_Km        FLOAT           NOT NULL CHECK (Radio_Km > 0 AND Radio_Km <= 50),
    Telefono        NVARCHAR(20)    NULL,
    Modificacion    DATETIME2(0)    NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Teléfono del local (botón "Llamar al restaurante"); para bases creadas antes de este campo
IF COL_LENGTH('AKR_ConfigNegocio', 'Telefono') IS NULL
    ALTER TABLE AKR_ConfigNegocio ADD Telefono NVARCHAR(20) NULL;

-- Valores con los que operaba el sistema (Ala K' Rico GO, San Martín de Porres)
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigNegocio WHERE Id = 1)
    INSERT INTO AKR_ConfigNegocio (Id, Nombre_Local, Direccion, Lat, Lng, Radio_Km)
    VALUES (1, N'Ala K'' Rico GO', N'Jr. Áncash 3855, San Martín de Porres 15101 Lima Perú', -12.0278455, -77.0895871, 3);
