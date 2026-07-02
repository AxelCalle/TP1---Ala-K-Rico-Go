# Guía de instalación — Ala K' Rico GO

## Requisitos previos

- Node.js 18 o superior
- SQL Server 2019 (Express o Developer)
- Git

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/AxelCalle/TP1---Ala-K-Rico-Go.git
cd TP1---Ala-K-Rico-Go
```

---

## 2. Instalar dependencias

```bash
# Dependencias del frontend (raíz del proyecto)
npm install

# Dependencias del backend
cd server
npm install
cd ..
```

---

## 3. Configurar la base de datos

### 3.1 Crear la base de datos en SQL Server

Abre SQL Server Management Studio y ejecuta:

```sql
CREATE DATABASE ALAKRICO_GO_DB;
```

### 3.2 Configurar las credenciales del backend

```bash
cp server/.env.example server/.env
```

Edita `server/.env` con tus datos:

```env
DB_SERVER=NOMBRE_PC\INSTANCIA_SQLSERVER   # ej: MIPC\MSSQLSERVER2019
DB_PORT=1433
DB_DATABASE=ALAKRICO_GO_DB
DB_USER=sa
DB_PASSWORD=tu_password_aqui

JWT_SECRET=AlaKRicoGO_JWT_Secret_2024_X9kP2mN

PORT=3001
FRONTEND_URL=http://localhost:8081
```

> **Nota:** Para encontrar el nombre de tu instancia, abre SQL Server Management Studio y copia el nombre del servidor que aparece en la pantalla de conexión.

---

## 4. Crear las tablas e insertar datos

```bash
cd server

# Crea las 10 tablas y los roles del sistema
node run-schema.js

# Siembra los 89 pedidos del piloto de la tesis (Tabla A.1)
node seed-piloto.js

cd ..
```

La semilla crea automáticamente:
- 1 usuario administrador: `admin@alakrico.com` / `Admin2026#`
- 1 repartidor: `pquispe@alakrico.com` / `Pedro.5678`
- 10 clientes de prueba: `*@piloto.test` / `Cliente2026`
- 89 pedidos distribuidos en 12 jornadas (6 FIFO + 6 ACO)
- Parámetros ACO calibrados del paper: α=2, β=3, ρ=0.1, T=100 iter

---

## 5. Levantar el proyecto

Necesitas dos terminales:

**Terminal 1 — Backend (Express):**
```bash
cd server
node index.js
# Servidor corriendo en http://localhost:3001
```

**Terminal 2 — Frontend (TanStack Start):**
```bash
npm run dev
# Aplicación en http://localhost:8081
```

---

## 6. Accesos del sistema

| Rol           | Email                    | Contraseña   |
|---------------|--------------------------|--------------|
| Administrador | admin@alakrico.com       | Admin2026#   |
| Repartidor    | pquispe@alakrico.com     | Pedro.5678   |
| Cliente       | cmendoza@piloto.test     | Cliente2026  |

---

## Estructura del proyecto

```
├── src/                    # Frontend (TanStack Start + React)
│   ├── routes/             # Páginas: admin, driver, cliente, login
│   └── lib/                # api.ts, store.ts, aco.ts
├── server/                 # Backend (Express + SQL Server)
│   ├── routes/             # pedidos, repartidores, auth, reportes...
│   ├── middleware/         # verificarToken.js, auditoria.js
│   ├── schema.sql          # Definición de las 10 tablas AKR_*
│   ├── run-schema.js       # Aplica el schema a SQL Server
│   ├── seed-piloto.js      # Semilla con datos del piloto de tesis
│   ├── .env.example        # Plantilla de variables de entorno
│   └── index.js            # Punto de entrada del servidor
└── SETUP.md                # Esta guía
```
