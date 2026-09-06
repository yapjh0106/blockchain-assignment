// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    
    const removeToast = () => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    };

    closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 4000);
}

// ==================== GLOBAL VARIABLES ====================
let web3 = null;
let ethUsdPrice = 0;

async function fetchEthPrice() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        if (data && data.ethereum && data.ethereum.usd) {
            ethUsdPrice = parseFloat(data.ethereum.usd);
            if (typeof updateDistributionPreview === 'function') {
                updateDistributionPreview();
            }
        }
    } catch (e) {
        console.error('Failed to fetch ETH price', e);
    }
}
let deploymentBlock = 0;
let currentAccount = null;
let currentRole = 0;

let userRegistry = null;
let logisticsEscrow = null;
let reputationToken = null;

let selectedAgreementId = null;
let selectedMilestoneType = null;

let currentRoleAgreements = [];
let adminAllUsers = [];
let currentRoleHistory = [];
let historyCurrentPage = 1;
const HISTORY_ITEMS_PER_PAGE = 10;

// ==================== HELPERS ====================
function shortAddress(address) {
    if (!address) return "-";
    return address.substring(0, 6) + "..." + address.substring(address.length - 4);
}

function formatTimestamp(timestamp) {
    if (!timestamp) return "-";
    return new Date(Number(timestamp) * 1000).toLocaleString("en-MY");
}

function getAgreementStatusName(agreement) {
    const status = Number(agreement.status);
    const now = Math.floor(Date.now() / 1000);
    if (status !== 3 &&
                status !== 4 &&
                status !== 5 && status !== 5 && Number(agreement.deadline) < now) {
        return "Expired";
    }

    const statuses = {
        0: "Created",
        1: "Funded",
        2: "In Progress",
        3: "Completed",
        4: "Refunded",
        5: "Cancelled"
    };

    return statuses[status] || "Unknown";
}

function getAgreementStatusClass(agreement) {
    const status = Number(agreement.status);
    const now = Math.floor(Date.now() / 1000);
    if (status !== 3 &&
                status !== 4 &&
                status !== 5 && status !== 5 && Number(agreement.deadline) < now) {
        return "status-expired";
    }

    const classes = {
        0: "status-created",
        1: "status-funded",
        2: "status-progress",
        3: "status-completed",
        4: "status-refunded",
        5: "status-rejected"
    };

    return classes[status] || "status-created";
}

function createDashboardStatus(agreement) {
    return `
        <span class="status-badge ${getAgreementStatusClass(agreement)}">
            ${getAgreementStatusName(agreement)}
        </span>
    `;
}

function getMilestoneStatusName(status) {
    const statuses = {
        0: "Pending",
        1: "Submitted",
        2: "Verified"
    };

    return statuses[Number(status)] || "Unknown";
}

function getMilestoneTypeName(type) {
    return Number(type) === 0 ? "Pickup" : "Delivery";
}

function showGlobalStatus(message) {
    const box = document.getElementById("globalStatus");
    if (!box) return;

    box.textContent = message;
    box.style.display = "block";
}

function hideGlobalStatus() {
    const box = document.getElementById("globalStatus");
    if (box) box.style.display = "none";
}

// ==================== READABLE ERRORS ====================
function getReadableError(error) {
    if (!error) return "Transaction failed.";

    const message = error.message || String(error);

    if (
        message.includes("User denied") ||
        message.includes("User rejected") ||
        message.includes("rejected the request")
    ) {
        return "Transaction was cancelled in MetaMask.";
    }

    if (message.includes("User already registered")) {
        return "This wallet is already registered.";
    }

    if (message.includes("Invalid role")) {
        return "Invalid user role.";
    }

    if (message.includes("Shipper is not registered")) {
        return "The Shipper wallet is not registered.";
    }

    if (message.includes("Only Shipper can create agreement")) {
        return "Only a registered Shipper can create an agreement.";
    }

    if (message.includes("Carrier is not registered")) {
        return "The selected Carrier wallet is not registered.";
    }

    if (message.includes("Selected address is not a Carrier")) {
        return "The selected wallet is not registered as a Carrier.";
    }

    if (message.includes("Shipper cannot be Carrier")) {
        return "The Shipper and Carrier cannot use the same wallet.";
    }

    if (message.includes("Total amount must be greater than zero")) {
        return "Total amount must be greater than zero.";
    }

    if (message.includes("Milestone amounts must equal total amount")) {
        return "Pickup + Delivery must equal the Total amount.";
    }

    if (message.includes("Deadline must be in the future")) {
        return "The deadline must be in the future.";
    }

    if (message.includes("Agreement does not exist")) {
        return "The Agreement ID does not exist.";
    }

    if (message.includes("Only Shipper can fund agreement")) {
        return "Only this agreement's Shipper can fund the escrow.";
    }

    if (message.includes("Agreement cannot be funded")) {
        return "This agreement cannot be funded in its current state.";
    }

    if (message.includes("Incorrect funding amount")) {
        return "Incorrect escrow funding amount.";
    }

    if (message.includes("Only Carrier can submit milestone")) {
        return "Only the assigned Carrier can submit this milestone.";
    }

    if (message.includes("Agreement is not active")) {
        return "This agreement is not active.";
    }

    if (message.includes("Pickup milestone cannot be submitted")) {
        return "Pickup cannot be submitted in its current state.";
    }

    if (message.includes("Pickup must be verified first")) {
        return "Pickup must be verified before Delivery.";
    }

    if (message.includes("Delivery milestone cannot be submitted")) {
        return "Delivery cannot be submitted in its current state.";
    }

    if (message.includes("Only Shipper can verify milestone")) {
        return "Only this agreement's Shipper can verify milestones.";
    }

    if (message.includes("Agreement is not in progress")) {
        return "This agreement is not currently in progress.";
    }

    if (message.includes("Pickup has not been submitted")) {
        return "Pickup must be submitted before verification.";
    }

    if (message.includes("Delivery has not been submitted")) {
        return "Delivery must be submitted before verification.";
    }

    if (message.includes("Agreement deadline has passed")) {
        return "The agreement deadline has already passed.";
    }

    if (message.includes("Not authorized to mint")) {
        return "LogisticsEscrow is not authorized to mint CRP.";
    }

    if (message.includes("Only Shipper can claim refund")) {
        return "Only this agreement's Shipper can claim the refund.";
    }

    if (message.includes("Deadline has not passed")) {
        return "The agreement deadline has not passed yet.";
    }

    if (message.includes("Agreement already completed")) {
        return "Completed agreements cannot be refunded.";
    }

    if (message.includes("Agreement already refunded")) {
        return "This agreement has already been refunded.";
    }

    if (message.includes("No escrow balance available")) {
        return "There is no remaining escrow balance.";
    }

    if (message.includes("Contract is not deployed on network")) {
        return "Contracts are not deployed on this MetaMask network.";
    }
    return message;
}

// ==================== CONTRACT LOADING ====================
async function loadContract(path) {
    const response = await fetch(`${path}?t=${new Date().getTime()}`);

    if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
    }

    const artifact = await response.json();
    const networkId = await web3.eth.net.getId();
    const deployment = artifact.networks[String(networkId)];
    if (deploymentBlock === 0 && deployment && deployment.transactionHash) {
        try {
            const receipt = await web3.eth.getTransactionReceipt(deployment.transactionHash);
            if (receipt && receipt.blockNumber) deploymentBlock = receipt.blockNumber;
        } catch(e) {}
    }

    if (!deployment) {
        throw new Error(`Contract is not deployed on network ${networkId}`);
    }

    return new web3.eth.Contract(artifact.abi, deployment.address);
}

async function loadContracts() {
    userRegistry = await loadContract("/contracts/UserRegistry.json");
    logisticsEscrow = await loadContract("/contracts/LogisticsEscrow.json");
    reputationToken = await loadContract("/contracts/CarrierReputationToken.json");

    console.log("UserRegistry:", userRegistry.options.address);
    console.log("LogisticsEscrow:", logisticsEscrow.options.address);
    console.log("ReputationToken:", reputationToken.options.address);
}

// ==================== LANDING / HOME / APPLICATION ====================
function showLandingPage() {
    document.getElementById("landingPage").style.display = "flex";
    document.getElementById("homePage").style.display = "none";
    document.getElementById("mainApplication").style.display = "none";
}

function showHome() {
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("homePage").style.display = "block";
    document.getElementById("mainApplication").style.display = "none";
}

function showApplication(role) {
    currentRole = Number(role);

    document.getElementById("landingPage").style.display = "none";
    document.getElementById("homePage").style.display = "none";
    document.getElementById("mainApplication").style.display = "block";

    updateRoleUI();
    showPage("dashboard");
}

// ==================== PAGE NAVIGATION ====================
function getNavigationGroup(pageName) {
    if (
        pageName === "create-agreement" ||
        pageName === "agreement-detail" ||
        pageName === "verify-milestone" ||
        pageName === "submit-milestone"
    ) {
        return "agreements";
    }
    return pageName;
}

function showPage(pageName) {
    document.querySelectorAll(".app-page").forEach(page => {
        page.classList.remove("active-page");
    });

    const page = document.getElementById(`page-${pageName}`);
    if (page) page.classList.add("active-page");

    const navigationGroup = getNavigationGroup(pageName);

    document.querySelectorAll(".main-nav-button").forEach(button => {
        button.classList.remove("active");

        if (button.dataset.page === navigationGroup) {
            button.classList.add("active");
        }
    });
    hideGlobalStatus();

    if (pageName === "dashboard" || pageName === "agreements") loadAgreementList();
    if (pageName === "history") loadRoleHistory();
    if (pageName === "reputation") loadReputationPage();

    window.scrollTo(0, 0);
}

window.showPage = showPage;

// ==================== ROLE UI ====================
function updateRoleUI() {
    const shipperDashboard = document.getElementById("shipperDashboardView");
    const carrierDashboard = document.getElementById("carrierDashboardView");
    const adminDashboard = document.getElementById("adminDashboardView");
    const shipperOnly = document.querySelectorAll(".shipper-only");

    if (shipperDashboard) {
        shipperDashboard.style.display = currentRole === 1 ? "block" : "none";
    }

    if (carrierDashboard) {
        carrierDashboard.style.display = currentRole === 2 ? "block" : "none";
    }
    
    if (adminDashboard) {
        adminDashboard.style.display = currentRole === 3 ? "block" : "none";
    }

    shipperOnly.forEach(element => {
        element.style.display = currentRole === 1 ? "" : "none";
    });

    const roleStr = currentRole === 1 ? "Shipper" : (currentRole === 2 ? "Carrier" : "Admin");
    if (userRegistry && currentAccount) {
        userRegistry.methods.userNames(currentAccount).call()
            .then(name => {
                document.getElementById("currentRole").textContent = name ? `${name} (${roleStr})` : roleStr;
            })
            .catch(() => {
                document.getElementById("currentRole").textContent = roleStr;
            });
    } else {
        document.getElementById("currentRole").textContent = roleStr;
    }

    document.getElementById("walletAddress").textContent =
        shortAddress(currentAccount);
}

