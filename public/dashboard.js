const userName = document.getElementById("userName");
const welcomeName = document.getElementById("welcomeName");
const logoutButton = document.getElementById("logoutButton");

const repairForm = document.getElementById("repairForm");
const formMessage = document.getElementById("formMessage");
const repairsList = document.getElementById("repairsList");


/* --------------------------------
   AUTH TOKEN
-------------------------------- */

const authToken = localStorage.getItem("authToken");


/* --------------------------------
   AUTHORIZATION HEADER
-------------------------------- */

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
}


/* --------------------------------
   LOAD USER
-------------------------------- */

async function loadDashboard() {

    if (!authToken) {
        window.location.href = "/login.html";
        return;
    }

    try {

        const response = await fetch("/api/me", {
            method: "GET",
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (!response.ok) {

            localStorage.removeItem("authToken");

            window.location.href = "/login.html";

            return;
        }

        userName.textContent = data.user.name;

        welcomeName.textContent = data.user.name;

        await loadRepairs();

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        window.location.href = "/login.html";
    }
}


/* --------------------------------
   LOAD REPAIR REQUESTS
-------------------------------- */

async function loadRepairs() {

    try {

        const response = await fetch(
            "/api/repairs",
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {

            repairsList.innerHTML = `
                <p class="loading">
                    Unable to load repairs.
                </p>
            `;

            return;
        }


        if (data.repairs.length === 0) {

            repairsList.innerHTML = `
                <p class="loading">
                    You don't have any repair requests yet.
                </p>
            `;

            return;
        }


        repairsList.innerHTML = "";


        data.repairs.forEach(repair => {

            const item =
                document.createElement("div");

            item.className = "repair-item";


            item.innerHTML = `
                <h3>
                    ${escapeHtml(repair.speaker)}
                </h3>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(repair.status)}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${escapeHtml(repair.phone)}
                </p>

                <p>
                    <strong>Problem:</strong>
                    ${escapeHtml(repair.problem)}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${escapeHtml(repair.created_at)}
                </p>

                <button
                    class="delete-repair"
                    onclick="deleteRepair(${repair.id})"
                >
                    Delete Request
                </button>
            `;


            repairsList.appendChild(item);

        });

    } catch (error) {

        console.error(
            "Repair loading error:",
            error
        );

        repairsList.innerHTML = `
            <p class="loading">
                Unable to load repairs.
            </p>
        `;
    }
}


/* --------------------------------
   CREATE REPAIR REQUEST
-------------------------------- */

repairForm.addEventListener(
    "submit",
    async function (e) {

        e.preventDefault();


        const phone =
            document
                .getElementById("phone")
                .value
                .trim();


        const speaker =
            document
                .getElementById("speaker")
                .value;


        const problem =
            document
                .getElementById("problem")
                .value
                .trim();


        formMessage.textContent = "";


        if (!phone || !speaker || !problem) {

            formMessage.textContent =
                "Please fill in all fields.";

            formMessage.style.color =
                "#ff6b6b";

            return;
        }


        if (
            phone.replace(/\D/g, "").length < 10
        ) {

            formMessage.textContent =
                "Please enter a valid phone number.";

            formMessage.style.color =
                "#ff6b6b";

            return;
        }


        try {

            const response = await fetch(
                "/api/repairs",
                {
                    method: "POST",

                    headers: getAuthHeaders(),

                    body: JSON.stringify({
                        phone,
                        speaker,
                        problem
                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                formMessage.textContent =
                    data.message ||
                    "Unable to submit repair request.";

                formMessage.style.color =
                    "#ff6b6b";

                return;
            }


            formMessage.textContent =
                "Repair request submitted successfully!";

            formMessage.style.color =
                "#7ee787";


            repairForm.reset();


            await loadRepairs();

        } catch (error) {

            console.error(error);

            formMessage.textContent =
                "Unable to connect to the server.";

            formMessage.style.color =
                "#ff6b6b";
        }
    }
);


/* --------------------------------
   DELETE REPAIR
-------------------------------- */

async function deleteRepair(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this repair request?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response = await fetch(
            `/api/repairs/${id}`,
            {
                method: "DELETE",
                headers: getAuthHeaders()
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Unable to delete repair request."
            );

            return;
        }


        await loadRepairs();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to the server."
        );
    }
}


/* --------------------------------
   LOGOUT
-------------------------------- */

logoutButton.addEventListener(
    "click",
    async function () {

        try {

            await fetch(
                "/api/logout",
                {
                    method: "POST",
                    headers: getAuthHeaders()
                }
            );

        } catch (error) {

            console.error(error);

        } finally {

            localStorage.removeItem(
                "authToken"
            );

            window.location.href =
                "/login.html";
        }
    }
);


/* --------------------------------
   HTML SECURITY
-------------------------------- */

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}


/* --------------------------------
   START DASHBOARD
-------------------------------- */

loadDashboard();
