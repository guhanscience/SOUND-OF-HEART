const cartStorageKey = "soundOfHeartCart";
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const buyNowButton = document.getElementById("buyNowButton");
const orderMessage = document.getElementById("orderMessage");
const userName = document.getElementById("userName");

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(cartStorageKey)) || [];
    } catch {
        return [];
    }
}

function formatPrice(price) {
    return `₹${price.toLocaleString("en-IN")}`;
}

function renderCart() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    cartTotal.textContent = formatPrice(total);
    buyNowButton.disabled = cart.length === 0;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <h2>Your cart is empty</h2>
                <p>Add a product to see it here.</p>
                <a href="product.html" class="add-button">Browse Products</a>
            </div>
        `;
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <article class="cart-item">
            <div>
                <p class="product-type">${item.quantity} ×</p>
                <h2>${item.name}</h2>
                <p class="product-details">${item.details}</p>
            </div>
            <strong>${formatPrice(item.price * item.quantity)}</strong>
            <button type="button" class="remove-button" data-remove-id="${item.id}">Remove</button>
        </article>
    `).join("");

    cartItems.querySelectorAll("[data-remove-id]").forEach(button => {
        button.addEventListener("click", () => {
            const updatedCart = getCart().filter(item => item.id !== button.dataset.removeId);
            localStorage.setItem(cartStorageKey, JSON.stringify(updatedCart));
            renderCart();
        });
    });
}

buyNowButton.addEventListener("click", () => {
    if (getCart().length === 0) {
        return;
    }

    orderMessage.innerHTML = "Your Order Placed Successfully<br>Delivered within Three Days";
    localStorage.removeItem(cartStorageKey);
    renderCart();
});

async function loadUserName() {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
        return;
    }

    try {
        const response = await fetch("/api/me", {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const data = await response.json();

        if (response.ok && data.user && data.user.name) {
            userName.textContent = data.user.name;
        }
    } catch (error) {
        console.error("Unable to load user name:", error);
    }
}

renderCart();
loadUserName();