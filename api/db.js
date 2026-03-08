const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'canteen.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        db.serialize(() => {
            // Create Items Table
            db.run(`CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                image_url TEXT,
                is_available BOOLEAN DEFAULT 1
            )`);

            // Create Orders Table
            // order_status: 'Pending', 'Preparing', 'Ready', 'Completed'
            // payment_status: 'Pending', 'Paid'
            db.run(`CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                total_amount REAL NOT NULL,
                payment_method TEXT,
                payment_status TEXT DEFAULT 'Pending',
                order_status TEXT DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create OrderItems Table
            db.run(`CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                item_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            )`);

            // Create Settings Table
            db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )`);

            // Seed initial data if items table is empty
            db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
                if (row && row.count === 0) {
                    const insertStmt = db.prepare(`INSERT INTO items (name, category, description, price, image_url, is_available) VALUES (?, ?, ?, ?, ?, ?)`);

                    const initialItems = [
                        ['Aloo Paratha', 'Food & Snacks', 'Freshly made, served hot', 30, 'assets/snacks_placeholder.png', 1],
                        ['Paneer Paratha', 'Food & Snacks', 'Filling campus favorite', 40, 'assets/snacks_placeholder.png', 1],
                        ['Veg Patties', 'Food & Snacks', 'Crispy baked snack', 15, 'assets/snacks_placeholder.png', 1],
                        ['Cutting Chai', 'Beverages', 'Classic student fuel', 10, 'assets/beverage_placeholder.png', 1],
                        ['Coffee', 'Beverages', 'Hot and energizing', 15, 'assets/beverage_placeholder.png', 1],
                        ['Cream Cakes', 'Bakery & Desserts', 'Sweet treat for breaks', 25, 'assets/desserts_1772615896267.png', 1]
                    ];

                    initialItems.forEach(item => {
                        insertStmt.run(item);
                    });
                    insertStmt.finalize();
                    console.log('Database seeded with initial items.');

                    // Seed initial settings
                    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('is_canteen_open', 'true')`);
                }
            });
        });
    }
});

module.exports = db;