// ==================== CONNECT WALLET ====================
async function connectWallet() {
    if (typeof window.ethereum === "undefined") {
        alert("MetaMask is not installed.");
        return;
    }

    try {
        web3 = new Web3(window.ethereum);

        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        if (accounts.length === 0) return;

        currentAccount = accounts[0];

        const networkId = await web3.eth.net.getId();

        document.getElementById("connectedWalletBox").style.display = "block";
        document.getElementById("homeWalletAddress").textContent = currentAccount;
        document.getElementById("registrationWalletAddress").textContent = currentAccount;
        document.getElementById("homeNetworkId").textContent = networkId;
        document.getElementById("homeRegistrationCard").style.display = "none";

        await loadContracts();
        await checkRegistrationAfterConnect();

    } catch (error) {
        console.error(error);
        alert(getReadableError(error));
    }
}

// ==================== CHECK REGISTRATION ====================
async function checkRegistrationAfterConnect() {
    try {
        const registered = await userRegistry.methods
            .isRegistered(currentAccount)
            .call();

        console.log("Registered:", registered);

        if (registered) {
            const role = Number(
                await userRegistry.methods
                    .getUserRole(currentAccount)
                    .call()
            );

            if (role === 1 || role === 2 || role === 3) {
                showApplication(role);
                await refreshApplication();
                return;
            }
        }
        currentRole = 0;

        document.getElementById("homeRegistrationCard").style.display = "block";
        document.getElementById("homeRegistrationStatus").textContent =
            "Wallet connected. Please select your role.";

    } catch (error) {
        console.error(error);
        alert("Unable to read UserRegistry.");
    }
}

