const planMessage = document.getElementById("planMessage");
const registration = sessionStorage.getItem("sellerRegistration");

document.querySelectorAll("[data-plan]").forEach(button => {
    button.addEventListener("click", () => {
        if (!registration) {
            planMessage.textContent = "Please complete seller registration first.";
            planMessage.style.color = "var(--error)";
            return;
        }

        sessionStorage.setItem("sellerPlan", button.dataset.plan);
        window.location.href = "pay_evidence.html";
    });
});