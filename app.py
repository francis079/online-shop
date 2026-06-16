import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request, render_template
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'shop.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
SELLER_KEY = 'seller2026'
ALLOWED_MIMETYPES = {'image/jpeg', 'image/png', 'image/webp'}
MAX_UPLOAD_SIZE = 2 * 1024 * 1024  # 2 MB

app = Flask(__name__, template_folder='templates', static_folder='static')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        '''CREATE TABLE IF NOT EXISTS products (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               name TEXT NOT NULL,
               price INTEGER NOT NULL,
               color TEXT NOT NULL,
               tag TEXT NOT NULL,
               image_url TEXT DEFAULT ''
           )'''
    )
    cursor.execute(
        '''CREATE TABLE IF NOT EXISTS orders (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               product_id INTEGER NOT NULL,
               quantity INTEGER NOT NULL,
               customer_name TEXT NOT NULL,
               phone TEXT NOT NULL,
               email TEXT NOT NULL,
               total INTEGER NOT NULL,
               created_at TEXT NOT NULL,
               FOREIGN KEY(product_id) REFERENCES products(id)
           )'''
    )
    connection.commit()

    # ensure upload folder exists
    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    except Exception:
        pass

    cursor.execute('SELECT COUNT(*) AS total FROM products')
    if cursor.fetchone()['total'] == 0:
        cursor.executemany(
            'INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)',
            [
                ('UltraLight Pro', 8900, 'Nebula Blue', 'Best seller', 'https://images.unsplash.com/photo-1519741491908-331efa60fde2?auto=format&fit=crop&w=900&q=80'),
                ('CityRun X', 7400, 'Crimson', 'New arrival', 'https://images.unsplash.com/photo-1528701800489-20fdb9ab975f?auto=format&fit=crop&w=900&q=80'),
                ('TrailFlex', 9900, 'Forest Green', 'Outdoor', 'https://images.unsplash.com/photo-1528701800489-20fdb9ab975f?auto=format&fit=crop&w=900&q=80')
            ]
        )
        connection.commit()
    connection.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'message': 'StrideShop is running'})


@app.route('/api/validate_seller', methods=['POST'])
def validate_seller():
    key = ''
    # try JSON
    data = request.get_json(silent=True)
    if data and isinstance(data, dict):
        key = data.get('key', '')
    # try form
    if not key:
        key = request.form.get('key') or request.values.get('key') or request.args.get('key') or ''

    if key == SELLER_KEY:
        return jsonify({'ok': True})
    return jsonify({'ok': False}), 403

@app.route('/api/products', methods=['GET'])
def list_products():
    connection = get_db_connection()
    products = connection.execute('SELECT * FROM products ORDER BY id ASC').fetchall()
    connection.close()

    return jsonify([dict(product) for product in products])

@app.route('/api/products', methods=['POST'])
def add_product():
    # Support both JSON and multipart/form-data (file upload)
    image_url = ''
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        form = request.form
        name = form.get('name', '').strip()
        try:
            price = int(form.get('price') or 0)
        except ValueError:
            price = None
        color = form.get('color', '').strip()
        tag = form.get('tag', '').strip()

        image_file = request.files.get('image')
        if image_file and image_file.filename:
            # Validate mimetype
            mtype = image_file.mimetype or ''
            if mtype not in ALLOWED_MIMETYPES:
                return jsonify({'error': f'Invalid image type: {mtype}'}), 400

            filename = secure_filename(image_file.filename)
            # avoid collisions
            base, ext = os.path.splitext(filename)
            dest = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(dest):
                filename = f"{base}_{int(datetime.utcnow().timestamp())}{ext}"
                dest = os.path.join(UPLOAD_FOLDER, filename)
            image_file.save(dest)

            # Validate file size after save
            try:
                size = os.path.getsize(dest)
                if size > MAX_UPLOAD_SIZE:
                    os.remove(dest)
                    return jsonify({'error': 'Image exceeds maximum size (2 MB).'}), 400
            except Exception:
                pass

            image_url = f"/static/uploads/{filename}"
    else:
        payload = request.get_json(force=True)
        name = payload.get('name', '').strip()
        price = payload.get('price')
        color = payload.get('color', '').strip()
        tag = payload.get('tag', '').strip()
        image_url = payload.get('image_url', '').strip()

    if not name or not color or not tag or not price:
        return jsonify({'error': 'All product fields are required.'}), 400

    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(
        'INSERT INTO products (name, price, color, tag, image_url) VALUES (?, ?, ?, ?, ?)',
        (name, price, color, tag, image_url)
    )
    connection.commit()
    product_id = cursor.lastrowid
    connection.close()

    return jsonify({'message': 'Product created successfully.', 'product_id': product_id}), 201

def _extract_key_from_request(req):
    # Try JSON, then form/values/args, then header
    key = ''
    data = req.get_json(silent=True)
    if data and isinstance(data, dict):
        key = data.get('key', '')
    if not key:
        key = req.form.get('key') or req.values.get('key') or req.args.get('key') or ''
    if not key:
        key = req.headers.get('X-Seller-Key', '')
    return key

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def remove_product(product_id):
    # require seller key for deleting products
    key = _extract_key_from_request(request)
    if key != SELLER_KEY:
        return jsonify({'error': 'Forbidden'}), 403

    connection = get_db_connection()
    cursor = connection.cursor()
    result = cursor.execute('DELETE FROM products WHERE id = ?', (product_id,))
    connection.commit()
    connection.close()

    if result.rowcount == 0:
        return jsonify({'error': 'Product not found.'}), 404

    return jsonify({'message': 'Product removed from catalog.'})

@app.route('/api/orders', methods=['GET'])
def list_orders():
    connection = get_db_connection()
    orders = connection.execute(
        '''SELECT orders.*, products.name AS product_name
           FROM orders
           JOIN products ON products.id = orders.product_id
           ORDER BY orders.created_at DESC'''
    ).fetchall()
    connection.close()
    return jsonify([dict(order) for order in orders])

@app.route('/api/orders', methods=['POST'])
def place_order():
    payload = request.get_json(force=True)
    product_id = payload.get('product_id')
    quantity = payload.get('quantity')
    customer_name = payload.get('customer_name', '').strip()
    phone = payload.get('phone', '').strip()
    email = payload.get('email', '').strip()

    if not product_id or not quantity or not customer_name or not phone or not email:
        return jsonify({'error': 'All order fields are required.'}), 400

    connection = get_db_connection()
    product = connection.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    if not product:
        connection.close()
        return jsonify({'error': 'Product not found.'}), 404

    total = product['price'] * quantity
    created_at = datetime.utcnow().isoformat()

    cursor = connection.cursor()
    cursor.execute(
        'INSERT INTO orders (product_id, quantity, customer_name, phone, email, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (product_id, quantity, customer_name, phone, email, total, created_at)
    )
    connection.commit()
    order_id = cursor.lastrowid
    connection.close()

    return jsonify({'message': f'Order placed successfully for {customer_name}.', 'order_id': order_id}), 201

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)

# Ensure DB is initialized even when run with Gunicorn
init_db()
