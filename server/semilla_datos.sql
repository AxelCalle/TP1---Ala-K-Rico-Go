-- =============================================================================
-- SEMILLA DE DATOS: Ala K' Rico GO
-- 3 repartidores | 15 clientes app | 90 pedidos (pedidos WhatsApp con Id_Cliente NULL)
-- Rango: 01 ago 2026 – 15 sep 2026
-- =============================================================================
-- ANTES DE EJECUTAR:
--   1. Genera el hash bcrypt de "1234" en Node.js:
--        node -e "require('bcryptjs').hash('1234',10).then(h=>console.log(h))"
--   2. Reemplaza el valor de @hash con el resultado (empieza con $2b$10$...).
--   3. Ejecutar una sola vez — los pedidos NO tienen protección de duplicados.
-- =============================================================================

DECLARE @hash NVARCHAR(250) = N'$2a$10$a.lwSOddjOq8ltWoKGKUbeOyTdhSELDTYfQec5uAmldXdIB6mfuRe';

-- ============================================================
-- REPARTIDORES (Id_Roles = 2)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'carlos.huaman@alakricogo.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (2,'Carlos','Huamán Quispe','carlos.huaman@alakricogo.com',@hash,'45123601','912345601',1,'2026-07-10 09:00:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'miguel.flores@alakricogo.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (2,'Miguel','Flores Mendoza','miguel.flores@alakricogo.com',@hash,'52987402','923456702',1,'2026-07-10 09:05:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'josue.ramirez@alakricogo.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (2,'Josué','Ramírez Torres','josue.ramirez@alakricogo.com',@hash,'63854203','934567803',1,'2026-07-15 09:10:00');

-- ============================================================
-- CLIENTES CON CUENTA APP (Id_Roles = 3) — 15 usuarios
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'ana.garcia@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Ana','García López','ana.garcia@gmail.com',@hash,'45678901','987123456',1,'2026-07-20 10:00:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'luis.perez@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Luis','Pérez Ríos','luis.perez@gmail.com',@hash,'52345678','976234567',1,'2026-07-21 11:30:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'maria.torres@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'María','Torres Vega','maria.torres@gmail.com',@hash,'63456789','965345678',1,'2026-07-22 09:15:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'carlos.ruiz@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Carlos','Ruiz Castro','carlos.ruiz@gmail.com',@hash,'74567890','954456789',1,'2026-07-22 14:00:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'sofia.mendoza@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Sofía','Mendoza Lima','sofia.mendoza@gmail.com',@hash,'85678901','943567890',1,'2026-07-23 16:45:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'diego.vargas@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Diego','Vargas Soto','diego.vargas@gmail.com',@hash,'96789012','932678901',1,'2026-07-24 10:20:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'valeria.chavez@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Valeria','Chávez Mora','valeria.chavez@gmail.com',@hash,'07890123','921789012',1,'2026-07-25 12:00:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'andres.salinas@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Andrés','Salinas Cruz','andres.salinas@gmail.com',@hash,'18901234','910890123',1,'2026-07-26 08:50:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'camila.rojas@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Camila','Rojas Fuentes','camila.rojas@gmail.com',@hash,'29012345','999901234',1,'2026-07-27 17:30:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'sebastian.lara@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Sebastián','Lara Pinto','sebastian.lara@gmail.com',@hash,'30123456','988012345',1,'2026-07-28 11:00:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'isabella.morales@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Isabella','Morales Díaz','isabella.morales@gmail.com',@hash,'41234567','977123456',1,'2026-07-29 09:45:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'mateo.gutierrez@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Mateo','Gutiérrez Alba','mateo.gutierrez@gmail.com',@hash,'52345679','966234567',1,'2026-07-30 14:20:00');

IF NOT EXISTS (SELECT 1 FROM AKR_Usuarios WHERE Email_Usuario = 'lucia.fernandez@gmail.com')
    INSERT INTO AKR_Usuarios (Id_Roles,Nombre_Usuario,Apellido_Usuario,Email_Usuario,Contraseña_Usuario,DNI_Usuario,Telf_Usuario,Activo_Usuario,Creacion_Usuario)
    VALUES (3,'Lucía','Fernández Vera','lucia.fernandez@gmail.com',@hash,'63456780','955345678',1,'2026-07-31 10:10:00');

-- Pedidos vía WhatsApp: Id_Cliente = NULL, datos del cliente en JSON Productos

