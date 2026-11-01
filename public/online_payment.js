const params = new URLSearchParams(location.search);
const total = Number(params.get("total") || 0);
document.getElementById("onlineTotal").textContent = `₹${total.toLocaleString("en-IN")}`;
const gpay = document.getElementById("gpayLink");
const intent = `gpay://upi/pay?pa=9952433437@upi&pn=Sound%20of%20Heart&am=${encodeURIComponent(total)}&cu=INR`;
gpay.href = intent;
document.getElementById("downloadQr").addEventListener("click", async () => {
  const imageUrl = document.getElementById("paymentQr").src;
  try { const response = await fetch(imageUrl); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "SOH-GPay-QR.png"; link.click(); URL.revokeObjectURL(url); } catch { window.open(imageUrl, "_blank"); }
});
