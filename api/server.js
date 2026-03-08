const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'canteen.json');

// Memory DB with persistent flush
let db = {
    users: [],
    items: [],
    orders: [],
    otps: {}, // Store generated OTPs { phone: otp }
    settings: {
        is_canteen_open: 'true'
    }
};

// Seed initial data if DB doesn't exist
if (!fs.existsSync(DB_FILE)) {
    db.items = [
        { id: 1, name: 'Aloo Paratha', category: 'Food & Snacks', description: 'Freshly made, served hot', price: 30, is_available: 1 },
        { id: 2, name: 'Paneer Paratha', category: 'Food & Snacks', description: 'Filling campus favorite', price: 40, is_available: 1 },
        { id: 3, name: 'Veg Patties', category: 'Food & Snacks', description: 'Crispy baked snack', price: 15, is_available: 1 },
        { id: 4, name: 'Cutting Chai', category: 'Beverages', description: 'Classic student fuel', price: 10, is_available: 1 },
        { id: 5, name: 'Coffee', category: 'Beverages', description: 'Hot and energizing', price: 15, is_available: 1 },
        { id: 6, name: 'Cream Cakes', category: 'Bakery & Desserts', description: 'Sweet treat for breaks', price: 25, is_available: 1 }
    ];
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
} else {
    try {
        const rawData = fs.readFileSync(DB_FILE, 'utf8');
        db = JSON.parse(rawData);
        // Robustness guarantees
        if (!db.users) db.users = [];
        if (!db.items) db.items = [];
        if (!db.orders) db.orders = [];
        if (!db.otps) db.otps = {};
    } catch (e) {
        console.error("Failed to parse DB, using empty state", e);
    }
}

