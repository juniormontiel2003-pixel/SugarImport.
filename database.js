const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'sugarimport.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('Connectado a la base de datos SQLite.');
        initDB();
    }
});

function initDB() {
    db.serialize(() => {
        // Tablas de Control de Acceso (Usuario, Rol)
        db.run(`CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rol (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS u_r (
            user_id INTEGER,
            rol_id INTEGER,
            PRIMARY KEY (user_id, rol_id),
            FOREIGN KEY (user_id) REFERENCES user(id),
            FOREIGN KEY (rol_id) REFERENCES rol(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS direccion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            calle TEXT,
            av TEXT,
            sector TEXT,
            n_casa TEXT,
            status TEXT,
            id_user INTEGER,
            FOREIGN KEY (id_user) REFERENCES user(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS modula (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS paginas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE,
            name TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rm_pagin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rol_id INTEGER,
            modulo_id INTEGER,
            pagina_id INTEGER,
            FOREIGN KEY (rol_id) REFERENCES rol(id),
            FOREIGN KEY (modulo_id) REFERENCES modula(id),
            FOREIGN KEY (pagina_id) REFERENCES paginas(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS permisos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS rm_per (
            rm_pagin_id INTEGER,
            permiso_id INTEGER,
            PRIMARY KEY (rm_pagin_id, permiso_id),
            FOREIGN KEY (rm_pagin_id) REFERENCES rm_pagin(id),
            FOREIGN KEY (permiso_id) REFERENCES permisos(id)
        )`);

        // Tabla de Catálogo Principal
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            brand TEXT,
            price REAL,
            stock INTEGER,
            image_url TEXT
        )`);

        // Tabla de Configuración de la Página
        db.run(`CREATE TABLE IF NOT EXISTS site_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hero_title TEXT,
            hero_subtitle TEXT,
            about_text TEXT,
            whatsapp_number TEXT,
            primary_color TEXT,
            hero_image_url TEXT,
            secondary_color TEXT,
            bg_color TEXT,
            contact_email TEXT,
            footer_text TEXT,
            text_color TEXT,
            card_bg TEXT,
            font_family TEXT
        )`);

        // Asegurar que las columnas existan en bases de datos ya creadas
        const columns = ['text_color', 'card_bg', 'font_family'];
        columns.forEach(col => {
            db.run(`ALTER TABLE site_settings ADD COLUMN ${col} TEXT`, (err) => {
                // Silenciamos el error si la columna ya existe
            });
        });

        // Insertar un usuario Administrador por defecto
        db.get("SELECT id FROM rol WHERE name = 'Admin'", (err, row) => {
            if (!row) {
                db.run("INSERT INTO rol (name) VALUES ('Admin')", function (err) {
                    if (!err) {
                        const adminRolId = this.lastID;
                        const defaultUser = process.env.ADMIN_USER || 'superadmin';
                        const defaultPass = process.env.ADMIN_PASS || 'default_secret_pw_123';
                        bcrypt.hash(defaultPass, 10, (err, hash) => {
                            db.run("INSERT INTO user (username, password, email) VALUES (?, ?, 'admin@sugarimport.com')", [defaultUser, hash], function (err) {
                                if (!err) {
                                    const adminUserId = this.lastID;
                                    db.run("INSERT INTO u_r (user_id, rol_id) VALUES (?, ?)", [adminUserId, adminRolId]);
                                    console.log("Usuario administrador por defecto creado a partir de variables de entorno.");
                                }
                            });
                        });
                    }
                });
            }
        });

        db.get("SELECT id FROM rol WHERE name = 'Gestor'", (err, row) => {
            if (!row) {
                db.run("INSERT INTO rol (name) VALUES ('Gestor')");
            }
        });

        // Insertar producto por defecto
        db.get("SELECT count(*) as count FROM products", (err, row) => {
            if (row && row.count === 0) {
                db.run("INSERT INTO products (name, brand, price, stock, image_url) VALUES ('iPhone 15 Pro', 'Apple', 999.00, 15, 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium_AV1?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692846359281')");
            }
        });

        // Insertar configuraciones por defecto
        db.get("SELECT count(*) as count FROM site_settings", (err, row) => {
            if (row && row.count === 0) {
                db.run("INSERT INTO site_settings (hero_title, hero_subtitle, about_text, whatsapp_number, primary_color, hero_image_url) VALUES (?, ?, ?, ?, ?, ?)", [
                    'El Futuro en tus Manos',
                    'Descubre los últimos y más avanzados dispositivos en tecnología móvil. Calidad premium, precios insuperables, y envíos seguros a toda Maracaibo.',
                    'En SugarImport nos dedicamos a traer lo mejor en tecnología, desde Apple hasta las marcas más competitivas del mercado global. Somos pioneros en Maracaibo, garantizando la seguridad en tu inversión tecnológica.',
                    '584246665883',
                    '#00f0ff',
                    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?q=80&w=2071&auto=format&fit=crop'
                ]);
            }
        });
    });
}

module.exports = db;
