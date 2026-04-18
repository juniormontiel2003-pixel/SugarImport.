// admin.js - Lógica del CRUD y Usuarios protegida por JWT

let currentToken = '';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Chequear Autenticación en Front y verificar token con el Back
    currentToken = checkAuth();
    if (!currentToken) return; // Se redirige automáticamente en checkAuth

    // Server-side verification
    try {
        const verifyRes = await fetch('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!verifyRes.ok) throw new Error('Token inválido');
    } catch (err) {
        logout();
        return;
    }

    // 2. Set UI Info
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('role');
    
    // Sidebar User UI
    document.getElementById('user-info-name').innerText = `@${username}`;
    document.getElementById('user-info-role').innerText = role;

    // Permissions matrix logic
    if (role === 'Admin') {
        // Admin gets everything
        document.getElementById('tabUsers').style.display = 'block';
        document.getElementById('tabSettings').style.display = 'block';
        fetchUsers(); 
        fetchSettings(); 
    } else {
        // Gestor only gets settings & inventary, no users!
        document.getElementById('tabSettings').style.display = 'block';
        fetchSettings();

        // Ocultar acciones de borrar (Delete) en inventario para Gestores
        const style = document.createElement('style');
        style.innerHTML = '.delete-btn { display: none !important; }';
        document.head.appendChild(style);
    }

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // 3. Inicializar Tabla de Productos
    fetchProductsForAdmin();

    // 4. Modal Events - Productos
    const productModal = document.getElementById('productModal');
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const productForm = document.getElementById('productForm');

    openAddModalBtn.addEventListener('click', () => {
        document.getElementById('modalTitle').innerText = 'Añadir Producto';
        productForm.reset();
        document.getElementById('productId').value = '';
        productModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        productModal.classList.remove('active');
    });

    productForm.addEventListener('submit', handleFormSubmit);

    // 5. Tabs Events
    const tabInventory = document.getElementById('tabInventory');
    const tabUsers = document.getElementById('tabUsers');
    const tabSettings = document.getElementById('tabSettings');
    const contentInventory = document.getElementById('contentInventory');
    const contentUsers = document.getElementById('contentUsers');
    const contentSettings = document.getElementById('contentSettings');

    function resetTabs() {
        tabInventory.classList.remove('active');
        tabUsers.classList.remove('active');
        tabSettings.classList.remove('active');
        contentInventory.style.display = 'none';
        contentUsers.style.display = 'none';
        contentSettings.style.display = 'none';
    }

    tabInventory.addEventListener('click', () => {
        resetTabs();
        tabInventory.classList.add('active');
        contentInventory.style.display = 'block';
    });

    tabUsers.addEventListener('click', () => {
        resetTabs();
        tabUsers.classList.add('active');
        contentUsers.style.display = 'block';
    });

    tabSettings.addEventListener('click', () => {
        resetTabs();
        tabSettings.classList.add('active');
        contentSettings.style.display = 'block';
    });

    // 6. Modal Events - Usuarios
    const userModal = document.getElementById('userModal');
    document.getElementById('openUserModalBtn').addEventListener('click', () => {
        document.getElementById('userForm').reset();
        userModal.classList.add('active');
    });
    document.getElementById('closeUserModalBtn').addEventListener('click', () => {
        userModal.classList.remove('active');
    });
    document.getElementById('userForm').addEventListener('submit', handleUserFormSubmit);
    
    // 7. Settings Form Event
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
});

// --- INVENTORY LOGIC ---
async function fetchProductsForAdmin() {
    try {
        const response = await fetch('/api/products'); 
        const products = await response.json();
        renderAdminTable(products);
    } catch (err) {
        console.error('Error fetching products:', err);
    }
}

