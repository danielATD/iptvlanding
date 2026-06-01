<?php
/**
 * FlowTV Catalog Upload Endpoint
 * Receives catalog JSON data securely over HTTPS.
 * Place this file in your Bluehost public_html directory.
 */

// ========== CONFIGURATION ==========
// Change this to a strong random key. Must match the Python script.
$SECRET_KEY = 'FTV_2026_x9Kp7mRw4Qz8nBv3';

// Directory where JSON files will be saved (relative to this script)
$CATALOG_DIR = __DIR__ . '/catalog_data';

// Allowed file names (security: only these can be uploaded)
$ALLOWED_FILES = ['movies.json', 'series.json', 'channels.json', 'live_categories.json', 'trending.json'];

// ========== SECURITY CHECKS ==========
header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Verify secret key
$providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!hash_equals($SECRET_KEY, $providedKey)) {
    http_response_code(403);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// Check if a file was uploaded
if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['file'];
$fileName = $file['name'] ?? '';

if (empty($fileName)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing filename']);
    exit;
}

// Security: only allow whitelisted filenames
if (!in_array($fileName, $ALLOWED_FILES)) {
    http_response_code(400);
    echo json_encode(['error' => 'File not allowed: ' . $fileName]);
    exit;
}

// Decompress the gzipped data
$compressedData = file_get_contents($file['tmp_name']);
$fileData = gzdecode($compressedData);

if ($fileData === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Failed to decompress data']);
    exit;
}

// Validate that the data is valid JSON
$decoded = json_decode($fileData);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Create catalog directory if it doesn't exist
if (!is_dir($CATALOG_DIR)) {
    mkdir($CATALOG_DIR, 0755, true);
}

// Write the file
$filePath = $CATALOG_DIR . '/' . $fileName;
$bytesWritten = file_put_contents($filePath, $fileData);

if ($bytesWritten === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write file']);
    exit;
}

// Success
echo json_encode([
    'success' => true,
    'file' => $fileName,
    'size' => $bytesWritten,
    'timestamp' => date('Y-m-d H:i:s')
]);
