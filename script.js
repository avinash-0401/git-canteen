let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile navigation toggle ---
    const mobileToggle = document.querySelector('.mobile-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-menu a');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            const icon = mobileMenu.classList.contains('active')
                ? '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
                : '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>';
            mobileToggle.querySelector('svg').innerHTML = icon;
        });
    }

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            mobileToggle.querySelector('svg').innerHTML = '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>';
        });
    });

    // --- Navbar scroll effect ---
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // --- Scroll Reveal Animation ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealOptions = { threshold: 0.15, rootMargin: "0px 0px -50px 0px" };
    const revealOnScroll = new IntersectionObserver(function (entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);
    revealElements.forEach(el => revealOnScroll.observe(el));

    // --- Dynamic Menu Display ---
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || !window.location.hostname;
    const API_BASE = isLocal
        ? 'http://localhost:3000/api'
        : '/api';

    fetch(`${API_BASE}/items`)
        .then(res => res.json())
        .then(items => {
            const container = document.getElementById('dynamic-menu-container');
            container.innerHTML = ''; // Clear loading text

            // Group by category
            const categories = items.reduce((acc, item) => {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item);
                return acc;
            }, {});

            const icons = {
                'Food & Snacks': '🥘',
                'Beverages': '☕',
                'Bakery & Desserts': '🧁'
            };

            for (const [cat, catItems] of Object.entries(categories)) {
                let listHtml = '';
                catItems.forEach(item => {
                    listHtml += `
                        <li class="menu-item-row">
                            <div class="menu-item-info">
                                <span class="item-name">${item.name} <span class="item-price">₹${item.price}</span></span>
                                <span class="item-desc">${item.description}</span>
                            </div>
                            <button class="add-to-cart-btn" onclick="addToCart(${item.id}, '${item.name}', ${item.price})">+</button>
                        </li>
                    `;
                });

                container.innerHTML += `
                    <div class="menu-category">
                        <div class="category-icon">${icons[cat] || '🍽️'}</div>
                        <h3>${cat}</h3>
                        <ul class="menu-list">
                            ${listHtml}
                        </ul>
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById('dynamic-menu-container').innerHTML = '<p style="text-align:center; color:red;">Failed to load menu items.</p>';
        });

    // --- Cart & Checkout Logic ---
    const cartBtn = document.getElementById('cartBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const checkoutForm = document.getElementById('checkoutForm');

    cartBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        renderCartItems();
        checkoutModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        checkoutModal.classList.remove('active');
    });

    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        try {
            const currentUser = JSON.parse(localStorage.getItem('canteenUser'));

            // 1. Initialize Order in Backend (Awaiting Payment)
            const orderRes = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser ? currentUser.user_id : null,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    total_amount: totalAmount,
                    payment_method: paymentMethod,
                    items: cart
                })
            });
            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                alert("Failed to initialize order.");
                return;
            }

            const activeOrderId = orderData.order_id;

            // 2. Create Payment Intent (Simulate Razorpay)
            const paymentRes = await fetch(`${API_BASE}/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: activeOrderId, amount: totalAmount })
            });
            const paymentData = await paymentRes.json();

            if (!paymentRes.ok) {
                alert("Payment Gateway Error: Could not generate intent.");
                return;
            }

            // 3. Open Simulated Payment Gateway Modal
            checkoutModal.classList.remove('active');
            document.getElementById('pgOrderId').innerText = paymentData.transaction_id;
            document.getElementById('pgAmount').innerText = `₹${totalAmount}`;
            document.getElementById('paymentGatewayModal').classList.add('active');

            // Set up success simulation button
            const simBtn = document.getElementById('pgSimulateSuccessBtn');
            const cartData = [...cart]; // preserve for receipt before clearing

            // Remove old listeners to avoid duplicates
            const newSimBtn = simBtn.cloneNode(true);
            simBtn.parentNode.replaceChild(newSimBtn, simBtn);

            newSimBtn.addEventListener('click', async () => {
                newSimBtn.innerText = "Processing...";
                newSimBtn.disabled = true;

                // 4. Verify Payment (Simulate Gateway Callback)
                const verifyRes = await fetch(`${API_BASE}/verify-payment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_id: activeOrderId,
                        transaction_id: paymentData.transaction_id
                    })
                });

                if (verifyRes.ok) {
                    cart = [];
                    updateCartBadge();
                    document.getElementById('paymentGatewayModal').classList.remove('active');
                    checkoutForm.reset();
                    showReceipt(activeOrderId, cartData, totalAmount);
                } else {
                    alert("Payment verification failed. Order not placed.");
                }

                newSimBtn.innerText = "Simulate Successful Payment";
                newSimBtn.disabled = false;
            });

        } catch (err) {
            console.error(err);
            alert("Error placing order.");
        }
    });
});

// Global functions for inline onclick handlers
window.addToCart = (id, name, price) => {
    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    updateCartBadge();
};

window.removeFromCart = (id) => {
    cart = cart.filter(i => i.id !== id);
    updateCartBadge();
    renderCartItems();
    if (cart.length === 0) {
        document.getElementById('checkoutModal').classList.remove('active');
    }
};

function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartCount');
    badge.innerText = totalItems;
    if (totalItems > 0) {
        document.getElementById('cartBtn').classList.add('has-items');
    } else {
        document.getElementById('cartBtn').classList.remove('has-items');
    }
}

function renderCartItems() {
    const container = document.getElementById('cartItemsContainer');
    let html = '';
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.quantity;
        html += `
            <div class="cart-item">
                <div class="cart-item-details">
                    <span class="cart-item-name">${item.name} (x${item.quantity})</span>
                    <span class="cart-item-price">₹${item.price * item.quantity}</span>
                </div>
                <button type="button" class="remove-item-btn" onclick="removeFromCart(${item.id})">❌</button>
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('cartTotalValue').innerText = `₹${total}`;
}

// Receipt & Tracking Functions
window.showReceipt = (orderId, items, total) => {
    const content = document.getElementById('receiptContent');
    let itemsHtml = items.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span>${i.quantity}x ${i.name}</span>
            <span>₹${i.price * i.quantity}</span>
        </div>
    `).join('');

    content.innerHTML = `
        <div style="text-align:center; margin-bottom: 20px;">
            <p style="color:var(--text-muted); margin-bottom:5px;">Your Order ID</p>
            <h3 style="color: var(--primary-red); font-size: 1.8rem; margin:0;">#${orderId}</h3>
            <p style="font-size: 0.9em; margin-top:5px;">Please save this ID to track your order.</p>
        </div>
        <div style="border-top: 2px dashed #eee; border-bottom: 2px dashed #eee; padding: 15px 0; margin-bottom: 15px;">
            ${itemsHtml}
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:1.2em; color:var(--dark-brown);">
            <span>Total Paid</span>
            <span>₹${total}</span>
        </div>
        <button onclick="openTrackOrder(event)" class="btn btn-primary" style="width:100%; justify-content:center; margin-top:20px;">
            Track Order Status
        </button>
    `;
    document.getElementById('receiptModal').classList.add('active');
};

window.closeReceipt = () => {
    document.getElementById('receiptModal').classList.remove('active');
    renderAuthUI(); // Option to refresh orders
};

window.openTrackOrder = (e) => {
    if (e) e.preventDefault();
    document.getElementById('receiptModal').classList.remove('active');
    const user = JSON.parse(localStorage.getItem('canteenUser'));
    if (user) {
        openMyOrders();
    } else {
        alert("Please login to track your orders.");
        openAuthModal();
    }
};

// --- Authentication & Sessions (Username/Password) ---

window.toggleAuthForms = (e) => {
    e.preventDefault();
    const loginForm = document.getElementById('authLoginForm');
    const regForm = document.getElementById('authRegisterForm');

    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
    }
    // Clear messages
    document.getElementById('loginMessage').style.display = 'none';
    document.getElementById('regMessage').style.display = 'none';
};

window.openAuthModal = (e) => {
    if (e) e.preventDefault();
    if (document.querySelector('.mobile-menu').classList.contains('active')) {
        document.querySelector('.mobile-menu').classList.remove('active');
    }

    // Reset forms
    document.getElementById('authLoginForm').style.display = 'block';
    document.getElementById('authRegisterForm').style.display = 'none';
    document.getElementById('authLoginForm').reset();
    document.getElementById('authRegisterForm').reset();
    document.getElementById('loginMessage').style.display = 'none';
    document.getElementById('regMessage').style.display = 'none';

    document.getElementById('authModal').classList.add('active');
};

window.closeAuthModal = () => document.getElementById('authModal').classList.remove('active');

// Step 1:// Login
document.getElementById('authLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const msg = document.getElementById('loginMessage');
    const btn = document.getElementById('authLoginBtn');

    btn.disabled = true;
    btn.innerText = "Logging in...";
    msg.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('canteenUser', JSON.stringify(data.user));
            closeAuthModal();
            renderAuthUI();
            alert(`Welcome, ${data.user.name}!`);
        } else {
            msg.innerText = data.error || "Login failed.";
            msg.style.display = 'block';
        }
    } catch (err) {
        console.error("Login fetch error:", err);
        msg.innerText = "Network error: API unreachable.";
        msg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerText = "Login";
    }
});

// Step 2:// Register
document.getElementById('authRegisterForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value.trim();

    const msg = document.getElementById('regMessage');
    const btn = document.getElementById('authRegBtn');

    btn.disabled = true;
    btn.innerText = "Registering...";
    msg.style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('canteenUser', JSON.stringify(data.user));
            closeAuthModal();
            renderAuthUI();
            alert(`Welcome, ${data.user.name}!`);
        } else {
            msg.innerText = data.error || "Registration failed.";
            msg.style.display = 'block';
        }
    } catch (err) {
        console.error("Register fetch error:", err);
        msg.innerText = "Network error: API unreachable.";
        msg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerText = "Create Account";
    }
});

window.logout = (e) => {
    if (e) e.preventDefault();
    localStorage.removeItem('canteenUser');
    renderAuthUI();
};

function renderAuthUI() {
    const user = JSON.parse(localStorage.getItem('canteenUser'));
    const navLinks = document.getElementById('navLinksAuth');
    const mobileMenu = document.querySelector('.mobile-menu');

    let deskLinks = `
        <a href="#about">About</a>
        <a href="#menu">Menu</a>
        <a href="#experience">Experience</a>
        <a href="#location">Location</a>
        <a href="#" onclick="openTrackOrder(event)" style="color: var(--primary-red); font-weight: 700;">Track Order</a>
    `;
    let mobLinks = deskLinks;

    if (user) {
        let authLinks = `
            <span style="color:var(--text-muted); font-weight:500; margin-left: 10px;">Hi, ${user.name.split(' ')[0]}</span>
            <a href="#" onclick="logout(event)" style="font-size:0.9em; color:#666;">Logout</a>
        `;
        navLinks.innerHTML = deskLinks + authLinks;
        mobileMenu.innerHTML = mobLinks + `
            <a href="#" onclick="logout(event); document.querySelector('.mobile-menu').classList.remove('active');">Logout</a>
        `;

        // Auto-fill checkout
        document.getElementById('customerName').value = user.name;
        document.getElementById('customerPhone').value = user.phone;
    } else {
        let authLinks = `<a href="#" onclick="openAuthModal(event)" style="color: var(--primary-red); font-weight: 700;">Login / Sign Up</a>`;
        navLinks.innerHTML = deskLinks + authLinks;
        mobileMenu.innerHTML = mobLinks + `
            <a href="#" onclick="openAuthModal(event); document.querySelector('.mobile-menu').classList.remove('active');" style="color: var(--primary-red);">Login / Sign Up</a>
        `;

        // Clear auto-fill
        document.getElementById('customerName').value = "";
        document.getElementById('customerPhone').value = "";
    }
}

// --- My Orders Tracking ---
window.openMyOrders = async (e) => {
    if (e) e.preventDefault();
    const user = JSON.parse(localStorage.getItem('canteenUser'));
    if (!user) {
        alert("Please login to view your orders.");
        openAuthModal();
        return;
    }

    document.getElementById('myOrdersModal').classList.add('active');
    const container = document.getElementById('myOrdersList');
    container.innerHTML = '<p style="text-align: center; color: #666;">Loading orders...</p>';

    try {
        const res = await fetch(`${API_BASE}/user/orders?phone=${user.phone}`);
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No orders found.</p>';
            return;
        }

        container.innerHTML = '';
        orders.reverse().forEach(o => {
            let bg = '#E5E7EB';
            let color = '#374151';

            if (o.order_status === 'Pending') { bg = '#FEF3C7'; color = '#D97706'; }
            if (o.order_status === 'Preparing') { bg = '#DBEAFE'; color = '#2563EB'; }
            if (o.order_status === 'Ready') { bg = '#D1FAE5'; color = '#059669'; }

            let itemsHtml = o.items ? o.items.map(i => `<div>${i.quantity}x ${i.name}</div>`).join('') : '';

            container.innerHTML += `
                <div style="border:1px solid #ddd; border-radius:8px; padding:15px; margin-bottom:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="font-weight:bold; color:var(--primary-red);">#${o.id}</span>
                        <span style="background:${bg}; color:${color}; padding:4px 8px; border-radius:4px; font-size:0.85em; font-weight:bold;">${o.order_status}</span>
                    </div>
                    <div style="font-size:0.9em; color:#555; margin-bottom:10px;">
                        ${itemsHtml}
                    </div>
                    <div style="font-weight:bold; text-align:right;">₹${o.total_amount}</div>
                </div>
            `;
        });
    } catch (err) {
        container.innerHTML = '<p style="text-align: center; color: red;">Network error.</p>';
    }
};

window.closeMyOrders = () => document.getElementById('myOrdersModal').classList.remove('active');

// Init
renderAuthUI();
