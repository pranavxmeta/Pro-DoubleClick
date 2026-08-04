document.addEventListener("DOMContentLoaded", () => {
    let currentHostname = "";

    // UI Elements
    const siteStatusTextOutput = document.getElementById("siteStatusTextOutput");
    const optionBtn = document.getElementById("btnOption");
    const resetBtn = document.getElementById("btnReset");
    const flagBtn = document.getElementById("btnFlag");
    const flagLabel = document.getElementById("flagLabel");

    const overrideButtons = {
        front: document.getElementById("siteBtnFront"),
        back: document.getElementById("siteBtnBack"),
    };

    const defaultButtons = {
        front: document.getElementById("globalBtnFront"),
        back: document.getElementById("globalBtnBack"),
    };

    const statusIconElement = document.querySelector(".status-current img");

    const slidingPanel = document.getElementById("slidingPanel");
    const closePanelBtn = document.getElementById("closePanelBtn");
    const tabOverride = document.getElementById("tabOverride");
    const tabExcluded = document.getElementById("tabExcluded");
    const panelList = document.getElementById("panelList");

    let targetedDirectory = "override";

    function showToast(message) {
        const toast = document.createElement("div");
        toast.style.cssText = `
            position:fixed; top:24px; left: 50%; transform: translateX(-50%);
            background:#1f2937; color:whitesmoke; padding:8px 16px; border-radius:20px;
            font-size:12px; font-weight:500; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.3);
            transition:opacity 0.25s ease; white-space:nowrap;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 250);
        }, 2000);
    }

    // Retrieve clean domain hostname
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
            try {
                const url = new URL(tabs[0].url);
                if (url.protocol.startsWith("http")) {
                    currentHostname = url.hostname.replace(/^www\./, '');
                }
            } catch (e) {
                console.error("Pro DoubleClick URL Exception:", e);
            }
        }
        syncStorageAndUI();
    });

    function syncStorageAndUI() {
        chrome.storage.sync.get(["defaultSetting", "sitePreferences", "excludedSites"], (data) => {
            const defaultSetting = data.defaultSetting || "background";
            const sitePreferences = data.sitePreferences || {
                "google.com": "background",
                "duckduckgo.com": "background",
            };
            const excludedSites = data.excludedSites || {};

            if (!data.defaultSetting) {
                chrome.storage.sync.set({ defaultSetting, sitePreferences, excludedSites });
            }

            updateButtonVisualStates(defaultSetting, sitePreferences, excludedSites);
            renderStatusDisplay(defaultSetting, sitePreferences, excludedSites);
        });
    }

    function updateButtonVisualStates(defaultSetting, sitePreferences, excludedSites) {
        Object.values(overrideButtons).forEach((b) => b?.classList.remove("selected"));
        Object.values(defaultButtons).forEach((b) => b?.classList.remove("selected"));

        if (defaultSetting === "foreground") {
            defaultButtons.front?.classList.add("selected");
        } else {
            defaultButtons.back?.classList.add("selected");
        }

        const isBlocked = currentHostname && Boolean(excludedSites[currentHostname]);

        if (currentHostname && !isBlocked) {
            const pref = sitePreferences[currentHostname];
            if (pref === "foreground") {
                overrideButtons.front?.classList.add("selected");
            } else if (pref === "background") {
                overrideButtons.back?.classList.add("selected");
            }
        }

        if (flagBtn) {
            flagBtn.classList.toggle("is-blocked", isBlocked);
        }
        if (flagLabel) {
            flagLabel.textContent = isBlocked ? "unblock" : "block";
        }
    }

    function updateStatusIcon(state) {
        if (!statusIconElement) return;

        let iconPath = "../asset/icon-svg/icon-default.svg";
        switch (state) {
            case "exclude":
                iconPath = "../asset/icon-svg/icon-exclude.svg";
                break;
            case "override":
                iconPath = "../asset/icon-svg/icon-override.svg";
                break;
            case "default":
            default:
                iconPath = "../asset/icon-svg/icon-default.svg";
                break;
        }
        statusIconElement.src = iconPath;
    }

    function renderStatusDisplay(defaultSetting, sitePreferences, excludedSites) {
        if (!siteStatusTextOutput) return;

        let iconState = "default";

        if (!currentHostname) {
            siteStatusTextOutput.textContent = "Inactive on system pages.";
            iconState = "exclude";
        } else if (excludedSites[currentHostname]) {
            siteStatusTextOutput.textContent = "Extension is disabled on this site.";
            iconState = "exclude";
        } else {
            const pref = sitePreferences[currentHostname];

            if (pref) {
                siteStatusTextOutput.textContent = `Override: links open in ${pref}.`;
                iconState = "override";
            } else {
                siteStatusTextOutput.textContent = `Default: links open in ${defaultSetting}.`;
                iconState = "default";
            }
        }

        updateStatusIcon(iconState);
    }

    // Toggle logic for "this site" overrides
    function handleOverrideClick(value) {
        if (!currentHostname) {
            showToast("Cannot set override");
            return;
        }

        chrome.storage.sync.get(["sitePreferences", "excludedSites"], (data) => {
            let sitePreferences = data.sitePreferences || {};
            let excludedSites = data.excludedSites || {};

            // Unblock site if setting override
            delete excludedSites[currentHostname];

            if (sitePreferences[currentHostname] === value) {
                // If tapped while already selected, remove override rule
                delete sitePreferences[currentHostname];
                showToast("Custom rule removed");
            } else {
                // Set or update override
                sitePreferences[currentHostname] = value;
                showToast("Rule saved");
            }

            chrome.storage.sync.set({ sitePreferences, excludedSites }, () => {
                syncStorageAndUI();
            });
        });
    }

    // Global default handler
    function handleDefaultClick(value) {
        chrome.storage.sync.set({ defaultSetting: value }, () => {
            syncStorageAndUI();
            showToast("Default updated");
        });
    }

    // Attach click listeners
    overrideButtons.front?.addEventListener("click", () => handleOverrideClick("foreground"));
    overrideButtons.back?.addEventListener("click", () => handleOverrideClick("background"));
    defaultButtons.front?.addEventListener("click", () => handleDefaultClick("foreground"));
    defaultButtons.back?.addEventListener("click", () => handleDefaultClick("background"));

    // Reset Extension Configuration
    resetBtn?.addEventListener("click", () => {
        const defaultSetting = "background";
        const sitePreferences = {
            "google.com": "background",
            "duckduckgo.com": "background",
        };
        chrome.storage.sync.set({ defaultSetting, sitePreferences, excludedSites: {} }, () => {
            syncStorageAndUI();
            showToast("Reset to default");
        });
    });

    // Block / Unblock Toggle Button
    flagBtn?.addEventListener("click", () => {
        if (!currentHostname) return showToast("Cannot block system page");

        chrome.storage.sync.get(["sitePreferences", "excludedSites"], (data) => {
            let sitePreferences = data.sitePreferences || {};
            let excludedSites = data.excludedSites || {};

            if (excludedSites[currentHostname]) {
                delete excludedSites[currentHostname];
                showToast(`Enabled on ${currentHostname}`);
            } else {
                excludedSites[currentHostname] = true;
                delete sitePreferences[currentHostname];
                showToast(`Disabled on ${currentHostname}`);
            }

            chrome.storage.sync.set({ sitePreferences, excludedSites }, () => {
                syncStorageAndUI();
            });
        });
    });

    function buildDirectoryUi() {
        panelList.innerHTML = "";

        chrome.storage.sync.get(["sitePreferences", "excludedSites"], (data) => {
            const sitePreferences = data.sitePreferences || {};
            const excludedSites = data.excludedSites || {};

            const isOverride = targetedDirectory === "override";

            tabOverride.classList.toggle("active", isOverride);
            tabExcluded.classList.toggle("active", !isOverride);

            const storageKey = isOverride ? "sitePreferences" : "excludedSites";
            const storageObject = isOverride ? sitePreferences : excludedSites;

            const items = Object.keys(storageObject);

            if (!items.length) {
                panelList.innerHTML = `<p style="color: whitesmoke;">No Custom Site</p>`;
                return;
            }

            items.forEach((domain) => {
                const card = document.createElement("div");
                card.className = "list-item";

                const displayText = isOverride
                    ? `${domain} (${storageObject[domain] === "foreground" ? "Front" : "Back"})`
                    : domain;

                card.innerHTML = `
                    <span class="list-item-text">${displayText}</span>
                    <button class="list-item-btn">
                        <img src="../asset/icon-svg/icon-delete.svg" alt="delete" width="20px" height="20px" />
                    </button>
                `;

                card.querySelector("button").onclick = () => {
                    delete storageObject[domain];

                    chrome.storage.sync.set({ [storageKey]: storageObject }, () => {
                        buildDirectoryUi();
                        syncStorageAndUI();
                    });
                };

                panelList.appendChild(card);
            });
        });
    }

    optionBtn?.addEventListener("click", () => {
        slidingPanel.classList.add("open");
        buildDirectoryUi();
    });

    closePanelBtn?.addEventListener("click", () => slidingPanel.classList.remove("open"));
    tabOverride?.addEventListener("click", () => {
        targetedDirectory = "override";
        buildDirectoryUi();
    });
    tabExcluded?.addEventListener("click", () => {
        targetedDirectory = "excluded";
        buildDirectoryUi();
    });
});