let sellerUnlocked = false;

const selectors = {
  productGrid: document.getElementById('productGrid'),
  productSelect: document.getElementById('productSelect'),
  productImageFile: document.getElementById('productImageFile'),
  productImagePreview: document.getElementById('productImagePreview'),
  backendSelect: document.getElementById('backendSelect'),
  uploadProgress: document.getElementById('uploadProgress'),
  orderForm: document.getElementById('orderForm'),
  orderStatus: document.getElementById('orderStatus'),
  shopMessage: document.getElementById('shopMessage'),
  sellerKeyInput: document.getElementById('sellerKey'),
  unlockSellerButton: document.getElementById('unlockSeller'),
  sellerArea: document.getElementById('sellerArea'),
  productForm: document.getElementById('productForm'),
  productStatus: document.getElementById('productStatus'),
  orderList: document.getElementById('orderList')
};

let apiMode = 'flask'; // 'flask' or 'php'
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function detectApiMode() {
  // prefer Flask if available
  try {
    const r = await fetch('/api/products', { method: 'GET' });
    if (r.ok) { apiMode = 'flask'; return; }
  } catch (e) {
    // ignore
  }

  // try PHP backend
  try {
    const r2 = await fetch('/api.php?resource=products', { method: 'GET' });
    if (r2.ok) { apiMode = 'php'; return; }
  } catch (e) {
    // ignore
  }

  apiMode = 'flask';
}

async function fetchProducts() {
  try {
    let response;
    if (apiMode === 'flask') response = await fetch('/api/products');
    else response = await fetch('/api.php?resource=products');
    if (!response.ok) throw new Error(`API returned ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    showShopMessage(`Shop unavailable: ${error.message}. If deployed on Render, ensure the backend is running and the database has been initialized.`, 'error');
    console.error('Fetch error:', error);
    return [];
  }
}

async function fetchOrders() {
  try {
    let response;
    if (apiMode === 'flask') response = await fetch('/api/orders');
    else response = await fetch('/api.php?resource=orders');
    if (!response.ok) throw new Error('Unable to load orders');
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

function formatCurrency(value) {
  return `Ksh ${Number(value).toLocaleString('en-KE')}`;
}

function showShopMessage(message, type = 'info') {
  selectors.shopMessage.textContent = message;
  selectors.shopMessage.className = `message ${type}`;
  selectors.shopMessage.classList.remove('hidden');
}

function clearShopMessage() {
  selectors.shopMessage.className = 'message info hidden';
}

function showStatus(element, message, type = 'success') {
  element.textContent = message;
  element.className = `message ${type}`;
  element.classList.remove('hidden');
  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}

function renderProducts(products) {
  selectors.productGrid.innerHTML = '';
  selectors.productSelect.innerHTML = '';

  if (!products.length) {
    selectors.productGrid.innerHTML = '<p class="message info">No products are available yet. Sellers can add new shoes to the catalog.</p>';
    return;
  }

  products.forEach(product => {
    const card = document.createElement('article');
    card.className = 'product-card';

    const imageUrl = product.image_url || 'https://images.unsplash.com/photo-1519741491908-331efa60fde2?auto=format&fit=crop&w=900&q=80';

    card.innerHTML = `
      <img src="${imageUrl}" alt="${product.name}" />
      <div class="card-body">
        <div>
          <h4>${product.name}</h4>
          <p>${product.color} · ${formatCurrency(product.price)}</p>
          <span class="tag">${product.tag}</span>
        </div>
        <div class="card-footer">
          <strong>${formatCurrency(product.price)}</strong>
          ${sellerUnlocked ? `<button class="button button-danger" data-delete-id="${product.id}">Delete</button>` : ''}
        </div>
      </div>
    `;

    if (sellerUnlocked) {
      const deleteButton = card.querySelector('[data-delete-id]');
      deleteButton.addEventListener('click', () => deleteProduct(product.id));
    }

    selectors.productGrid.appendChild(card);

    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} — ${formatCurrency(product.price)}`;
    selectors.productSelect.appendChild(option);
  });
}

function renderOrders(orders) {
  selectors.orderList.innerHTML = '';

  if (!orders.length) {
    selectors.orderList.innerHTML = '<p class="message info">No orders have been placed yet.</p>';
    return;
  }

  orders.forEach(order => {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.innerHTML = `
      <p><strong>${order.customer_name}</strong> placed an order for <strong>${order.quantity} x ${order.product_name}</strong></p>
      <p>Phone: ${order.phone}</p>
      <p>Email: ${order.email}</p>
      <p>Total: ${formatCurrency(order.total)}</p>
      <p class="muted">${new Date(order.created_at).toLocaleString()}</p>
    `;
    selectors.orderList.appendChild(orderCard);
  });
}

async function updateProductList() {
  clearShopMessage();
  const products = await fetchProducts();
  renderProducts(products);
}

async function updateOrderList() {
  if (!sellerUnlocked) return;
  const orders = await fetchOrders();
  renderOrders(orders);
}