-- ============================================================
-- PEDIDOS (90 total)
-- Estado: 78 entregado | 5 cancelado | 4 en_camino | 2 asignado | 1 sin_asignar
-- Origen siempre: Jr. Áncash 3855, SMP (-12.0278455, -77.0895871)
-- ============================================================

-- === SEMANA 1: Aug 1-6 (10 entregado) ===

-- Aug 1
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='ana.garcia@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0312,-77.0756,'Jr. Huiracocha 142, San Martín de Porres 15102','[{"nombre":"8 alitas - Buffalo","cliente":"Ana García","telefono":"987123456","notas":""}]',22.00,'2026-08-01 12:00:00','2026-08-01 12:18:00','2026-08-01 13:05:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='luis.perez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 1250, San Martín de Porres 15103','[{"nombre":"10 alitas - BBQ","cliente":"Luis Pérez","telefono":"976234567","notas":""}]',26.00,'2026-08-01 18:30:00','2026-08-01 18:50:00','2026-08-01 19:38:00',NULL);

-- Aug 2
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='maria.torres@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 456, San Martín de Porres 15102','[{"nombre":"6 alitas - Ranch","cliente":"María Torres","telefono":"965345678","notas":"Sin picante por favor"}]',18.00,'2026-08-02 13:15:00','2026-08-02 13:35:00','2026-08-02 14:22:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 310, San Martín de Porres 15102','[{"nombre":"12 alitas - Mango Habanero","cliente":"Javier Mamani","telefono":"987600001","notas":""}]',30.00,'2026-08-02 19:00:00','2026-08-02 19:20:00','2026-08-02 20:10:00',NULL);

-- Aug 3
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sofia.mendoza@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 321, San Martín de Porres 15102','[{"nombre":"8 alitas - Ajo","cliente":"Sofía Mendoza","telefono":"943567890","notas":""}]',22.00,'2026-08-03 12:30:00','2026-08-03 12:50:00','2026-08-03 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 450, San Martín de Porres 15102','[{"nombre":"10 alitas - Buffalo","cliente":"Rosa Condori","telefono":"976600002","notas":"Extra napkins"}]',26.00,'2026-08-03 19:45:00','2026-08-03 20:05:00','2026-08-03 20:55:00',NULL);

-- Aug 4
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='diego.vargas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 654, San Martín de Porres 15103','[{"nombre":"15 alitas - Buffalo","cliente":"Diego Vargas","telefono":"932678901","notas":""}]',36.00,'2026-08-04 13:00:00','2026-08-04 13:22:00','2026-08-04 14:15:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valeria.chavez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 2100, San Martín de Porres 15106','[{"nombre":"8 alitas - Teriyaki","cliente":"Valeria Chávez","telefono":"921789012","notas":""}]',22.00,'2026-08-04 17:45:00','2026-08-04 18:05:00','2026-08-04 18:55:00',NULL);

-- Aug 5
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='andres.salinas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 987, San Martín de Porres 15104','[{"nombre":"10 alitas - Mostaza Miel","cliente":"Andrés Salinas","telefono":"910890123","notas":""}]',26.00,'2026-08-05 12:00:00','2026-08-05 12:20:00','2026-08-05 13:10:00',NULL);

-- Aug 6
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"6 alitas - Picante Extremo","cliente":"Camila Rojas","telefono":"999901234","notas":"Extra salsa"}]',18.00,'2026-08-06 19:30:00','2026-08-06 19:50:00','2026-08-06 20:40:00',NULL);

-- === SEMANA 2: Aug 7-13 (12 entregado + 1 cancelado) ===

-- Aug 7 (viernes)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sebastian.lara@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0445,-77.0756,'Jr. Los Jazmines 567, San Martín de Porres 15105','[{"nombre":"10 alitas - BBQ","cliente":"Sebastián Lara","telefono":"988012345","notas":""}]',26.00,'2026-08-07 12:00:00','2026-08-07 12:18:00','2026-08-07 13:08:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='isabella.morales@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 890, San Martín de Porres 15106','[{"nombre":"8 alitas - Mango Habanero","cliente":"Isabella Morales","telefono":"977123456","notas":""}]',22.00,'2026-08-07 19:00:00','2026-08-07 19:20:00','2026-08-07 20:12:00',NULL);

