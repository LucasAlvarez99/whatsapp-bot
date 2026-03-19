# 🎩 Magic Show Bot v2 — Mensajes por tipo de contacto

Bot de WhatsApp para enviar mensajes personalizados según el tipo de contacto: **cliente**, **cliente_nuevo**, **salon** y **empresa**.

---

## 📁 Estructura del proyecto

```
whatsapp-magic-bot/
├── index.js                         → Código principal
├── contactos.csv                    → Tu lista de contactos
├── mensajes/
│   ├── mensaje_cliente.txt          → Mensaje para clientes existentes
│   ├── mensaje_cliente_nuevo.txt    → Mensaje para clientes nuevos
│   ├── mensaje_salon.txt            → Mensaje para salones de eventos
│   └── mensaje_empresa.txt          → Mensaje para empresas
├── package.json
├── session/                         → Sesión guardada (se crea solo)
└── logs/
    └── envios.log                   → Historial de todos los envíos
```

---

## ✅ Instalación

```bash
# 1. Instalá las dependencias (una sola vez)
npm install
```

---

## 👥 El archivo contactos.csv

Este es el corazón del sistema. Cada fila es un contacto con su tipo asignado.

### Formato

```
nombre,numero,tipo,empresa
María García,5491112345678,cliente,
Juan Pérez,5491198765432,cliente_nuevo,
Salón Los Robles,5491155443322,salon,Los Robles
TechCorp Argentina,5491166778899,empresa,TechCorp Argentina
```

### Columnas

| Columna  | Obligatorio | Descripción                                              |
|----------|-------------|----------------------------------------------------------|
| nombre   | ✅ Sí        | Nombre del contacto o negocio                            |
| numero   | ✅ Sí        | Número con código de país, sin espacios (ej: 5491112...) |
| tipo     | ✅ Sí        | `cliente`, `cliente_nuevo`, `salon` o `empresa`          |
| empresa  | Solo para salones/empresas | Nombre del salón o empresa (usado en el mensaje) |

### Tipos válidos

| Tipo           | Mensaje que recibe              | Cuándo usarlo                         |
|----------------|---------------------------------|---------------------------------------|
| `cliente`      | mensaje_cliente.txt             | Ya contrató tus servicios antes       |
| `cliente_nuevo`| mensaje_cliente_nuevo.txt       | Nunca te contrató, primera vez        |
| `salon`        | mensaje_salon.txt               | Salones de eventos, no personas       |
| `empresa`      | mensaje_empresa.txt             | Empresas para eventos corporativos    |

### Formato del número de teléfono

Siempre con código de país, sin espacios ni símbolos:

| País      | Ejemplo correcto   |
|-----------|--------------------|
| Argentina | `5491112345678`    |
| México    | `5215512345678`    |
| España    | `34612345678`      |
| Colombia  | `5731512345678`    |

> ⚠️ Argentina: el 9 entre el 54 y el código de área es obligatorio.

---

## 💬 Cómo editar los mensajes

Cada tipo tiene su propio archivo en la carpeta `mensajes/`. Editá directamente el texto:

**mensajes/mensaje_salon.txt**
```
Hola, buen día! Me comunico desde nuestro grupo de magia profesional 🎩

Nos gustaría colaborar con {empresa} para sus próximos eventos...
```

### Variables disponibles en los mensajes

Usá `{nombre_de_columna}` para insertar cualquier dato del CSV:

| Variable    | Reemplaza con...             |
|-------------|------------------------------|
| `{nombre}`  | El nombre del contacto       |
| `{empresa}` | El nombre del salón/empresa  |
| `{numero}`  | El número de teléfono        |

Si la variable no existe en el CSV para ese contacto, queda tal cual (`{empresa}`).

---

## ▶️ Cómo ejecutar

```bash
npm start
```

Al ejecutar:
1. Se abre Chrome con WhatsApp Web
2. Escaneá el QR con tu celular (solo la primera vez)
3. El bot muestra un resumen de contactos por tipo
4. Comienza a enviar con delays aleatorios de 28-35 segundos

---

## 🎮 Controles

| Tecla    | Acción                    |
|----------|---------------------------|
| `P`      | Pausar / reanudar envíos  |
| `Ctrl+C` | Detener el bot            |

---

## 📊 Logs

Cada envío queda registrado en `logs/envios.log`:

```
[2025-03-19T14:32:01.000Z] [OK]    [1/10] ✅ OK — María García
[2025-03-19T14:32:31.000Z] [ERROR] [2/10] ❌ ERROR — Número inválido
[2025-03-19T14:33:05.000Z] [OK]    [3/10] ✅ OK — Salón Los Robles
```

---

## 🛡️ Buenas prácticas

- Empezá con listas cortas (10-20 contactos) para probar
- No enviés más de 80-100 mensajes por día con un número normal
- Usá el celular de forma natural además del bot
- Hacé pausas entre tandas de envíos

---

## ⚠️ Advertencia

El uso de bots no oficiales puede violar los Términos de Servicio de WhatsApp y resultar en el bloqueo del número. Usá el bot con responsabilidad y solo para contactos que consintieron recibir mensajes.