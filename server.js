const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database_mysql');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'sugarimport_secret_key_12345'; // En producción, usar variable de entorno

app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticación
const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Token no proporcionado' });
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = decoded;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Administrador' });
    }
};

// --- AUTH ROUTES ---

// Verify token validity
app.get('/api/auth/verify', authenticate, (req, res) => {
    res.json({ valid: true, user: req.user });
});


// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM user WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!isMatch) return res.status(400).json({ error: 'Contraseña incorrecta' });

            // Verificar el rol
            db.get("SELECT r.name FROM rol r JOIN u_r ur ON r.id = ur.rol_id WHERE ur.user_id = ?", [user.id], (err, rol) => {
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: rol ? rol.name : 'User' },
                    JWT_SECRET,
                    { expiresIn: '2h' }
                );
                res.json({ message: 'Login exitoso', token, role: rol ? rol.name : 'User' });
            });
        });
    });
});

// --- USER MANAGEMENT ROUTES ---

// Obtener todos los usuarios y sus roles
app.get('/api/users', authenticate, isAdmin, (req, res) => {
    db.all(`
        SELECT u.id, u.username, u.email, r.name as role 
        FROM user u 
        LEFT JOIN u_r ur ON u.id = ur.user_id 
        LEFT JOIN rol r ON ur.rol_id = r.id
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear nuevo usuario
app.post('/api/users', authenticate, isAdmin, (req, res) => {
    const { username, password, email, role } = req.body;
    db.get("SELECT id FROM rol WHERE name = ?", [role], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Rol inválido o error en BD' });
        const rolId = row.id;

        bcrypt.hash(password, 10, (err, hash) => {
            db.run("INSERT INTO user (username, password, email) VALUES (?, ?, ?)", [username, hash, email], function(err) {
                if (err) return res.status(400).json({ error: 'El usuario ya existe o error en BD' });
                const userId = this.lastID;
                db.run("INSERT INTO u_r (user_id, rol_id) VALUES (?, ?)", [userId, rolId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ id: userId, username, email, role });
                });
            });
        });
    });
});

// Actualizar rol de usuario
app.put('/api/users/:id/role', authenticate, isAdmin, (req, res) => {
    const { role } = req.body;
    db.get("SELECT id FROM rol WHERE name = ?", [role], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Rol inválido' });
        const rolId = row.id;
        // Upsert logic for u_r isn't strictly necessary since all users get a role on creation, so simple UPDATE works
        db.run("UPDATE u_r SET rol_id = ? WHERE user_id = ?", [rolId, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, updated: this.changes });
        });
    });
});

// Eliminar usuario
app.delete('/api/users/:id', authenticate, isAdmin, (req, res) => {
    // Evitar que el administrador se borre a sí mismo
    if (parseInt(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propio usuario activo' });
    }
    
    db.run("DELETE FROM u_r WHERE user_id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("DELETE FROM user WHERE id = ?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, deleted: this.changes });
        });
    });
});

// Obtener los roles disponibles
app.get('/api/roles', authenticate, isAdmin, (req, res) => {
    db.all("SELECT * FROM rol", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- SITE SETTINGS ROUTES ---

app.get('/api/settings', (req, res) => {
    db.get("SELECT * FROM site_settings ORDER BY id DESC LIMIT 1", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

app.put('/api/settings', authenticate, (req, res) => {
    const { 
        hero_title, hero_subtitle, about_text, whatsapp_number, 
        primary_color, hero_image_url, secondary_color, bg_color, 
        contact_email, footer_text, text_color, card_bg, font_family 
    } = req.body;

    db.run(
        "UPDATE site_settings SET hero_title = ?, hero_subtitle = ?, about_text = ?, whatsapp_number = ?, primary_color = ?, hero_image_url = ?, secondary_color = ?, bg_color = ?, contact_email = ?, footer_text = ?, text_color = ?, card_bg = ?, font_family = ? WHERE id = (SELECT id FROM site_settings ORDER BY id DESC LIMIT 1)",
        [
            hero_title, hero_subtitle, about_text, whatsapp_number, 
            primary_color, hero_image_url, secondary_color, bg_color, 
            contact_email, footer_text, text_color, card_bg, font_family
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// --- CATALOG / PRODUCTS ROUTES ---

// Obtener todos los productos (Público)
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener producto por ID
app.get('/api/products/:id', (req, res) => {
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

// Crear producto (Protegido)
app.post('/api/products', authenticate, (req, res) => {
    const { name, brand, price, stock, image_url } = req.body;
    db.run(
        "INSERT INTO products (name, brand, price, stock, image_url) VALUES (?, ?, ?, ?, ?)",
        [name, brand, price, stock, image_url],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, brand, price, stock, image_url });
        }
    );
});

// Actualizar producto (Protegido)
app.put('/api/products/:id', authenticate, (req, res) => {
    const { name, brand, price, stock, image_url } = req.body;
    db.run(
        "UPDATE products SET name = ?, brand = ?, price = ?, stock = ?, image_url = ? WHERE id = ?",
        [name, brand, price, stock, image_url, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

// Eliminar producto (Protegido)
app.delete('/api/products/:id', authenticate, (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});


// Rutas fallback para HTML
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


const server = app.listen(PORT, () => {
    console.log(`Servidor de SugarImport corriendo en http://sugarimport.localtest.me:${PORT}`);
    
    // Abre automáticamente la página en el navegador dependiendo del modo
    let startUrl = `http://sugarimport.localtest.me:${PORT}`;
    if (process.argv.includes('--admin')) {
        startUrl = `http://sugarimport.localtest.me:${PORT}/login`;
    }
    require('child_process').exec(`start ${startUrl}`);
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.log('Un servidor ya está corriendo de fondo en este puerto. Abriendo el enlace directamente...');
        let startUrl = `http://sugarimport.localtest.me:${PORT}`;
        if (process.argv.includes('--admin')) {
            startUrl = `http://sugarimport.localtest.me:${PORT}/login`;
        }
        require('child_process').exec(`start ${startUrl}`);
        // Cerramos esta ventana extra suavemente ya que no necesitamos 2 servidores
        setTimeout(() => process.exit(0), 1000);
    } else {
        console.error('Error fatal detectado:', e);
    }
});