// ==================== REGISTER ====================
async function registerFromHome() {
    if (!currentAccount) {
        showToast("Please connect MetaMask first.", "info");
        return;
    }

    try {
        const selected = document.querySelector(
            'input[name="homeRole"]:checked'
        );
        const nameInput = document.getElementById("homeUsernameInput").value.trim();

        if (!selected || !nameInput) {
            showToast("Please select a role and enter a username.", "info");
            return;
        }

        const role = Number(selected.value);

        showToast("Waiting for MetaMask confirmation...", "info");

        await userRegistry.methods
            .registerUser(role, nameInput)
            .send({
                from: currentAccount
            });

        const registered = await userRegistry.methods
            .isRegistered(currentAccount)
            .call();

        if (!registered) {
            showToast("Unable to verify registration.", "info");
            return;
        }

        const blockchainRole = Number(
            await userRegistry.methods
                .getUserRole(currentAccount)
                .call()
        );

        showApplication(blockchainRole);
        await refreshApplication();

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}

// ==================== REFRESH APPLICATION ====================
async function refreshApplication() {
    await loadAgreementList();
    await refreshDashboardStats();

    if (selectedAgreementId) {
        try {
            await loadAgreementDetail(selectedAgreementId, false);
        } catch (error) {
            console.error(error);
        }
    }
}

// ==================== LOAD AGREEMENTS ====================
async function loadAgreementList() {
    if (!logisticsEscrow || !currentAccount || currentRole === 0) return;

    const count = Number(
        await logisticsEscrow.methods
            .agreementCount()
            .call()
    );

    const current = currentAccount.toLowerCase();

    const fetchedAgreements = [];

    for (let id = 1; id <= count; id++) {
        const agreement = await logisticsEscrow.methods
            .getAgreement(id)
            .call();

        let belongs = false;

        if (currentRole === 1) {
            belongs = agreement.shipper.toLowerCase() === current;
        }

        if (currentRole === 2) {
            belongs = agreement.carrier.toLowerCase() === current;
        }
        
        if (currentRole === 3) {
            belongs = true; // Admin sees all
        }

        if (belongs) {
            fetchedAgreements.push(agreement);
        }
    }

    currentRoleAgreements = fetchedAgreements;
    currentRoleAgreements.sort(
        (a, b) => Number(b.id) - Number(a.id)
    );
    renderAgreementList();
    refreshDashboardStats();
}

// ==================== AGREEMENT LIST ====================
function renderAgreementList() {
    const body = document.getElementById("agreementListBody");
    if (!body) return;

    document.getElementById("agreementCounterpartyHeader").textContent =
        currentRole === 1 ? "Carrier" : "Shipper";

    let title = "Agreements";
    if (currentRole === 1) title = "My Logistics Agreements";
    if (currentRole === 2) title = "Assigned Agreements";
    if (currentRole === 3) title = "System Agreements";

    document.getElementById("agreementListTitle").textContent = title;

    if (currentRoleAgreements.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    No agreements available.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = currentRoleAgreements.map(agreement => {
        const counterparty =
            currentRole === 1 ? agreement.carrier : agreement.shipper;

        const total = web3.utils.fromWei(
            agreement.totalAmount.toString(),
            "ether"
        );

        const escrow = web3.utils.fromWei(
            agreement.escrowBalance.toString(),
            "ether"
        );

        return `
            <tr>
                <td>#${agreement.id}</td>
                <td>${shortAddress(counterparty)}</td>
                <td>${total} ETH</td>
                <td>${escrow} ETH</td>
                <td>${formatTimestamp(agreement.deadline)}</td>
                <td>${createDashboardStatus(agreement)}</td>
                <td>
                    <button
                        class="table-open-button"
                        onclick="openAgreementDetail(${agreement.id})">
                        Open
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// ==================== DASHBOARD ====================
async function refreshDashboardStats() {
    if (currentRole === 1) {
        await renderShipperDashboard();
    } else if (currentRole === 2) {
        await renderCarrierDashboard();
    } else if (currentRole === 3) {
        await renderAdminDashboard();
    }
}

// ==================== SHIPPER DASHBOARD ====================
async function renderShipperDashboard() {
    let active = 0;
    let completed = 0;
    let escrowTotal = web3.utils.toBN(0);
    let needsAttentionHTML = "";
    
    const now = Math.floor(Date.now() / 1000);

    currentRoleAgreements.forEach(agreement => {
        const bal = web3.utils.toBN(agreement.escrowBalance.toString());
        const status = Number(agreement.status);
        const deadline = Number(agreement.deadline);

        if (status === 3) {
            completed++;
        } else if (status === 4) {
            // Refunded
        } else if (status === 5) {
            // Cancelled
        } else if (deadline < now) {
            if (!bal.isZero()) {
                needsAttentionHTML += `
                    <tr>
                        <td>#${agreement.id}</td>
                        <td>${shortAddress(agreement.shipper)}</td>
                        <td>${shortAddress(agreement.carrier)}</td>
                        <td style="color: #e11d48; font-weight: 600;">${web3.utils.fromWei(bal.toString(), "ether")} ETH</td>
                        <td><span class="status-badge" style="background: #fee2e2; color: #b91c1c;">Expired</span></td>
                    </tr>
                `;
            }
        } else {
            active++;
        }

        escrowTotal = escrowTotal.add(bal);
    });

    document.getElementById("shipperActiveCount").textContent = active;
    document.getElementById("shipperCompletedCount").textContent = completed;

    document.getElementById("shipperEscrowValue").textContent =
        `${web3.utils.fromWei(escrowTotal.toString(), "ether")} ETH`;
        
    const needsAttentionBody = document.getElementById("shipperNeedsAttention");
    if (needsAttentionBody) {
        if (!needsAttentionHTML) {
            needsAttentionBody.innerHTML = '<tr><td colspan="5" class="empty-table">No items need attention.</td></tr>';
        } else {
            needsAttentionBody.innerHTML = needsAttentionHTML;
        }
    }

    renderShipperRecentAgreements();
    renderShipperDeadlines();
    await renderShipperRecentActivity();
}

function renderShipperRecentAgreements() {
    const body = document.getElementById("shipperRecentAgreements");
    const recent = currentRoleAgreements.slice(0, 5);

    if (recent.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    No agreements available.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = recent.map(agreement => `
        <tr>
            <td>#${agreement.id}</td>
            <td>${shortAddress(agreement.carrier)}</td>

            <td>
                ${web3.utils.fromWei(
                    agreement.totalAmount.toString(),
                    "ether"
                )} ETH
            </td>

            <td>
                ${web3.utils.fromWei(
                    agreement.escrowBalance.toString(),
                    "ether"
                )} ETH
            </td>

            <td>${formatTimestamp(agreement.deadline)}</td>
            <td>${createDashboardStatus(agreement)}</td>
        </tr>
    `).join("");
}

function renderShipperDeadlines() {
    const container = document.getElementById("shipperDeadlineList");
    const now = Math.floor(Date.now() / 1000);

    const agreements = currentRoleAgreements
        .filter(agreement => {
            const status = Number(agreement.status);

            return (
                Number(agreement.deadline) > now &&
                status !== 3 &&
                status !== 4 &&
                status !== 5
            );
        })
        .sort((a, b) => Number(a.deadline) - Number(b.deadline))
        .slice(0, 3);

    if (agreements.length === 0) {
        container.innerHTML = `
            <div class="empty-box">
                No upcoming deadlines.
            </div>
        `;
        return;
    }

    container.innerHTML = agreements.map(agreement => {
        const seconds = Number(agreement.deadline) - now;
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        let timeParts = [];
        if (d > 0) timeParts.push(`${d}d`);
        if (h > 0) timeParts.push(`${h}h`);
        if (m > 0) timeParts.push(`${m}m`);
        timeParts.push(`${s}s`);
        const timeString = timeParts.join(" ");

        const date = new Date(
            Number(agreement.deadline) * 1000
        ).toLocaleDateString("en-MY");

        return `
            <div class="list-item">
                <div class="list-item-main">
                    <strong>Agreement #${agreement.id}</strong>
                    <span>
                        Carrier:
                        ${shortAddress(agreement.carrier)}
                    </span>
                </div>

                <div class="list-item-side">
                    <strong>${date}</strong>
                    <span>${timeString}</span>
                </div>
            </div>
        `;
    }).join("");
}

async function renderShipperRecentActivity() {
    const container = document.getElementById("shipperRecentActivity");

    if (currentRoleAgreements.length === 0) {
        container.innerHTML = `
            <div class="empty-box">
                No recent activity.
            </div>
        `;
        return;
    }

    const ids = new Set(
        currentRoleAgreements.map(
            agreement => String(agreement.id)
        )
    );

    const events = await logisticsEscrow.getPastEvents(
        "allEvents",
        {
            fromBlock: deploymentBlock,
            toBlock: "latest"
        }
    );

    const relevant = events
        .filter(event =>
            event.returnValues.id !== undefined &&
            ids.has(String(event.returnValues.id))
        )
        .sort(sortEventsNewestFirst)
        .slice(0, 5);

    if (relevant.length === 0) {
        container.innerHTML = `
            <div class="empty-box">
                No recent activity.
            </div>
        `;
        return;
    }

    container.innerHTML = relevant.map(event => `
        <div class="activity-item">
            <div class="activity-icon">↻</div>

            <div class="activity-text">
                <strong>
                    ${getEventDisplayName(event)}
                    · Agreement #${event.returnValues.id}
                </strong>

                <span>
                    ${
                        event.returnValues.timestamp
                            ? formatTimestamp(event.returnValues.timestamp)
                            : "-"
                    }
                </span>
            </div>
        </div>
    `).join("");
}

// ==================== CARRIER DASHBOARD ====================

async function renderCarrierDashboard() {
    let active = 0;
    let completed = 0;
    let verified = 0;

    const now = Math.floor(Date.now() / 1000);

    currentRoleAgreements.forEach(agreement => {
        const status = Number(agreement.status);
        const deadline = Number(agreement.deadline);

        if (status === 3) {
            completed++;
        } else if (status === 4 || status === 5) {
            // Refunded or Cancelled
        } else if (deadline < now) {
            // Expired
        } else {
            active++;
        }

        if (Number(agreement.pickupStatus) === 2) verified++;
        if (Number(agreement.deliveryStatus) === 2) verified++;
    });

    const reputation = await reputationToken.methods
        .balanceOf(currentAccount)
        .call();

    document.getElementById("carrierAssignedCount").textContent = active;
    document.getElementById("carrierCompletedCount").textContent = completed;
    document.getElementById("carrierDashboardCRP").textContent = reputation;
    document.getElementById("carrierReputationCircle").textContent = reputation;
    document.getElementById("carrierVerifiedMilestones").textContent = verified;
    document.getElementById("carrierActiveDeliveries").textContent = active;

    renderCarrierAssignedAgreements();
    renderCarrierPendingVerifications();
}

function renderCarrierAssignedAgreements() {
    const body = document.getElementById("carrierAssignedAgreements");
    const recent = currentRoleAgreements.slice(0, 5);

    if (recent.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    No assigned agreements.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = recent.map(agreement => {
        let milestone =
            `Pickup: ${getMilestoneStatusName(agreement.pickupStatus)}`;

        if (Number(agreement.pickupStatus) === 2) {
            milestone =
                `Delivery: ${getMilestoneStatusName(
                    agreement.deliveryStatus
                )}`;
        }

        return `
            <tr>
                <td>#${agreement.id}</td>
                <td>${shortAddress(agreement.shipper)}</td>

                <td>
                    ${web3.utils.fromWei(
                        agreement.totalAmount.toString(),
                        "ether"
                    )} ETH
                </td>

                <td>${formatTimestamp(agreement.deadline)}</td>
                <td>${milestone}</td>
                <td>${createDashboardStatus(agreement)}</td>
            </tr>
        `;
    }).join("");
}

function renderCarrierPendingVerifications() {
    const container = document.getElementById(
        "carrierPendingVerificationList"
    );

    const pending = [];

    const now = Math.floor(Date.now() / 1000);
    
    currentRoleAgreements.forEach(agreement => {
        const deadline = Number(agreement.deadline);
        if (deadline < now) return; // Hide if expired

        if (Number(agreement.pickupStatus) === 1) {
            pending.push({
                id: agreement.id,
                milestone: "Pickup",
                shipper: agreement.shipper
            });
        }

        if (Number(agreement.deliveryStatus) === 1) {
            pending.push({
                id: agreement.id,
                milestone: "Delivery",
                shipper: agreement.shipper
            });
        }
    });

    if (pending.length === 0) {
        container.innerHTML = `
            <div class="empty-box">
                No pending verifications.
            </div>
        `;
        return;
    }

    container.innerHTML = pending.slice(0, 4).map(item => `
        <div class="list-item">
            <div class="list-item-main">
                <strong>${item.milestone} Verification</strong>
                <span>
                    Agreement #${item.id}
                    · Shipper ${shortAddress(item.shipper)}
                </span>
            </div>

            <div class="list-item-side">
                <span>Awaiting Shipper</span>
            </div>
        </div>
    `).join("");
}

// ==================== CREATE AGREEMENT PREVIEW ====================
function updateDistributionPreview() {
    const total = Number(document.getElementById("totalAmount").value) || 0;
    const pickup = Number(document.getElementById("pickupAmount").value) || 0;
    const delivery = Number(document.getElementById("deliveryAmount").value) || 0;

    if (ethUsdPrice > 0) {
        const tUsd = document.getElementById('totalAmountUsd');
        const pUsd = document.getElementById('pickupAmountUsd');
        const dUsd = document.getElementById('deliveryAmountUsd');
        
        if (total > 0) { tUsd.textContent = '~' + (total * ethUsdPrice).toFixed(2) + ' USD'; tUsd.style.display = 'block'; } else { tUsd.style.display = 'none'; }
        if (pickup > 0) { pUsd.textContent = '~' + (pickup * ethUsdPrice).toFixed(2) + ' USD'; pUsd.style.display = 'block'; } else { pUsd.style.display = 'none'; }
        if (delivery > 0) { dUsd.textContent = '~' + (delivery * ethUsdPrice).toFixed(2) + ' USD'; dUsd.style.display = 'block'; } else { dUsd.style.display = 'none'; }
    }

    let pickupPercent = 0;
    let deliveryPercent = 0;

    if (total > 0) {
        pickupPercent = pickup / total * 100;
        deliveryPercent = delivery / total * 100;
    }

    pickupPercent = Math.max(0, Math.min(100, pickupPercent));
    deliveryPercent = Math.max(0, Math.min(100, deliveryPercent));

    document.getElementById("pickupPercentage").textContent =
        `${pickupPercent.toFixed(0)}%`;

    document.getElementById("deliveryPercentage").textContent =
        `${deliveryPercent.toFixed(0)}%`;

    document.getElementById("pickupPreview").textContent =
        `${pickup} ETH`;

    document.getElementById("deliveryPreview").textContent =
        `${delivery} ETH`;

    document.getElementById("createSummaryTotal").textContent =
        `${total} ETH`;

    const valid =
        total > 0 &&
        Math.abs(pickup + delivery - total) < 0.0000001;

    document.getElementById("distributionValidation").style.display =
        total > 0 && !valid ? "block" : "none";

    const circle = document.getElementById("distributionCircle");
    const pickupDegrees = pickupPercent * 3.6;

    circle.style.background = `
        conic-gradient(
            #1675ea 0deg ${pickupDegrees}deg,
            #099a98 ${pickupDegrees}deg 360deg
        )
    `;
}

// ==================== CREATE AGREEMENT ====================
async function createAgreement() {
    try {
        const carrier =
            document.getElementById("carrierAddress").value.trim();

        const total =
            document.getElementById("totalAmount").value;

        const pickup =
            document.getElementById("pickupAmount").value;

        const delivery =
            document.getElementById("deliveryAmount").value;

        const deadlineValue =
            document.getElementById("deadline").value;

        if (!web3.utils.isAddress(carrier)) {
            showToast("Enter a valid Carrier wallet address.", "info");
            return;
        }

        if (
            Number(total) <= 0 ||
            Number(pickup) <= 0 ||
            Number(delivery) <= 0
        ) {
            showToast("Payment amounts must be greater than zero.", "info");
            return;
        }

        const totalWei =
            web3.utils.toWei(total.toString(), "ether");

        const pickupWei =
            web3.utils.toWei(pickup.toString(), "ether");

        const deliveryWei =
            web3.utils.toWei(delivery.toString(), "ether");

        const combined =
            web3.utils
                .toBN(pickupWei)
                .add(web3.utils.toBN(deliveryWei));

        if (!combined.eq(web3.utils.toBN(totalWei))) {
            showToast("Pickup + Delivery must equal Total Amount.", "info");
            return;
        }

        if (!deadlineValue) {
            showToast("Select a deadline.", "info");
            return;
        }

        const deadline =
            Math.floor(
                new Date(deadlineValue).getTime() / 1000
            );

        if (deadline <= Math.floor(Date.now() / 1000)) {
            showToast("Deadline must be in the future.", "info");
            return;
        }

        showToast("Waiting for MetaMask confirmation...", "info");

        await logisticsEscrow.methods
            .createAgreement(
                carrier,
                totalWei,
                pickupWei,
                deliveryWei,
                deadline
            )
            .send({
                from: currentAccount
            });

        const newId = Number(
            await logisticsEscrow.methods
                .agreementCount()
                .call()
        );

        showToast(`Agreement #${newId} created successfully.`, "success");

        // Upload any pending documents to the server under the new agreement id
        if (fileManagers.createAgreement?.getPendingCount() > 0) {
            showToast(`Uploading documents for Agreement #${newId}…`, "info");
            try {
                await fileManagers.createAgreement.uploadPending(newId);
            } catch (uploadErr) {
                console.warn("Document upload failed:", uploadErr);
            }
        }

        resetAgreementForm();
        await refreshApplication();
        await openAgreementDetail(newId);

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}

function resetAgreementForm() {
    document.getElementById("carrierAddress").value = "";
    document.getElementById("totalAmount").value = "";
    document.getElementById("pickupAmount").value = "";
    document.getElementById("deliveryAmount").value = "";
    document.getElementById("deadline").value = "";

    if (fileManagers.createAgreement) {
        fileManagers.createAgreement.clear();
    }

    updateDistributionPreview();
}

// ==================== FILE ATTACHMENT MANAGER ====================

// ---- Shared helpers ----

function _fileFormatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function _fileGetIconInfo(mimeType = "", name = "") {
    const ext = name.split(".").pop().toLowerCase();
    if (mimeType === "application/pdf" || ext === "pdf")
        return { icon: "PDF", cls: "icon-pdf" };
    if (mimeType.startsWith("image/") || ["jpg","jpeg","png","gif","webp","bmp","svg"].includes(ext))
        return { icon: "🖼", cls: "icon-image" };
    if (["doc","docx","xls","xlsx","ppt","pptx","txt","csv"].includes(ext))
        return { icon: "DOC", cls: "icon-doc" };
    return { icon: "📄", cls: "icon-generic" };
}

/**
 * Renders a read-only file list (server files) into a container element.
 * Used by the Agreement Detail shared viewer and milestone pages.
 * @param {HTMLElement} container
 * @param {Array}       files   - [{name, size, mimeType, url}]
 * @param {boolean}     canDelete - show delete button
 * @param {Function}    onDelete  - async callback(file)
 */
function renderServerFiles(container, files, canDelete = false, onDelete = null) {
    if (!container) return;

    if (!files || files.length === 0) {
        container.innerHTML = `<div class="file-empty-state">No files attached.</div>`;
        return;
    }

    container.innerHTML = files.map((f, idx) => {
        const info = _fileGetIconInfo(f.mimeType, f.name);
        const deleteBtn = canDelete
            ? `<button class="file-item-remove" type="button" title="Delete file" data-file-idx="${idx}">✕</button>`
            : "";
        return `
            <div class="file-item" data-file-idx="${idx}">
                <div class="file-item-icon ${info.cls}">${info.icon}</div>
                <div class="file-item-info">
                    <a class="file-item-name"
                       href="${f.url}"
                       target="_blank"
                       rel="noopener noreferrer"
                       title="Open ${f.name}">${f.name}</a>
                    <span class="file-item-meta">
                        ${_fileFormatSize(f.size)} &middot; ${f.mimeType || "file"}
                    </span>
                </div>
                ${deleteBtn}
            </div>
        `;
    }).join("");

    if (canDelete && onDelete) {
        container.querySelectorAll("[data-file-idx]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const idx = Number(btn.dataset.fileIdx);
                btn.disabled = true;
                btn.textContent = "…";
                await onDelete(files[idx]);
            });
        });
    }
}

/**
 * FileAttachmentManager
 * - If agreementId is known: files upload immediately on select/drop.
 * - If agreementId not yet known (Create Agreement): files stay pending
 *   and are uploaded via uploadPending() after the agreement is created.
 */
class FileAttachmentManager {
    constructor({ dropZoneId, fileInputId, fileListId, badgeId, context, maxSizeMB = 10 }) {
        this.dropZone  = document.getElementById(dropZoneId);
        this.fileInput = document.getElementById(fileInputId);
        this.fileList  = document.getElementById(fileListId);
        this.badge     = document.getElementById(badgeId);
        this.context   = context;
        this.maxBytes  = maxSizeMB * 1024 * 1024;
        this.pendingFiles  = [];  // queued locally, not yet uploaded
        this.serverFiles   = [];  // confirmed on server
        this.uploadingFiles = []; // currently uploading (show spinner)
        this._nextId = 1;
        this._agreementId = null;
        this._setupEvents();
    }

    // ---- Public API ----

    async loadForAgreement(agreementId) {
        this._agreementId = agreementId;
        this.pendingFiles  = [];
        this.uploadingFiles = [];
        await this._fetchServerFiles();
        this._render();
    }

    clear() {
        this._agreementId  = null;
        this.pendingFiles   = [];
        this.serverFiles    = [];
        this.uploadingFiles = [];
        this._render();
    }

    /** Upload any still-pending files (used by Create Agreement after tx succeeds). */
    async uploadPending(agreementId) {
        if (this.pendingFiles.length === 0) return [];
        this._agreementId = agreementId;
        return await this._uploadBatch(this.pendingFiles.map(e => e.file));
    }

    getPendingCount()  { return this.pendingFiles.length; }
    getServerCount()   { return this.serverFiles.length;  }

    // ---- Private ----

    async _fetchServerFiles() {
        if (!this._agreementId) { this.serverFiles = []; return; }
        try {
            const res  = await fetch(`/api/files/${this._agreementId}/${this.context}`);
            const data = await res.json();
            this.serverFiles = data.files || [];
        } catch (e) {
            console.warn("Could not load server files:", e);
            this.serverFiles = [];
        }
    }

    _setupEvents() {
        if (!this.dropZone || !this.fileInput) return;

        this.dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            this.dropZone.classList.add("drag-over");
        });

        this.dropZone.addEventListener("dragleave", (e) => {
            if (!this.dropZone.contains(e.relatedTarget))
                this.dropZone.classList.remove("drag-over");
        });

        this.dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            this.dropZone.classList.remove("drag-over");
            this._handleNewFiles(Array.from(e.dataTransfer.files));
        });

        this.fileInput.addEventListener("change", (e) => {
            this._handleNewFiles(Array.from(e.target.files));
            e.target.value = "";
        });
    }

    _handleNewFiles(rawFiles) {
        let rejected = 0;
        const accepted = [];

        rawFiles.forEach(file => {
            if (file.size > this.maxBytes) { rejected++; return; }

            // Prevent exact duplicates already on server or pending
            const onServer  = this.serverFiles.some(f => f.name === file.name && f.size === file.size);
            const inPending = this.pendingFiles.some(f => f.name === file.name && f.size === file.size);
            const uploading = this.uploadingFiles.some(f => f.name === file.name && f.size === file.size);

            if (!onServer && !inPending && !uploading) accepted.push(file);
        });

        if (rejected > 0) alert(`${rejected} file(s) exceed the ${this.maxBytes / 1024 / 1024}MB limit.`);
        if (accepted.length === 0) return;

        if (this._agreementId) {
            // Auto-upload immediately
            this._autoUpload(accepted);
        } else {
            // No agreement ID yet — queue as pending
            accepted.forEach(file => {
                this.pendingFiles.push({
                    id: this._nextId++, file,
                    name: file.name, size: file.size, type: file.type
                });
            });
            this._render();
        }
    }

    async _autoUpload(files) {
        // Add to uploading list for spinner display
        const entries = files.map(file => ({
            id: this._nextId++, file,
            name: file.name, size: file.size, type: file.type
        }));
        this.uploadingFiles.push(...entries);
        this._render();

        try {
            const uploaded = await this._uploadBatch(files);
            // Remove from uploading, add to server list
            entries.forEach(e => {
                this.uploadingFiles = this.uploadingFiles.filter(u => u.id !== e.id);
            });
            this.serverFiles.push(...uploaded);
        } catch (err) {
            console.error("Auto-upload failed:", err);
            // Move failed uploads to pending so user sees them
            entries.forEach(e => {
                this.uploadingFiles = this.uploadingFiles.filter(u => u.id !== e.id);
                this.pendingFiles.push({
                    ...e,
                    uploadError: true
                });
            });
        }
        this._render();
    }

    async _uploadBatch(files) {
        const formData = new FormData();
        files.forEach(file => formData.append("files", file));

        const res = await fetch(
            `/api/files/${this._agreementId}/${this.context}`,
            { method: "POST", body: formData }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Upload failed.");
        }
        const data = await res.json();
        // Remove from pendingFiles if they were there
        files.forEach(f => {
            this.pendingFiles = this.pendingFiles.filter(
                p => !(p.name === f.name && p.size === f.size)
            );
        });
        return data.files || [];
    }

    async _deleteServerFile(file) {
        try {
            const res = await fetch(
                `/api/files/${this._agreementId}/${this.context}/${encodeURIComponent(file.name)}`,
                { method: "DELETE" }
            );
            if (res.ok) {
                this.serverFiles = this.serverFiles.filter(f => f.name !== file.name);
                this._render();
            }
        } catch (e) {
            console.error("Delete failed:", e);
        }
    }

    _render() {
        if (!this.fileList) return;
        let html = "";

        // ---- Uploading (spinner) ----
        if (this.uploadingFiles.length > 0) {
            html += `<div class="file-section-label">Uploading…</div>`;
            html += this.uploadingFiles.map(entry => {
                const info = _fileGetIconInfo(entry.type, entry.name);
                return `
                    <div class="file-item uploading-file">
                        <div class="file-item-icon ${info.cls}">${info.icon}</div>
                        <div class="file-item-info">
                            <span class="file-item-name">${entry.name}</span>
                            <span class="file-item-meta">
                                ${_fileFormatSize(entry.size)}
                                <span class="file-status-chip uploading">⏳ Uploading…</span>
                            </span>
                        </div>
                        <div class="file-upload-spinner"></div>
                    </div>
                `;
            }).join("");
        }

        // ---- Server files (saved, clickable, deletable) ----
        if (this.serverFiles.length > 0) {
            html += `<div class="file-section-label">Uploaded files</div>`;
            html += this.serverFiles.map((f, idx) => {
                const info = _fileGetIconInfo(f.mimeType, f.name);
                return `
                    <div class="file-item server-file" data-server-idx="${idx}">
                        <div class="file-item-icon ${info.cls}">${info.icon}</div>
                        <div class="file-item-info">
                            <a class="file-item-name"
                               href="${f.url}"
                               target="_blank"
                               rel="noopener noreferrer">${f.name}</a>
                            <span class="file-item-meta">
                                ${_fileFormatSize(f.size)} &middot; ${f.mimeType || "file"}
                                <span class="file-status-chip uploaded">✓ Saved</span>
                            </span>
                        </div>
                        <button class="file-item-remove server-delete"
                                type="button" title="Delete"
                                data-server-idx="${idx}">✕</button>
                    </div>
                `;
            }).join("");
        }

        // ---- Pending (no agreementId yet) ----
        if (this.pendingFiles.length > 0) {
            const hasError = this.pendingFiles.some(f => f.uploadError);
            html += `<div class="file-section-label">${hasError ? "Failed — will retry on submit" : "Will upload on form submit"}</div>`;
            html += this.pendingFiles.map(entry => {
                const info = _fileGetIconInfo(entry.type, entry.name);
                const chip = entry.uploadError
                    ? `<span class="file-status-chip error">✕ Failed</span>`
                    : `<span class="file-status-chip pending">⏳ Pending</span>`;
                return `
                    <div class="file-item pending-file" data-pending-id="${entry.id}">
                        <div class="file-item-icon ${info.cls}">${info.icon}</div>
                        <div class="file-item-info">
                            <span class="file-item-name">${entry.name}</span>
                            <span class="file-item-meta">
                                ${_fileFormatSize(entry.size)} &middot; ${entry.type || "file"}
                                ${chip}
                            </span>
                        </div>
                        <button class="file-item-remove pending-remove"
                                type="button" title="Remove"
                                data-pending-id="${entry.id}">✕</button>
                    </div>
                `;
            }).join("");
        }

        this.fileList.innerHTML = html;

        // Wire server delete
        this.fileList.querySelectorAll(".server-delete").forEach(btn => {
            btn.addEventListener("click", async () => {
                const idx = Number(btn.dataset.serverIdx);
                btn.disabled = true; btn.textContent = "…";
                await this._deleteServerFile(this.serverFiles[idx]);
            });
        });

        // Wire pending remove
        this.fileList.querySelectorAll(".pending-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = Number(btn.dataset.pendingId);
                this.pendingFiles = this.pendingFiles.filter(f => f.id !== id);
                this._render();
            });
        });

        const total = this.serverFiles.length + this.pendingFiles.length + this.uploadingFiles.length;
        if (this.badge) this.badge.textContent = total;
    }
}


