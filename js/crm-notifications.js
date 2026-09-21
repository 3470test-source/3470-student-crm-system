const API_BASE_no = "http://localhost:3000/api";

async function loadHeaderNotificationCount() {

    const headerCount = document.getElementById("headerNotificationCount");

    if (!headerCount) {
        return;
    }

    try {

        const response = await fetch(`${API_BASE_no}/notifications/today`);

        if (!response.ok) {
            throw new Error("Failed to load notifications");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(
                data.message || "Unable to load notifications"
            );
        }

        headerCount.textContent = Number(data.summary.total_notifications) || 0;

    } catch (error) {

        console.error("❌ Header Notification Error:", error);

        headerCount.textContent = "0";
    }
}


function openNotifications() {

    window.location.href = "today-notifications.html";

}


document.addEventListener("DOMContentLoaded", () => {

        loadHeaderNotificationCount();

    }
);