-- Aug 8 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='mateo.gutierrez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0212,-77.0956,'Jr. Los Cipreses 123, San Martín de Porres 15103','[{"nombre":"12 alitas - Buffalo","cliente":"Mateo Gutiérrez","telefono":"966234567","notas":""}]',30.00,'2026-08-08 13:30:00','2026-08-08 13:48:00','2026-08-08 14:40:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='lucia.fernandez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 456, San Martín de Porres 15107','[{"nombre":"8 alitas - Ajo","cliente":"Lucía Fernández","telefono":"955345678","notas":"Bien caliente"}]',22.00,'2026-08-08 17:00:00','2026-08-08 17:22:00','2026-08-08 18:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='ana.garcia@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0312,-77.0756,'Jr. Huiracocha 142, San Martín de Porres 15102','[{"nombre":"10 alitas - Buffalo","cliente":"Ana García","telefono":"987123456","notas":""}]',26.00,'2026-08-08 20:00:00','2026-08-08 20:18:00','2026-08-08 21:10:00',NULL);

-- Aug 9 (domingo)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 1850, San Martín de Porres 15106','[{"nombre":"8 alitas - BBQ","cliente":"Eduardo Ccallo","telefono":"965600003","notas":""}]',22.00,'2026-08-09 12:45:00','2026-08-09 13:05:00','2026-08-09 13:58:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.ruiz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 789, San Martín de Porres 15104','[{"nombre":"6 alitas - Ranch","cliente":"Carlos Ruiz","telefono":"954456789","notas":""}]',18.00,'2026-08-09 18:30:00','2026-08-09 18:50:00','2026-08-09 19:42:00',NULL);

-- Aug 10
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 980, San Martín de Porres 15103','[{"nombre":"10 alitas - Teriyaki","cliente":"Patricia Ttito","telefono":"954600004","notas":""}]',26.00,'2026-08-10 19:00:00','2026-08-10 19:20:00','2026-08-10 20:15:00',NULL);

-- Aug 11
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='pablo.ramos@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0289,-77.1045,'Jr. Los Rosales 789, San Martín de Porres 15104','[{"nombre":"8 alitas - Mango Habanero","cliente":"Pablo Ramos","telefono":"944456789","notas":""}]',22.00,'2026-08-11 13:00:00','2026-08-11 13:18:00','2026-08-11 14:10:00',NULL);

-- Aug 12 (cancelado + entregado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,NULL,'cancelado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 178, San Martín de Porres 15102','[{"nombre":"8 alitas - Buffalo","cliente":"Ricardo Paucar","telefono":"943600005","notas":""}]',22.00,'2026-08-12 14:00:00',NULL,NULL,'2026-08-12 14:14:00');

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valentina.cruz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0356,-77.0845,'Jr. Pacasmayo 234, San Martín de Porres 15102','[{"nombre":"10 alitas - BBQ","cliente":"Valentina Cruz","telefono":"933567890","notas":""}]',26.00,'2026-08-12 19:30:00','2026-08-12 19:50:00','2026-08-12 20:42:00',NULL);

-- Aug 13
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='andres.salinas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 1023, San Martín de Porres 15104','[{"nombre":"6 alitas - Ajo","cliente":"Andrés Salinas","telefono":"910890123","notas":""}]',18.00,'2026-08-13 18:00:00','2026-08-13 18:20:00','2026-08-13 19:12:00',NULL);

-- === SEMANA 3: Aug 14-20 (12 entregado + 1 cancelado) ===

-- Aug 14
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 650, San Martín de Porres 15106','[{"nombre":"8 alitas - Mostaza Miel","cliente":"Norma Apaza","telefono":"932600006","notas":""}]',22.00,'2026-08-14 12:30:00','2026-08-14 12:50:00','2026-08-14 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"10 alitas - Picante Extremo","cliente":"Camila Rojas","telefono":"999901234","notas":"Doble salsa"}]',26.00,'2026-08-14 19:00:00','2026-08-14 19:18:00','2026-08-14 20:10:00',NULL);

-- Aug 15
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='luis.perez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 1250, San Martín de Porres 15103','[{"nombre":"15 alitas - BBQ","cliente":"Luis Pérez","telefono":"976234567","notas":""}]',36.00,'2026-08-15 13:00:00','2026-08-15 13:20:00','2026-08-15 14:15:00',NULL);