// ==================== FILE MANAGER INSTANCES ====================

const fileManagers = {};

function setupFileAttachmentManagers() {
    fileManagers.createAgreement = new FileAttachmentManager({
        dropZoneId:  "createAgreementDropZone",
        fileInputId: "createAgreementFileInput",
        fileListId:  "createAgreementFileList",
        badgeId:     "createAgreementFileCount",
        context:     "shipper"
    });

    fileManagers.verify = new FileAttachmentManager({
        dropZoneId:  "verifyDropZone",
        fileInputId: "verifyFileInput",
        fileListId:  "verifyFileList",
        badgeId:     "verifyFileCount",
        context:     "verify"
    });

    fileManagers.pickup = new FileAttachmentManager({
        dropZoneId:  "pickupDropZone",
        fileInputId: "pickupFileInput",
        fileListId:  "pickupFileList",
        badgeId:     "pickupFileCount",
        context:     "pickup"
    });

    fileManagers.delivery = new FileAttachmentManager({
        dropZoneId:  "deliveryDropZone",
        fileInputId: "deliveryFileInput",
        fileListId:  "deliveryFileList",
        badgeId:     "deliveryFileCount",
        context:     "delivery"
    });
}

// ---- Load files for agreement context pages ----
async function loadPageFiles(agreementId) {
    if (!agreementId) return;
    // Load shipper docs and verify evidence (both roles can see these)
    await Promise.all([
        fileManagers.verify?.loadForAgreement(agreementId)
    ]);
}

