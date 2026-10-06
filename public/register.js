const form = document.getElementById("registerForm");
const message = document.getElementById("registerMessage");

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;

    message.textContent = "";

    if (!name || !email || !password || !confirmPassword) {
        message.textContent =
            "Please fill in all fields.";

        message.style.color = "#ff6b6b";
        return;
    }

    if (password.length < 8) {
        message.textContent =
            "Password must be at least 8 characters.";

        message.style.color = "#ff6b6b";
        return;
    }

    if (password !== confirmPassword) {
        message.textContent =
            "Passwords do not match.";

        message.style.color = "#ff6b6b";
        return;
    }

    try {
        const response = await fetch("/api/register", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name,
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            message.textContent =
                data.message || "Registration failed.";

            message.style.color = "#ff6b6b";
            return;
        }

        // Save authentication token
        localStorage.setItem("authToken", data.token);

        message.textContent =
            "Account created successfully! Redirecting...";

        message.style.color = "#7ee787";

        setTimeout(() => {
            window.location.href = "/dashboard.html";
        }, 1000);

    } catch (error) {
        console.error(error);

        message.textContent =
            "Unable to connect to the server.";

        message.style.color = "#ff6b6b";
    }
});