-- Aug 16 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 320, San Martín de Porres 15107','[{"nombre":"8 alitas - Teriyaki","cliente":"Óscar Huanca","telefono":"921600007","notas":""}]',22.00,'2026-08-16 12:00:00','2026-08-16 12:22:00','2026-08-16 13:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sebastian.lara@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0445,-77.0756,'Jr. Los Jazmines 567, San Martín de Porres 15105','[{"nombre":"10 alitas - Buffalo","cliente":"Sebastián Lara","telefono":"988012345","notas":""}]',26.00,'2026-08-16 17:30:00','2026-08-16 17:50:00','2026-08-16 18:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sofia.mendoza@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 321, San Martín de Porres 15102','[{"nombre":"12 alitas - BBQ","cliente":"Sofía Mendoza","telefono":"943567890","notas":"Sin cebolla"}]',30.00,'2026-08-16 20:00:00','2026-08-16 20:20:00','2026-08-16 21:12:00',NULL);

-- Aug 17 (domingo)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='mateo.gutierrez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0212,-77.0956,'Jr. Los Cipreses 123, San Martín de Porres 15103','[{"nombre":"8 alitas - Mango Habanero","cliente":"Mateo Gutiérrez","telefono":"966234567","notas":""}]',22.00,'2026-08-17 13:00:00','2026-08-17 13:20:00','2026-08-17 14:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 500, San Martín de Porres 15103','[{"nombre":"6 alitas - Ranch","cliente":"Carmen Llanos","telefono":"910600008","notas":""}]',18.00,'2026-08-17 18:30:00','2026-08-17 18:48:00','2026-08-17 19:40:00',NULL);

-- Aug 18 (cancelado + entregado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='maria.torres@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'cancelado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 456, San Martín de Porres 15102','[{"nombre":"10 alitas - Buffalo","cliente":"María Torres","telefono":"965345678","notas":""}]',26.00,'2026-08-18 14:30:00','2026-08-18 14:48:00',NULL,'2026-08-18 15:02:00');

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='isabella.morales@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 890, San Martín de Porres 15106','[{"nombre":"8 alitas - Ajo","cliente":"Isabella Morales","telefono":"977123456","notas":""}]',22.00,'2026-08-18 19:00:00','2026-08-18 19:18:00','2026-08-18 20:10:00',NULL);

-- Aug 19-20
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='diego.vargas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 654, San Martín de Porres 15103','[{"nombre":"10 alitas - Teriyaki","cliente":"Diego Vargas","telefono":"932678901","notas":""}]',26.00,'2026-08-19 18:30:00','2026-08-19 18:50:00','2026-08-19 19:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 560, San Martín de Porres 15104','[{"nombre":"8 alitas - Buffalo","cliente":"Fernando Sauñe","telefono":"999600009","notas":""}]',22.00,'2026-08-20 20:00:00','2026-08-20 20:20:00','2026-08-20 21:10:00',NULL);

-- === SEMANA 4: Aug 21-27 (12 entregado + 1 cancelado) ===

-- Aug 21
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='ana.garcia@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0312,-77.0756,'Jr. Huiracocha 142, San Martín de Porres 15102','[{"nombre":"12 alitas - Buffalo","cliente":"Ana García","telefono":"987123456","notas":""}]',30.00,'2026-08-21 12:30:00','2026-08-21 12:50:00','2026-08-21 13:40:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='lucia.fernandez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 456, San Martín de Porres 15107','[{"nombre":"6 alitas - BBQ","cliente":"Lucía Fernández","telefono":"955345678","notas":""}]',18.00,'2026-08-21 19:30:00','2026-08-21 19:50:00','2026-08-21 20:40:00',NULL);

-- Aug 22
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='pablo.ramos@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0289,-77.1045,'Jr. Los Rosales 789, San Martín de Porres 15104','[{"nombre":"10 alitas - Mango Habanero","cliente":"Pablo Ramos","telefono":"944456789","notas":""}]',26.00,'2026-08-22 18:00:00','2026-08-22 18:20:00','2026-08-22 19:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 720, San Martín de Porres 15104','[{"nombre":"8 alitas - Ranch","cliente":"Miriam Quispe","telefono":"988600010","notas":""}]',22.00,'2026-08-22 20:30:00','2026-08-22 20:50:00','2026-08-22 21:42:00',NULL);