async function loadSubmitPageFiles(agreementId) {
    if (!agreementId) return;
    await Promise.all([
        fileManagers.pickup?.loadForAgreement(agreementId),
        fileManagers.delivery?.loadForAgreement(agreementId)
    ]);
}

/**
 * Fetches and renders all agreement files in a shared viewer panel.
 * Contexts: shipper, pickup, delivery, verify
 */
async function loadAgreementSharedFiles(agreementId) {
    const contexts = [
        { key: "shipper",  label: "Shipper Documents",     icon: "📋" },
        { key: "pickup",   label: "Pickup Proof",          icon: "📦" },
        { key: "delivery", label: "Delivery Proof",        icon: "🚚" },
        { key: "verify",   label: "Verification Evidence", icon: "🔍" }
    ];

    const container = document.getElementById("detailSharedFiles");
    if (!container) return;

    container.innerHTML = `<div class="file-loading">Loading documents…</div>`;

    let totalFound = 0;
    let sectionsHtml = "";

    for (const ctx of contexts) {
        try {
            const res  = await fetch(`/api/files/${agreementId}/${ctx.key}`);
            const data = await res.json();
            const files = data.files || [];
            totalFound += files.length;

            if (files.length === 0) continue;

            sectionsHtml += `
                <div class="shared-file-section">
                    <div class="shared-file-section-title">
                        <span>${ctx.icon}</span>
                        <strong>${ctx.label}</strong>
                        <span class="file-count-badge">${files.length}</span>
                    </div>
                    <div class="file-list shared-file-list" id="shared-files-${ctx.key}"></div>
                </div>
            `;
        } catch (e) {
            console.warn(`Could not load ${ctx.key} files`, e);
        }
    }

    if (totalFound === 0) {
        container.innerHTML = `<div class="file-empty-state">No documents attached to this agreement yet.</div>`;
        return;
    }

    container.innerHTML = sectionsHtml;

    // Now populate each section
    for (const ctx of contexts) {
        const el = document.getElementById(`shared-files-${ctx.key}`);
        if (!el) continue;
        try {
            const res  = await fetch(`/api/files/${agreementId}/${ctx.key}`);
            const data = await res.json();
            renderServerFiles(el, data.files || [], false);
        } catch (e) {
            el.innerHTML = `<div class="file-empty-state">Error loading files.</div>`;
        }
    }

    // Update badge
    const badge = document.getElementById("detailSharedFilesBadge");
    if (badge) badge.textContent = totalFound;
}



// ==================== AGREEMENT DETAIL ====================

async function openAgreementDetail(id) {
    selectedAgreementId = Number(id);
    await loadAgreementDetail(selectedAgreementId, true);
}

window.openAgreementDetail = openAgreementDetail;

async function loadAgreementDetail(id, navigate = true) {
    const agreement = await logisticsEscrow.methods
        .getAgreement(id)
        .call();

    selectedAgreementId = Number(id);

    document.getElementById("detailPageId").textContent =
        agreement.id;

    document.getElementById("detailPageShipper").textContent =
        agreement.shipper;

    document.getElementById("detailPageCarrier").textContent =
        agreement.carrier;

    const tVal = web3.utils.fromWei(agreement.totalAmount.toString(), "ether");
    document.getElementById("detailPageTotal").textContent = `${tVal} ETH`;
    if (ethUsdPrice > 0) document.getElementById("detailPageTotalUsd").textContent = `~${(Number(tVal) * ethUsdPrice).toFixed(2)} USD`;

    const eVal = web3.utils.fromWei(agreement.escrowBalance.toString(), "ether");
    document.getElementById("detailPageEscrow").textContent = `${eVal} ETH`;
    if (ethUsdPrice > 0) document.getElementById("detailPageEscrowUsd").textContent = `~${(Number(eVal) * ethUsdPrice).toFixed(2)} USD`;

    document.getElementById("detailPageDeadline").textContent =
        formatTimestamp(agreement.deadline);

    document.getElementById("detailPageCreated").textContent =
        formatTimestamp(agreement.createdAt);

    const pVal = web3.utils.fromWei(agreement.pickupAmount.toString(), "ether");
    document.getElementById("detailPagePickupAmount").textContent = `${pVal} ETH`;
    if (ethUsdPrice > 0) document.getElementById("detailPagePickupAmountUsd").textContent = `~${(Number(pVal) * ethUsdPrice).toFixed(2)} USD`;

    const dVal = web3.utils.fromWei(agreement.deliveryAmount.toString(), "ether");
    document.getElementById("detailPageDeliveryAmount").textContent = `${dVal} ETH`;
    if (ethUsdPrice > 0) document.getElementById("detailPageDeliveryAmountUsd").textContent = `~${(Number(dVal) * ethUsdPrice).toFixed(2)} USD`;

    setMilestoneStatusElement(
        "detailPagePickupStatus",
        agreement.pickupStatus,
        agreement.status
    );

        setMilestoneStatusElement(
        "detailPageDeliveryStatus",
        agreement.deliveryStatus,
        agreement.status
    );

    const rejectBox = document.getElementById("detailRejectionReasonBox");
    if (rejectBox) rejectBox.style.display = "none";
    
    const statusNumber = Number(agreement.status);
    const pStatus = Number(agreement.pickupStatus);
    const dStatus = Number(agreement.deliveryStatus);
    
    if (statusNumber === 4 || statusNumber === 5 || pStatus === 2 || dStatus === 2) {
        try {
            const cancelEvents = await logisticsEscrow.getPastEvents('AgreementCancelled', { filter: { id: id }, fromBlock: deploymentBlock, toBlock: 'latest' });
            const milestoneRejectEvents = await logisticsEscrow.getPastEvents('MilestoneRejected', { filter: { id: id }, fromBlock: deploymentBlock, toBlock: 'latest' });
            
            const allEvents = [...cancelEvents, ...milestoneRejectEvents].sort((a, b) => b.blockNumber - a.blockNumber);
            if (allEvents.length > 0 && rejectBox) {
                const ev = allEvents[0];
                document.getElementById("detailPageRejectionReason").textContent = ev.returnValues.reason || ev.returnValues.comment || "No reason provided";
                rejectBox.style.display = "block";
            }
        } catch (e) {
            console.error("Failed to load rejection reason", e);
        }
    }


    const statusBadge = document.getElementById("detailPageStatus");

    statusBadge.textContent =
        getAgreementStatusName(agreement);

    statusBadge.className =
        `status-badge ${getAgreementStatusClass(agreement)}`;

    renderAgreementAction(agreement);

    // Load shared file viewer for both parties
    loadAgreementSharedFiles(Number(id));

    if (navigate) {
        showPage("agreement-detail");
    }
}

function setMilestoneStatusElement(elementId, status, agreementStatus) {
    const element = document.getElementById(elementId);
    const value = Number(status);
    const agStatus = Number(agreementStatus);

    if (agStatus === 5 && value !== 2) {
        element.textContent = "Cancelled";
        element.className = "milestone-status cancelled";
        element.style.color = ""; // reset inline color
        return;
    }
    
    element.style.color = "";

    element.textContent =
        getMilestoneStatusName(value);

    element.className = "milestone-status";

    if (value === 0) {
        element.classList.add("pending");
    } else if (value === 1) {
        element.classList.add("submitted");
    } else {
        element.classList.add("verified");
    }
}

// ==================== AGREEMENT ACTION ====================
function renderAgreementAction(agreement) {
    const title = document.getElementById("detailActionTitle");
    const description = document.getElementById("detailActionDescription");
    const content = document.getElementById("detailActionContent");

    content.innerHTML = "";

    const status = Number(agreement.status);
    const pickup = Number(agreement.pickupStatus);
    const delivery = Number(agreement.deliveryStatus);

    const escrow =
        web3.utils.toBN(
            agreement.escrowBalance.toString()
        );

    const deadlinePassed =
        Math.floor(Date.now() / 1000) >
        Number(agreement.deadline);

    // SHIPPER
    if (currentRole === 1) {

        if (
            deadlinePassed &&
            !escrow.isZero() &&
            status !== 3 &&
                status !== 4 &&
                status !== 5
        ) {
            title.textContent =
                "Agreement Deadline Passed";

            description.textContent =
                "The remaining escrow may now be returned to the Shipper.";

            content.innerHTML = `
                <div class="action-amount-box">
                    <span>Refund Amount</span>
                    <strong>
                        ${web3.utils.fromWei(
                            escrow.toString(),
                            "ether"
                        )} ETH
                    </strong>
                </div>

                <button
                    class="refund-button"
                    onclick="claimRefundFromDetail()">
                    Claim Refund
                </button>
            `;

            return;
        }

        if (status === 0) {
            if (deadlinePassed) {
                title.textContent = "Agreement Expired";
                description.textContent = "This agreement expired before it was funded.";
                content.innerHTML = `
                    <div class="info-banner red-banner compact-banner">
                        <div class="banner-icon">⚠️</div>
                        <span>Funding and rejection are no longer available.</span>
                    </div>
                `;
                return;
            }

            title.textContent =
                "Fund Escrow to Activate Agreement";

            description.textContent =
                "Fund the agreement with the exact Total Value amount.";

            content.innerHTML = `
                <div class="action-amount-box">
                    <span>Required Escrow</span>
                    <strong>
                        ${web3.utils.fromWei(
                            agreement.totalAmount.toString(),
                            "ether"
                        )} ETH
                    </strong>
                </div>

                <button
                    class="primary-button large-button full-width-button"
                    onclick="fundFromDetail()">
                      Fund Escrow
                  </button>
                  <button
                      class="primary-button large-button full-width-button"
                      style="margin-top: 12px; background: linear-gradient(90deg, #d32f2f, #f44336);"
                      onclick="openRejectModal('agreement')">
                      Cancel Agreement
                  </button>
            `;

            return;
        }

        if (status === 1) {
            title.textContent =
                "Awaiting Carrier Pickup";

            description.textContent =
                "The agreement is funded. The carrier has not yet completed pickup.";

            content.innerHTML = `
                <div class="info-banner teal-banner compact-banner">
                    <div class="banner-icon">ℹ️</div>
                    <span>Waiting for carrier to submit pickup proof.</span>
                </div>
            `;

            return;
        }

        if (status === 2 && pickup === 1) {
            title.textContent =
                "Pickup Awaiting Verification";

            description.textContent =
                "The Carrier has submitted Pickup completion.";

            content.innerHTML = `
                <button
                    class="primary-button large-button full-width-button"
                    onclick="openVerifyPage(0)">
                    Verify Pickup
                </button>
                <button
                    class="primary-button large-button full-width-button"
                      style="margin-top: 12px; background: linear-gradient(90deg, #d32f2f, #f44336);"
                    onclick="openRejectModal('milestone', 0)">
                    Reject Pickup
                </button>
            `;

            return;
        }

        if (status === 2 && delivery === 1) {
            title.textContent =
                "Delivery Awaiting Verification";

            description.textContent =
                "The Carrier has submitted Final Delivery completion.";

            content.innerHTML = `
                <button
                    class="primary-button large-button full-width-button"
                    onclick="openVerifyPage(1)">
                    Verify Final Delivery
                </button>
                <button
                    class="primary-button large-button full-width-button"
                      style="margin-top: 12px; background: linear-gradient(90deg, #d32f2f, #f44336);"
                    onclick="openRejectModal('milestone', 1)">
                    Reject Delivery
                </button>
            `;

            return;
        }
    }

    // CARRIER
    if (currentRole === 2) {

        if (deadlinePassed) {
            title.textContent =
                "Agreement Deadline Passed";

            description.textContent =
                "No further milestones may be submitted.";

            return;
        }

        if ((status === 1 || status === 2) && pickup === 0) {
            title.textContent =
                "Pickup Milestone Available";

            description.textContent =
                "Submit Pickup completion after collecting the shipment. You can also cancel the agreement if you can no longer fulfill it.";

            content.innerHTML = `
                <button
                    class="primary-button large-button full-width-button"
                    onclick="openSubmitPage()">
                    Submit Pickup
                </button>
                <button
                    class="primary-button large-button full-width-button"
                    style="margin-top: 12px; background: linear-gradient(90deg, #d32f2f, #f44336);"
                    onclick="openRejectModal('cancel_carrier')">
                    Cancel Agreement
                </button>
            `;

            return;
        }

        if (
            status === 2 &&
            pickup === 2 &&
            delivery === 0
        ) {
            title.textContent =
                "Final Delivery Available";

            description.textContent =
                "Pickup is verified. You may now submit Final Delivery.";

            content.innerHTML = `
                <button
                    class="primary-button large-button full-width-button"
                    onclick="openSubmitPage()">
                    Submit Final Delivery
                </button>
                
            `;

            return;
        }

        if (pickup === 1 || delivery === 1) {
            title.textContent =
                "Awaiting Shipper Verification";

            description.textContent =
                "A submitted milestone is waiting for the Shipper to verify it.";

            return;
        }
    }
    title.textContent = "No Action Required";

    if (status === 3) {
        title.textContent = "Agreement Completed";
        description.textContent = "This agreement has been completed successfully.";
    } else if (status === 4) {
        title.textContent = "Agreement Refunded";
        description.textContent = "The escrow balance has been refunded.";
    } else if (status === 5) {
        title.textContent = "Agreement Cancelled";
        description.textContent = "This agreement was cancelled and is no longer active.";
    } else {
        title.textContent = "No Action Required";
        description.textContent = "No action is currently required from this wallet.";
    }
}

