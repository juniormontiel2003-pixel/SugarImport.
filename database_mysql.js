// Eliminada la dependencia dotenv para evitar crash
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// 1. Crear una conexión temporal inicial para revisar/crear la BD en phpMyAdmin sin arrojar error si no existe
const adminConnection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Por defecto en XAMPP local
    password: ''  // Por defecto en XAMPP local está vacío
});

// El objeto db envoltorio que simula ser el objeto de sqlite3 para no romper server.js
const db = {
    pool: null,
    
    // Simula db.run() de SQLite
    run: function(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (!this.pool) return callback && callback(new Error("La base de datos MySQL aún no está conectada."));
        
        // MySQL reserva la palabra 'user', la escapamos automáticamente por si acaso, evitando errores
        const safeSql = sql.replace(/\buser\b/gi, '`user`');

        this.pool.query(safeSql, params, function(err, results) {
            if (callback) {
                // SQLite inyecta 'lastID' y 'changes' en la función
                const context = {
                    lastID: results ? results.insertId : 0,
                    changes: results ? results.affectedRows : 0
                };
                callback.call(context, err);
            }
        });
    },
    
    // Simula db.get() de SQLite (devuelve solo el primer resultado)
    get: function(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (!this.pool) return callback(new Error("La base de datos MySQL aún no está conectada."));
        
        const safeSql = sql.replace(/\buser\b/gi, '`user`');
        
        this.pool.query(safeSql, params, (err, rows) => {
            if (err) return callback(err, null);
            callback(null, rows && rows.length > 0 ? rows[0] : undefined);
        });
    },

    // Simula db.all() de SQLite (devuelve un arreglo con todos los resultados)
    all: function(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        if (!this.pool) return callback(new Error("La base de datos MySQL aún no está conectada."));
        
        const safeSql = sql.replace(/\buser\b/gi, '`user`');
        
        this.pool.query(safeSql, params, (err, rows) => {
            callback(err, rows);
        });
    }
};

adminConnection.query("CREATE DATABASE IF NOT EXISTS sugarimport_db", (err) => {
    if (err) {
        console.error("Error al intentar crear base de datos automática MySQL:", err.message);
        console.error("Asegúrate de que tienes XAMPP prendido y con el módulo MySQL corriendo.");
        return;
    }
    
    // Crear el Pool verdadero ahora que sabemos que la BD existe en phpMyAdmin
    db.pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'sugarimport_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    
    console.log("Conectado a MySQL exitosamente (Base de datos: sugarimport_db).");
    initDB();
});