-- Aug 23 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.ruiz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 789, San Martín de Porres 15104','[{"nombre":"20 alitas - Buffalo","cliente":"Carlos Ruiz","telefono":"954456789","notas":""}]',45.00,'2026-08-23 13:00:00','2026-08-23 13:22:00','2026-08-23 14:18:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valeria.chavez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 2100, San Martín de Porres 15106','[{"nombre":"10 alitas - Mostaza Miel","cliente":"Valeria Chávez","telefono":"921789012","notas":""}]',26.00,'2026-08-23 17:00:00','2026-08-23 17:20:00','2026-08-23 18:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 310, San Martín de Porres 15102','[{"nombre":"8 alitas - BBQ","cliente":"Javier Mamani","telefono":"987600001","notas":""}]',22.00,'2026-08-23 20:00:00','2026-08-23 20:18:00','2026-08-23 21:10:00',NULL);

-- Aug 24 (domingo)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='isabella.morales@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 890, San Martín de Porres 15106','[{"nombre":"6 alitas - Ajo","cliente":"Isabella Morales","telefono":"977123456","notas":""}]',18.00,'2026-08-24 12:30:00','2026-08-24 12:50:00','2026-08-24 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='andres.salinas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 987, San Martín de Porres 15104','[{"nombre":"10 alitas - Picante Extremo","cliente":"Andrés Salinas","telefono":"910890123","notas":"Extra salsa"}]',26.00,'2026-08-24 19:00:00','2026-08-24 19:20:00','2026-08-24 20:12:00',NULL);

-- Aug 25 (cancelado + entregado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,NULL,'cancelado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 450, San Martín de Porres 15102','[{"nombre":"10 alitas - Buffalo","cliente":"Rosa Condori","telefono":"976600002","notas":""}]',26.00,'2026-08-25 15:00:00',NULL,NULL,'2026-08-25 15:16:00');

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"8 alitas - Ranch","cliente":"Camila Rojas","telefono":"999901234","notas":""}]',22.00,'2026-08-25 19:30:00','2026-08-25 19:50:00','2026-08-25 20:42:00',NULL);

-- Aug 26
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valentina.cruz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0356,-77.0845,'Jr. Pacasmayo 234, San Martín de Porres 15102','[{"nombre":"12 alitas - Teriyaki","cliente":"Valentina Cruz","telefono":"933567890","notas":""}]',30.00,'2026-08-26 18:00:00','2026-08-26 18:20:00','2026-08-26 19:12:00',NULL);

-- === SEMANA 5: Aug 28 - Sep 3 (12 entregado + 1 cancelado) ===

-- Aug 28
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sebastian.lara@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0445,-77.0756,'Jr. Los Jazmines 567, San Martín de Porres 15105','[{"nombre":"8 alitas - Buffalo","cliente":"Sebastián Lara","telefono":"988012345","notas":""}]',22.00,'2026-08-28 12:00:00','2026-08-28 12:20:00','2026-08-28 13:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 1850, San Martín de Porres 15106','[{"nombre":"10 alitas - BBQ","cliente":"Eduardo Ccallo","telefono":"965600003","notas":""}]',26.00,'2026-08-28 19:30:00','2026-08-28 19:50:00','2026-08-28 20:42:00',NULL);

-- Aug 29
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='maria.torres@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 456, San Martín de Porres 15102','[{"nombre":"8 alitas - Mango Habanero","cliente":"María Torres","telefono":"965345678","notas":""}]',22.00,'2026-08-29 13:00:00','2026-08-29 13:18:00','2026-08-29 14:10:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='mateo.gutierrez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0212,-77.0956,'Jr. Los Cipreses 123, San Martín de Porres 15103','[{"nombre":"6 alitas - Ajo","cliente":"Mateo Gutiérrez","telefono":"966234567","notas":""}]',18.00,'2026-08-29 19:00:00','2026-08-29 19:18:00','2026-08-29 20:10:00',NULL);

-- Aug 30 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='ana.garcia@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0312,-77.0756,'Jr. Huiracocha 142, San Martín de Porres 15102','[{"nombre":"15 alitas - Buffalo","cliente":"Ana García","telefono":"987123456","notas":""}]',36.00,'2026-08-30 12:30:00','2026-08-30 12:50:00','2026-08-30 13:45:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 980, San Martín de Porres 15103','[{"nombre":"8 alitas - Ranch","cliente":"Patricia Ttito","telefono":"954600004","notas":"Sin picante"}]',22.00,'2026-08-30 17:00:00','2026-08-30 17:20:00','2026-08-30 18:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='diego.vargas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 654, San Martín de Porres 15103','[{"nombre":"10 alitas - Teriyaki","cliente":"Diego Vargas","telefono":"932678901","notas":""}]',26.00,'2026-08-30 20:00:00','2026-08-30 20:20:00','2026-08-30 21:15:00',NULL);

