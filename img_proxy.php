<?php
/**
 * FlowTV Image Proxy
 * Oculta el dominio del servidor IPTV original.
 * Soporta múltiples servidores de imágenes IPTV.
 */

// 1. Obtener la ruta de la imagen solicitada
$path = $_GET['path'] ?? '';
$host = $_GET['host'] ?? '';

// Si no hay ruta, devolver 404
if (empty($path)) {
    http_response_code(404);
    exit;
}

// 2. Seguridad: Evitar Directory Traversal
if (strpos($path, '../') !== false) {
    http_response_code(403);
    exit;
}

// 3. Determinar el servidor de origen
$ALLOWED_HOSTS = [
    'http://enlatv.com:8080',
    'http://23.239.106.58:80',
    'http://23.239.106.58',
    'http://104.250.159.146:80',
    'http://104.250.159.146',
];
$iptv_domain = "http://enlatv.com:8080/";

if (!empty($host)) {
    // Validate host against whitelist
    $host_clean = rtrim($host, '/');
    if (in_array($host_clean, $ALLOWED_HOSTS)) {
        $iptv_domain = $host_clean . '/';
    } else {
        http_response_code(403);
        exit;
    }
}

$target_url = $iptv_domain . ltrim($path, '/');

// 4. Headers: imagen + caché
header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=604800'); // 7 días
header('Access-Control-Allow-Origin: *');

// 5. Descargar y enviar la imagen
$image = @file_get_contents($target_url);

if ($image === false) {
    http_response_code(404);
    // Imagen transparente 1x1
    echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
} else {
    echo $image;
}
?>