function initDB() {
    // Array de queries de sintaxis MySQL
    const queries = [
        `CREATE TABLE IF NOT EXISTS \`user\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            email VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS rol (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS u_r (
            user_id INT,
            rol_id INT,
            PRIMARY KEY (user_id, rol_id),
            FOREIGN KEY (user_id) REFERENCES \`user\`(id) ON DELETE CASCADE,
            FOREIGN KEY (rol_id) REFERENCES rol(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS direccion (
            id INT AUTO_INCREMENT PRIMARY KEY,
            calle VARCHAR(255),
            av VARCHAR(255),
            sector VARCHAR(255),
            n_casa VARCHAR(255),
            status VARCHAR(255),
            id_user INT,
            FOREIGN KEY (id_user) REFERENCES \`user\`(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS modula (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS paginas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            path VARCHAR(255) UNIQUE,
            name VARCHAR(255)
        )`,
        `CREATE TABLE IF NOT EXISTS rm_pagin (
            id INT AUTO_INCREMENT PRIMARY KEY,
            rol_id INT,
            modulo_id INT,
            pagina_id INT,
            FOREIGN KEY (rol_id) REFERENCES rol(id) ON DELETE CASCADE,
            FOREIGN KEY (modulo_id) REFERENCES modula(id) ON DELETE CASCADE,
            FOREIGN KEY (pagina_id) REFERENCES paginas(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS permisos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS rm_per (
            rm_pagin_id INT,
            permiso_id INT,
            PRIMARY KEY (rm_pagin_id, permiso_id),
            FOREIGN KEY (rm_pagin_id) REFERENCES rm_pagin(id) ON DELETE CASCADE,
            FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255),
            brand VARCHAR(255),
            price DECIMAL(10,2),
            stock INT,
            image_url TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS site_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            hero_title VARCHAR(255),
            hero_subtitle TEXT,
            about_text TEXT,
            whatsapp_number VARCHAR(255),
            primary_color VARCHAR(255),
            hero_image_url TEXT,
            secondary_color VARCHAR(255),
            bg_color VARCHAR(255),
            contact_email VARCHAR(255),
            footer_text TEXT,
            text_color VARCHAR(255),
            card_bg VARCHAR(255),
            font_family VARCHAR(255)
        )`
    ];

    const runQueries = async () => {
        const promisePool = db.pool.promise();
        try {
            // Se procesan las tablas sincronamente (en orden como SQLite serialize)
            for (let q of queries) {
                await promisePool.query(q);
            }
            
            // Administrador por defecto
            const [roles] = await promisePool.query("SELECT id FROM rol WHERE name = 'Admin'");
            let adminRolId;
            if (roles.length === 0) {
                const [result] = await promisePool.query("INSERT INTO rol (name) VALUES ('Admin')");
                adminRolId = result.insertId;
                
                const defaultUser = process.env.ADMIN_USER || 'superadmin';
                const defaultPass = process.env.ADMIN_PASS || 'default_secret_pw_123';
                const hash = await bcrypt.hash(defaultPass, 10);
                
                const [userRes] = await promisePool.query("INSERT INTO \`user\` (username, password, email) VALUES (?, ?, 'admin@sugarimport.com')", [defaultUser, hash]);
                const adminUserId = userRes.insertId;
                
                await promisePool.query("INSERT INTO u_r (user_id, rol_id) VALUES (?, ?)", [adminUserId, adminRolId]);
                console.log("Usuario administrador por defecto creado.");
            }
            
            // Rol Gestor por defecto
            const [gestores] = await promisePool.query("SELECT id FROM rol WHERE name = 'Gestor'");
            if (gestores.length === 0) {
                await promisePool.query("INSERT INTO rol (name) VALUES ('Gestor')");
            }
            
            // Producto por defecto
            const [productsCountData] = await promisePool.query("SELECT count(*) as count FROM products");
            if (productsCountData[0].count === 0) {
                await promisePool.query("INSERT INTO products (name, brand, price, stock, image_url) VALUES ('iPhone 15 Pro', 'Apple', 999.00, 15, 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium_AV1?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692846359281')");
            }
            
            // Configuracion por defecto
            const [settingsCountData] = await promisePool.query("SELECT count(*) as count FROM site_settings");
            if (settingsCountData[0].count === 0) {
                await promisePool.query("INSERT INTO site_settings (hero_title, hero_subtitle, about_text, whatsapp_number, primary_color, hero_image_url) VALUES (?, ?, ?, ?, ?, ?)", [
                    'El Futuro en tus Manos',
                    'Descubre los últimos y más avanzados dispositivos en tecnología móvil. Calidad premium, precios insuperables, y envíos seguros a toda Maracaibo.',
                    'En SugarImport nos dedicamos a traer lo mejor en tecnología, desde Apple hasta las marcas más competitivas del mercado global. Somos pioneros en Maracaibo, garantizando la seguridad en tu inversión tecnológica.',
                    '584246665883',
                    '#00f0ff',
                    'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?q=80&w=2071&auto=format&fit=crop'
                ]);
            }
        } catch(e) {
            console.error("Error inicializando tablas en MySQL:", e);
        }
    };
    
    runQueries();
}

module.exports = db;
