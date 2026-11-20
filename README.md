# Control de Acceso — sistema 100 % local

Sistema de control de acceso con interfaz web y backend que funciona **sin servicios en la nube**:
personas, credenciales (huella, tarjeta, PIN), grupos con horarios, puertas, dispositivos (simulador, ZKTeco y relés HTTP),
apertura remota desde el celular, registros, auditoría, dashboard en tiempo real y respaldos.

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20+ · Express · API REST · WebSocket (`ws`) |
| Base de datos | SQLite (un archivo: `server/data/control-acceso.db`) vía `better-sqlite3` |
| Frontend | React 18 · Vite · TailwindCSS 4 · Recharts · lucide-react |
| Seguridad | bcrypt (`bcryptjs`), JWT, zod, helmet, rate limiting, consultas preparadas |

---

## 1. Instalación en Windows (paso a paso)

1. **Instale Node.js 22 LTS** desde <https://nodejs.org> (instalador `.msi`, opción por defecto).
   Verifique en una terminal (PowerShell o CMD):
   ```powershell
   node -v   # debe mostrar v20.x o v22.x
   npm -v
   ```
2. **Descargue el proyecto** (ZIP de GitHub y descomprímalo, o `git clone`). Ejemplo: `C:\control-acceso`.
3. **Abra una terminal en la carpeta del proyecto**:
   ```powershell
   cd C:\control-acceso
   ```
4. **Instale las dependencias** (una sola vez, instala backend y frontend):
   ```powershell
   npm install
   ```
   > `better-sqlite3` descarga un binario precompilado para Windows. Si falla con un error de `node-gyp`,
   > use Node 22 LTS (no una versión "Current") o instale las
   > [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) con "Desarrollo para el escritorio con C++".
5. **Levante todo con un solo comando**:
   ```powershell
   npm run dev
   ```
   La primera vez se crea automáticamente el archivo `.env` (con claves aleatorias) y la base de datos con datos de ejemplo.
6. Abra **<http://localhost:5173>** e ingrese con **`admin` / `Admin123!`**.

### Modo producción (un solo puerto)
```powershell
npm start
```
Compila el frontend y lo sirve desde Express en **<http://localhost:3001>**.

### Con Docker (opcional)
```powershell
docker compose up -d --build
```
Queda en <http://localhost:3001>. Los datos persisten en `server/data`.

### Usar desde el celular (misma red Wi-Fi)
1. Obtenga la IP del PC: `ipconfig` → "Dirección IPv4" (ej. `192.168.1.50`).
2. En el celular abra `http://192.168.1.50:5173/abrir` (modo dev) o `http://192.168.1.50:3001/abrir` (producción).
3. Si no carga, permita Node.js en el **Firewall de Windows** (redes privadas) cuando lo pregunte, o agregue una regla de entrada para los puertos 5173/3001.

---

## 2. Cómo probarlo (recorrido sugerido)

| Qué probar | Cómo |
|---|---|
| **Dashboard en vivo** | Entre al Dashboard: los 2 lectores simulados generan lecturas aleatorias cada ~45 s y aparecen en "Últimos 10 eventos" sin recargar (indicador **En vivo**). |
| **Apertura remota (admin)** | *Puertas* → **Abrir remotamente** → PIN del admin **`123456`**. Un token de un solo uso dura 30 s. |
| **Portal del celular** | Abra `/abrir` e ingrese con RUT **`17.919.337-K`** y contraseña **`Persona123!`** → toque **Abrir** → PIN **`123456`**. |
| **Denegaciones** | *Registros*: verá "Fuera de horario", "Persona suspendida" (Antonia Bravo), "Vigencia vencida" (Ignacio Riquelme), "Sin permiso" (Rodrigo Vásquez, sin grupo) y "Credencial no registrada". |
| **Horarios** | *Grupos y horarios* → edite "Administración" y quite el día de hoy: María José seguirá pudiendo abrir (grupo Gerencia 24/7), pero Camila Sepúlveda no. |
| **Dispositivos** | *Dispositivos* → **Probar conexión**, **Sincronizar usuarios**, **Ver usuarios**. Edite un simulador y active "Simular equipo desconectado" para verlo *offline*. |
| **Exportar** | *Registros* o *Auditoría* → **Excel** / **PDF** (respetan los filtros). |
| **Auditoría** | Cada crear/editar/eliminar, login, apertura, exportación y respaldo queda registrado con detalle "antes → después". |
| **Respaldo** | *Configuración → Respaldo* → descargar `.db` y restaurarlo (sólo Super Admin; guarda una copia previa automática). |
| **Roles** | *Configuración → Usuarios*: cree un usuario "Solo lectura" e ingrese con él: puede ver todo pero no modificar ni abrir. |
| **Modo oscuro** | Ícono luna/sol en la barra superior. |