-- Aug 31 (domingo)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='lucia.fernandez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 456, San Martín de Porres 15107','[{"nombre":"8 alitas - Mostaza Miel","cliente":"Lucía Fernández","telefono":"955345678","notas":""}]',22.00,'2026-08-31 13:00:00','2026-08-31 13:18:00','2026-08-31 14:10:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 650, San Martín de Porres 15106','[{"nombre":"10 alitas - Buffalo","cliente":"Norma Apaza","telefono":"932600006","notas":""}]',26.00,'2026-08-31 19:30:00','2026-08-31 19:50:00','2026-08-31 20:42:00',NULL);

-- Sep 1
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"12 alitas - BBQ","cliente":"Camila Rojas","telefono":"999901234","notas":""}]',30.00,'2026-09-01 18:30:00','2026-09-01 18:50:00','2026-09-01 19:42:00',NULL);

-- Sep 2 (cancelado + entregado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,NULL,'cancelado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 320, San Martín de Porres 15107','[{"nombre":"8 alitas - Teriyaki","cliente":"Óscar Huanca","telefono":"921600007","notas":""}]',22.00,'2026-09-02 14:00:00',NULL,NULL,'2026-09-02 14:12:00');

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='luis.perez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 1250, San Martín de Porres 15103','[{"nombre":"10 alitas - Mango Habanero","cliente":"Luis Pérez","telefono":"976234567","notas":""}]',26.00,'2026-09-02 19:00:00','2026-09-02 19:20:00','2026-09-02 20:12:00',NULL);

-- Sep 3
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sofia.mendoza@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 321, San Martín de Porres 15102','[{"nombre":"8 alitas - Buffalo","cliente":"Sofía Mendoza","telefono":"943567890","notas":""}]',22.00,'2026-09-03 18:30:00','2026-09-03 18:50:00','2026-09-03 19:42:00',NULL);

-- === SEMANA 6: Sep 4-10 (12 entregado + 1 cancelado) ===

-- Sep 4
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='pablo.ramos@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0289,-77.1045,'Jr. Los Rosales 789, San Martín de Porres 15104','[{"nombre":"10 alitas - Ajo","cliente":"Pablo Ramos","telefono":"944456789","notas":""}]',26.00,'2026-09-04 12:30:00','2026-09-04 12:50:00','2026-09-04 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 178, San Martín de Porres 15102','[{"nombre":"8 alitas - BBQ","cliente":"Ricardo Paucar","telefono":"943600005","notas":""}]',22.00,'2026-09-04 19:00:00','2026-09-04 19:20:00','2026-09-04 20:12:00',NULL);

-- Sep 5
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valeria.chavez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 2100, San Martín de Porres 15106','[{"nombre":"12 alitas - Mango Habanero","cliente":"Valeria Chávez","telefono":"921789012","notas":""}]',30.00,'2026-09-05 18:00:00','2026-09-05 18:20:00','2026-09-05 19:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 500, San Martín de Porres 15103','[{"nombre":"6 alitas - Buffalo","cliente":"Carmen Llanos","telefono":"910600008","notas":""}]',18.00,'2026-09-05 20:30:00','2026-09-05 20:50:00','2026-09-05 21:42:00',NULL);

-- Sep 6 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='andres.salinas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 987, San Martín de Porres 15104','[{"nombre":"15 alitas - Buffalo","cliente":"Andrés Salinas","telefono":"910890123","notas":""}]',36.00,'2026-09-06 13:00:00','2026-09-06 13:20:00','2026-09-06 14:15:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sebastian.lara@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0445,-77.0756,'Jr. Los Jazmines 567, San Martín de Porres 15105','[{"nombre":"8 alitas - Mostaza Miel","cliente":"Sebastián Lara","telefono":"988012345","notas":""}]',22.00,'2026-09-06 17:30:00','2026-09-06 17:50:00','2026-09-06 18:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 560, San Martín de Porres 15104','[{"nombre":"10 alitas - Teriyaki","cliente":"Fernando Sauñe","telefono":"999600009","notas":""}]',26.00,'2026-09-06 20:00:00','2026-09-06 20:20:00','2026-09-06 21:12:00',NULL);

