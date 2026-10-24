const productForm = document.getElementById("productForm");
const productMessage = document.getElementById("productMessage");
document.getElementById("sellerName").textContent = localStorage.getItem("sellerName") || "Seller";

function readProductPhoto(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

productForm.addEventListener("submit", async event => {
    event.preventDefault();
    const file = document.getElementById("productPhoto").files[0];

    try {
        const response = await fetch("/api/seller/products", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("sellerToken")}`
            },
            body: JSON.stringify({
                name: document.getElementById("productName").value,
                price: document.getElementById("productPrice").value,
                details: document.getElementById("productDetails").value,
                photo: await readProductPhoto(file)
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to add product.");
        }

        productMessage.textContent = "Product added successfully.";
        productMessage.style.color = "var(--success)";
        productForm.reset();
    } catch (error) {
        productMessage.textContent = error.message;
        productMessage.style.color = "var(--error)";
    }
});