const API_URL = 'http://localhost:3000/api';

// DOM Elements
const authNav = document.getElementById('auth-nav');
const userNav = document.getElementById('user-nav');
const welcomeMsg = document.getElementById('welcome-msg');
const authSection = document.getElementById('auth-section');
const signupForm = document.getElementById('signup-form');
const signinForm = document.getElementById('signin-form');
const sellerDashboard = document.getElementById('seller-dashboard');
const buyerDashboard = document.getElementById('buyer-dashboard');
const listingsContainer = document.getElementById('listings-container');
const buyerMessage = document.getElementById('buyer-message');
const sellerMessage = document.getElementById('seller-message');

const cartContainer = document.getElementById('cart-container');
const cartMessage = document.getElementById('cart-message');
const checkoutBtn = document.getElementById('checkout-btn');

const inventoryContainer = document.getElementById('inventory-container');
const inventoryMessage = document.getElementById('inventory-message');
const ordersContainer = document.getElementById('orders-container');
const totalRevenueEl = document.getElementById('total-revenue');
const ordersMessage = document.getElementById('orders-message');

const buyingHistoryContainer = document.getElementById('buying-history-container');
const buyingHistoryMessage = document.getElementById('buying-history-message');

const clearCartBtn = document.getElementById('clear-cart-btn');
const cartActionsDiv = document.querySelector('.cart-actions');

// Event Listeners
document.getElementById('show-signup').addEventListener('click', () => {
    signupForm.style.display = 'block';
    signinForm.style.display = 'none';
});

document.getElementById('show-signin').addEventListener('click', () => {
    signinForm.style.display = 'block';
    signupForm.style.display = 'none';
});

document.getElementById('signup-btn').addEventListener('click', async () => {
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    const messageEl = document.getElementById('signup-message');
    await handleAuth('register', { username, password, role }, messageEl);
});

document.getElementById('signin-btn').addEventListener('click', async () => {
    const username = document.getElementById('signin-username').value;
    const password = document.getElementById('signin-password').value;
    const messageEl = document.getElementById('signin-message');
    await handleAuth('login', { username, password }, messageEl);
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    
    // Clear all auth-related input fields
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signin-username').value = '';
    document.getElementById('signin-password').value = '';

    checkAuth();
});

document.getElementById('add-product-btn').addEventListener('click', async () => {
    const model_name = document.getElementById('seller-model-name').value; // <-- Changed element ID and variable name
    const quantity = document.getElementById('seller-quantity').value;
    const price = document.getElementById('seller-price').value;
    const token = localStorage.getItem('token');
    const messageEl = document.getElementById('seller-message');

    try {
        const response = await fetch(`${API_URL}/seller/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ quantity: parseInt(quantity), price: parseFloat(price), model_name }) // <-- Changed variable name
        });

        const data = await response.json();
        if (response.ok) {
            messageEl.textContent = data.message;
            messageEl.style.color = 'green';
            document.getElementById('seller-model-name').value = '';
            document.getElementById('seller-quantity').value = '';
            document.getElementById('seller-price').value = '';
            fetchSellerData(); // <-- Refresh dashboard
        } else {
            messageEl.textContent = data.message;
            messageEl.style.color = 'red';
        }
    } catch (error) {
        console.error('Error adding product:', error);
        messageEl.textContent = 'Failed to add product.';
        messageEl.style.color = 'red';
    }
});


// Helper Functions

async function addToCart(event) {
    const productId = event.target.dataset.id;
    const quantityInput = event.target.previousElementSibling;
    const quantity = parseInt(quantityInput.value);
    const token = localStorage.getItem('token');

    if (!quantity || quantity <= 0) {
        alert('Please enter a valid quantity to add to cart.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/buyer/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ product_id: productId, quantity })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchCart();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Failed to add to cart.');
    }
}

async function fetchCart() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/buyer/cart`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const cartItems = await response.json();
        displayCart(cartItems);
    } catch (error) {
        console.error('Error fetching cart:', error);
        cartMessage.textContent = 'Failed to load cart.';
    }
}

function displayCart(items) {
    cartContainer.innerHTML = '';
    if (items.length === 0) {
        cartMessage.textContent = 'Your cart is empty.';
        cartActionsDiv.style.display = 'none';
        return;
    }
    cartMessage.textContent = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h4>Seller: ${item.seller_name}</h4>
            <p><strong>Model Name:</strong> ${item.model_name}</p>
            <p><strong>Quantity:</strong> ${item.cart_quantity} bottles</p>
            <p><strong>Price:</strong> $${item.price} per bottle</p>
        `;
        cartContainer.appendChild(card);
    });
    cartActionsDiv.style.display = 'flex';
}




async function handleCheckout() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/buyer/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            fetchProducts();
            fetchCart();
            fetchBuyerOrders();
        }
    } catch (error) {
        console.error('Checkout failed:', error);
        alert('Checkout failed due to a server error.');
    }
}


async function handleAuth(endpoint, body, messageEl) {
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (response.ok) {
            messageEl.textContent = data.message;
            messageEl.style.color = 'green';
            
            // Clear input fields on successful registration
            if (endpoint === 'register') {
                document.getElementById('signup-username').value = '';
                document.getElementById('signup-password').value = '';
            }
            
            // Handle login token if available
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                checkAuth();
            }
        } else {
            messageEl.textContent = data.message;
            messageEl.style.color = 'red';
        }
    } catch (error) {
        console.error(`Error with ${endpoint}:`, error);
        messageEl.textContent = `Failed to ${endpoint}.`;
        messageEl.style.color = 'red';
    }
}

async function fetchProducts() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/buyer/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        buyerMessage.textContent = 'Failed to load listings.';
    }
}

function displayProducts(products) {
    listingsContainer.innerHTML = '';
    if (products.length === 0) {
        listingsContainer.innerHTML = '<p>No listings available at the moment.</p>';
        return;
    }
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h4>Seller: ${product.seller_name}</h4>
            <p><strong>Model Name:</strong> ${product.model_name}</p> <p><strong>Quantity:</strong> ${product.quantity} bottles</p>
            <p><strong>Price:</strong> $${product.price} per bottle</p>
            <input type="number" class="add-to-cart-quantity" placeholder="Qty" min="1" max="${product.quantity}">
            <button class="add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
        `;
        listingsContainer.appendChild(card);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', addToCart);
    });
}

