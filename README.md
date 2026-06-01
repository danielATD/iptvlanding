# FlowTV - IPTV Landing Page & Catálogo

## 📋 Descripción General

Sitio web de venta/demostración del servicio IPTV **FlowTV**. Funciona actualmente en producción en **elflowtv.com** (hosting Bluehost) y también como parte de **catalogo.nachotv.site** (VPS Linode).

### URLs en Producción
- **elflowtv.com** — Hosting Bluehost (Apache + PHP), versión con `upload_catalog.php` para actualización automática del catálogo
- **catalogo.nachotv.site/tv/** — VPS en `23.239.118.251` (Nginx), sirve archivos estáticos, se despliega desde el repo `catalogo-nachotv`

## 🏗️ Arquitectura del Proyecto

```
iptvlanding/
├── index.html              # Página única: Landing + Catálogo + Buscador + Planes + Instalación + Demo
├── styles.css              # Estilos globales (landing + pricing + instalación + popup)
├── catalogo.css            # Estilos del catálogo (hero, stats, tarjetas, modales, animaciones)
├── .htaccess               # Config Apache/Bluehost: gzip, caché, CORS, protección upload, PHP limits
├── php.ini                 # Config PHP: memory_limit=512M, upload_max_filesize=512M, max_execution_time=300
├── user.ini                # Mismo contenido que php.ini (formato user.ini para Bluehost)
│
├── upload_catalog.php      # 🤖 ENDPOINT para recibir catálogo actualizado (POST + API key + gzip)
├── img_proxy.php           # 🖼️ Proxy de imágenes IPTV (oculta dominio del servidor, evita mixed content)
├── extract_catalog.js      # Script Node.js para extraer datos del API Xtream Codes manualmente
│
├── catalog_data/           # Datos JSON del catálogo (generados por el bot o extract_catalog.js)
│   ├── movies.json         # ~25MB — Películas (simplificado)
│   ├── series.json         # ~8MB  — Series (simplificado)
│   ├── channels.json       # ~2.7MB — Canales
│   ├── live_categories.json # Categorías de canales en vivo
│   └── trending.json       # 🔥 IDs de contenido trending (generado por el bot)
│
├── images/
│   ├── logo.png            # Logo FlowTV
│   ├── logo_popup.png      # Logo para popup promocional
│   ├── horizontalmundial.png
│   └── peliculas/          # Pósters locales de ejemplo
│
├── video/
│   └── demo.mp4            # Video demo del servicio (~33MB)
│
├── buscador.html           # Buscador standalone (versión anterior/independiente)
├── catalogo.html           # Catálogo standalone (versión anterior)
├── _peek.py                # Script helper para inspeccionar JSONs
└── resources/              # Capturas de red Fiddler (sesiones HTTP del API)
```

---

## 🤖 Sistema de Actualización Automática del Catálogo

### Flujo completo

```
┌──────────────────┐    HTTP GET     ┌──────────────────┐    HTTP POST (gzip+key)    ┌────────────────────┐
│ API Xtream Codes │ ──────────────► │  Bot/Script      │ ──────────────────────────► │ upload_catalog.php │
│ enlatv.com:8080  │                 │  (extrae datos)  │                             │ (elflowtv.com)     │
└──────────────────┘                 └──────────────────┘                             └────────────────────┘
                                                                                              │
                                                                                              ▼
                                                                                     catalog_data/*.json
                                                                                     (servidos estáticos)
                                                                                              │
                                                                                              ▼
                                                                                     ┌────────────────────┐
                                                                                     │  Frontend (JS)     │
                                                                                     │  fetch() → buscar  │
                                                                                     └────────────────────┘
```

### 1. upload_catalog.php — Endpoint receptor (en Bluehost)

Archivo: [`upload_catalog.php`](upload_catalog.php)

Recibe archivos JSON del catálogo vía POST. Funciona así:

```
POST https://elflowtv.com/upload_catalog.php
Headers:
  X-API-KEY: FTV_2026_x9Kp7mRw4Qz8nBv3
  Content-Type: multipart/form-data

Body:
  file: (archivo .json comprimido con gzip)
```

**Seguridad implementada:**
- Solo acepta POST (GET bloqueado en `.htaccess`)
- Valida API key via header `X-API-KEY` con `hash_equals()`
- Solo permite archivos whitelisted: `movies.json`, `series.json`, `channels.json`, `live_categories.json`, `trending.json`
- Descomprime gzip → valida que sea JSON válido → guarda en `catalog_data/`

**Configuración clave:**
```php
$SECRET_KEY = 'FTV_2026_x9Kp7mRw4Qz8nBv3';
$CATALOG_DIR = __DIR__ . '/catalog_data';
$ALLOWED_FILES = ['movies.json', 'series.json', 'channels.json', 'live_categories.json', 'trending.json'];
```

### 2. Bot que extrae y sube el catálogo

El bot debe:
1. Conectarse al API de Xtream Codes (`enlatv.com:8080`)
2. Descargar películas, series, canales
3. Simplificar los datos (quitar campos innecesarios)
4. Comprimir con gzip
5. Subir a `upload_catalog.php` vía POST con la API key

**Ejemplo de cómo subir un archivo al endpoint:**
```python
import requests
import gzip
import json

API_KEY = 'FTV_2026_x9Kp7mRw4Qz8nBv3'
UPLOAD_URL = 'https://elflowtv.com/upload_catalog.php'

# Cargar datos del API IPTV
data = requests.get('http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_vod_streams').json()

# Simplificar
movies = [{"stream_id": m["stream_id"], "name": m["name"], "year": m.get("year",""), 
           "rating": m.get("rating",""), "genre": m.get("genre",""), 
           "stream_icon": m.get("stream_icon",""), "cover": m.get("cover",""),
           "plot": m.get("plot",""), "cast": m.get("cast",""), 
           "director": m.get("director",""), "category_id": m.get("category_id","")} 
          for m in data]

# Comprimir con gzip
compressed = gzip.compress(json.dumps(movies).encode())

# Subir
response = requests.post(
    UPLOAD_URL,
    headers={'X-API-KEY': API_KEY},
    files={'file': ('movies.json', compressed, 'application/octet-stream')}
)
print(response.json())
```

### 3. extract_catalog.js — Extracción manual (Node.js)

Archivo: [`extract_catalog.js`](extract_catalog.js)

Script alternativo para extraer el catálogo localmente con Node.js:
```bash
node extract_catalog.js
```
Guarda los JSONs en `catalog_data/`. Útil para pruebas locales o si el bot no está disponible.

---

## 🖼️ img_proxy.php — Proxy de Imágenes

Archivo: [`img_proxy.php`](img_proxy.php)

Resuelve dos problemas:
1. **Mixed content**: El sitio es HTTPS pero las imágenes del IPTV son HTTP
2. **Oculta el servidor IPTV**: No expone `enlatv.com:8080` al usuario final

**Uso en el frontend:**
```javascript
function getSecureImageUrl(url) {
    if (url.includes('enlatv.com:8080/')) {
        const path = url.split('enlatv.com:8080/')[1];
        return 'img_proxy.php?path=' + encodeURIComponent(path);
    }
    // También soporta servidores IP directos
    const ipMatch = url.match(/https?:\/\/[\d.:]+\/(.*)/);
    if (ipMatch) {
        return 'img_proxy.php?host=' + encodeURIComponent(url.split('/').slice(0, 3).join('/')) + '&path=' + encodeURIComponent(ipMatch[1]);
    }
    return url;
}
```

**Servidores IPTV whitelisted:**
- `http://enlatv.com:8080`
- `http://23.239.106.58:80`
- `http://104.250.159.146:80`

**Caché**: 7 días (`Cache-Control: public, max-age=604800`)

---

## 🔌 API del Servidor IPTV (Xtream Codes)

### Conexión
```
Servidor: http://enlatv.com:8080
API Base: http://enlatv.com:8080/player_api.php
Username: flow01
Password: caracoles
```

### Endpoints

| Acción | Endpoint | Descripción |
|--------|----------|-------------|
| Películas | `action=get_vod_streams` | Todas las películas con metadatos |
| Categorías VOD | `action=get_vod_categories` | Lista de categorías de películas |
| Series | `action=get_series` | Todas las series con metadatos |
| Categorías Series | `action=get_series_categories` | Lista de categorías de series |
| Info Serie | `action=get_series_info&series_id=XXX` | Detalle con temporadas y episodios |
| Canales | `action=get_live_streams` | Todos los canales en vivo |
| Categorías Live | `action=get_live_categories` | Categorías de canales |

### URL completa de ejemplo
```
http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_vod_streams
```

---

## 🔍 Cómo Funciona el Buscador (Frontend)

### Flujo de carga
1. El frontend hace `fetch('catalog_data/movies.json')` al cargar la página
2. Datos se cachean en `localStorage` por 24 horas (`ftv_movies`, `ftv_series`, etc.)
3. En visitas repetidas, carga desde localStorage instantáneamente
4. Si hay `trending.json`, los items trending se muestran primero con badge 🔥

### Funcionalidades principales
- **3 tipos**: Películas, Series, Canales (tabs)
- **Búsqueda en tiempo real** con debounce 300ms (multi-término AND)
- **Filtros de género** con pills (AND logic)
- **Trending**: Items de `trending.json` aparecen primero con badge "🔥 Top"
- **Paginación adaptativa**: 9 en móvil (3×3), 8 en tablet (2×4), 10 en PC (2×5)
- **Canales en carpetas** con paginación por páginas
- **Detail overlay**: Modal compacto con poster, sinopsis, reparto, rating
- **Image proxy**: Usa `getSecureImageUrl()` para evitar mixed content
- **localStorage cache**: 24h TTL para carga instantánea en visitas repetidas

### Código clave del buscador (en index.html)
```javascript
// Archivos de datos
const files = {
  movies: 'catalog_data/movies.json',
  series: 'catalog_data/series.json',
  channels: 'catalog_data/channels.json'
};

// Cache en localStorage (24h)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Trending: carga trending.json, reordena items trending al inicio
async function loadData(type) {
    if (!trendingData) {
        trendingData = await (await fetch('catalog_data/trending.json')).json();
    }
    // Intenta cache primero, luego fetch
    const cached = getCache(type);
    if (cached) { allData[type] = applyTrending(cached, type); return; }
    const res = await fetch(files[type]);
    const parsed = await res.json();
    setCache(type, parsed);
    allData[type] = applyTrending(parsed, type);
}
```

---

## 🖥️ Configuración del Servidor

### Bluehost (elflowtv.com) — Apache
- **`.htaccess`**: Gzip para JSON/HTML/CSS/JS, caché 6h para JSON, 7d para imágenes, CORS `*`, protección de `upload_catalog.php`
- **PHP 8.3**: `memory_limit=512M`, `upload_max_filesize=512M`, `max_execution_time=300`
- Archivos: `index.html`, `styles.css`, `catalogo.css`, `upload_catalog.php`, `img_proxy.php`, `catalog_data/`

### VPS Linode (catalogo.nachotv.site) — Nginx
- **IP**: `23.239.118.251`
- **Nginx config**: SSL Let's Encrypt, caché 7d para estáticos
- **Deploy**: Git repo en `/opt/catalogo-nachotv-repo/`, deploy script en `/opt/deploy-catalogo.sh`
- **Catálogo estático**: Archivos JSON se copian a `/var/www/catalogo-nachotv/tv/catalog_data/`
- **Deploy command**: `bash /opt/deploy-catalogo.sh` (hace `git pull` + copia archivos)

### Deploy script VPS (`/opt/deploy-catalogo.sh`)
```bash
#!/bin/bash
REPO_DIR="/opt/catalogo-nachotv-repo"
DEPLOY_DIR="/var/www/catalogo-nachotv"
cd "$REPO_DIR" && git pull origin main
cp "$REPO_DIR/index.html" "$DEPLOY_DIR/"
# ... copia todos los archivos a /var/www/catalogo-nachotv/tv/
```

---

## 🎨 Diseño

### Paleta de colores
| Color | Hex | Uso |
|-------|-----|-----|
| Fondo | `#0a0b10` | Background principal |
| Rojo acento | `#ff3b3b` | Botones, badges, highlights |
| Texto | `#e8e8e8` | Texto principal |
| Texto muted | `#888` | Texto secundario |
| Cards | `rgba(255,255,255,0.03-0.04)` | Fondo de tarjetas |

### Componentes
- **Popup promocional**: Se muestra al cargar (se oculta con `?nopopup` en URL)
- **Device toggle**: Planes de 1 vs 4 dispositivos
- **Stat cards**: Contadores animados (5,689 canales, 17,552 películas, 7,638 series)
- **Genre pills**: Filtros por género con toggle
- **Result cards**: Grid responsivo con póster 2/3, rating, año, trending badge
- **Channel folders**: Carpetas por categoría con paginación

---

## 📊 Analytics y Tracking

### Google Analytics 4
- **ID**: `G-Q5VPGQF6JD`
- Se carga de forma diferida con `window.addEventListener('load')` para no bloquear render

### Meta Pixel (Facebook)
- **Pixel ID**: `4400299233579759`
- Tracking de `PageView`, integrado para conversiones de Facebook Ads

---

## 📱 WhatsApp

Botón flotante en todas las páginas: `https://wa.link/8fijhf`

Links de WhatsApp por plan:
| Plan | Link |
|------|------|
| 1 Mes / 1 Disp | `wa.link/k5zmfw` |
| 3 Meses / 1 Disp | `wa.link/r5w5is` |
| 6 Meses / 1 Disp | `wa.link/xov3pi` |
| 1 Mes / 4 Disp | `wa.link/jcg5fq` |
| 3 Meses / 4 Disp | `wa.link/98596w` |
| 6 Meses / 4 Disp | `wa.link/snn1nl` |
| Demo 6h | `wa.link/8fijhf` |

---

## ⚠️ Notas Importantes

1. **Los JSONs del catálogo son grandes** (~35MB total). El `.htaccess` ya configura gzip para JSON.
2. **Las imágenes de pósters** son URLs externas de TMDB o del servidor IPTV. Se proxifican via `img_proxy.php` en producción.
3. **El video demo** (`video/demo.mp4`, 33MB) se sirve directamente.
4. **localStorage cache** de 24h en el frontend acelera cargas repetidas.
5. **Trending**: El bot puede subir un `trending.json` con IDs de contenido popular, que aparece primero con badge 🔥.
6. **El bot de actualización debe implementarse** para correr diariamente y subir JSONs actualizados a `upload_catalog.php`.
