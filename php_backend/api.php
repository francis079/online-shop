<?php
header('Content-Type: application/json');
$base = __DIR__;
$dbFile = $base . '/db/shop.db';
$SELLER_KEY = 'seller2026';
if (!file_exists($dbFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Database not initialized. Run init_db.php']);
    exit;
}

$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// simple router using ?resource=products or ?resource=orders and optional id
$resource = $_GET['resource'] ?? null;
$id = isset($_GET['id']) ? intval($_GET['id']) : null;
$method = $_SERVER['REQUEST_METHOD'];
// support method override via _method form field
if ($method === 'POST' && isset($_POST['_method'])) {
    $method = strtoupper($_POST['_method']);
}

function json_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($resource === 'products') {
    if ($method === 'GET') {
        $stmt = $pdo->query('SELECT * FROM products ORDER BY id DESC');
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response($rows);
    }

    if ($method === 'POST') {
        // handle multipart/form-data or json
        $name = '';
        $price = null;
        $color = '';
        $tag = '';
        $image_url = '';

        $MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
        $ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

        if (!empty($_FILES['image']['name'])) {
            $upDir = $base . '/uploads';
            if (!is_dir($upDir)) mkdir($upDir, 0755, true);
            $fn = basename($_FILES['image']['name']);
            $fn = preg_replace('/[^A-Za-z0-9._-]/', '_', $fn);
            $target = $upDir . '/' . $fn;
            $i = 1;
            while (file_exists($target)) {
                $target = $upDir . '/' . pathinfo($fn, PATHINFO_FILENAME) . '_' . $i . '.' . pathinfo($fn, PATHINFO_EXTENSION);
                $i++;
            }
            // Validate MIME type
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $_FILES['image']['tmp_name']);
            finfo_close($finfo);
            if (!in_array($mime, $ALLOWED_MIMES)) {
                json_response(['error' => 'Invalid image type'], 400);
            }
            // Validate size
            if ($_FILES['image']['size'] > $MAX_UPLOAD_BYTES) {
                json_response(['error' => 'Image exceeds maximum size (2 MB)'], 400);
            }
            move_uploaded_file($_FILES['image']['tmp_name'], $target);
            $image_url = '/uploads/' . basename($target);
            $name = $_POST['name'] ?? '';
            $price = intval($_POST['price'] ?? 0);
            $color = $_POST['color'] ?? '';
            $tag = $_POST['tag'] ?? '';
        } else {
            // try json body
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? $_POST;
            $name = trim($data['name'] ?? '');
            $price = isset($data['price']) ? intval($data['price']) : null;
            $color = trim($data['color'] ?? '');
            $tag = trim($data['tag'] ?? '');
            $image_url = trim($data['image_url'] ?? '');
        }

        if (!$name || !$price || !$color || !$tag) {
            json_response(['error' => 'All product fields are required.'], 400);
        }

        $stmt = $pdo->prepare('INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$name, $price, $color, $tag, $image_url]);
        json_response(['message' => 'Product created', 'product_id' => $pdo->lastInsertId()], 201);
    }

    if ($method === 'DELETE' || ($method === 'POST' && isset($_POST['_method']) && $_POST['_method'] === 'DELETE')) {
        if (!$id) json_response(['error' => 'id required'], 400);
        // extract seller key from JSON, POST, or GET
        $raw = file_get_contents('php://input');
        $inputData = json_decode($raw, true) ?? $_POST ?? $_GET;
        $key = trim($inputData['key'] ?? $_POST['key'] ?? $_GET['key'] ?? '');
        if ($key !== $SELLER_KEY) json_response(['error' => 'Forbidden'], 403);

        $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) json_response(['error' => 'Product not found'], 404);
        json_response(['message' => 'Product removed']);
    }
}

if ($resource === 'validate') {
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;
        $key = trim($data['key'] ?? '');
        if ($key === $SELLER_KEY) json_response(['ok' => true]);
        json_response(['ok' => false], 403);
    }
}

if ($resource === 'orders') {
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT orders.*, products.name AS product_name FROM orders JOIN products ON products.id = orders.product_id ORDER BY orders.created_at DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        json_response($rows);
    }

    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?? $_POST;
        $product_id = intval($data['product_id'] ?? 0);
        $quantity = intval($data['quantity'] ?? 0);
        $customer_name = trim($data['customer_name'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $email = trim($data['email'] ?? '');

        if (!$product_id || !$quantity || !$customer_name || !$phone || !$email) {
            json_response(['error' => 'All order fields are required.'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $stmt->execute([$product_id]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$product) json_response(['error' => 'Product not found.'], 404);

        $total = intval($product['price']) * $quantity;
        $created_at = (new DateTime())->format(DATE_ATOM);

        $stmt = $pdo->prepare('INSERT INTO orders (product_id, quantity, customer_name, phone, email, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$product_id, $quantity, $customer_name, $phone, $email, $total, $created_at]);

        json_response(['message' => 'Order recorded', 'order_id' => $pdo->lastInsertId()], 201);
    }
}

json_response(['error' => 'Unknown resource or method'], 400);
