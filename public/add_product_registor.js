const registrationForm = document.getElementById("sellerRegistrationForm");
const registrationMessage = document.getElementById("registrationMessage");

registrationForm.addEventListener("submit", event => {
    event.preventDefault();

    const formData = new FormData(registrationForm);
    const registration = Object.fromEntries(formData.entries());

    if (registration.password !== registration.confirmPassword) {
        registrationMessage.textContent = "Passwords do not match.";
        registrationMessage.style.color = "var(--error)";
        return;
    }

    sessionStorage.setItem("sellerRegistration", JSON.stringify(registration));
    window.location.href = "plan.html";
});