let deferredPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    // Show the install button on all pages
    const installButton = document.getElementById("installButton");
    if (installButton) {
        installButton.style.display = "block";
        installButton.addEventListener("click", async () => {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
                console.log("User installed the app");
                installButton.style.display = "none"; // Hide after install
            }
            deferredPrompt = null;
        });
    }
});

// Check if the app is already installed
window.addEventListener("appinstalled", () => {
    console.log("PWA was installed");
    const installButton = document.getElementById("installButton");
    if (installButton) {
        installButton.style.display = "none"; // Hide if installed
    }
});
