let products = [
    {
        id: "heart-mini",
        name: "Heart Mini Bluetooth Speaker",
        price: 2499,
        details: "Compact wireless speaker with warm sound, deep bass, and up to 12 hours of battery life."
    },
    {
        id: "heart-bar",
        name: "HeartBar Soundbar",
        price: 7999,
        details: "A slim soundbar with clear dialogue, room-filling audio, and simple TV connectivity."
    },
    {
        id: "heart-woofer",
        name: "HeartBass Home Woofer",
        price: 11999,
        details: "Powerful low-end response for music and films, tuned for balanced home listening."
    },
    {
        id: "heart-cable",
        name: "Premium Audio Cable",
        price: 799,
        details: "Durable gold-plated audio cable designed for reliable, low-noise connections."
    }
];

const cartStorageKey = "soundOfHeartCart";
const productsGrid = document.getElementById("productsGrid");
const cartCount = document.getElementById("cartCount");
const userName = document.getElementById("userName");

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(cartStorageKey)) || [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const count = getCart().reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = count;
}

function addToCart(productId) {
    const product = products.find(item => item.id === productId);
    const cart = getCart();
    const stock = Number(product.quantity ?? 10);
    const existingItem = cart.find(item => item.id === productId);
    if (stock <= 0 || (existingItem && existingItem.quantity >= stock)) return;

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart(cart);
}

function renderProducts() {
    productsGrid.innerHTML = products.map(product => {
        const quantity = Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 10;
        return `
        <article class="product-card ${quantity === 0 ? "out-of-stock" : ""}">
            <div class="product-image-wrap">
                ${product.photo
                    ? `<img class="product-photo" src="${product.photo}" alt="${product.name}">`
                    : `<div class="product-art" aria-hidden="true">♪</div>`}
                ${quantity === 0 ? `<span class="stock-label">Out of Stock</span>` : ""}
            </div>
            <p class="product-type">Sound of Heart</p>
            <h2>${product.name}</h2>
            <p class="product-details">${product.details}</p>
            <p class="stock-count">${quantity > 0 ? `${quantity} in stock` : "Unavailable"}</p>
            <div class="product-footer">
                <strong>₹${product.price.toLocaleString("en-IN")}</strong>
                <div><button type="button" class="add-button" data-product-id="${product.id}" ${quantity === 0 ? "disabled" : ""}>${quantity === 0 ? "Unavailable" : "Add to Cart"}</button> <button type="button" class="buy-button" data-buy-id="${product.id}" ${quantity === 0 ? "disabled" : ""}>Buy Now</button></div>
            </div>
        </article>`;
    }).join("");

    productsGrid.querySelectorAll("[data-product-id]").forEach(button => {
        button.addEventListener("click", () => addToCart(button.dataset.productId));
    });
    productsGrid.querySelectorAll("[data-buy-id]").forEach(button => {
        button.addEventListener("click", () => {
            addToCart(button.dataset.buyId);
            window.location.href = "buynow.html";
        });
    });
}

async function loadSellerProducts() {
    try {
        const response = await fetch("/api/products");
        const data = await response.json();

        if (response.ok && data.products.length > 0) {
                    products = [...products, ...data.products.map(product => ({
                ...product,
                id: `seller-${product.id}`
            }))];
            renderProducts();
        }
    } catch (error) {
        console.error("Unable to load seller products:", error);
    }
}

async function loadUserName() {
    const authToken = localStorage.getItem("authToken");

    if (!authToken) {
        return;
    }

    try {
        const response = await fetch("/api/me", {
            headers: { "Authorization": "Bearer " + authToken }
        });
        const data = await response.json();

        if (response.ok && data.user && data.user.name) {
            userName.textContent = data.user.name;
        }
    } catch (error) {
        console.error("Unable to load user name:", error);
    }
}

const yourOrderButton = document.getElementById("yourOrderButton");
if (yourOrderButton) {
    const activeOrderJson = localStorage.getItem("soundOfHeartActiveOrder");
    yourOrderButton.style.display = activeOrderJson ? "inline-block" : "none";
    if (activeOrderJson) {
        const activeOrder = JSON.parse(activeOrderJson);
        fetch(`/api/orders/${activeOrder.orderId}/tracking?token=${encodeURIComponent(activeOrder.trackingToken)}`)
            .then(response => response.json())
            .then(data => {
                if (data.order && (data.order.status === "Delivered" || data.order.status === "Cancelled")) {
                    localStorage.removeItem("soundOfHeartActiveOrder");
                    yourOrderButton.style.display = "none";
                }
            })
            .catch(() => {});
    }
}

document.getElementById("refreshButton").addEventListener("click", () => {
    window.location.reload();
});

renderProducts();
updateCartCount();
loadUserName();
loadSellerProducts();