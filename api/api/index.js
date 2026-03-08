// In-memory Database for Vercel Demo
// (Warning: Resets on Serverless Sleep)

let db = {
    users: [],
    items: [
        { id: 1, name: 'Aloo Paratha', category: 'Food & Snacks', description: 'Freshly made, served hot', price: 30, is_available: 1 },
        { id: 2, name: 'Paneer Paratha', category: 'Food & Snacks', description: 'Filling campus favorite', price: 40, is_available: 1 },
        { id: 3, name: 'Veg Patties', category: 'Food & Snacks', description: 'Crispy baked snack', price: 15, is_available: 1 },
        { id: 4, name: 'Cutting Chai', category: 'Beverages', description: 'Classic student fuel', price: 10, is_available: 1 },
        { id: 5, name: 'Coffee', category: 'Beverages', description: 'Hot and energizing', price: 15, is_available: 1 },
        { id: 6, name: 'Cream Cakes', category: 'Bakery & Desserts', description: 'Sweet treat for breaks', price: 25, is_available: 1 }
    ],
    orders: [],
    otps: {},
    settings: {
        is_canteen_open: 'true'
    }
};

const crypto = require('crypto');

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const { url, method, body, query } = req;

    // Exact paths are based on how Vercel rewrites or paths
    // Usually Vercel sends req.url starting with /api
    const pathname = url.split('?')[0];

    // --- ROUTES ---

    // PUBLIC: Get available items
    if (method === 'GET' && pathname === '/api/items') {
        return res.status(200).json(db.items.filter(i => i.is_available === 1));
    }

    // ADMIN: Get all items
    if (method === 'GET' && pathname === '/api/admin/items') {
        return res.status(200).json(db.items);
    }

    // ADMIN: Create item
    if (method === 'POST' && pathname === '/api/admin/items') {
        const newItem = {
            id: Date.now(),
            name: body.name,
            category: body.category,
            description: body.description,
            price: parseFloat(body.price),
            image_url: body.image_url || 'assets/snacks_placeholder.png',
            is_available: body.is_available !== undefined ? body.is_available : 1
        };
        db.items.push(newItem);
        return res.status(201).json({ message: 'Item created', id: newItem.id });
    }

    // ADMIN: Delete item
    if (method === 'DELETE' && pathname.startsWith('/api/admin/items/')) {
        const idStr = pathname.split('/').pop();
        if (idStr) {
            db.items = db.items.filter(i => i.id.toString() !== idStr);
            return res.status(200).json({ message: 'Item deleted' });
        }
    }

    // PUBLIC: Create order
    if (method === 'POST' && pathname === '/api/orders') {
        const newOrder = {
            id: Date.now(),
            user_id: body.user_id || null,
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
            total_amount: body.total_amount,
            payment_method: body.payment_method,
            payment_status: 'Pending',
            order_status: 'Awaiting Payment',
            created_at: new Date().toISOString(),
            items: body.items || []
        };
        db.orders.push(newOrder);
        return res.status(201).json({ message: 'Order initialized', order_id: newOrder.id });
    }

    // POST: /api/create-payment
    if (method === 'POST' && pathname === '/api/create-payment') {
        const { order_id, amount } = body;
        if (!order_id) return res.status(400).json({ error: 'Order ID is required' });

        const transaction_id = `pay_${crypto.randomBytes(8).toString('hex')}`;
        return res.status(200).json({
            transaction_id,
            amount,
            gateway: 'MockPay',
            message: 'Payment intent created successfully'
        });
    }

    // POST: /api/verify-payment
    if (method === 'POST' && pathname === '/api/verify-payment') {
        const { order_id, transaction_id } = body;
        if (!order_id || !transaction_id) {
            return res.status(400).json({ error: 'Order ID and Transaction ID required' });
        }

        const order = db.orders.find(o => o.id.toString() === order_id.toString());
        if (!order) return res.status(404).json({ error: 'Order not found' });

        order.payment_status = 'Paid';
        order.order_status = 'Pending';
        order.transaction_id = transaction_id;

        return res.status(200).json({ message: 'Payment verified successfully', order_id: order.id });
    }

    // PUBLIC: Get specific order by ID
    if (method === 'GET' && pathname.match(/^\/api\/orders\/\d+$/)) {
        const idStr = pathname.split('/').pop();
        const order = db.orders.find(o => o.id.toString() === idStr);
        if (order) return res.status(200).json(order);
        return res.status(404).json({ error: 'Order not found' });
    }

    // ADMIN: Get all orders
    if (method === 'GET' && pathname === '/api/admin/orders') {
        return res.status(200).json(db.orders);
    }

    // USER: Send OTP
    if (method === 'POST' && pathname === '/api/send-otp') {
        const { phone, name } = body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        db.otps[phone] = { otp, name };

        console.log(`\n\n[MOCK SMS] 📱 Sending OTP to ${phone}: ${otp}\n\n`);
        return res.status(200).json({ message: 'OTP sent successfully', _dev_otp_note: `OTP is: ${otp}` });
    }

    // USER: Verify OTP
    if (method === 'POST' && pathname === '/api/verify-otp') {
        const { phone, otp } = body;
        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const storedOtpData = db.otps[phone];
        if (!storedOtpData || storedOtpData.otp !== otp) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        let user = db.users.find(u => u.phone === phone);
        if (!user) {
            user = {
                user_id: `user_${Date.now()}`,
                name: storedOtpData.name || 'New User',
                phone: phone,
                created_at: new Date().toISOString()
            };
            db.users.push(user);
        }

        delete db.otps[phone];
        return res.status(200).json({ message: 'Login successful', user: { user_id: user.user_id, name: user.name, phone: user.phone } });
    }

    // USER: Get their orders
    if (method === 'GET' && pathname === '/api/user/orders') {
        const userId = query.user_id;
        if (!userId) return res.status(400).json({ error: 'Missing user_id' });

        const user = db.users.find(u => u.user_id === userId);
        const userOrders = db.orders.filter(o => o.user_id === userId || (user && o.customer_phone === user.phone));
        return res.status(200).json(userOrders);
    }

    // CHEF: Get live orders
    if (method === 'GET' && pathname === '/api/chef/orders') {
        const liveOrders = db.orders.filter(o => o.order_status !== 'Completed');
        return res.status(200).json(liveOrders);
    }

    // CHEF: Update order status
    if (method === 'PUT' && pathname.match(/\/api\/chef\/orders\/\d+\/status/)) {
        const idStr = pathname.split('/')[4];
        const order = db.orders.find(o => o.id.toString() === idStr);
        if (order && body.order_status) {
            order.order_status = body.order_status;
            return res.status(200).json({ message: 'Order status updated' });
        }
        return res.status(404).json({ error: 'Order not found' });
    }

    // Fallback
    res.status(404).json({ error: 'Not Found' });
};
