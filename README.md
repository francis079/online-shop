# StrideShop

A simple shoe store website built with HTML, CSS, JavaScript, and Python Flask.

## Features

- Product catalog powered by Flask and SQLite
- Customer order form with name, phone, email, and quantity
- Seller dashboard with access key to add product items
- Seller can remove products and view customer orders
- Product management and order notifications in the UI

## Run locally

1. Create a virtual environment:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the app:
   ```bash
   python app.py
   ```
4. Open http://127.0.0.1:5000/

## Deploy on Render

1. Push your code to GitHub
2. Go to https://render.com and create a new Web Service
3. Connect your GitHub repository
4. Configure the deployment:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -b 0.0.0.0:$PORT app:app`
5. Click Deploy

The app will automatically initialize the database and serve the frontend + API from a single endpoint.

## PHP backend (optional)

If you prefer to run the PHP-based API instead of Flask, an alternative PHP backend is provided in `php_backend`.

Initialize the PHP DB once:

```bash
php php_backend/init_db.php
```

Start the PHP built-in server (serves the API under `/api.php` style routing):

```bash
php -S localhost:8000 -t php_backend
```

API examples:

- List products: `http://localhost:8000/api.php?resource=products`
- Add product (multipart/form-data): POST to `http://localhost:8000/api.php?resource=products`
- Place order: POST JSON to `http://localhost:8000/api.php?resource=orders`


## Seller access

- Seller key: `seller2026`

## Notes

- The app stores products and orders in `shop.db`.
- Use the seller dashboard to add or remove products and see order details.
 
Validation and uploads

- Uploaded images are limited to 2 MB and must be JPEG, PNG, or WEBP.
- The seller form shows a live preview and upload progress when submitting a product image.
