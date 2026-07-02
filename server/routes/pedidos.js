// Rutas de pedidos
import { Router } from 'express';
import { getPool, sql } from '../db.js';
import { verificarToken } from '../middleware/verificarToken.js';
import { registrarAuditoria } from '../middleware/auditoria.js';

const router = Router();
router.use(verificarToken);

// GET /api/pedidos  — lista según rol
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    let query;

    if (req.usuario.role === 'admin') {
      query = pool.request().query(`
        SELECT p.*,
          c.Nombre_Usuario  AS Nombre_Cliente,
          c.Apellido_Usuario AS Apellido_Cliente,
          r.Nombre_Usuario  AS Nombre_Repartidor,
          r.Apellido_Usuario AS Apellido_Repartidor
        FROM AKR_Pedidos p
        INNER JOIN AKR_Usuarios c ON p.Id_Cliente = c.Id_Usuario
        LEFT  JOIN AKR_Usuarios r ON p.Id_Repartidor = r.Id_Usuario
        ORDER BY p.Creacion_Pedido DESC
      `);
    } else if (req.usuario.role === 'driver') {
      query = pool.request()
        .input('idRep', sql.Int, req.usuario.id)
        .query(`
          SELECT p.*,
            c.Nombre_Usuario AS Nombre_Cliente,
            c.Apellido_Usuario AS Apellido_Cliente
          FROM AKR_Pedidos p
          INNER JOIN AKR_Usuarios c ON p.Id_Cliente = c.Id_Usuario
          WHERE p.Id_Repartidor = @idRep
            AND p.Estado IN ('asignado','en_camino')
          ORDER BY p.Creacion_Pedido DESC
        `);
    } else {
      // customer
      query = pool.request()
        .input('idCli', sql.Int, req.usuario.id)
        .query(`
          SELECT p.*,
            r.Nombre_Usuario AS Nombre_Repartidor,
            r.Apellido_Usuario AS Apellido_Repartidor
          FROM AKR_Pedidos p
          LEFT JOIN AKR_Usuarios r ON p.Id_Repartidor = r.Id_Usuario
          WHERE p.Id_Cliente = @idCli
          ORDER BY p.Creacion_Pedido DESC
        `);
    }

    const result = await query;
    return res.json(result.recordset);
  } catch (err) {
    console.error('GET /pedidos:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// GET /api/pedidos/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query(`
        SELECT p.*,
          c.Nombre_Usuario  AS Nombre_Cliente,
          c.Apellido_Usuario AS Apellido_Cliente,
          c.Telf_Usuario    AS Telf_Cliente,
          r.Nombre_Usuario  AS Nombre_Repartidor,
          r.Apellido_Usuario AS Apellido_Repartidor
        FROM AKR_Pedidos p
        INNER JOIN AKR_Usuarios c ON p.Id_Cliente = c.Id_Usuario
        LEFT  JOIN AKR_Usuarios r ON p.Id_Repartidor = r.Id_Usuario
        WHERE p.Id_Pedido = @id
      `);

    const pedido = result.recordset[0];
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Solo el cliente dueño, su repartidor asignado, o admin pueden verlo
    if (
      req.usuario.role !== 'admin' &&
      pedido.Id_Cliente !== req.usuario.id &&
      pedido.Id_Repartidor !== req.usuario.id
    ) {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    return res.json(pedido);
  } catch (err) {
    console.error('GET /pedidos/:id:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /api/pedidos  — crear pedido (solo clientes)
router.post('/', async (req, res) => {
  if (req.usuario.role !== 'customer') {
    return res.status(403).json({ error: 'Solo los clientes pueden crear pedidos.' });
  }

  const { latDestino, lngDestino, direccionDestino, productos, total, latOrigen, lngOrigen } = req.body;

  if (!latDestino || !lngDestino || !direccionDestino) {
    return res.status(400).json({ error: 'Ubicación de destino es obligatoria.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('idCliente',   sql.Int,          req.usuario.id)
      .input('latDest',     sql.Float,         latDestino)
      .input('lngDest',     sql.Float,         lngDestino)
      .input('direccion',   sql.NVarChar(300), direccionDestino)
      .input('productos',   sql.NVarChar(sql.MAX), productos ? JSON.stringify(productos) : null)
      .input('total',       sql.Decimal(10,2), total ?? null)
      .input('latOrigen',   sql.Float,         latOrigen ?? null)
      .input('lngOrigen',   sql.Float,         lngOrigen ?? null)
      .query(`
        INSERT INTO AKR_Pedidos
          (Id_Cliente, Lat_Destino, Lng_Destino, Direccion_Destino,
           Productos, Total, Lat_Origen, Lng_Origen)
        OUTPUT INSERTED.Id_Pedido
        VALUES
          (@idCliente, @latDest, @lngDest, @direccion,
           @productos, @total, @latOrigen, @lngOrigen)
      `);

    const id = result.recordset[0].Id_Pedido;
    await registrarAuditoria(pool, req.usuario.id, null, 'pedido_creado',
      `Pedido #${id} creado por cliente ${req.usuario.id}`, req);

    return res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error('POST /pedidos:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/pedidos/:id/estado  — cambiar estado
router.patch('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  const validStates = ['sin_asignar','asignado','en_camino','entregado','cancelado'];
  if (!validStates.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }

  try {
    const pool = await getPool();

    // Obtener pedido actual
    const cur = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT * FROM AKR_Pedidos WHERE Id_Pedido = @id');
    const pedido = cur.recordset[0];
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado.' });

    // Permisos: admin puede todo; driver solo en_camino→entregado de sus pedidos
    if (req.usuario.role === 'driver') {
      if (pedido.Id_Repartidor !== req.usuario.id) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      if (!['en_camino','entregado'].includes(estado)) {
        return res.status(403).json({ error: 'El repartidor solo puede marcar en_camino o entregado.' });
      }
    }
    // customer solo puede cancelar sus propios pedidos sin_asignar
    if (req.usuario.role === 'customer') {
      if (pedido.Id_Cliente !== req.usuario.id) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
      if (estado !== 'cancelado' || pedido.Estado !== 'sin_asignar') {
        return res.status(400).json({ error: 'Solo puedes cancelar pedidos sin asignar.' });
      }
    }

    const now = new Date();
    await pool.request()
      .input('id',       sql.Int,         parseInt(req.params.id))
      .input('estado',   sql.NVarChar(20), estado)
      .input('asignado', sql.DateTime,     estado === 'asignado'  ? now : null)
      .input('entrega',  sql.DateTime,     estado === 'entregado' ? now : null)
      .input('cancel',   sql.DateTime,     estado === 'cancelado' ? now : null)
      .query(`
        UPDATE AKR_Pedidos SET
          Estado              = @estado,
          Asignacion_Pedido   = COALESCE(Asignacion_Pedido, @asignado),
          Entrega_Pedido      = COALESCE(Entrega_Pedido, @entrega),
          Cancelacion_Pedido  = COALESCE(Cancelacion_Pedido, @cancel)
        WHERE Id_Pedido = @id
      `);

    // Crear notificación si corresponde
    if (['asignado','en_camino','entregado','cancelado'].includes(estado)) {
      const mensajes = {
        asignado:   `Tu pedido #${req.params.id} fue asignado a un repartidor.`,
        en_camino:  `Tu pedido #${req.params.id} está en camino.`,
        entregado:  `Tu pedido #${req.params.id} fue entregado. ¡Buen provecho!`,
        cancelado:  `Tu pedido #${req.params.id} fue cancelado.`,
      };
      await pool.request()
        .input('idCli',  sql.Int,          pedido.Id_Cliente)
        .input('tipo',   sql.NVarChar(30),  estado)
        .input('msg',    sql.NVarChar(300), mensajes[estado])
        .input('idPed',  sql.Int,           parseInt(req.params.id))
        .query(`
          INSERT INTO AKR_Notificaciones (Id_Cliente, Tipo, Mensaje, Id_Pedido)
          VALUES (@idCli, @tipo, @msg, @idPed)
        `);
    }

    await registrarAuditoria(pool, req.usuario.id, null, 'estado_pedido',
      `Pedido #${req.params.id} → ${estado}`, req);

    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /pedidos/:id/estado:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// PATCH /api/pedidos/:id/asignar  — admin asigna repartidor
router.patch('/:id/asignar', async (req, res) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Solo admin puede asignar.' });
  }

  const { idRepartidor } = req.body;
  if (!idRepartidor) return res.status(400).json({ error: 'idRepartidor requerido.' });

  try {
    const pool = await getPool();
    const now = new Date();
    await pool.request()
      .input('id',    sql.Int,          parseInt(req.params.id))
      .input('repId', sql.Int,          idRepartidor)
      .input('now',   sql.DateTime,     now)
      .query(`
        UPDATE AKR_Pedidos SET
          Id_Repartidor     = @repId,
          Estado            = 'asignado',
          Asignacion_Pedido = @now
        WHERE Id_Pedido = @id AND Estado = 'sin_asignar'
      `);

    const cur = await pool.request()
      .input('id', sql.Int, parseInt(req.params.id))
      .query('SELECT Id_Cliente FROM AKR_Pedidos WHERE Id_Pedido = @id');
    const pedido = cur.recordset[0];

    if (pedido) {
      await pool.request()
        .input('idCli', sql.Int,          pedido.Id_Cliente)
        .input('msg',   sql.NVarChar(300), `Tu pedido #${req.params.id} fue asignado a un repartidor.`)
        .input('idPed', sql.Int,           parseInt(req.params.id))
        .query(`
          INSERT INTO AKR_Notificaciones (Id_Cliente, Tipo, Mensaje, Id_Pedido)
          VALUES (@idCli, 'asignado', @msg, @idPed)
        `);
    }

    await registrarAuditoria(pool, req.usuario.id, null, 'pedido_asignado',
      `Pedido #${req.params.id} asignado a repartidor ${idRepartidor}`, req);

    return res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /pedidos/:id/asignar:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

// POST /api/pedidos/:id/incidencia  — repartidor reporta incidencia
router.post('/:id/incidencia', async (req, res) => {
  if (req.usuario.role !== 'driver') {
    return res.status(403).json({ error: 'Solo repartidores pueden reportar incidencias.' });
  }

  const { tipo, detalle } = req.body;
  if (!tipo) return res.status(400).json({ error: 'Tipo de incidencia requerido.' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('idPed',   sql.Int,          parseInt(req.params.id))
      .input('idRep',   sql.Int,          req.usuario.id)
      .input('tipo',    sql.NVarChar(80),  tipo)
      .input('detalle', sql.NVarChar(500), detalle ?? null)
      .query(`
        INSERT INTO AKR_Incidencias (Id_Pedido, Id_Repartidor, Tipo, Detalle)
        VALUES (@idPed, @idRep, @tipo, @detalle)
      `);

    await registrarAuditoria(pool, req.usuario.id, null, 'incidencia_reportada',
      `Pedido #${req.params.id}: ${tipo}`, req);

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /pedidos/:id/incidencia:', err.message);
    return res.status(500).json({ error: 'Error interno.' });
  }
});

export default router;
