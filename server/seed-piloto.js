// seed-piloto.js — Recrea los 89 pedidos del piloto de tesis (Tabla A.1)
// Ejecutar: node seed-piloto.js

import dotenv from 'dotenv';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

dotenv.config();

const DB_CONFIG = {
  server:   process.env.DB_SERVER,
  port:     parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
};

// Restaurante Ala K' Rico — Jr. Áncash 3855, San Martín de Porres 15101
const LAT_REST = -12.0278455;
const LNG_REST = -77.0895871;

const ADMIN = {
  nombre: 'Administrador', apellido: 'AKR',
  email: 'admin@alakrico.com', password: 'Admin2026#',
  dni: '00000001', telf: '999000001',
};

const REPARTIDOR = {
  nombre: 'Pedro', apellido: 'Quispe Mamani',
  email: 'pquispe@alakrico.com', password: 'Pedro.5678',
  dni: '87654321', telf: '987000002',
};

const CLIENTES = [
  { nombre:'Carlos',    apellido:'Mendoza Rojas',   email:'cmendoza@piloto.test',  password:'Cliente2026', dni:'45821309', telf:'987654321', lat:-12.0031, lng:-77.0850, dir:'Av. Perú 1456, San Martín de Porres, Lima' },
  { nombre:'Lucía',     apellido:'Paredes Lima',    email:'lparedes@piloto.test',  password:'Cliente2026', dni:'52134678', telf:'956789012', lat:-11.9980, lng:-77.0790, dir:'Av. Universitaria 2340, San Martín de Porres, Lima' },
  { nombre:'Miguel',    apellido:'Torres Vidal',    email:'mtorres@piloto.test',   password:'Cliente2026', dni:'38907156', telf:'945678901', lat:-11.9855, lng:-77.0672, dir:'Av. Carlos Izaguirre 890, Los Olivos, Lima' },
  { nombre:'Sofía',     apellido:'Ríos Castillo',   email:'srios@piloto.test',     password:'Cliente2026', dni:'61234589', telf:'934567890', lat:-11.9902, lng:-77.0715, dir:'Av. Angélica Gamarra 456, Los Olivos, Lima' },
  { nombre:'Diego',     apellido:'Chávez Palma',    email:'dchavez@piloto.test',   password:'Cliente2026', dni:'49876543', telf:'923456789', lat:-12.0098, lng:-77.0903, dir:'Av. Zarumilla 567, San Martín de Porres, Lima' },
  { nombre:'Ana',       apellido:'Flores Díaz',     email:'aflores@piloto.test',   password:'Cliente2026', dni:'71234908', telf:'912345678', lat:-11.9712, lng:-77.0648, dir:'Av. Universitaria 3890, Comas, Lima' },
  { nombre:'Roberto',   apellido:'Vega Soto',       email:'rvega@piloto.test',     password:'Cliente2026', dni:'54321098', telf:'901234567', lat:-12.0142, lng:-77.1098, dir:'Av. Morales Duárez 234, Callao' },
  { nombre:'Patricia',  apellido:'Salas Ríos',      email:'psalas@piloto.test',    password:'Cliente2026', dni:'43210987', telf:'998765432', lat:-11.9823, lng:-77.0635, dir:'Av. Alfredo Mendiola 1890, Los Olivos, Lima' },
  { nombre:'Jorge',     apellido:'Cárdenas Torres', email:'jcardenas@piloto.test', password:'Cliente2026', dni:'36789012', telf:'976543210', lat:-12.0015, lng:-77.0812, dir:'Av. Los Alisos 123, San Martín de Porres, Lima' },
  { nombre:'Valentina', apellido:'Cruz Medina',     email:'vcruz@piloto.test',     password:'Cliente2026', dni:'58901234', telf:'965432109', lat:-11.9748, lng:-77.0695, dir:'Av. Belaúnde 890, Comas, Lima' },
];