-- Sep 7 (domingo)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.ruiz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 789, San Martín de Porres 15104','[{"nombre":"8 alitas - Ranch","cliente":"Carlos Ruiz","telefono":"954456789","notas":""}]',22.00,'2026-09-07 13:00:00','2026-09-07 13:20:00','2026-09-07 14:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='isabella.morales@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0334,-77.1012,'Jr. Prolongación Unión 890, San Martín de Porres 15106','[{"nombre":"10 alitas - BBQ","cliente":"Isabella Morales","telefono":"977123456","notas":""}]',26.00,'2026-09-07 19:30:00','2026-09-07 19:50:00','2026-09-07 20:42:00',NULL);

-- Sep 8 (cancelado + entregado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,NULL,'cancelado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 720, San Martín de Porres 15104','[{"nombre":"8 alitas - Buffalo","cliente":"Miriam Quispe","telefono":"988600010","notas":""}]',22.00,'2026-09-08 15:30:00',NULL,NULL,'2026-09-08 15:44:00');

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='ana.garcia@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0312,-77.0756,'Jr. Huiracocha 142, San Martín de Porres 15102','[{"nombre":"8 alitas - Ajo","cliente":"Ana García","telefono":"987123456","notas":"Extra salsa"}]',22.00,'2026-09-08 19:00:00','2026-09-08 19:18:00','2026-09-08 20:10:00',NULL);

-- Sep 9
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='mateo.gutierrez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0212,-77.0956,'Jr. Los Cipreses 123, San Martín de Porres 15103','[{"nombre":"10 alitas - Picante Extremo","cliente":"Mateo Gutiérrez","telefono":"966234567","notas":""}]',26.00,'2026-09-09 18:30:00','2026-09-09 18:50:00','2026-09-09 19:42:00',NULL);

-- Sep 10
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='lucia.fernandez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0467,-77.0912,'Av. Naranjal 456, San Martín de Porres 15107','[{"nombre":"6 alitas - Ranch","cliente":"Lucía Fernández","telefono":"955345678","notas":""}]',18.00,'2026-09-10 19:00:00','2026-09-10 19:20:00','2026-09-10 20:12:00',NULL);

-- === DÍAS FINALES: Sep 11-15 (8 entregado + 4 en_camino + 2 asignado + 1 sin_asignar) ===

-- Sep 11
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valentina.cruz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0356,-77.0845,'Jr. Pacasmayo 234, San Martín de Porres 15102','[{"nombre":"10 alitas - Buffalo","cliente":"Valentina Cruz","telefono":"933567890","notas":""}]',26.00,'2026-09-11 12:30:00','2026-09-11 12:50:00','2026-09-11 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 310, San Martín de Porres 15102','[{"nombre":"8 alitas - BBQ","cliente":"Javier Mamani","telefono":"987600001","notas":""}]',22.00,'2026-09-11 19:00:00','2026-09-11 19:18:00','2026-09-11 20:10:00',NULL);

-- Sep 12 (sábado)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"12 alitas - Mango Habanero","cliente":"Camila Rojas","telefono":"999901234","notas":""}]',30.00,'2026-09-12 13:00:00','2026-09-12 13:20:00','2026-09-12 14:15:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='pablo.ramos@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0289,-77.1045,'Jr. Los Rosales 789, San Martín de Porres 15104','[{"nombre":"8 alitas - Teriyaki","cliente":"Pablo Ramos","telefono":"944456789","notas":""}]',22.00,'2026-09-12 17:30:00','2026-09-12 17:50:00','2026-09-12 18:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 450, San Martín de Porres 15102','[{"nombre":"10 alitas - BBQ","cliente":"Rosa Condori","telefono":"976600002","notas":""}]',26.00,'2026-09-12 20:00:00','2026-09-12 20:18:00','2026-09-12 21:12:00',NULL);

