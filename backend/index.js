const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Replace with your actual database credentials
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Wholesale Water Bottle Transaction Management System',
    password: '1234',
    port: 5435,
});

const JWT_SECRET = 'secret_key'; // Replace with a strong, random key

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, role]
        );
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: 'Error registering user', error: error.detail || error.message });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token, role: user.role });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Seller: Add a new product listing
app.post('/api/seller/products', authenticateToken, async (req, res) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Access denied: Not a seller' });
    }
    const { quantity, price, model_name } = req.body;
    const seller_id = req.user.id;
    try {
        const result = await pool.query(
            'INSERT INTO products (seller_id, quantity, price, model_name) VALUES ($1, $2, $3, $4) ON CONFLICT (seller_id, model_name, price) DO UPDATE SET quantity = products.quantity + EXCLUDED.quantity RETURNING *',
            [seller_id, quantity, price, model_name]
        );
        res.status(201).json({ message: 'Product updated successfully', product: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Buyer: View all product listings
app.get('/api/buyer/products', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.quantity,
                p.price,
                p.model_name,
                u.username as seller_name
            FROM products p
            JOIN users u ON p.seller_id = u.id
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Buyer: Purchase a product
app.post('/api/buyer/buy', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }

    const { product_id, quantity } = req.body;
    const buyer_id = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check product availability and get details
        const productResult = await client.query('SELECT * FROM products WHERE id = $1 AND quantity >= $2 FOR UPDATE', [product_id, quantity]);
        const product = productResult.rows[0];

        if (!product) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Product not available or insufficient quantity' });
        }

        // Calculate total price
        const total_price = product.price * quantity;

        // Update the product quantity
        await client.query('UPDATE products SET quantity = quantity - $1 WHERE id = $2', [quantity, product_id]);

        // Record the order
        const orderResult = await client.query(
            'INSERT INTO orders (buyer_id, seller_id, product_id, quantity, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [buyer_id, product.seller_id, product_id, quantity, total_price]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: 'Purchase successful', order: orderResult.rows[0] });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Transaction failed', error: error.message });
    } finally {
        client.release();
    }
});


// Buyer: Add a product to the cart
app.post('/api/buyer/cart', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    const { product_id, quantity } = req.body;
    const buyer_id = req.user.id;
    try {
        const result = await pool.query(
            'INSERT INTO carts (buyer_id, product_id, quantity) VALUES ($1, $2, $3) ON CONFLICT (buyer_id, product_id) DO UPDATE SET quantity = carts.quantity + EXCLUDED.quantity RETURNING *',
            [buyer_id, product_id, quantity]
        );
        res.status(201).json({ message: 'Item added to cart', cart_item: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Buyer: Get cart items
app.get('/api/buyer/cart', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    const buyer_id = req.user.id;
    try {
        const result = await pool.query(`
            SELECT
                c.id,
                c.quantity as cart_quantity,
                p.price,
                p.model_name,
                p.seller_id,
                u.username as seller_name
            FROM carts c
            JOIN products p ON c.product_id = p.id
            JOIN users u ON p.seller_id = u.id
            WHERE c.buyer_id = $1
        `, [buyer_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Buyer: Checkout
app.post('/api/buyer/checkout', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    const buyer_id = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get all items from the user's cart
        const cartResult = await client.query('SELECT product_id, quantity FROM carts WHERE buyer_id = $1', [buyer_id]);
        const cartItems = cartResult.rows;

        if (cartItems.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // 2. Process each item in the cart
        for (const item of cartItems) {
            const productResult = await client.query('SELECT * FROM products WHERE id = $1 AND quantity >= $2 FOR UPDATE', [item.product_id, item.quantity]);
            const product = productResult.rows[0];

            if (!product) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Insufficient quantity for product ID: ${item.product_id}` });
            }

            const total_price = product.price * item.quantity;
            await client.query('UPDATE products SET quantity = quantity - $1 WHERE id = $2', [item.quantity, item.product_id]);
            
            // Per your request, a new record is created for each buyer-to-seller transaction.
            await client.query(
                'INSERT INTO orders (buyer_id, seller_id, product_id, quantity, price) VALUES ($1, $2, $3, $4, $5)',
                [buyer_id, product.seller_id, item.product_id, item.quantity, total_price]
            );
        }

        // 3. Clear the cart
        await client.query('DELETE FROM carts WHERE buyer_id = $1', [buyer_id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Checkout successful! Your order has been placed.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Checkout failed. Please try again.', error: error.message });
    } finally {
        client.release();
    }
});


// Seller: Get their own product listings (inventory)
app.get('/api/seller/inventory', authenticateToken, async (req, res) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Access denied: Not a seller' });
    }
    const seller_id = req.user.id;
    try {
        const result = await pool.query(
            'SELECT id, model_name, quantity, price FROM products WHERE seller_id = $1 ORDER BY created_at DESC',
            [seller_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Seller: Get their order history and total revenue
app.get('/api/seller/orders', authenticateToken, async (req, res) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Access denied: Not a seller' });
    }
    const seller_id = req.user.id;
    try {
        // Fetch all orders received by this seller
        const ordersResult = await pool.query(`
            SELECT
                o.id,
                o.quantity,
                o.price as total_amount,
                o.order_date,
                p.model_name,
                u.username as buyer_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.buyer_id = u.id
            WHERE o.seller_id = $1
            ORDER BY o.order_date DESC
        `, [seller_id]);

        // Calculate total revenue from these orders
        const totalRevenueResult = await pool.query(
            'SELECT SUM(price) as total_revenue FROM orders WHERE seller_id = $1',
            [seller_id]
        );

        const totalRevenue = totalRevenueResult.rows[0].total_revenue || 0;

        res.json({
            orders: ordersResult.rows,
            totalRevenue: parseFloat(totalRevenue)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Buyer: Get their order history
app.get('/api/buyer/orders', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    const buyer_id = req.user.id;
    try {
        const result = await pool.query(`
            SELECT
                o.id,
                o.quantity,
                o.price as total_amount,
                o.order_date,
                p.model_name,
                u.username as seller_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = $1
            ORDER BY o.order_date DESC
        `, [buyer_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Buyer: Clear their cart
app.delete('/api/buyer/cart', authenticateToken, async (req, res) => {
    if (req.user.role !== 'buyer') {
        return res.status(403).json({ message: 'Access denied: Not a buyer' });
    }
    const buyer_id = req.user.id;
    try {
        await pool.query('DELETE FROM carts WHERE buyer_id = $1', [buyer_id]);
        res.status(200).json({ message: 'Cart has been cleared' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});