const COMBOS = [
  { nombre:'Combo 6 alitas BBQ',     precio:25.90 },
  { nombre:'Combo 12 alitas Ranch',  precio:42.00 },
  { nombre:'Combo 24 alitas Mixtas', precio:65.00 },
  { nombre:'Combo 6 alitas Picante', precio:27.50 },
  { nombre:'Combo 12 alitas Honey',  precio:44.00 },
  { nombre:'Combo 18 alitas Mix',    precio:56.00 },
];

// 90 pedidos en 12 jornadas — 45 FIFO + 45 ACO. Días: Vie/Sáb/Dom.
// FIFO: Jun 5-19 (semanas 1-2) | ACO: Jun 26-Jul 10 (semanas 3-4)
// TPE por jornada calibrado con Tabla A.1 del paper. J04 lleva 7 ped (+1 extra).
const JORNADAS = [
  // ── Fase FIFO (45 ped) ───────────────────────────────────────────────────
  { id:'J01', fecha:'2026-06-05', dia:'Viernes', fase:'FIFO', tpes:[32,36,39,42,44,45,57,59] },       // 8 ped  media=44.3
  { id:'J02', fecha:'2026-06-06', dia:'Sábado',  fase:'FIFO', tpes:[33,37,40,43,45,45,54,63,70] },    // 9 ped  media=47.8
  { id:'J04', fecha:'2026-06-07', dia:'Domingo', fase:'FIFO', tpes:[24,28,33,36,38,44,50] },           // 7 ped  media=36.1  (+1 vs paper)
  { id:'J03', fecha:'2026-06-12', dia:'Viernes', fase:'FIFO', tpes:[26,30,35,38,42,45,52] },           // 7 ped  media=38.3
  { id:'J05', fecha:'2026-06-13', dia:'Sábado',  fase:'FIFO', tpes:[28,34,38,42,44,45,54,56] },       // 8 ped  media=42.6
  { id:'J06', fecha:'2026-06-19', dia:'Viernes', fase:'FIFO', tpes:[30,35,39,43,45,58] },             // 6 ped  media=41.7
  // ── Fase ACO (45 ped) ────────────────────────────────────────────────────
  { id:'J07', fecha:'2026-06-26', dia:'Viernes', fase:'ACO',  tpes:[22,24,26,28,29,31,32] },           // 7 ped  media=27.4
  { id:'J08', fecha:'2026-06-27', dia:'Sábado',  fase:'ACO',  tpes:[22,25,27,29,30,31,33,35,34,46] }, // 10 ped media=31.2
  { id:'J10', fecha:'2026-06-28', dia:'Domingo', fase:'ACO',  tpes:[19,22,23,26,30] },                 // 5 ped  media=24.0
  { id:'J09', fecha:'2026-07-03', dia:'Viernes', fase:'ACO',  tpes:[20,22,24,26,28,29,31,34] },       // 8 ped  media=26.8
  { id:'J11', fecha:'2026-07-04', dia:'Sábado',  fase:'ACO',  tpes:[20,24,27,29,30,31,33,35,47] },   // 9 ped  media=30.7
  { id:'J12', fecha:'2026-07-10', dia:'Viernes', fase:'ACO',  tpes:[20,22,25,27,28,35] },             // 6 ped  media=26.2
];

// Parámetros calibrados del paper (Tabla 3)
const ACO_PARAMS = {
  alfa: 2.0, beta: 3.0, rho: 0.1, Q: 8.0,
  numAnts: 20.0, iterations: 100.0, elite: 4.0, tauMin: 0.02,
};

// ─────────────────────────────────────────────────────────────────────────────