async function placeOrder(event) {
  event.preventDefault();
  const payload = {
    product_id: Number(selectors.productSelect.value),
    quantity: Number(document.getElementById('orderQuantity').value),
    customer_name: document.getElementById('customerName').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    email: document.getElementById('customerEmail').value.trim()
  };

  try {
    let response;
    if (apiMode === 'flask') {
      response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch('/api.php?resource=orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || 'Order failed');

    showStatus(selectors.orderStatus, `Order received. ${result.message}`, 'success');
    selectors.orderForm.reset();
    updateOrderList();
  } catch (error) {
    showStatus(selectors.orderStatus, error.message, 'error');
  }
}

async function addProduct(event) {
  event.preventDefault();
  const name = document.getElementById('productName').value.trim();
  const price = Number(document.getElementById('productPrice').value);
  const color = document.getElementById('productColor').value.trim();
  const tag = document.getElementById('productTag').value.trim();

  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('color', color);
  formData.append('tag', tag);

  const fileInput = selectors.productImageFile;
  if (fileInput && fileInput.files && fileInput.files.length) {
    formData.append('image', fileInput.files[0]);
  }

  try {
    const addBtn = selectors.productForm.querySelector('button[type="submit"]');
    if (addBtn) addBtn.disabled = true;
    const filePresent = fileInput && fileInput.files && fileInput.files.length;
    let result;

    if (filePresent) {
      // Use XMLHttpRequest to allow progress events
      const xhr = new XMLHttpRequest();
      const url = apiMode === 'flask' ? '/api/products' : '/api.php?resource=products';
      xhr.open('POST', url, true);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && selectors.uploadProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          selectors.uploadProgress.value = pct;
          selectors.uploadProgress.classList.remove('hidden');
        }
      };

      const promise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          selectors.uploadProgress.classList.add('hidden');
          try {
            const json = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, json });
            else resolve({ ok: false, json });
          } catch (e) {
            resolve({ ok: false, json: { error: 'Invalid server response' } });
          }
        };
        xhr.onerror = () => { selectors.uploadProgress.classList.add('hidden'); reject(new Error('Upload failed')); };
      });

      xhr.send(formData);
      const respWrap = await promise;
      if (!respWrap.ok) throw new Error((respWrap.json && respWrap.json.error) || 'Unable to add product');
      result = respWrap.json;
    } else {
      // No file — standard fetch
      const url = apiMode === 'flask' ? '/api/products' : '/api.php?resource=products';
      const response = await fetch(url, { method: 'POST', body: formData });
      result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add product');
    }

    showStatus(selectors.productStatus, 'Product added successfully.', 'success');
    selectors.productForm.reset();
    if (selectors.productImagePreview) {
      selectors.productImagePreview.src = '';
      selectors.productImagePreview.classList.add('hidden');
    }
    updateProductList();
  } catch (error) {
    showStatus(selectors.productStatus, error.message, 'error');
  } finally {
    const addBtn = selectors.productForm.querySelector('button[type="submit"]');
    if (addBtn) addBtn.disabled = false;
  }
}

async function deleteProduct(productId) {
  if (!confirm('Remove this product from the catalog?')) return;

  try {
    let response;
    const sellerKey = selectors.sellerKeyInput ? selectors.sellerKeyInput.value.trim() : '';
    if (apiMode === 'flask') {
      const headers = {};
      if (sellerKey) headers['X-Seller-Key'] = sellerKey;
      response = await fetch(`/api/products/${productId}`, { method: 'DELETE', headers });
    } else {
      const fd = new FormData();
      fd.append('_method', 'DELETE');
      if (sellerKey) fd.append('key', sellerKey);
      response = await fetch(`/api.php?resource=products&id=${productId}`, { method: 'POST', body: fd });
    }
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || 'Delete failed');

    showShopMessage(result.message, 'success');
    updateProductList();
    updateOrderList();
  } catch (error) {
    showShopMessage(error.message, 'error');
  }
}

function unlockSeller() {
  const key = selectors.sellerKeyInput.value.trim();
  if (!key) { showShopMessage('Enter seller key to unlock.', 'error'); return; }

  (async () => {
    try {
      let resp;
      const formBody = new URLSearchParams();
      formBody.append('key', key);
      if (apiMode === 'flask') {
        resp = await fetch('/api/validate_seller', { method: 'POST', body: formBody });
      } else {
        resp = await fetch('/api.php?resource=validate', { method: 'POST', body: formBody });
      }
      const result = await resp.json();
      if (resp.ok && result.ok) {
        sellerUnlocked = true;
        selectors.sellerArea.classList.remove('hidden');
        selectors.unlockSellerButton.textContent = 'Seller unlocked';
        selectors.unlockSellerButton.disabled = true;
        selectors.sellerKeyInput.disabled = true;
        updateProductList();
        updateOrderList();
        showShopMessage('Seller dashboard unlocked. You can add or remove products and view orders.', 'success');
      } else {
        showShopMessage('Invalid seller key. Please enter the correct access key.', 'error');
      }
    } catch (err) {
      showShopMessage('Unable to validate seller key.', 'error');
    }
  })();
}

selectors.orderForm.addEventListener('submit', placeOrder);
selectors.productForm.addEventListener('submit', addProduct);
selectors.unlockSellerButton.addEventListener('click', unlockSeller);

(async function init() {
  await detectApiMode();
  updateProductList();
})();

// Preview selected image in seller form
if (selectors.productImageFile && selectors.productImagePreview) {
  selectors.productImageFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      selectors.productImagePreview.src = '';
      selectors.productImagePreview.classList.add('hidden');
      return;
    }
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showStatus(selectors.productStatus, 'Invalid image type. Allowed: jpg, png, webp', 'error');
      selectors.productImageFile.value = '';
      selectors.productImagePreview.src = '';
      selectors.productImagePreview.classList.add('hidden');
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      showStatus(selectors.productStatus, 'Image is too large. Max 2 MB.', 'error');
      selectors.productImageFile.value = '';
      selectors.productImagePreview.src = '';
      selectors.productImagePreview.classList.add('hidden');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
      selectors.productImagePreview.src = ev.target.result;
      selectors.productImagePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });
}

// Backend selector handling
if (selectors.backendSelect) {
  selectors.backendSelect.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'auto') detectApiMode().then(() => updateProductList());
    else { apiMode = v; updateProductList(); }
  });
}
