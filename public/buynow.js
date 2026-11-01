const cartKey = "soundOfHeartCart";
const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
document.getElementById("orderTotal").textContent = `₹${total.toLocaleString("en-IN")}`;
const address = document.getElementById("address");
const warning = document.getElementById("addressWarning");
address.addEventListener("input", () => {
  warning.textContent = address.value.toLowerCase().includes("guduvancherry") ? "" : "Delivery is only within Guduvancherry surroundings. Please enter the word Guduvancherry.";
});
document.getElementById("orderForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!address.value.toLowerCase().includes("guduvancherry")) {
    warning.textContent = "Delivery is only within Guduvancherry surroundings. Please enter the word Guduvancherry.";
    return;
  }
  const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
  const payload = { username: document.getElementById("username").value.trim(), gpayNumber: document.getElementById("gpayNumber").value.trim(), gmailId: document.getElementById("gmailId").value.trim(), address: address.value.trim(), paymentMethod, cart, total };
  try {
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    sessionStorage.setItem("sohOrder", JSON.stringify(payload));
    localStorage.setItem("soundOfHeartActiveOrder", JSON.stringify({ orderId: data.orderId, trackingToken: data.trackingToken, createdAt: new Date().toISOString(), gmailId: payload.gmailId }));
    localStorage.removeItem(cartKey);
    if (data.mailto) window.open(data.mailto, "_blank");
    if (paymentMethod === "Online Payment") {
      window.location.href = "online_payment.html?total=" + encodeURIComponent(total);
    } else {
      document.getElementById("orderMessage").textContent = "Order submitted successfully. Confirmation email actions have been sent.";
      localStorage.removeItem(cartKey);
    }
  } catch (error) { document.getElementById("orderMessage").textContent = error.message; }
});
