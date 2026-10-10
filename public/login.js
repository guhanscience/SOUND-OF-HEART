const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        message.style.color = "#ff6b6b";
        return;
    }

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "Login failed.";

            message.style.color = "#ff6b6b";
            return;
        }

        localStorage.setItem("authToken", data.token);

        message.textContent =
            "Login successful! Redirecting...";

        message.style.color = "#7ee787";

        setTimeout(() => {
            window.location.href = "/dashboard.html";
        }, 700);

    } catch (error) {
        console.error(error);

        message.textContent =
            "Unable to connect to the server.";

        message.style.color = "#ff6b6b";
    }
});
