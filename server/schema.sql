-- =============================================================================
-- SCHEMA COMPLETO: Ala K' Rico GO
-- Ejecutar sobre ALAKRICO_GO_DB
-- Seguro de re-ejecutar (IF NOT EXISTS en cada tabla)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ROLES
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Roles')
CREATE TABLE AKR_Roles (
    Id_Role         SMALLINT        PRIMARY KEY,
    Nombre_Role     NVARCHAR(50)    NOT NULL,
    Descripcion_Role NVARCHAR(200)  NULL,
    Activo_Role     BIT             NOT NULL DEFAULT 1,
    Creacion_Role   DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ---------------------------------------------------------------------------
-- 2. FUNCIONES POR ROL
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Funciones')
CREATE TABLE AKR_Funciones (
    Id_Funcion      INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Role         SMALLINT        NOT NULL REFERENCES AKR_Roles(Id_Role),
    Modulo          NVARCHAR(60)    NOT NULL,
    Activo_Funcion  BIT             NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- 3. USUARIOS
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Usuarios')
CREATE TABLE AKR_Usuarios (
    Id_Usuario          INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Roles            SMALLINT        NOT NULL REFERENCES AKR_Roles(Id_Role),
    Nombre_Usuario      NVARCHAR(100)   NOT NULL,
    Apellido_Usuario    NVARCHAR(100)   NOT NULL DEFAULT '',
    Email_Usuario       NVARCHAR(150)   NOT NULL UNIQUE,
    Contraseña_Usuario  NVARCHAR(250)   NOT NULL,
    DNI_Usuario         NVARCHAR(9)     NULL,
    Telf_Usuario        NVARCHAR(9)     NULL,
    Activo_Usuario      BIT             NOT NULL DEFAULT 1,
    Creacion_Usuario    DATETIME        NOT NULL DEFAULT GETDATE(),
    Modificacion_Usuario DATETIME       NULL
);

-- ---------------------------------------------------------------------------
-- 4. PEDIDOS
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Pedidos')
CREATE TABLE AKR_Pedidos (
    Id_Pedido           INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Cliente          INT             NOT NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Id_Repartidor       INT             NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Estado              NVARCHAR(20)    NOT NULL DEFAULT 'sin_asignar'
                            CHECK (Estado IN ('sin_asignar','asignado','en_camino','entregado','cancelado')),
    -- Ubicación de recogida (restaurante / sede)
    Lat_Origen          FLOAT           NULL,
    Lng_Origen          FLOAT           NULL,
    -- Ubicación de entrega
    Lat_Destino         FLOAT           NOT NULL,
    Lng_Destino         FLOAT           NOT NULL,
    Direccion_Destino   NVARCHAR(300)   NOT NULL,
    -- Detalle del pedido (JSON serializado)
    Productos           NVARCHAR(MAX)   NULL,
    Total               DECIMAL(10,2)   NULL,
    -- Timestamps de ciclo de vida
    Creacion_Pedido     DATETIME        NOT NULL DEFAULT GETDATE(),
    Asignacion_Pedido   DATETIME        NULL,
    Entrega_Pedido      DATETIME        NULL,
    Cancelacion_Pedido  DATETIME        NULL
);

-- ---------------------------------------------------------------------------
-- 5. UBICACIONES GPS EN TIEMPO REAL (repartidores)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Ubicaciones')
CREATE TABLE AKR_Ubicaciones (
    Id_Repartidor   INT             PRIMARY KEY REFERENCES AKR_Usuarios(Id_Usuario),
    Lat             FLOAT           NOT NULL,
    Lng             FLOAT           NOT NULL,
    Actualizado     DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ---------------------------------------------------------------------------
-- 6. NOTIFICACIONES
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Notificaciones')
CREATE TABLE AKR_Notificaciones (
    Id_Notificacion INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Cliente      INT             NOT NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Tipo            NVARCHAR(30)    NOT NULL
                        CHECK (Tipo IN ('pedido_en_camino','entregado','cancelado','asignado','sistema')),
    Mensaje         NVARCHAR(300)   NOT NULL,
    Id_Pedido       INT             NULL REFERENCES AKR_Pedidos(Id_Pedido),
    Leida           BIT             NOT NULL DEFAULT 0,
    Creacion        DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ---------------------------------------------------------------------------
-- 7. INCIDENCIAS DEL REPARTIDOR
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Incidencias')
CREATE TABLE AKR_Incidencias (
    Id_Incidencia   INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Pedido       INT             NOT NULL REFERENCES AKR_Pedidos(Id_Pedido),
    Id_Repartidor   INT             NOT NULL REFERENCES AKR_Usuarios(Id_Usuario),
    Tipo            NVARCHAR(80)    NOT NULL,
    Detalle         NVARCHAR(500)   NULL,
    Creacion        DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ---------------------------------------------------------------------------
-- 8. CACHÉ DE GEOCODIFICACIÓN
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Geocache')
CREATE TABLE AKR_Geocache (
    Id_Cache        INT             IDENTITY(1,1) PRIMARY KEY,
    Query_Hash      NVARCHAR(64)    NOT NULL UNIQUE,
    Query_Original  NVARCHAR(300)   NOT NULL,
    Lat             FLOAT           NOT NULL,
    Lng             FLOAT           NOT NULL,
    Resultado       NVARCHAR(MAX)   NULL,
    Creacion        DATETIME        NOT NULL DEFAULT GETDATE(),
    Expiracion      DATETIME        NOT NULL
);

-- ---------------------------------------------------------------------------
-- 9. LOG DE AUDITORÍA
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_Auditoria')
CREATE TABLE AKR_Auditoria (
    Id_Log          INT             IDENTITY(1,1) PRIMARY KEY,
    Id_Usuario      INT             NULL,
    Email_Intento   NVARCHAR(150)   NULL,
    Evento          NVARCHAR(60)    NOT NULL,
    Detalle         NVARCHAR(500)   NULL,
    IP              NVARCHAR(45)    NULL,
    Timestamp       DATETIME        NOT NULL DEFAULT GETDATE()
);

-- ---------------------------------------------------------------------------
-- 10. CONFIGURACIÓN ACO
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AKR_ConfigACO')
CREATE TABLE AKR_ConfigACO (
    Clave   NVARCHAR(30)    PRIMARY KEY,
    Valor   FLOAT           NOT NULL
);

-- Valores por defecto del ACO
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'alfa')
    INSERT INTO AKR_ConfigACO VALUES ('alfa', 1.0);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'beta')
    INSERT INTO AKR_ConfigACO VALUES ('beta', 3.0);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'rho')
    INSERT INTO AKR_ConfigACO VALUES ('rho', 0.3);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'Q')
    INSERT INTO AKR_ConfigACO VALUES ('Q', 1.0);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'numAnts')
    INSERT INTO AKR_ConfigACO VALUES ('numAnts', 20);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'iterations')
    INSERT INTO AKR_ConfigACO VALUES ('iterations', 60);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'elite')
    INSERT INTO AKR_ConfigACO VALUES ('elite', 4);
IF NOT EXISTS (SELECT 1 FROM AKR_ConfigACO WHERE Clave = 'tauMin')
    INSERT INTO AKR_ConfigACO VALUES ('tauMin', 0.02);

-- =============================================================================
-- SEMILLA: Roles y usuario administrador
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 1)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role) VALUES (1, 'Administrador', 'Acceso total al sistema', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 2)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role) VALUES (2, 'Repartidor', 'Portal de rutas y entregas', 1, GETDATE());
IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 3)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role) VALUES (3, 'Cliente', 'Seguimiento de pedidos y perfil', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Pedidos')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (1, 'Pedidos');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Repartidores')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (1, 'Repartidores');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Reportes')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (1, 'Reportes');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Configuracion')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (1, 'Configuracion');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 2 AND Modulo = 'Rutas')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (2, 'Rutas');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 2 AND Modulo = 'Pedidos_Asignados')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (2, 'Pedidos_Asignados');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 3 AND Modulo = 'Seguimiento')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (3, 'Seguimiento');
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 3 AND Modulo = 'Historial_Pedidos')
    INSERT INTO AKR_Funciones (Id_Role, Modulo) VALUES (3, 'Historial_Pedidos');
