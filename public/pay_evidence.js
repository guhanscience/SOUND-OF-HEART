const paymentForm = document.getElementById("paymentForm");
const paymentPhoto = document.getElementById("paymentPhoto");
const paymentMessage = document.getElementById("paymentMessage");

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

paymentForm.addEventListener("submit", async event => {
    event.preventDefault();
    const registration = JSON.parse(sessionStorage.getItem("sellerRegistration") || "null");
    const plan = sessionStorage.getItem("sellerPlan");
    const file = paymentPhoto.files[0];

    if (!registration || !plan || !file) {
        paymentMessage.textContent = "Please complete registration, choose a plan, and upload a payment photo.";
        paymentMessage.style.color = "var(--error)";
        return;
    }

    paymentMessage.textContent = "Submitting payment evidence...";
    paymentMessage.style.color = "var(--muted)";

    try {
        const response = await fetch("/api/seller/applications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...registration, plan, paymentEvidence: await readFileAsDataUrl(file) })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to submit payment evidence.");
        }

        sessionStorage.removeItem("sellerRegistration");
        sessionStorage.removeItem("sellerPlan");
        paymentMessage.textContent = `${data.message} Wait for approval before using seller login.`;
        paymentMessage.style.color = "var(--success)";
        paymentForm.reset();
    } catch (error) {
        paymentMessage.textContent = error.message;
        paymentMessage.style.color = "var(--error)";
    }
});