function renderAdminTable(products) {
    const tbody = document.getElementById('productsTableBody');
    tbody.innerHTML = '';
    products.forEach(p => {
        const tr = document.createElement('tr');
        const imgDisplay = p.image_url ? `<img src="${p.image_url}" width="40" height="40" style="border-radius:4px; object-fit:cover;">` : 'Sin Imagen';
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${imgDisplay}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.brand}</td>
            <td>$${parseFloat(p.price).toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button class="actions-btn edit-btn" onclick="editProduct(${p.id}, '${escapeQuote(p.name)}', '${escapeQuote(p.brand)}', ${p.price}, ${p.stock}, '${p.image_url || ''}')">Editar</button>
                <button class="actions-btn delete-btn" onclick="deleteProduct(${p.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeQuote(str) {
    return str.replace(/'/g, "\\'");
}

function editProduct(id, name, brand, price, stock, image_url) {
    document.getElementById('modalTitle').innerText = 'Editar Producto';
    document.getElementById('productId').value = id;
    document.getElementById('p-name').value = name;
    document.getElementById('p-brand').value = brand;
    document.getElementById('p-price').value = price;
    document.getElementById('p-stock').value = stock;
    document.getElementById('p-image').value = image_url;
    document.getElementById('productModal').classList.add('active');
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const productData = {
        name: document.getElementById('p-name').value,
        brand: document.getElementById('p-brand').value,
        price: parseFloat(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value),
        image_url: document.getElementById('p-image').value
    };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/products/${id}` : '/api/products';

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(productData)
        });
        if (response.ok) {
            document.getElementById('productModal').classList.remove('active');
            fetchProductsForAdmin();
        } else {
            const err = await response.json();
            alert('Error: ' + (err.error || 'Autenticación fallida o permisos insuficientes.'));
            if(response.status === 401 || response.status === 403) logout();
        }
    } catch (err) {
        console.error('Error saving product:', err);
    }
}

async function deleteProduct(id) {
    if (!confirm('¿Seguro que deseas eliminar este producto (Se requiere autenticación)?')) return;
    try {
        const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (response.ok) {
            fetchProductsForAdmin();
        } else {
            const err = await response.json();
            alert('Error: ' + (err.error || 'Operación denegada.'));
            if(response.status === 401 || response.status === 403) logout();
        }
    } catch (err) {
        console.error('Error deleting product:', err);
    }
}


// --- USERS LOGIC ---

async function fetchUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (response.ok) {
            const users = await response.json();
            renderUsersTable(users);
        }
    } catch (err) {
        console.error('Error fetching users:', err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    // Asumimos que los roles posibles son Admin y Gestor
    const roles = ['Admin', 'Gestor'];
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        
        let roleSelectOptions = '';
        roles.forEach(r => {
            roleSelectOptions += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`;
        });
        
        tr.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${u.username}</strong></td>
            <td>${u.email}</td>
            <td><span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${u.role}</span></td>
            <td>
                <select class="actions-btn" style="background:#3b82f6; color:white; border:none; padding: 4px; border-radius: 4px; margin-right: 5px; cursor: pointer;" onchange="changeUserRole(${u.id}, this.value)">
                    ${roleSelectOptions}
                </select>
                <button class="actions-btn delete-btn" onclick="deleteUser(${u.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function changeUserRole(id, newRole) {
    if (!confirm(`¿Seguro que deseas cambiar el rol de este usuario a ${newRole}?`)) {
        fetchUsers(); // Revertir selector si se cancela
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${id}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ role: newRole })
        });
        if (response.ok) {
            alert('Rol actualizado exitosamente');
            fetchUsers();
        } else {
            const err = await response.json();
            alert('Error al actualizar rol: ' + (err.error || 'Autenticación fallida'));
            fetchUsers(); // Revertir selector
        }
    } catch (err) {
        console.error('Error changing user role:', err);
        fetchUsers();
    }
}

async function deleteUser(id) {
    if (!confirm('¿Seguro que deseas eliminar permanentemente a este usuario?')) return;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (response.ok) {
            alert('Usuario eliminado exitosamente');
            fetchUsers();
        } else {
            const err = await response.json();
            alert('Error al eliminar: ' + (err.error || 'Operación denegada.'));
        }
    } catch (err) {
        console.error('Error deleting user:', err);
    }
}

async function handleUserFormSubmit(e) {
    e.preventDefault();
    const userData = {
        username: document.getElementById('u-username').value,
        email: document.getElementById('u-email').value,
        password: document.getElementById('u-password').value,
        role: document.getElementById('u-role').value
    };

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            document.getElementById('userModal').classList.remove('active');
            fetchUsers();
            alert('Usuario creado exitosamente');
        } else {
            const err = await response.json();
            alert('Error: ' + err.error);
        }
    } catch (err) {
        console.error('Error creating user:', err);
    }
}

// --- SETTINGS LOGIC ---

async function fetchSettings() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            if (settings) {
                document.getElementById('s-hero-title').value = settings.hero_title || '';
                document.getElementById('s-hero-subtitle').value = settings.hero_subtitle || '';
                document.getElementById('s-about-text').value = settings.about_text || '';
                document.getElementById('s-whatsapp').value = settings.whatsapp_number || '584246665883';
                document.getElementById('s-primary-color').value = settings.primary_color || '#0ea5e9';
                document.getElementById('s-hero-image').value = settings.hero_image_url || '';
                
                document.getElementById('s-footer-text').value = settings.footer_text || '';
                
                document.getElementById('s-text-color').value = settings.text_color || '#0f172a';
                document.getElementById('s-card-bg').value = settings.card_bg || '#ffffff';
                document.getElementById('s-font-family').value = settings.font_family || "'Inter', sans-serif";
            }
        }
    } catch (err) {
        console.error('Error fetching settings:', err);
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    const settingsData = {
        hero_title: document.getElementById('s-hero-title').value,
        hero_subtitle: document.getElementById('s-hero-subtitle').value,
        about_text: document.getElementById('s-about-text').value,
        whatsapp_number: document.getElementById('s-whatsapp').value,
        primary_color: document.getElementById('s-primary-color').value,
        hero_image_url: document.getElementById('s-hero-image').value,
        secondary_color: document.getElementById('s-secondary-color').value,
        bg_color: document.getElementById('s-bg-color').value,
        contact_email: document.getElementById('s-contact-email').value,
        footer_text: document.getElementById('s-footer-text').value,
        text_color: document.getElementById('s-text-color').value,
        card_bg: document.getElementById('s-card-bg').value,
        font_family: document.getElementById('s-font-family').value
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(settingsData)
        });

        if (response.ok) {
            alert('Configuración guardada exitosamente. Actualiza la página para ver los cambios aplicados en la tienda.');
        } else {
            const err = await response.json();
            alert('Error al guardar configuración: ' + (err.error || 'Autenticación fallida'));
        }
    } catch (err) {
        console.error('Error saving settings:', err);
    }
}