async function upsertUsuario(pool, u, idRole) {
  const existe = await pool.request()
    .input('email', sql.NVarChar(150), u.email)
    .query('SELECT Id_Usuario FROM AKR_Usuarios WHERE Email_Usuario = @email');

  if (existe.recordset.length > 0) {
    const id = existe.recordset[0].Id_Usuario;
    console.log(`  Ya existe: ${u.email} (ID=${id})`);
    return id;
  }

  const hash = await bcrypt.hash(u.password, 10);
  const r = await pool.request()
    .input('idRole',   sql.SmallInt,     idRole)
    .input('nombre',   sql.NVarChar(100), u.nombre)
    .input('apellido', sql.NVarChar(100), u.apellido || '')
    .input('email',    sql.NVarChar(150), u.email)
    .input('hash',     sql.NVarChar(250), hash)
    .input('dni',      sql.NVarChar(9),   u.dni  || '')
    .input('telf',     sql.NVarChar(9),   u.telf || '')
    .query(`
      INSERT INTO AKR_Usuarios
        (Id_Roles, Nombre_Usuario, Apellido_Usuario, Email_Usuario,
         Contraseña_Usuario, DNI_Usuario, Telf_Usuario, Activo_Usuario, Creacion_Usuario)
      OUTPUT INSERTED.Id_Usuario
      VALUES (@idRole, @nombre, @apellido, @email, @hash, @dni, @telf, 1, GETDATE())
    `);
  const id = r.recordset[0].Id_Usuario;
  console.log(`  Creado: ${u.email} (ID=${id})`);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────

try {
  const pool = await new sql.ConnectionPool(DB_CONFIG).connect();
  console.log('Conectado a SQL Server.\n');

  // Guardia: no re-sembrar
  const yaHay = await pool.request().query(
    "SELECT COUNT(*) AS n FROM AKR_Usuarios WHERE Email_Usuario LIKE '%@piloto.test'"
  );
  if (yaHay.recordset[0].n > 0) {
    console.log('Los datos del piloto ya existen. Para re-sembrar, primero borra los registros existentes.');
    await pool.close();
    process.exit(0);
  }

  // ── 1. Usuarios ──────────────────────────────────────────────────────────
  console.log('[1/3] Creando usuarios...');
  await upsertUsuario(pool, ADMIN,      1);
  const idRepartidor = await upsertUsuario(pool, REPARTIDOR, 2);
  const clientesConId = [];
  for (const c of CLIENTES) {
    const id = await upsertUsuario(pool, c, 3);
    clientesConId.push({ ...c, id });
  }
  console.log(`  Total usuarios: ${2 + clientesConId.length}\n`);

  // ── 2. Pedidos (89) ───────────────────────────────────────────────────────
  console.log('[2/3] Insertando pedidos (Tabla A.1)...');
  let total = 0;

  for (const j of JORNADAS) {
    const baseHora = j.dia === 'Domingo' ? 12 : 18;

    for (let i = 0; i < j.tpes.length; i++) {
      const tpe     = j.tpes[i];
      const cliente = clientesConId[i % clientesConId.length];
      const combo   = COMBOS[i % COMBOS.length];

      const minBase  = baseHora * 60 + i * 18;
      const hC = Math.floor(minBase / 60), mC = minBase % 60;
      const creacion   = new Date(`${j.fecha}T${String(hC).padStart(2,'0')}:${String(mC).padStart(2,'0')}:00`);
      const asignacion = new Date(creacion.getTime() + (10 + (i % 6)) * 60000);
      const entrega    = new Date(creacion.getTime() + tpe * 60000);

      const productos = JSON.stringify([
        { nombre: combo.nombre, precio: combo.precio, cantidad: 1 },
        { _jornada: j.id, _fase: j.fase },
      ]);

      await pool.request()
        .input('idCliente',    sql.Int,               cliente.id)
        .input('idRepartidor', sql.Int,               idRepartidor)
        .input('latOrigen',    sql.Float,             LAT_REST)
        .input('lngOrigen',    sql.Float,             LNG_REST)
        .input('latDest',      sql.Float,             cliente.lat + i * 0.00012)
        .input('lngDest',      sql.Float,             cliente.lng + i * 0.00012)
        .input('dir',          sql.NVarChar(300),     cliente.dir)
        .input('productos',    sql.NVarChar(sql.MAX), productos)
        .input('total',        sql.Decimal(10, 2),    combo.precio)
        .input('creacion',     sql.DateTime,          creacion)
        .input('asignacion',   sql.DateTime,          asignacion)
        .input('entrega',      sql.DateTime,          entrega)
        .query(`
          INSERT INTO AKR_Pedidos
            (Id_Cliente, Id_Repartidor, Estado,
             Lat_Origen, Lng_Origen, Lat_Destino, Lng_Destino, Direccion_Destino,
             Productos, Total, Creacion_Pedido, Asignacion_Pedido, Entrega_Pedido)
          VALUES
            (@idCliente, @idRepartidor, 'entregado',
             @latOrigen, @lngOrigen, @latDest, @lngDest, @dir,
             @productos, @total, @creacion, @asignacion, @entrega)
        `);
      total++;
    }

    const media = (j.tpes.reduce((a, b) => a + b, 0) / j.tpes.length).toFixed(1);
    console.log(`  ${j.id}  ${j.fecha}  ${j.dia.padEnd(8)} ${j.fase}  ${j.tpes.length} ped  TPE=${media} min`);
  }
  console.log(`  Total insertado: ${total} pedidos\n`);

  // ── 3. Parámetros ACO calibrados ──────────────────────────────────────────
  console.log('[3/3] Actualizando AKR_ConfigACO con parámetros del paper...');
  for (const [clave, valor] of Object.entries(ACO_PARAMS)) {
    await pool.request()
      .input('clave', sql.NVarChar(30), clave)
      .input('valor', sql.Float,        valor)
      .query(`
        MERGE AKR_ConfigACO AS t
        USING (SELECT @clave AS Clave, @valor AS Valor) AS s ON t.Clave = s.Clave
        WHEN MATCHED     THEN UPDATE SET t.Valor = s.Valor
        WHEN NOT MATCHED THEN INSERT (Clave, Valor) VALUES (s.Clave, s.Valor);
      `);
  }
  console.log('  ' + Object.entries(ACO_PARAMS).map(([k,v]) => `${k}=${v}`).join('  ') + '\n');

  // ── Verificación estadística ──────────────────────────────────────────────
  const stats = await pool.request().query(`
    SELECT
      COUNT(*) AS n,
      CAST(AVG(CAST(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido) AS FLOAT)) AS DECIMAL(5,1)) AS tpe_global,
      MIN(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido)) AS tpe_min,
      MAX(DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido)) AS tpe_max,
      CAST(100.0 * SUM(CASE WHEN DATEDIFF(minute, Creacion_Pedido, Entrega_Pedido) <= 45 THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(4,1)) AS pct_ontime
    FROM AKR_Pedidos WHERE Estado = 'entregado'
  `);
  const s = stats.recordset[0];
  console.log('=== VERIFICACIÓN ===');
  console.log(`  Pedidos         : ${s.n} (esperado: 89)`);
  console.log(`  TPE global      : ${s.tpe_global} min  (FIFO+ACO; paper: 41.8 FIFO, 28.6 ACO)`);
  console.log(`  TPE min / max   : ${s.tpe_min} / ${s.tpe_max} min  (paper: 15-71)`);
  console.log(`  Entregas ≤45min : ${s.pct_ontime}%  (esperado: ~86%, FIFO+ACO combinado)`);

  // Desglose por fase
  const porFase = await pool.request().query(`
    SELECT
      JSON_VALUE(p2.val, '$[1]._fase') AS fase,
      COUNT(*) AS n,
      CAST(AVG(CAST(DATEDIFF(minute, p2.Creacion_Pedido, p2.Entrega_Pedido) AS FLOAT)) AS DECIMAL(5,1)) AS tpe
    FROM (
      SELECT Creacion_Pedido, Entrega_Pedido,
             Productos AS val
      FROM AKR_Pedidos WHERE Estado = 'entregado'
    ) p2
    GROUP BY JSON_VALUE(p2.val, '$[1]._fase')
  `);
  for (const row of porFase.recordset) {
    console.log(`  Fase ${row.fase}: ${row.n} pedidos, TPE=${row.tpe} min`);
  }

  await pool.close();
  console.log('\nSemilla del piloto completada.');

} catch (err) {
  console.error('Error fatal:', err.message);
  process.exit(1);
}
