const activeKey = "soundOfHeartActiveOrder";
let active = JSON.parse(localStorage.getItem(activeKey) || "null");
if (!active) {
  window.location.href = "product.html";
} else {
  refreshTracking();
  setInterval(refreshTracking, 30000);
}

function formatElapsed(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m elapsed`;
}

async function refreshTracking() {
  if (!active) return;
  try {
    const response = await fetch(`/api/orders/${active.orderId}/tracking?token=${encodeURIComponent(active.trackingToken)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    const order = data.order;
    const stageIndex = { Ordered: 0, Shipped: 1, "Out for Delivery": 2, Delivered: 3 };
    const index = order.status === "Cancelled" ? -1 : stageIndex[order.stage] ?? 0;

    document.querySelectorAll(".tracking-stage").forEach((element, i) => {
      element.classList.toggle("active", i <= index);
    });
    document.getElementById("trackingProgress").style.width = index < 0 ? "0" : `${index * 33.333}%`;
    document.getElementById("elapsedTime").textContent = formatElapsed(order.elapsedMs);

    const products = order.cart.map(item => `${item.name} × ${item.quantity}`).join("<br>");
    const details = document.getElementById("orderDetails");
    details.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = `Order #${order.id}`;
    const productInfo = document.createElement("p");
    productInfo.textContent = products;
    const total = document.createElement("p");
    const totalLabel = document.createElement("strong");
    totalLabel.textContent = "Total: ";
    total.append(totalLabel, document.createTextNode(`₹${Number(order.total).toLocaleString("en-IN")}`));
    const address = document.createElement("p");
    const addressLabel = document.createElement("strong");
    addressLabel.textContent = "Address: ";
    address.append(addressLabel, document.createTextNode(order.address));
    details.append(heading, productInfo, total, address);

    const cancelButton = document.getElementById("cancelOrder");
    const confirmButton = document.getElementById("confirmDelivery");
    const emailButton = document.getElementById("emailOrder");
    const message = document.getElementById("trackingMessage");

    if (order.status === "Cancelled") {
      message.textContent = "Order cancelled";
      cancelButton.style.display = "none";
      confirmButton.style.display = "none";
      emailButton.style.display = "none";
      localStorage.removeItem(activeKey);
      return;
    }
    if (order.stage === "Delivered") {
      message.textContent = "Order Delivered";
      cancelButton.style.display = "none";
      confirmButton.style.display = "none";
      emailButton.style.display = "none";
      localStorage.removeItem(activeKey);
      return;
    }

    cancelButton.style.display = order.stage === "Out for Delivery" ? "none" : "inline-block";
    if (order.stage === "Out for Delivery") {
      confirmButton.style.display = "inline-block";
      emailButton.style.display = "inline-block";
      message.textContent = "Wait for Confirmation";
      prepareConfirmationEmail(order);
    } else {
      confirmButton.style.display = "none";
      emailButton.style.display = "none";
      message.textContent = "Your order is being processed.";
    }
  } catch (error) {
    document.getElementById("trackingMessage").textContent = error.message;
  }
}

function prepareConfirmationEmail(order) {
  const trackingUrl = `${location.origin}/order_tracking.html?order=${order.id}&token=${encodeURIComponent(active.trackingToken)}&confirm=1`;
  const subject = `SOH Order #${order.id} - Order Confirmation`;
  const body = `Order information:\n\nOrder: #${order.id}\nUsername: ${order.username}\nGmail: ${order.gmailId}\nAddress: ${order.address}\nPayment: ${order.paymentMethod}\nTotal: ₹${Number(order.total).toLocaleString("en-IN")}\n\nOrder Confirmation button: ${trackingUrl}`;
  document.getElementById("emailOrder").onclick = () => {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(order.gmailId)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  };
  document.getElementById("confirmDelivery").onclick = async () => {
    const response = await fetch(`/api/orders/${order.id}/tracking-confirm?token=${encodeURIComponent(active.trackingToken)}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) document.getElementById("trackingMessage").textContent = data.message;
    else refreshTracking();
  };
}

function setupCancel() {
  document.getElementById("cancelOrder").addEventListener("click", async () => {
    if (!confirm("Cancel this order?")) return;
    const response = await fetch(`/api/orders/${active.orderId}/tracking-cancel?token=${encodeURIComponent(active.trackingToken)}`, { method: "POST" });
    const data = await response.json();
    document.getElementById("trackingMessage").textContent = data.message;
    if (response.ok) refreshTracking();
  });
}
setupCancel();
