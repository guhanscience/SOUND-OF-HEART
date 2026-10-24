const sellerLoginForm = document.getElementById("sellerLoginForm");
const loginMessage = document.getElementById("loginMessage");

sellerLoginForm.addEventListener("submit", async event => {
    event.preventDefault();

    try {
        const response = await fetch("/api/seller/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("loginName").value.trim(),
                password: document.getElementById("loginPassword").value
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Seller login failed.");
        }

        localStorage.setItem("sellerToken", data.token);
        localStorage.setItem("sellerName", data.name);
        window.location.href = "Add_product.html";
    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.style.color = "var(--error)";
    }
});