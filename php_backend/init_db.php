<?php
// Run this once to initialize the PHP backend database: php php_backend/init_db.php
$dbDir = __DIR__ . '/db';
@mkdir($dbDir, 0755, true);
$dbFile = $dbDir . '/shop.db';
$pdo = new PDO('sqlite:' . $dbFile);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  color TEXT NOT NULL,
  tag TEXT NOT NULL,
  image_url TEXT DEFAULT ''
)");

$pdo->exec("CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL
)");

// seed sample products if empty
$cnt = $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
if ($cnt == 0) {
  $stmt = $pdo->prepare('INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)');
  $stmt->execute(['UltraLight Pro', 8900, 'Nebula Blue', 'Best seller', 'https://images.unsplash.com/photo-1519741491908-331efa60fde2?auto=format&fit=crop&w=900&q=80']);
  $stmt->execute(['CityRun X', 7400, 'Crimson', 'New arrival', 'https://images.unsplash.com/photo-1528701800489-20fdb9ab975f?auto=format&fit=crop&w=900&q=80']);
  $stmt->execute(['TrailFlex', 9900, 'Forest Green', 'Outdoor', 'https://images.unsplash.com/photo-1528701800489-20fdb9ab975f?auto=format&fit=crop&w=900&q=80']);
}

echo "PHP shop DB initialized at: $dbFile\n";