-- Sep 13 (2 entregado + 2 en_camino)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.ruiz@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0267,-77.0834,'Jr. Manco Cápac 789, San Martín de Porres 15104','[{"nombre":"6 alitas - Buffalo","cliente":"Carlos Ruiz","telefono":"954456789","notas":""}]',18.00,'2026-09-13 12:00:00','2026-09-13 12:20:00','2026-09-13 13:12:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='sofia.mendoza@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0389,-77.0878,'Jr. Santa Rosa 321, San Martín de Porres 15102','[{"nombre":"8 alitas - Ranch","cliente":"Sofía Mendoza","telefono":"943567890","notas":""}]',22.00,'2026-09-13 17:00:00','2026-09-13 17:18:00','2026-09-13 18:10:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='diego.vargas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'en_camino',-12.0278455,-77.0895871,-12.0156,-77.0945,'Jr. Las Orquídeas 654, San Martín de Porres 15103','[{"nombre":"10 alitas - Mostaza Miel","cliente":"Diego Vargas","telefono":"932678901","notas":""}]',26.00,'2026-09-13 19:30:00','2026-09-13 19:50:00',NULL,NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'en_camino',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 1850, San Martín de Porres 15106','[{"nombre":"8 alitas - BBQ","cliente":"Eduardo Ccallo","telefono":"965600003","notas":""}]',22.00,'2026-09-13 20:30:00','2026-09-13 20:50:00',NULL,NULL);

-- Sep 14 (1 entregado + 1 en_camino)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='andres.salinas@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'entregado',-12.0278455,-77.0895871,-12.0301,-77.0967,'Jr. Progreso 987, San Martín de Porres 15104','[{"nombre":"10 alitas - Picante Extremo","cliente":"Andrés Salinas","telefono":"910890123","notas":""}]',26.00,'2026-09-14 12:30:00','2026-09-14 12:50:00','2026-09-14 13:42:00',NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='maria.torres@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'en_camino',-12.0278455,-77.0895871,-12.0341,-77.0912,'Jr. Mariano Cornejo 456, San Martín de Porres 15102','[{"nombre":"8 alitas - Buffalo","cliente":"María Torres","telefono":"965345678","notas":""}]',22.00,'2026-09-14 19:30:00','2026-09-14 19:50:00',NULL,NULL);

-- Sep 15 — HOY (1 en_camino + 2 asignado + 1 sin_asignar)
INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='luis.perez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='miguel.flores@alakricogo.com'),'en_camino',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 1250, San Martín de Porres 15103','[{"nombre":"10 alitas - BBQ","cliente":"Luis Pérez","telefono":"976234567","notas":""}]',26.00,'2026-09-15 11:00:00','2026-09-15 11:20:00',NULL,NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='valeria.chavez@gmail.com'),(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='josue.ramirez@alakricogo.com'),'asignado',-12.0278455,-77.0895871,-12.0423,-77.0823,'Av. Canta Callao 2100, San Martín de Porres 15106','[{"nombre":"8 alitas - Mango Habanero","cliente":"Valeria Chávez","telefono":"921789012","notas":""}]',22.00,'2026-09-15 13:00:00','2026-09-15 13:18:00',NULL,NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES(NULL,(SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='carlos.huaman@alakricogo.com'),'asignado',-12.0278455,-77.0895871,-12.0198,-77.0821,'Av. Universitaria 980, San Martín de Porres 15103','[{"nombre":"10 alitas - Ranch","cliente":"Patricia Ttito","telefono":"954600004","notas":"Sin picante"}]',26.00,'2026-09-15 14:00:00','2026-09-15 14:22:00',NULL,NULL);

INSERT INTO AKR_Pedidos (Id_Cliente,Id_Repartidor,Estado,Lat_Origen,Lng_Origen,Lat_Destino,Lng_Destino,Direccion_Destino,Productos,Total,Creacion_Pedido,Asignacion_Pedido,Entrega_Pedido,Cancelacion_Pedido)
VALUES((SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario='camila.rojas@gmail.com'),NULL,'sin_asignar',-12.0278455,-77.0895871,-12.0178,-77.0789,'Jr. Las Flores 234, San Martín de Porres 15102','[{"nombre":"6 alitas - Buffalo","cliente":"Camila Rojas","telefono":"999901234","notas":""}]',18.00,'2026-09-15 15:30:00',NULL,NULL,NULL);

-- =============================================================================
-- RESUMEN
-- Usuarios insertados: 3 repartidores + 15 clientes app + 10 clientes WhatsApp = 28
-- Pedidos: 78 entregado + 5 cancelado + 4 en_camino + 2 asignado + 1 sin_asignar = 90
-- =============================================================================
