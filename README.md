# FlowTV - IPTV Landing Page & Catálogo

## 📋 Descripción General

Sitio web de venta/demostración de servicio IPTV (FlowTV). Incluye:
- **Landing page** (`index.html`) — página principal con planes, demo en video, instalación
- **Catálogo completo** (`catalogo.html`) — buscador integrado de películas, series y canales con estadísticas animadas
- **Buscador standalone** (`buscador.html`) — versión independiente del buscador

## 🏗️ Arquitectura

```
iptvlanding/
├── index.html              # Landing page principal
├── catalogo.html           # Catálogo con buscador integrado + demo en video
├── buscador.html           # Buscador standalone (búsqueda de películas/series/canales)
├── styles.css              # Estilos globales (landing)
├── catalogo.css            # Estilos adicionales del catálogo
├── .htaccess               # Redirección HTTPS + quitar www
├── extract_catalog.js      # Script Node.js para extraer datos del API del servidor IPTV
├── _peek.py                # Script helper para inspeccionar JSONs
│
├── catalog_data/           # ⬅️ DATOS DEL CATÁLOGO (se actualizan desde el servidor)
│   ├── movies.json         # ~25MB — 17,552 películas (simplificado)
│   ├── series.json         # ~8MB  — 7,638 series (simplificado)
│   ├── channels.json       # ~2.7MB — 5,689 canales
│   ├── live_categories.json # Categorías de canales en vivo
│   └── _series_test.json   # Datos de prueba de una serie individual
│
├── images/
│   ├── logo.png            # Logo FlowTV
│   ├── horizontalmundial.png
│   └── peliculas/          # Pósters locales de ejemplo
│       ├── apex.jpeg
│       ├── michael.jpg
│       └── proyecto.jpg
│
├── video/
│   └── demo.mp4            # Video demo del servicio (~33MB)
│
└── resources/              # Capturas de red Fiddler (sesiones HTTP capturadas)
    ├── sessions.saz
    ├── sessions.zip
    └── sessions_extracted/
        └── raw/            # Requests/responses individuales del API
```

## 🔌 API del Servidor IPTV (Xtream Codes)

El catálogo se alimenta de un servidor IPTV con API Xtream Codes:

### Configuración de conexión
```
Servidor: http://enlatv.com:8080
API Base: http://enlatv.com:8080/player_api.php
Username: flow01
Password: caracoles
```

### Endpoints disponibles

| Endpoint | Acción | Descripción |
|----------|--------|-------------|
| `player_api.php?...&action=get_vod_streams` | Películas | Retorna TODAS las películas con metadatos completos |
| `player_api.php?...&action=get_vod_categories` | Categorías VOD | Lista de categorías de películas |
| `player_api.php?...&action=get_series` | Series | Retorna TODAS las series con metadatos |
| `player_api.php?...&action=get_series_categories` | Categorías Series | Lista de categorías de series |
| `player_api.php?...&action=get_series_info&series_id=XXX` | Info Serie | Detalle de una serie con temporadas y episodios |
| `player_api.php?...&action=get_live_streams` | Canales | Retorna TODOS los canales en vivo |
| `player_api.php?...&action=get_live_categories` | Categorías Live | Lista de categorías de canales |

### Formato de URL completo
```
http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_vod_streams
```

### Formato de datos de películas (del API)
```json
{
  "num": 1,
  "name": "Nombre de la Película",
  "stream_type": "movie",
  "stream_id": 12345,
  "stream_icon": "https://image.tmdb.org/...",  // Póster desde TMDB
  "rating": "7.5",
  "rating_5based": 3.75,
  "genre": "Acción, Aventura",
  "plot": "Descripción de la película...",
  "cast": "Actor 1, Actor 2",
  "director": "Director",
  "year": "2024",
  "added": "1700000000",
  "category_id": "123",
  "container_extension": "mkv"
}
```

### Formato simplificado guardado en `catalog_data/movies.json`
```json
{
  "id": 12345,
  "name": "Nombre de la Película",
  "year": "2024",
  "rating": "7.5",
  "genre": "Acción, Aventura",
  "poster": "https://image.tmdb.org/...",
  "plot": "Descripción...",
  "cast": "Actor 1, Actor 2",
  "director": "Director",
  "added": "1700000000",
  "category_id": "123"
}
```

### Formato de canales
```json
{
  "id": 12345,
  "name": "ESPN HD",
  "icon": "https://...",
  "category_id": "5",
  "epg_channel_id": "ESPN.us"
}
```

## 🔍 Cómo Funciona el Buscador

### Flujo de datos actual (archivos estáticos)
1. **Extracción**: Se ejecuta `node extract_catalog.js` manualmente para descargar datos del API
2. **Almacenamiento**: Los datos se guardan como JSON en `catalog_data/`
3. **Carga en cliente**: El buscador hace `fetch('catalog_data/movies.json')` para cargar los datos
4. **Búsqueda**: Todo el filtrado es client-side con JavaScript puro