// ==================== FUND FROM DETAIL ====================
async function fundFromDetail() {
    try {
        const agreement = await logisticsEscrow.methods
            .getAgreement(selectedAgreementId)
            .call();

        const amount = web3.utils.fromWei(
            agreement.totalAmount.toString(),
            "ether"
        );

        showToast(`Confirm ${amount} ETH in MetaMask.`, "info");

        await logisticsEscrow.methods
            .fundAgreement(selectedAgreementId)
            .send({
                from: currentAccount,
                value: agreement.totalAmount
            });

        showToast("Escrow funded successfully.", "success");

        await refreshApplication();
        await loadAgreementDetail(
            selectedAgreementId,
            false
        );

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}

window.fundFromDetail = fundFromDetail;

// ==================== REFUND FROM DETAIL ====================
async function claimRefundFromDetail() {
    try {
        showToast("Waiting for MetaMask confirmation...", "info");

        await logisticsEscrow.methods
            .claimRefund(selectedAgreementId)
            .send({
                from: currentAccount
            });

        showToast("Remaining escrow refunded successfully.", "success");

        await refreshApplication();
        await loadAgreementDetail(
            selectedAgreementId,
            false
        );

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}
window.claimRefundFromDetail = claimRefundFromDetail;

// ==================== VERIFY PAGE ====================
async function openVerifyPage(milestoneType) {
    selectedMilestoneType = Number(milestoneType);

    const agreement = await logisticsEscrow.methods
        .getAgreement(selectedAgreementId)
        .call();

    const milestoneStatus =
        selectedMilestoneType === 0
            ? Number(agreement.pickupStatus)
            : Number(agreement.deliveryStatus);

    if (milestoneStatus !== 1) {
        showGlobalStatus(
            "This milestone has not been submitted."
        );
        return;
    }

    const paymentWei =
        selectedMilestoneType === 0
            ? agreement.pickupAmount
            : agreement.deliveryAmount;

    const currentEscrow =
        web3.utils.toBN(
            agreement.escrowBalance.toString()
        );

    const payment =
        web3.utils.toBN(
            paymentWei.toString()
        );

    const remaining =
        currentEscrow.sub(payment);

    document.getElementById("verifyPageAgreementId").textContent =
        agreement.id;

    document.getElementById("verifyPageAgreementStatus").textContent =
        getAgreementStatusName(agreement);

    document.getElementById("verifyPageMilestoneName").textContent =
        `${getMilestoneTypeName(selectedMilestoneType)} Milestone`;

    document.getElementById("verifyPageCarrier").textContent =
        agreement.carrier;

    document.getElementById("verifyPagePayment").textContent =
        `${web3.utils.fromWei(payment.toString(), "ether")} ETH`;

    document.getElementById("verifyPageTotal").textContent =
        `${web3.utils.fromWei(
            agreement.totalAmount.toString(),
            "ether"
        )} ETH`;

    document.getElementById("verifyPageCurrentEscrow").textContent =
        `${web3.utils.fromWei(
            currentEscrow.toString(),
            "ether"
        )} ETH`;

    document.getElementById("verifyPageReleaseAmount").textContent =
        `${web3.utils.fromWei(
            payment.toString(),
            "ether"
        )} ETH`;

    document.getElementById("verifyPageRemaining").textContent =
        `${web3.utils.fromWei(
            remaining.toString(),
            "ether"
        )} ETH`;

    showPage("verify-milestone");

    // Load carrier proof files (pickup or delivery) for the Shipper to review
    const proofContext = selectedMilestoneType === 0 ? "pickup" : "delivery";
    if (fileManagers.verify) {
        await fileManagers.verify.loadForAgreement(selectedAgreementId);
    }
    // Also load the specific carrier proof
    const proofManager = selectedMilestoneType === 0
        ? fileManagers.pickup
        : fileManagers.delivery;
    if (proofManager) {
        await proofManager.loadForAgreement(selectedAgreementId);
    }
}
window.openVerifyPage = openVerifyPage;

// ==================== CONFIRM VERIFY ====================
async function confirmVerifyMilestone() {
    try {
        // Upload any verification evidence before confirming
        if (fileManagers.verify?.getPendingCount() > 0) {
            showToast("Uploading verification evidence…", "info");
            try {
                await fileManagers.verify.uploadPending(selectedAgreementId);
            } catch (uploadErr) {
                console.warn("Evidence upload failed:", uploadErr);
            }
        }

        showToast("Waiting for MetaMask confirmation...", "info");

        await logisticsEscrow.methods
            .verifyMilestone(
                selectedAgreementId,
                selectedMilestoneType
            )
            .send({
                from: currentAccount
            });

        showToast(`${getMilestoneTypeName(
                selectedMilestoneType
            )} verified. Payment released successfully.`, "success");

        await refreshApplication();
        await openAgreementDetail(selectedAgreementId);

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}


// ==================== CARRIER SUBMIT PAGE ====================
async function openSubmitPage() {
    const agreement = await logisticsEscrow.methods
        .getAgreement(selectedAgreementId)
        .call();

    document.getElementById("submitPageAgreementId").textContent =
        agreement.id;

    document.getElementById("submitPageShipper").textContent =
        agreement.shipper;

    document.getElementById("submitPageCarrier").textContent =
        agreement.carrier;

    document.getElementById("submitPageTotal").textContent =
        `${web3.utils.fromWei(
            agreement.totalAmount.toString(),
            "ether"
        )} ETH`;

    document.getElementById("submitPageDeadline").textContent =
        formatTimestamp(agreement.deadline);

    document.getElementById("submitPagePickupAmount").textContent =
        `${web3.utils.fromWei(
            agreement.pickupAmount.toString(),
            "ether"
        )} ETH`;

    document.getElementById("submitPageDeliveryAmount").textContent =
        `${web3.utils.fromWei(
            agreement.deliveryAmount.toString(),
            "ether"
        )} ETH`;

    document.getElementById("submitPagePickupStatus").textContent =
        getMilestoneStatusName(agreement.pickupStatus);

    document.getElementById("submitPageDeliveryStatus").textContent =
        getMilestoneStatusName(agreement.deliveryStatus);

    const pickupButton =
        document.getElementById("submitPickupButton");

    const deliveryButton =
        document.getElementById("submitDeliveryButton");

    const deadlinePassed =
        Math.floor(Date.now() / 1000) >
        Number(agreement.deadline);

    pickupButton.disabled =
        deadlinePassed ||
        (Number(agreement.status) !== 1 && Number(agreement.status) !== 2) ||
        Number(agreement.pickupStatus) !== 0;

    deliveryButton.disabled =
        deadlinePassed ||
        Number(agreement.status) !== 2 ||
        Number(agreement.pickupStatus) !== 2 ||
        Number(agreement.deliveryStatus) !== 0;

    document.getElementById("submitPickupCard").classList.toggle(
        "active-card",
        !pickupButton.disabled
    );

    document.getElementById("submitDeliveryCard").classList.toggle(
        "active-card",
        !deliveryButton.disabled
    );

    showPage("submit-milestone");

    // Load existing files for carrier (their own proofs + shipper docs)
    await Promise.all([
        fileManagers.pickup?.loadForAgreement(selectedAgreementId),
        fileManagers.delivery?.loadForAgreement(selectedAgreementId)
    ]);
}
window.openSubmitPage = openSubmitPage;

// ==================== SUBMIT MILESTONE ====================
async function submitMilestoneFromPage(type) {
    try {
        showToast("Waiting for MetaMask confirmation...", "info");

        await logisticsEscrow.methods
            .submitMilestone(
                selectedAgreementId,
                type
            )
            .send({
                from: currentAccount
            });

        showToast(`${getMilestoneTypeName(type)} submitted successfully.`, "success");

        // Upload any pending proof files to the server
        const proofManager = type === 0 ? fileManagers.pickup : fileManagers.delivery;
        if (proofManager?.getPendingCount() > 0) {
            try {
                await proofManager.uploadPending(selectedAgreementId);
            } catch (uploadErr) {
                console.warn("Proof upload failed:", uploadErr);
            }
        }

        await refreshApplication();
        await openAgreementDetail(selectedAgreementId);

    } catch (error) {
        console.error(error);
        showToast(getReadableError(error), "error");
    }
}

// ==================== REPUTATION PAGE ====================
async function loadReputationPage() {
    const carrierView =
        document.getElementById("carrierOwnReputationView");

    const shipperView =
        document.getElementById("shipperReputationView");

    if (currentRole === 2) {
        carrierView.style.display = "block";
        shipperView.style.display = "none";

        await renderOwnCarrierReputation();
    } else {
        carrierView.style.display = "none";
        shipperView.style.display = "block";
        await viewReputation();
    }
}

async function renderOwnCarrierReputation() {
    const balance = await reputationToken.methods
        .balanceOf(currentAccount)
        .call();

    let verified = 0;
    let completed = 0;

    currentRoleAgreements.forEach(agreement => {
        if (Number(agreement.pickupStatus) === 2) verified++;
        if (Number(agreement.deliveryStatus) === 2) verified++;

        if (Number(agreement.status) === 3) {
            completed++;
        }
    });
    document.getElementById("reputationOwnAddress").textContent =
        currentAccount;

    document.getElementById("carrierReputation").textContent =
        balance;

    document.getElementById("reputationVerifiedMilestones").textContent =
        verified;

    document.getElementById("reputationCompletedAgreements").textContent =
        completed;
}

// ==================== SHIPPER REPUTATION LOOKUP ====================
async function viewReputation() {
    const tbody = document.getElementById("allCarriersReputationBody");
    try {
        showToast("Loading carriers...", "info");
        
        const events = await userRegistry.getPastEvents("UserRegistered", { fromBlock: deploymentBlock, toBlock: "latest" });
        const carriersList = events.filter(e => Number(e.returnValues.role) === 2).map(e => e.returnValues.user);
        
        if (carriersList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-table">No Carriers registered yet.</td></tr>';
            return;
        }

        const count = Number(await logisticsEscrow.methods.agreementCount().call());
        const allAgreements = [];
        for(let i=1; i<=count; i++) {
            allAgreements.push(await logisticsEscrow.methods.getAgreement(i).call());
        }

        let html = "";
        for (let carrier of carriersList) {
            const balance = await reputationToken.methods.balanceOf(carrier).call();
            
            let completed = 0;
            let verified = 0;
            for(let agr of allAgreements) {
                if(agr.carrier.toLowerCase() === carrier.toLowerCase()) {
                    if(Number(agr.status) === 3) completed++;
                    if(Number(agr.pickupStatus) === 2) verified++;
                    if(Number(agr.deliveryStatus) === 2) verified++;
                }
            }

            html += `
                <tr>
                    <td class="primary-cell">${shortAddress(carrier)}</td>
                    <td style="color: var(--blue); font-weight: 600;">${balance} CRP</td>
                    <td>${verified}</td>
                    <td>${completed}</td>
                </tr>
            `;
        }
        tbody.innerHTML = html;
        showToast("Carrier reputations loaded successfully.", "success");
    } catch (error) {
        console.error(error);
        showToast("Error loading reputations.", "error");
        tbody.innerHTML = '<tr><td colspan="4" class="empty-table">Error loading reputations.</td></tr>';
    }
}

// ==================== HISTORY ====================
function sortEventsNewestFirst(a, b) {
    if (Number(b.blockNumber) === Number(a.blockNumber)) {
        return Number(b.logIndex) - Number(a.logIndex);
    }

    return Number(b.blockNumber) - Number(a.blockNumber);
}

async function loadRoleHistory() {
    if (!currentAccount || currentRole === 0) return;

    if (currentRoleAgreements.length === 0) {
        await loadAgreementList();
    }

    const allowedIds = new Set(
        currentRoleAgreements.map(
            agreement => String(agreement.id)
        )
    );

    const events = await logisticsEscrow.getPastEvents(
        "allEvents",
        {
            fromBlock: deploymentBlock,
            toBlock: "latest"
        }
    );

    const filteredEvents = events
        .filter(event =>
            event.returnValues.id !== undefined &&
            allowedIds.has(
                String(
                    event.returnValues.id
                )
            )
        );

    currentRoleHistory = await Promise.all(filteredEvents.map(async (event) => {
        if (!event.returnValues.timestamp) {
            try {
                const block = await web3.eth.getBlock(event.blockNumber);
                event.returnValues.timestamp = block.timestamp;
            } catch (e) {
                event.returnValues.timestamp = Math.floor(Date.now() / 1000);
            }
        }
        return event;
    }));

    currentRoleHistory.sort(sortEventsNewestFirst);

    document.getElementById("historyRoleDescription").textContent =
        currentRole === 1
            ? "Showing blockchain history for agreements where you are the Shipper."
            : "Showing blockchain history for agreements where you are the Carrier.";

    renderRoleHistory();
}

function getEventDisplayName(event) {
    const names = {
        AgreementCreated: "Agreement Created",
        AgreementFunded: "Escrow Funded",

        MilestoneSubmitted:
            `${getMilestoneTypeName(
                event.returnValues.milestone
            )} Submitted`,

        MilestoneVerified:
            `${getMilestoneTypeName(
                event.returnValues.milestone
            )} Verified`,

        PaymentReleased:
            `${getMilestoneTypeName(
                event.returnValues.milestone
            )} Payment Released`,

        RefundIssued: "Refund Issued",
        AgreementCancelled: "Agreement Cancelled",
        MilestoneRejected: "Milestone Rejected"
    };
    return names[event.event] || event.event;
}

function getEventActor(event) {
    if (
        event.event === "AgreementCreated" ||
        event.event === "AgreementFunded" ||
        event.event === "MilestoneVerified" ||
        event.event === "RefundIssued"
    ) {
        return {
            label: "Shipper",
            className: "role-shipper"
        };
    }

    if (event.event === "MilestoneSubmitted") {
        return {
            label: "Carrier",
            className: "role-carrier"
        };
    }

    return {
        label: "Contract",
        className: "role-contract"
    };
}

function getEventAmount(event) {
    const values = event.returnValues;

    if (
        event.event === "AgreementFunded" ||
        event.event === "PaymentReleased" ||
        event.event === "RefundIssued"
    ) {
        if (values.amount !== undefined) {
            return (
                web3.utils.fromWei(
                    values.amount.toString(),
                    "ether"
                ) + " ETH"
            );
        }
    }
    return "—";
}

function renderRoleHistory() {
    const body = document.getElementById("roleHistoryTableBody");

    const agreementFilter =
        document.getElementById("historyAgreementFilter")
            .value
            .trim();

    const actionFilter =
        document.getElementById("historyActionFilter").value;

    const filtered = currentRoleHistory.filter(event => {
        const agreementMatch =
            !agreementFilter ||
            String(
                event.returnValues.id
            ).includes(agreementFilter);

        const actionMatch =
            actionFilter === "all" ||
            event.event === actionFilter;

        return agreementMatch && actionMatch;
    });

    const totalPages = Math.ceil(filtered.length / HISTORY_ITEMS_PER_PAGE) || 1;
    if (historyCurrentPage > totalPages) {
        historyCurrentPage = totalPages;
    }

    const startIndex = (historyCurrentPage - 1) * HISTORY_ITEMS_PER_PAGE;
    const paginated = filtered.slice(startIndex, startIndex + HISTORY_ITEMS_PER_PAGE);

    if (paginated.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    No history available.
                </td>
            </tr>
        `;
    } else {
        body.innerHTML = paginated.map(event => {
            const actor = getEventActor(event);

            return `
                <tr>
                    <td>
                        ${
                            event.returnValues.timestamp
                                ? formatTimestamp(
                                    event.returnValues.timestamp
                                )
                                : "-"
                        }
                    </td>

                    <td>
                        #${event.returnValues.id}
                    </td>

                    <td>
                        <span
                            class="role-label ${actor.className}">
                            ${actor.label}
                        </span>
                    </td>

                    <td>
                        ${getEventDisplayName(event)}
                    </td>

                    <td>
                        ${getEventAmount(event)}
                    </td>

                    <td>
                        ${shortAddress(event.transactionHash)}
                    </td>
                </tr>
            `;
        }).join("");
    }
    document.getElementById("roleHistoryCount").textContent =
        filtered.length;

    document.getElementById("roleLatestActivity").textContent =
        filtered.length > 0
            ? (
                filtered[0].returnValues.timestamp
                    ? formatTimestamp(
                        filtered[0].returnValues.timestamp
                    )
                    : `Block ${filtered[0].blockNumber}`
            )
            : "-";

    const prevBtn = document.getElementById("prevHistoryPage");
    const nextBtn = document.getElementById("nextHistoryPage");
    const pageIndicator = document.getElementById("historyPageIndicator");

    if (prevBtn && nextBtn && pageIndicator) {
        prevBtn.disabled = historyCurrentPage === 1;
        nextBtn.disabled = historyCurrentPage === totalPages;
        pageIndicator.textContent = `Page ${historyCurrentPage} of ${totalPages}`;
    }
}

// ==================== ROLE SELECTOR ====================
function setupRoleSelector() {
    document.querySelectorAll(
        'input[name="homeRole"]'
    ).forEach(radio => {
        radio.addEventListener("change", function () {
            document.querySelectorAll(".role-option").forEach(option => {
                option.classList.remove("selected");
            });
            this.closest(".role-option").classList.add("selected");
        });
    });
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    const adminUserSearch = document.getElementById("adminUserSearch");
    if (adminUserSearch) {
        adminUserSearch.addEventListener("input", renderAdminUserList);
    }
    const adminUserFilter = document.getElementById("adminUserFilter");
    if (adminUserFilter) {
        adminUserFilter.addEventListener("change", renderAdminUserList);
    }

    const addAdminBtn = document.getElementById("addAdminBtn");
    if (addAdminBtn) {
        addAdminBtn.addEventListener("click", async () => {
            if (currentRole !== 3) return showToast("Only admins can add admins.", "error");
            const addr = document.getElementById("newAdminAddress").value.trim();
            const name = document.getElementById("newAdminName").value.trim();
            if (!addr || !name) return showToast("Please provide address and name.", "warning");
            try {
                showToast("Adding new admin...", "info");
                await userRegistry.methods.addAdmin(addr, name).send({from: currentAccount});
                showToast("Admin added successfully!", "success");
                document.getElementById("newAdminAddress").value = "";
                document.getElementById("newAdminName").value = "";
            } catch (err) {
                console.error(err);
                showToast("Failed to add admin.", "error");
            }
        });
    }

    document.getElementById("enterAppBtn")
        ?.addEventListener("click", () => {
            document.getElementById("landingPage").style.display = "none";
            document.getElementById("homePage").style.display = "block";
        });

    document.getElementById("connectWallet")
        .addEventListener("click", connectWallet);

    document.getElementById("homeConnectWallet")
        .addEventListener("click", connectWallet);

    document.getElementById("homeRegisterButton")
        .addEventListener("click", registerFromHome);

    // HOME NAVIGATION
    document.querySelectorAll("[data-home-nav]").forEach(button => {
        button.addEventListener("click", function () {
            if (currentRole !== 1 && currentRole !== 2) {
                alert(
                    "Please connect and register your wallet first."
                );
                return;
            }
            showApplication(currentRole);
            showPage(this.dataset.homeNav);
        });
    });

    // MAIN NAVIGATION
    document.querySelectorAll(".main-nav-button").forEach(button => {
        button.addEventListener("click", function () {
            showPage(this.dataset.page);
        });
    });

    // DASHBOARD LINKS
    document.querySelectorAll("[data-dashboard-page]").forEach(button => {
        button.addEventListener("click", function () {
            showPage(this.dataset.dashboardPage);
        });
    });

    document.getElementById("dashboardCreateAgreement")
        .addEventListener("click", () => {
            showPage("create-agreement");
        });

    document.getElementById("openCreateAgreement")
        .addEventListener("click", () => {
            showPage("create-agreement");
        });

    document.getElementById("backFromCreateAgreement")
        .addEventListener("click", () => {
            showPage("agreements");
        });

    document.getElementById("createAgreement")
        .addEventListener("click", createAgreement);

    document.getElementById("resetAgreementForm")
        .addEventListener("click", resetAgreementForm);

    // CREATE AGREEMENT PREVIEW
    [
        "totalAmount",
        "pickupAmount",
        "deliveryAmount"
    ].forEach(id => {
        document.getElementById(id)
            .addEventListener(
                "input",
                updateDistributionPreview
            );
    });

    document.getElementById("backFromAgreementDetail")
        .addEventListener("click", () => {
            showPage("agreements");
        });

    document.getElementById("backFromVerify")
        .addEventListener("click", async () => {
            await openAgreementDetail(selectedAgreementId);
        });

    document.getElementById("confirmVerifyMilestone")
        .addEventListener(
            "click",
            confirmVerifyMilestone
        );

    document.getElementById("backFromSubmit")
        .addEventListener("click", async () => {
            await openAgreementDetail(selectedAgreementId);
        });

    document.getElementById("submitPickupButton")
        .addEventListener("click", () => {
            submitMilestoneFromPage(0);
        });

    document.getElementById("submitDeliveryButton")
        .addEventListener("click", () => {
            submitMilestoneFromPage(1);
        });



    document.getElementById("historyAgreementFilter")
        .addEventListener("input", () => {
            historyCurrentPage = 1;
            renderRoleHistory();
        });

    document.getElementById("historyActionFilter")
        .addEventListener("change", () => {
            historyCurrentPage = 1;
            renderRoleHistory();
        });

    document.getElementById("resetHistoryFilters")
        .addEventListener("click", () => {
            document.getElementById("historyAgreementFilter").value = "";
            document.getElementById("historyActionFilter").value = "all";
            historyCurrentPage = 1;
            renderRoleHistory();
        });

    document.getElementById("prevHistoryPage")
        ?.addEventListener("click", () => {
            if (historyCurrentPage > 1) {
                historyCurrentPage--;
                renderRoleHistory();
            }
        });

    document.getElementById("nextHistoryPage")
        ?.addEventListener("click", () => {
            historyCurrentPage++;
            renderRoleHistory();
        });

    document.getElementById("returnHomeButton")
        .addEventListener("click", showHome);
}

// ==================== METAMASK ACCOUNT CHANGE ====================
function setupMetaMaskListeners() {
    if (!window.ethereum) return;

    window.ethereum.on(
        "accountsChanged",
        async function (accounts) {

            if (accounts.length === 0) {
                currentAccount = null;
                currentRole = 0;

                location.reload();
                return;
            }

            currentAccount = accounts[0];
            currentRole = 0;

            selectedAgreementId = null;
            selectedMilestoneType = null;

            currentRoleAgreements = [];
            currentRoleHistory = [];

            showHome();

            document.getElementById(
                "homeRegistrationCard"
            ).style.display = "none";

            document.getElementById(
                "connectedWalletBox"
            ).style.display = "block";

            document.getElementById(
                "homeWalletAddress"
            ).textContent = currentAccount;

            document.getElementById(
                "registrationWalletAddress"
            ).textContent = currentAccount;

            if (web3 && userRegistry) {
                const networkId =
                    await web3.eth.net.getId();

                document.getElementById(
                    "homeNetworkId"
                ).textContent = networkId;

                await checkRegistrationAfterConnect();
            }
        }
    );

    window.ethereum.on(
        "chainChanged",
        function () {
            location.reload();
        }
    );
}

// ==================== ADMIN DASHBOARD ====================

async function renderAdminDashboard() {
    let escrowTotal = web3.utils.toBN(0);
    let active = 0, completed = 0, expired = 0, refunded = 0;
    let needsAttentionHTML = "";
    
    const now = Math.floor(Date.now() / 1000);

    currentRoleAgreements.forEach(agreement => {
        const bal = web3.utils.toBN(agreement.escrowBalance.toString());
        escrowTotal = escrowTotal.add(bal);
        
        const status = Number(agreement.status !== undefined ? agreement.status : (agreement.escrowBalance > 0 ? 1 : 0)); // Fallback if no status field
        const deadline = Number(agreement.deadline);
        const st = Number(agreement.status); // 0:Created,1:Funded,2:InProgress,3:Completed,4:Refunded
        
        if (st === 3) completed++;
        else if (st === 4) refunded++;
        else if (deadline < now) {
            if (st !== 3 && st !== 4 && st !== 5) expired++;
        }
        else active++;
    });

    document.getElementById("adminTotalAgreements").textContent = currentRoleAgreements.length;
    document.getElementById("adminGlobalEscrow").textContent = `${web3.utils.fromWei(escrowTotal.toString(), "ether")} ETH`;
    document.getElementById("adminActiveCount").textContent = active;
    document.getElementById("adminCompletedCount").textContent = completed;
    document.getElementById("adminExpiredCount").textContent = expired;
    document.getElementById("adminRefundedCount").textContent = refunded;



    renderAdminRecentAgreements();
    await loadSystemUsers();
}

function renderAdminRecentAgreements() {
    const body = document.getElementById("adminAllAgreements");
    
    if (currentRoleAgreements.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table">
                    No agreements in the system.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = currentRoleAgreements.map(agreement => `
        <tr>
            <td>#${agreement.id}</td>
            <td>${shortAddress(agreement.shipper)}</td>
            <td>${shortAddress(agreement.carrier)}</td>
            <td>
                ${web3.utils.fromWei(
                    agreement.totalAmount.toString(),
                    "ether"
                )} ETH
            </td>
            <td>
                ${web3.utils.fromWei(
                    agreement.escrowBalance.toString(),
                    "ether"
                )} ETH
            </td>
            <td>${createDashboardStatus(agreement)}</td>
        </tr>
    `).join("");
}

async function loadSystemUsers() {
    const container = document.getElementById("adminUserList");
    
    try {
        const events = await userRegistry.getPastEvents(
            "UserRegistered",
            {
                fromBlock: deploymentBlock,
                toBlock: "latest"
            }
        );
        
        adminAllUsers = events.map(e => e.returnValues);
        
        document.getElementById("adminTotalUsers").textContent = adminAllUsers.length;

        renderAdminUserList();

    } catch (e) {
        console.error("Failed to load users:", e);
        container.innerHTML = `
            <div class="empty-box">
                Failed to load users.
            </div>
        `;
    }
}

function renderAdminUserList() {
    const container = document.getElementById("adminUserList");
    const searchEl = document.getElementById("adminUserSearch");
    const filterEl = document.getElementById("adminUserFilter");
    
    const searchQuery = searchEl ? searchEl.value.toLowerCase() : "";
    const filterRole = filterEl ? filterEl.value : "all";

    let filteredUsers = adminAllUsers.filter(user => {
        const nameMatch = user.name.toLowerCase().includes(searchQuery);
        const walletMatch = user.user.toLowerCase().includes(searchQuery);
        
        const roleMatch = filterRole === "all" || String(user.role) === filterRole;

        return (nameMatch || walletMatch) && roleMatch;
    });

    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div class="empty-box">
                No users found.
            </div>
        `;
        return;
    }

    container.innerHTML = filteredUsers.reverse().map(user => {
        const roleName = Number(user.role) === 1 ? "Shipper" : (Number(user.role) === 2 ? "Carrier" : "Admin");
        return `
            <div class="list-item">
                <div class="list-item-main">
                    <strong>${user.name}</strong>
                    <span>
                        Role: ${roleName}
                        • Wallet: ${shortAddress(user.user)}
                    </span>
                </div>
                <div class="list-item-side">
                    <span>${formatTimestamp(user.timestamp)}</span>
                </div>
            </div>
        `;
    }).join("");
}

// ==================== START APPLICATION ====================
document.addEventListener(
    "DOMContentLoaded",
    function () {
        showLandingPage();
        setupRoleSelector();
        setupEventListeners();
        setupMetaMaskListeners();
        setupFileAttachmentManagers();
        fetchEthPrice();
        updateDistributionPreview();
    }
);



// ==================== REJECT AGREEMENT ====================
let rejectActionType = "";
let rejectMilestoneType = 0; // 0 for pickup, 1 for delivery

function openRejectModal(type, milestoneType = 0) {
    rejectActionType = type;
    rejectMilestoneType = milestoneType;
    document.getElementById("rejectComment").value = "";
    
    const title = document.querySelector("#rejectModal .modal-header h2");
    const desc = document.querySelector("#rejectModal .modal-body p");
    const btn = document.getElementById("confirmRejectBtn");

    if (type === 'agreement') {
        title.textContent = "Cancel Agreement";
        desc.textContent = "Are you sure you want to cancel this agreement? This action cannot be undone.";
        btn.textContent = "Confirm Cancellation";
    } else if (type === 'cancel_carrier') {
        title.textContent = "Cancel Agreement";
        desc.textContent = "Are you sure you want to cancel? Escrow will be refunded to the Shipper.";
        btn.textContent = "Confirm Cancellation";
    } else if (type === 'milestone') {
        title.textContent = milestoneType === 0 ? "Reject Pickup" : "Reject Delivery";
        desc.textContent = "Please provide a reason for rejecting the submitted milestone evidence.";
        btn.textContent = "Reject Milestone";
    }

    document.getElementById("rejectModal").style.display = "flex";
}

async function confirmRejectAgreement() {
    const comment = document.getElementById("rejectComment").value.trim();
    if (!comment) return showToast("Please provide a reason.", "warning");
    
    if (!selectedAgreementId) return;

    try {
        const btn = document.getElementById("confirmRejectBtn");
        btn.disabled = true;
        btn.textContent = "Processing...";
        showToast("Processing request...", "info");

        if (rejectActionType === 'agreement') {
            await logisticsEscrow.methods.cancelAgreementByShipper(selectedAgreementId, comment).send({ from: currentAccount });
            showToast("Agreement cancelled successfully!", "success");
        } else if (rejectActionType === 'cancel_carrier') {
            await logisticsEscrow.methods.cancelAgreementByCarrier(selectedAgreementId, comment).send({ from: currentAccount });
            showToast("Agreement cancelled successfully!", "success");
        } else if (rejectActionType === 'milestone') {
            await logisticsEscrow.methods.rejectMilestone(selectedAgreementId, rejectMilestoneType, comment).send({ from: currentAccount });
            showToast("Milestone rejected successfully!", "success");
        }

        document.getElementById("rejectModal").style.display = "none";
        
        // Refresh detail view
        await refreshDashboardStats();
        await loadAgreementDetail(selectedAgreementId, false);

    } catch (err) {
        console.error(err);
        showToast("Action failed.", "error");
    } finally {
        const btn = document.getElementById("confirmRejectBtn");
        btn.disabled = false;
        btn.textContent = "Confirm"; // Reset
    }
}