### Datos de ejemplo
- 1 Super Admin: `admin` / `Admin123!` (PIN de apertura `123456`).
- 15 personas, 3 puertas, 2 dispositivos simulados, 3 grupos (Administración, Bodega, Gerencia) y 200 eventos de los últimos 7 días.
- Personas con acceso web (contraseña `Persona123!`, PIN `123456`):

  | Persona | RUT | Puertas |
  |---|---|---|
  | María José González Soto | 17.919.337-K | Todas (Gerencia 24/7) |
  | Carlos Andrés Muñoz Pérez | 11.838.674-4 | Acceso Principal, Bodega (L–V 07–18, Sáb 08–13) |
  | Francisca Rojas Díaz | 19.758.011-9 | Todas (Gerencia 24/7) |

- Reiniciar la base con datos de ejemplo: `npm run seed` (¡borra todo!).

> **Importante:** cambie la contraseña y el PIN de `admin` en *Configuración → Mi cuenta* antes de usarlo en producción.

---

## 3. Estructura del proyecto

```
control-acceso/
├── package.json            # workspaces + scripts (dev, start, seed)
├── .env.example            # variables de entorno (se copia a .env automáticamente)
├── Dockerfile / docker-compose.yml
├── server/                 # Backend Express
│   ├── data/               # SQLite, fotos (uploads/), respaldos (backups/)  ← NO se versiona
│   └── src/
│       ├── index.js        # app Express, WebSocket /ws, arranque
│       ├── config.js       # carga .env (lo crea si falta)
│       ├── db.js           # esquema SQLite y conexión
│       ├── seed.js         # datos de ejemplo
│       ├── middleware/     # auth JWT + roles, rate limits
│       ├── routes/         # auth, users, people, groups, doors, devices, logs, audit, dashboard, remote, backup, settings
│       ├── services/       # motor de acceso, apertura remota, gestor de dispositivos, auditoría, exportación Excel/PDF
│       ├── drivers/        # ← capa de dispositivos
│       │   ├── DeviceDriver.js     # interfaz base
│       │   ├── SimulatorDriver.js  # huellero simulado
│       │   ├── ZKTecoDriver.js     # ZKTeco vía node-zklib (base)
│       │   ├── RelayDriver.js      # Shelly / ESP32 por HTTP
│       │   └── index.js            # registro de drivers
│       └── utils/          # RUT, cifrado de PIN, fechas, errores HTTP
└── client/                 # Frontend React + Vite + Tailwind
    └── src/
        ├── pages/          # Dashboard, People, Groups, Doors, Devices, Logs, Audit, Settings, Remote, Login
        ├── components/     # Layout (menú lateral), ui.jsx, OpenDoorModal
        ├── context/        # sesión, tema claro/oscuro, confirmaciones
        └── lib/            # cliente API, WebSocket, formatos es-CL
```

---

## 4. Capa de dispositivos

Todos los drivers implementan la interfaz `DeviceDriver`:

```js
connect()            // → info del equipo (modelo, serie, usuarios…)
getUsers()           // → [{ userId, name, cardNumber }]
addUser(user)        // { userId, name, cardNumber, pin }
deleteUser(userId)
setCard(userId, cardNumber)
openDoor(doorNumber, seconds)
getAttendanceLogs()  // → [{ userId, timestamp, method }]
// eventos: driver.emit('read', { method, credential, doorNumber, at })
```

El driver se elige **por dispositivo desde la interfaz** (*Dispositivos → Editar → Driver*).

| Driver | Estado | Notas |
|---|---|---|
| `simulator` | Completo | Responde a todos los comandos con latencia simulada y genera lecturas aleatorias (huella/tarjeta/PIN) de los usuarios sincronizados y de credenciales desconocidas. Opciones: `offline`, `unknownRate`. |
| `zkteco` | Base | Usa `node-zklib` (TCP/UDP 4370): conexión, info, usuarios, marcaciones, apertura (`CMD_UNLOCK`) y tiempo real. `addUser`/`deleteUser` usan comandos crudos del protocolo con registro de 72 bytes: **valide con su modelo/firmware**. |
| `relay` | Completo (sólo apertura) | Shelly Gen1 (`/relay/0?turn=on&timer=N`), Shelly Gen2 (`/rpc/Switch.Set`) o ESP32 con `GET /status` y `POST /open {relay, seconds}` + header `X-Api-Key`. |