### Lógica de búsqueda (en `buscador.html` y `catalogo.html`)
```javascript
// Archivos de datos
const files = {
  movies: 'catalog_data/movies.json',    // ~17,552 películas
  series: 'catalog_data/series.json',    // ~7,638 series
  channels: 'catalog_data/channels.json' // ~5,689 canales
};

// Búsqueda por nombre (multi-término AND)
const terms = query.split(/\s+/);
results = data.filter(item => {
  const name = (item.name || item.title || '').toLowerCase();
  return terms.every(t => name.includes(t));
});

// Filtrado por géneros (AND logic: debe coincidir con TODOS los seleccionados)
results = results.filter(item => {
  const itemGenres = (item.genre || '').split(',').map(g => g.trim().toLowerCase());
  return selectedGenres.every(sg => itemGenres.some(ig => ig === sg.toLowerCase()));
});

// Deduplicación
const seen = new Set();
filtered = results.filter(item => {
  const id = item.stream_id || item.series_id || item.name;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
});
```

### Funcionalidades del buscador
- **3 tipos de contenido**: Películas, Series, Canales (tabs)
- **Búsqueda en tiempo real** con debounce de 300ms
- **Filtros por género** (pills) con lógica AND
- **Paginación**: Muestra 50 resultados, botón "Cargar más" para +50
- **Vista detalle**: Overlay modal con póster, sinopsis, reparto, rating
- **Canales en carpetas**: Agrupados por categoría con expandir/colapsar
- **Series con temporadas**: Al ver detalle de una serie, hace fetch en vivo al API para obtener info de temporadas:
  ```
  http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_series_info&series_id=XXX
  ```

### Géneros soportados
**Películas**: Acción, Aventura, Animación, Ciencia ficción, Comedia, Crimen, Documental, Drama, Familia, Fantasía, Historia, Misterio, Música, Romance, Suspense, Terror, Bélica, Western

**Series**: Animación, Comedia, Crimen, Documental, Drama, Familia, Historia, Misterio, Romance, Western, Action & Adventure, Kids, News, Reality, Sci-Fi & Fantasy, Soap, Talk, War & Politics

## 🎨 Diseño y Estilos

### Paleta de colores
- **Fondo principal**: `#0a0b10` (casi negro)
- **Acento principal**: `#ff3b3b` (rojo)
- **Texto principal**: `#e8e8e8`
- **Texto secundario**: `#888`
- **Bordes**: `rgba(255,255,255,0.06-0.08)`
- **Cards hover**: borde `rgba(255,59,59,0.3)`, sombra negra

### Componentes UI
- **Cards de películas**: Poster 2/3 aspect ratio, badge de rating, año, hover con translateY
- **Carpetas de canales**: Grid expandible, iconos de canal 36x36
- **Detail overlay**: Modal backdrop-blur, poster + info, botones CTA
- **Genre pills**: Botones redondeados toggle, estilo chip

## 🖥️ Despliegue en Servidor

### Requisitos
- Servidor web con soporte para `.htaccess` (Apache) o equivalente
- Servir archivos estáticos (HTML, CSS, JS, JSON, videos)
- HTTPS habilitado (el `.htaccess` ya redirige HTTP→HTTPS)

### Para actualizar el catálogo desde el servidor
```bash
# Requiere Node.js instalado
node extract_catalog.js
```
Esto descarga datos frescos del API `enlatv.com:8080` y genera los JSONs en `catalog_data/`.

### Migración a servidor (actualización dinámica)
Para que los datos se actualicen automáticamente desde el servidor:

**Opción A: Cron job + archivos estáticos**
- Ejecutar `node extract_catalog.js` con un cron cada X horas
- Los archivos JSON se regeneran y el frontend los sirve como estáticos

**Opción B: API proxy (recomendado para producción)**
- Crear un backend que haga proxy al API de Xtream Codes
- El frontend llama al backend en vez de cargar JSONs estáticos
- Ventaja: datos siempre actualizados, no se exponen credenciales

**Opción C: Servir directamente del API (simplificado)**
- Cambiar las URLs en el frontend para apuntar directamente al API:
  ```javascript
  const files = {
    movies: 'http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_vod_streams',
    series: 'http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_series',
    channels: 'http://enlatv.com:8080/player_api.php?username=flow01&password=caracoles&action=get_live_streams'
  };
  ```
  ⚠️ Problemas: CORS, expone credenciales, sin caché

## 📊 Google Analytics

El catálogo tiene GA4 integrado con tracking ID `G-Q5VPGQF6JD`:
- `catalog_switch_type` — cuando el usuario cambia entre Películas/Series/Canales
- `view_content_detail` — cuando abre el detalle de un título
- `click_whatsapp` — clicks al botón de WhatsApp
- `click_ver_planes` — clicks a "Ver Planes"
- `click_demo` — clicks a "Pedir demo"

## 📱 WhatsApp

Botón flotante en todas las páginas: `https://wa.link/8fijhf`

## ⚠️ Notas Importantes

1. **Los JSONs del catálogo son grandes** (~35MB total). En producción considerar compresión gzip en el servidor.
2. **Las imágenes de pósters** (`stream_icon`, `cover`) son URLs externas de TMDB, no locales.
3. **El video demo** (`video/demo.mp4`, 33MB) se sirve directamente. Considerar CDN para producción.
4. **Credenciales del API** están expuestas en `extract_catalog.js` y en `buscador.html` (línea 514 para series info). En producción, mover a backend.