async function handleBuy(event) {
    const productId = event.target.dataset.id;
    const quantityInput = event.target.previousElementSibling;
    const quantity = parseInt(quantityInput.value);
    const token = localStorage.getItem('token');

    if (!quantity || quantity <= 0) {
        alert('Please enter a valid quantity to buy.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/buyer/buy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ product_id: productId, quantity })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            fetchProducts(); // Refresh the list
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error during purchase:', error);
        alert('Failed to complete the purchase.');
    }
}


async function fetchBuyerOrders() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/buyer/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orders = await response.json();
        displayBuyerOrders(orders);
    } catch (error) {
        console.error('Error fetching buyer orders:', error);
        buyingHistoryMessage.textContent = 'Failed to load order history.';
    }
}


async function fetchSellerData() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        // Fetch Inventory
        const inventoryResponse = await fetch(`${API_URL}/seller/inventory`, { headers: { 'Authorization': `Bearer ${token}` } });
        const inventoryData = await inventoryResponse.json();
        displayInventory(inventoryData);

        // Fetch Orders
        const ordersResponse = await fetch(`${API_URL}/seller/orders`, { headers: { 'Authorization': `Bearer ${token}` } });
        const ordersData = await ordersResponse.json();
        displaySellerOrders(ordersData.orders, ordersData.totalRevenue);
        
    } catch (error) {
        console.error('Error fetching seller data:', error);
        inventoryMessage.textContent = 'Failed to load inventory.';
        ordersMessage.textContent = 'Failed to load orders.';
    }
}
function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && role) {
        authNav.style.display = 'none';
        authSection.style.display = 'none';
        userNav.style.display = 'flex';
        welcomeMsg.textContent = `Welcome, ${role}!`;

        if (role === 'seller') {
            sellerDashboard.style.display = 'block';
            buyerDashboard.style.display = 'none';
            fetchSellerData(); // <-- Call new function
        } else if (role === 'buyer') {
            sellerDashboard.style.display = 'none';
            buyerDashboard.style.display = 'block';
            fetchProducts();
            fetchCart(); // <-- Fetch cart items on login
            fetchBuyerOrders();
        }
    } else {
        authNav.style.display = 'flex';
        authSection.style.display = 'block';
        userNav.style.display = 'none';
        sellerDashboard.style.display = 'none';
        buyerDashboard.style.display = 'none';
    }
}

function displayInventory(products) {
    inventoryContainer.innerHTML = '';
    inventoryMessage.textContent = '';
    if (products.length === 0) {
        inventoryMessage.textContent = 'You have no active listings.';
        return;
    }
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h4>${product.model_name}</h4>
            <p><strong>Quantity:</strong> ${product.quantity} bottles</p>
            <p><strong>Price:</strong> $${product.price} per bottle</p>
        `;
        inventoryContainer.appendChild(card);
    });
}

function displaySellerOrders(orders, totalRevenue) {
    ordersContainer.innerHTML = '';
    ordersMessage.textContent = '';
    if (orders.length === 0) {
        ordersMessage.textContent = 'You have not received any orders yet.';
        totalRevenueEl.textContent = '$0.00';
        return;
    }
    const orderList = document.createElement('ul');
    orders.forEach(order => {
        const orderItem = document.createElement('li');
        orderItem.innerHTML = `
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Buyer:</strong> ${order.buyer_name}</p>
            <p><strong>Product:</strong> ${order.model_name}</p>
            <p><strong>Quantity:</strong> ${order.quantity} bottles</p>
            <p><strong>Amount:</strong> $${order.total_amount}</p>
            <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleDateString()}</p>
        `;
        orderList.appendChild(orderItem);
    });
    ordersContainer.appendChild(orderList);
    totalRevenueEl.textContent = `$${totalRevenue.toFixed(2)}`;
}


function displayBuyerOrders(orders) {
    buyingHistoryContainer.innerHTML = '';
    buyingHistoryMessage.textContent = ''; 

    if (orders.length === 0) {
        buyingHistoryMessage.textContent = 'You have not made any purchases yet.';
        return;
    }
    
    // Create a container for the cards
    const ordersGrid = document.createElement('div');
    ordersGrid.className = 'orders-grid'; // This class will be used for styling

    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card'; // This class will be used for styling
        orderCard.innerHTML = `
            <h4>From Seller: ${order.seller_name}</h4>
            <p><strong>Product:</strong> ${order.model_name}</p>
            <p><strong>Quantity:</strong> ${order.quantity} bottles</p>
            <p><strong>Total Cost:</strong> $${order.total_amount}</p>
            <p><strong>Order Date:</strong> ${new Date(order.order_date).toLocaleDateString()}</p>
        `;
        ordersGrid.appendChild(orderCard);
    });
    
    buyingHistoryContainer.appendChild(ordersGrid);
}


async function clearCart() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/buyer/cart`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        alert(data.message);
        if (response.ok) {
            fetchCart(); // Refresh the cart display
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
        alert('Failed to clear cart.');
    }
}


// Initial check on page load
checkAuth();
checkoutBtn.addEventListener('click', handleCheckout);
clearCartBtn.addEventListener('click', clearCart);