**Agregar un driver nuevo:** cree una clase que extienda `DeviceDriver`, declare `static capabilities` y regístrela en `server/src/drivers/index.js` (y en el `CHECK` de la columna `driver` en `db.js`).

**Flujo de una lectura:** lector → evento `read` → `deviceManager.handleRead` → identifica a la persona (ID de huella / tarjeta / PIN) → `evaluateAccess` (estado → vigencia → grupo con la puerta → horario) → registro en `access_logs` → WebSocket al dashboard.

---

## 5. Seguridad

- Contraseñas de administradores y personas con **bcrypt**; sesión **JWT** (expira en 8 h, configurable).
- **Roles:** Super Admin (todo, incluidos usuarios y restauración), Administrador (gestiona; no usuarios ni restauración), Solo lectura (sólo GET).
- **Apertura remota en 2 pasos:** valida permiso + horario → emite **token de un solo uso con expiración de 30 s** → exige **PIN de 6 dígitos** → revalida y abre. El consumo del token es atómico en SQLite (no se puede reutilizar).
- **Huellas:** sólo se guarda el *ID de usuario del lector*, nunca imágenes ni plantillas.
- **PIN de personas** cifrados con AES‑256‑GCM (clave `PIN_ENC_KEY` en `.env`), porque deben poder enviarse al lector al sincronizar; nunca se devuelven por la API. El PIN de administradores se guarda con bcrypt.
- Validación de todos los datos en el backend con **zod** (RUT con dígito verificador), **consultas preparadas** (sin concatenar SQL; ordenamientos por lista blanca).
- **Rate limiting:** login (10 intentos fallidos / 15 min), apertura remota (10 / min) y API general.
- Cabeceras seguras con **helmet** (CSP), fotos validadas por firma de archivo (máx. 2 MB), restauración valida que el archivo sea SQLite íntegro y de este sistema.
- Variables sensibles en `.env` (excluido de git).

### Variables de entorno (`.env`)
| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend (3001) |
| `TZ` | Zona horaria para horarios y reportes (`America/Santiago`) |
| `JWT_SECRET` | Secreto para firmar sesiones (se genera al azar) |
| `JWT_EXPIRES` | Duración de la sesión (`8h`) |
| `PIN_ENC_KEY` | 64 caracteres hex para cifrar PIN (se genera al azar; **no lo cambie** o los PIN existentes dejarán de funcionar) |
| `DB_PATH` | Ruta del archivo SQLite |
| `SIM_EVENT_INTERVAL` | Segundos promedio entre lecturas simuladas (0 = desactivado) |
| `DEVICE_CHECK_INTERVAL` | Segundos entre verificaciones de estado de dispositivos |
| `CORS_ORIGIN` | Orígenes permitidos si sirve el frontend desde otro host |

---

## 6. API REST (resumen)

Todas bajo `/api`, con `Authorization: Bearer <token>` salvo login y health.

| Recurso | Endpoints |
|---|---|
| Sesión | `POST /auth/login` · `GET /auth/me` · `POST /auth/change-password` · `POST /auth/pin` |
| Usuarios admin | `GET/POST /users` · `PUT/DELETE /users/:id` (Super Admin) |
| Personas | `GET /people?q=&status=&area=&group_id=&page=&pageSize=` · `POST /people` · `GET/PUT/DELETE /people/:id` · `POST/DELETE /people/:id/photo` |
| Grupos | `GET/POST /groups` · `GET/PUT/DELETE /groups/:id` (incluye horarios, personas y puertas) |
| Puertas | `GET/POST /doors` · `PUT/DELETE /doors/:id` · `POST /doors/:id/open-token` · `POST /doors/open` |
| Dispositivos | `GET/POST /devices` · `PUT/DELETE /devices/:id` · `POST /devices/:id/test` · `/sync` · `/import-logs` · `GET /devices/:id/users` · `GET /devices/drivers` |
| Registros | `GET /logs?from=&to=&person_id=&door_id=&method=&result=` · `GET /logs/export?format=xlsx\|pdf` |
| Auditoría | `GET /audit` · `GET /audit/export?format=xlsx\|pdf` |
| Dashboard | `GET /dashboard` |
| Respaldo | `GET /backup/download` · `POST /backup/restore` (multipart `file`) · `GET /backup/list` |
| Portal remoto | `POST /remote/login` · `GET /remote/doors` · `POST /remote/token` · `POST /remote/open` |
| Tiempo real | WebSocket `ws://host/ws?token=<JWT>` → mensajes `access` y `device_status` |
