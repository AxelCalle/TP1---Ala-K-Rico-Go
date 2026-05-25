-- =============================================================================
-- SEMILLA: Roles, Funciones y usuario administrador inicial
-- Proyecto: Ala K' Rico GO
-- =============================================================================
-- Ejecutar una sola vez sobre la base de datos del proyecto.
-- Todos los INSERT están protegidos con IF NOT EXISTS para evitar duplicados.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ROLES (AKR_Roles)
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 1)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role)
    VALUES (1, 'Administrador', 'Acceso total al sistema', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 2)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role)
    VALUES (2, 'Repartidor', 'Portal de rutas y entregas', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM AKR_Roles WHERE Id_Role = 3)
    INSERT INTO AKR_Roles (Id_Role, Nombre_Role, Descripcion_Role, Activo_Role, Creacion_Role)
    VALUES (3, 'Cliente', 'Seguimiento de pedidos y perfil', 1, GETDATE());

-- ---------------------------------------------------------------------------
-- 2. FUNCIONES (AKR_Funciones)
-- ---------------------------------------------------------------------------
-- Administrador (Id_Role = 1)
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Pedidos')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (1, 'Pedidos', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Repartidores')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (1, 'Repartidores', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Reportes')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (1, 'Reportes', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 1 AND Modulo = 'Configuracion')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (1, 'Configuracion', 1);

-- Repartidor (Id_Role = 2)
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 2 AND Modulo = 'Rutas')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (2, 'Rutas', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 2 AND Modulo = 'Pedidos_Asignados')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (2, 'Pedidos_Asignados', 1);

-- Cliente (Id_Role = 3)
IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 3 AND Modulo = 'Seguimiento')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (3, 'Seguimiento', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 3 AND Modulo = 'Perfil')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (3, 'Perfil', 1);

IF NOT EXISTS (SELECT 1 FROM AKR_Funciones WHERE Id_Role = 3 AND Modulo = 'Historial_Pedidos')
    INSERT INTO AKR_Funciones (Id_Role, Modulo, Activo_Funcion) VALUES (3, 'Historial_Pedidos', 1);

-- ---------------------------------------------------------------------------
-- 3. USUARIO ADMINISTRADOR DE EJEMPLO (AKR_Usuarios)
-- ---------------------------------------------------------------------------
-- IMPORTANTE: La columna Contraseña_Usuario debe almacenarse hasheada con bcrypt.
--
-- OPCION A (recomendada): Usa la ruta POST /api/auth/register del backend
--   para crear este usuario. El backend hasheará la contraseña automáticamente.
--   Body de ejemplo:
--   {
--     "nombre":   "Administrador",
--     "apellido": "Sistema",
--     "email":    "admin@alakricogo.com",
--     "password": "Admin2024!",
--     "idRole":   1
--   }
--
-- OPCION B: Si necesitas insertarlo directo en SQL, primero genera el hash
--   ejecutando en Node.js:
--     import bcrypt from 'bcryptjs';
--     console.log(await bcrypt.hash('Admin2024!', 10));
--   Luego reemplaza <HASH_GENERADO> por el resultado y descomenta la siguiente consulta:
--
-- IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'admin@alakricogo.com')
--     INSERT INTO AKR_Usuarios
--         (Id_Roles, Nombre_Usuario, Apellido_Usuario, Email_Usuario,
--          Contraseña_Usuario, DNI_Usuario, Telf_Usuario,
--          Activo_Usuario, Creacion_Usuario)
--     VALUES
--         (1, 'Administrador', 'Sistema', 'admin@alakricogo.com',
--          '<HASH_GENERADO>', '00000000', '000000000',
--          1, GETDATE());
-- =============================================================================