function saveDb() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Basic router
const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Helper to parse JSON body
    const getBody = () => new Promise(resolve => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { resolve({}); }
        });
    });

    const sendJson = (status, data) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // --- ROUTES ---

    // PUBLIC: Get available items
    if (req.method === 'GET' && pathname === '/api/items') {
        return sendJson(200, db.items.filter(i => i.is_available === 1));
    }

    // ADMIN: Get all items
    if (req.method === 'GET' && pathname === '/api/admin/items') {
        return sendJson(200, db.items);
    }

    // ADMIN: Create item
    if (req.method === 'POST' && pathname === '/api/admin/items') {
        getBody().then(data => {
            const newItem = {
                id: Date.now(),
                name: data.name,
                category: data.category,
                description: data.description,
                price: parseFloat(data.price),
                image_url: data.image_url || 'assets/snacks_placeholder.png',
                is_available: data.is_available !== undefined ? data.is_available : 1
            };
            db.items.push(newItem);
            saveDb();
            return sendJson(201, { message: 'Item created', id: newItem.id });
        });
        return;
    }

    // ADMIN: Delete item
    if (req.method === 'DELETE' && pathname.startsWith('/api/admin/items/')) {
        const idStr = pathname.split('/').pop();
        if (idStr) {
            db.items = db.items.filter(i => i.id.toString() !== idStr);
            saveDb();
            return sendJson(200, { message: 'Item deleted' });
        }
    }

    // PUBLIC: Create order (Pending Payment state)
    if (req.method === 'POST' && pathname === '/api/orders') {
        getBody().then(data => {
            const newOrder = {
                id: Date.now(),
                user_id: data.user_id || null,
                customer_name: data.customer_name,
                customer_phone: data.customer_phone,
                total_amount: data.total_amount,
                payment_method: data.payment_method,
                payment_status: 'Pending',
                order_status: 'Awaiting Payment',
                created_at: new Date().toISOString(),
                items: data.items || []
            };
            db.orders.push(newOrder);
            saveDb();
            return sendJson(201, { message: 'Order initialized', order_id: newOrder.id });
        });
        return;
    }

    // POST: /api/create-payment (Simulate Gateway Intent)
    if (req.method === 'POST' && pathname === '/api/create-payment') {
        getBody().then(data => {
            const { order_id, amount } = data;
            if (!order_id) return sendJson(400, { error: 'Order ID is required' });

            // Generate a fake transaction ID like Razorpay's pay_XYZ
            const transaction_id = `pay_${crypto.randomBytes(8).toString('hex')}`;

            return sendJson(200, {
                transaction_id,
                amount,
                gateway: 'MockPay',
                message: 'Payment intent created successfully'
            });
        });
        return;
    }

    // POST: /api/verify-payment (Simulate Gateway Verification)
    if (req.method === 'POST' && pathname === '/api/verify-payment') {
        getBody().then(data => {
            const { order_id, transaction_id } = data;
            if (!order_id || !transaction_id) {
                return sendJson(400, { error: 'Order ID and Transaction ID required' });
            }

            const order = db.orders.find(o => o.id.toString() === order_id.toString());
            if (!order) return sendJson(404, { error: 'Order not found' });

            // Mark as Paid
            order.payment_status = 'Paid';
            order.order_status = 'Pending'; // Now it goes to the Chef
            order.transaction_id = transaction_id;
            saveDb();

            return sendJson(200, { message: 'Payment verified successfully', order_id: order.id });
        });
        return;
    }

    // PUBLIC: Get specific order by ID
    if (req.method === 'GET' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const idStr = pathname.split('/').pop();
        const order = db.orders.find(o => o.id.toString() === idStr);
        if (order) return sendJson(200, order);
        return sendJson(404, { error: 'Order not found' });
    }

    // ADMIN: Get all orders
    if (req.method === 'GET' && pathname === '/api/admin/orders') {
        return sendJson(200, db.orders);
    }

    // USER: Send OTP (Mock SMS)
    if (req.method === 'POST' && pathname === '/api/send-otp') {
        getBody().then(data => {
            const { phone, name } = data;
            if (!phone) {
                return sendJson(400, { error: 'Phone number is required' });
            }

            // Generate a 4 digit OTP
            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            db.otps[phone] = { otp, name };
            saveDb();

            // Mock sending SMS
            console.log(`\n\n[MOCK SMS] 📱 Sending OTP to ${phone}: ${otp}\n\n`);

            return sendJson(200, { message: 'OTP sent successfully' });
        });
        return;
    }

    // USER: Verify OTP & Login/Register
    if (req.method === 'POST' && pathname === '/api/verify-otp') {
        getBody().then(data => {
            const { phone, otp } = data;
            if (!phone || !otp) {
                return sendJson(400, { error: 'Phone and OTP are required' });
            }

            const storedOtpData = db.otps[phone];
            if (!storedOtpData || storedOtpData.otp !== otp) {
                return sendJson(401, { error: 'Invalid or expired OTP' });
            }

            // OTP valid, check if user exists
            let user = db.users.find(u => u.phone === phone);

            // Register if new user
            if (!user) {
                user = {
                    user_id: `user_${Date.now()}`,
                    name: storedOtpData.name || 'New User',
                    phone: phone,
                    created_at: new Date().toISOString()
                };
                db.users.push(user);
            }

            // Clear OTP (Single use)
            delete db.otps[phone];
            saveDb();

            return sendJson(200, { message: 'Login successful', user: { user_id: user.user_id, name: user.name, phone: user.phone } });
        });
        return;
    }

    // USER: Get their orders
    if (req.method === 'GET' && pathname === '/api/user/orders') {
        const userId = url.searchParams.get('user_id');
        if (!userId) return sendJson(400, { error: 'Missing user_id' });
        const user = db.users.find(u => u.user_id === userId);
        const userOrders = db.orders.filter(o => o.user_id === userId || (user && o.customer_phone === user.phone));
        return sendJson(200, userOrders);
    }

    // CHEF: Get live orders
    if (req.method === 'GET' && pathname === '/api/chef/orders') {
        const liveOrders = db.orders.filter(o => o.order_status !== 'Completed');
        return sendJson(200, liveOrders);
    }

    // CHEF: Update order status
    if (req.method === 'PUT' && pathname.match(/\/api\/chef\/orders\/\d+\/status/)) {
        const idStr = pathname.split('/')[4];
        getBody().then(data => {
            const order = db.orders.find(o => o.id.toString() === idStr);
            if (order && data.order_status) {
                order.order_status = data.order_status;
                saveDb();
                return sendJson(200, { message: 'Order status updated' });
            }
            return sendJson(404, { error: 'Order not found' });
        });
        return;
    }

    // Fallback
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Vanilla Node.js API Server running on port ${PORT}`);
});
