/* ------------------------------------------------------------------
   ABB-Investment Admin Panel – JWT + Render API
   ------------------------------------------------------------------ */
const API       = "https://abb-backend.onrender.com/api";
const TOKEN_KEY = "aab_admin_token";

/* 🔐 Ensure admin is logged-in */
const token = localStorage.getItem(TOKEN_KEY);
if (!token) location.href = "login.html";

/* Helper for all requests */
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    ...options
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      alert("Session expired – please log in again.");
      location.href = "login.html";
    }
    throw new Error(await res.text());
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  PAGE INITIALISATION                                               */
/* ------------------------------------------------------------------ */
let usersDB = [], rechargeData = [], withdrawData = [], vipData = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Fetch everything in parallel
    [ usersDB,
      rechargeData,
      withdrawData,
      vipData ] = await Promise.all([
        api("/admin/users"),
        api("/admin/recharges"),
        api("/admin/withdrawals"),
        api("/admin/vips")
      ]);

    renderDashboard();
  } catch (err) {
    console.error(err);
    alert(err.message || "Error loading admin data");
  }
});

/* ------------------------------------------------------------------ */
/*  RENDERERS                                                         */
/* ------------------------------------------------------------------ */
function renderDashboard() {
  renderStats();
  renderUsers();
  renderRecharges();
  renderWithdrawals();
  renderVIPs();
}

/* -- Stats cards -- */
function renderStats() {
  const totalUsers       = usersDB.length;
  const pendingRecharges = flatten("recharges", rechargeData).length;
  const pendingWithdraws = flatten("withdrawals", withdrawData).length;
  const totalBalance     = usersDB.reduce((sum,u)=>sum+u.balance,0);

  setTxt("total-users", totalUsers);
  setTxt("pending-recharges", pendingRecharges);
  setTxt("pending-withdrawals", pendingWithdraws);
  setTxt("total-balance", `UGX ${totalBalance.toLocaleString()}`);
}
const setTxt = (id,val)=>document.getElementById(id)?.textContent = val;

/* -- User List -- */
function renderUsers() {
  const tbody = document.getElementById("users-list");
  if (!tbody) return;
  tbody.innerHTML = usersDB.map(u=>`
    <tr>
      <td>${u._id.slice(-6)}</td>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>UGX ${u.balance.toLocaleString()}</td>
      <td>${u.vipLevel||0}</td>
    </tr>`).join("");
}

/* Helpers */
const flatten = (key, arr)=>
  arr.flatMap(u => (u[key]||[])
    .filter(r=>r.status==="pending")
    .map(r=>({ user:u.username, email:u.email, uId:u._id, req:r })));

/* -- Recharges -- */
function renderRecharges() {
  const tbody = document.getElementById("recharge-requests");
  if (!tbody) return;
  tbody.innerHTML = flatten("recharges", rechargeData)
    .map(x=>`
      <tr>
        <td>${x.user}</td>
        <td>UGX ${x.req.amount}</td>
        <td>${new Date(x.req.date).toLocaleDateString()}</td>
        <td>
          <button onclick="approveRecharge('${x.uId}','${x.req._id}')">Approve</button>
          <button onclick="rejectRecharge('${x.uId}','${x.req._id}')">Reject</button>
        </td>
      </tr>`).join("");
}

/* -- Withdrawals -- */
function renderWithdrawals() {
  const tbody = document.getElementById("withdrawal-requests");
  if (!tbody) return;
  tbody.innerHTML = flatten("withdrawals", withdrawData)
    .map(x=>`
      <tr>
        <td>${x.user}</td>
        <td>UGX ${x.req.amount}</td>
        <td>${x.req.network}</td>
        <td>${new Date(x.req.date).toLocaleDateString()}</td>
        <td>
          <button onclick="approveWithdrawal('${x.uId}','${x.req._id}')">Approve</button>
          <button onclick="rejectWithdrawal('${x.uId}','${x.req._id}')">Reject</button>
        </td>
      </tr>`).join("");
}

/* -- VIP Requests -- */
function renderVIPs() {
  const tbody = document.getElementById("vip-requests");
  if (!tbody) return;
  tbody.innerHTML = flatten("vipRequests", vipData)
    .map(x=>`
      <tr>
        <td>${x.user}</td>
        <td>VIP ${x.req.level}</td>
        <td>UGX ${x.req.amount}</td>
        <td>
          <button onclick="approveVIP('${x.uId}','${x.req._id}')">Approve</button>
          <button onclick="rejectVIP('${x.uId}','${x.req._id}')">Reject</button>
        </td>
      </tr>`).join("");
}

/* ------------------------------------------------------------------ */
/*  ACTION ENDPOINT WRAPPERS                                          */
/* ------------------------------------------------------------------ */
function mutate(kind, userId, reqId, approve) {
  const path = `/admin/${kind}/${userId}/${reqId}/${approve?"approve":"reject"}`;
  api(path, { method:"PATCH" })
    .then(()=>location.reload())
    .catch(e=>alert(e.message));
}
const approveRecharge    = (u,r)=>mutate("recharge",    u,r,true);
const rejectRecharge     = (u,r)=>mutate("recharge",    u,r,false);
const approveWithdrawal  = (u,r)=>mutate("withdrawal",  u,r,true);
const rejectWithdrawal   = (u,r)=>mutate("withdrawal",  u,r,false);
const approveVIP         = (u,r)=>mutate("vip",         u,r,true);
const rejectVIP          = (u,r)=>mutate("vip",         u,r,false);

/* ------------------------------------------------------------------ */
/*  LOGOUT                                                            */
/* ------------------------------------------------------------------ */
document.getElementById("admin-logout-btn")?.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_KEY);
  location.href = "login.html";
});

