(function () {
  const client = window.sdpSupabase;
  const gate = document.getElementById("sdpAuthGate");
  const app = document.getElementById("sdpProtectedApp");
  const form = document.getElementById("sdpAuthForm");
  const message = document.getElementById("sdpAuthMessage");
  const submit = document.getElementById("sdpAuthSubmit");
  const loginPanel = document.getElementById("sdpLoginPanel");
  const requestPanel = document.getElementById("sdpRequestPanel");

  function say(text, colour = "#ffc38e") {
    message.textContent = text;
    message.style.color = colour;
  }
  function lock() {
    app.style.visibility = "hidden";
    gate.style.display = "flex";
  }
  function showLogin() {
    loginPanel.hidden = false;
    requestPanel.hidden = true;
  }
  function showRequest() {
    loginPanel.hidden = true;
    requestPanel.hidden = false;
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function installAdminNav() {
    if (document.getElementById("sdpAccessNav")) return;
    const nav = document.querySelector(".sidebar .nav");
    if (!nav) return;
    const btn = document.createElement("button");
    btn.id = "sdpAccessNav";
    btn.innerHTML = '<span class="ico">♙</span>User access management';
    btn.onclick = manageAccess;
    nav.appendChild(btn);
  }

  async function verifyAccess() {
    lock();
    say("Checking your SDP-BESR access...");
    const { data, error } = await client.rpc("sdp_my_access");
    if (error) throw error;
    const access = data || {};
    if (access.account_status !== "active") {
      await client.auth.signOut();
      if (access.account_status === "pending") {
        say("Your account request has been received. An authorised administrator must approve your access before you can enter.");
      } else if (access.account_status === "suspended") {
        say("This account is suspended. Contact the platform administrator.");
      } else {
        say("No SDP-BESR access record was found for this account. Submit an access request.");
      }
      return;
    }

    const { data: gpsAdmin } = await client.rpc("is_gps_admin");
    if (gpsAdmin === true || ["gps_admin", "super_admin"].includes(access.role)) {
      gate.style.display = "none";
      app.style.visibility = "visible";
      say("Administrator access verified.", "#9ce0bd");
      installAdminNav();
      return;
    }

    await client.auth.signOut();
    say("Your account is approved as " + (access.role || "an authorised user") +
      ", with " + (access.scope_type || "unassigned") +
      " scope. Your operational workspace will open after module-level permissions are enabled. Your approval is retained.");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = "Signing in...";
    try {
      const email = document.getElementById("sdpAuthEmail").value.trim();
      const password = document.getElementById("sdpAuthPassword").value;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await verifyAccess();
    } catch (error) {
      say(error.message, "#ffaaa4");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign In";
    }
  });

  document.getElementById("sdpShowRequest").addEventListener("click", showRequest);
  document.getElementById("sdpBackToLogin").addEventListener("click", showLogin);
  document.getElementById("sdpRequestAccess").addEventListener("click", async function () {
    const fullName = document.getElementById("sdpRequestName").value.trim();
    const email = document.getElementById("sdpRequestEmail").value.trim();
    const password = document.getElementById("sdpRequestPassword").value;
    const passwordConfirm = document.getElementById("sdpRequestConfirm").value;
    if (!fullName || !email || password.length < 10) {
      say("Enter your full name, email and a password of at least 10 characters.", "#ffaaa4");
      return;
    }
    if (password !== passwordConfirm) {
      say("The passwords do not match.", "#ffaaa4");
      return;
    }
    const button = this;
    button.disabled = true;
    button.textContent = "Submitting...";
    try {
      const { data, error } = await client.auth.signUp({
        email, password, options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      if (data.session) await client.auth.signOut();
      say("Access request submitted. Your account remains pending until an administrator approves it. If email confirmation is enabled, confirm your email first.", "#9ce0bd");
      showLogin();
    } catch (error) {
      say(error.message, "#ffaaa4");
    } finally {
      button.disabled = false;
      button.textContent = "Submit Access Request";
    }
  });

  async function manageAccess() {
    const { data: current } = await client.rpc("sdp_my_access");
    const { data: gpsAdmin } = await client.rpc("is_gps_admin");
    if (!(gpsAdmin === true || ["gps_admin", "super_admin"].includes(current?.role))) return;

    let panel = document.getElementById("sdpAccessPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "sdpAccessPanel";
      panel.style.cssText = "position:fixed;inset:0;z-index:1000001;background:#001c1beF;overflow:auto;padding:18px";
      panel.innerHTML = `
        <div style="max-width:1050px;margin:20px auto;background:#103b35;border:1px solid #397065;border-radius:13px;padding:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div><b style="font-size:17px">User access management</b><p style="color:#a6c0b6;font-size:11px">Review requests, assign roles and geographical scope, or suspend accounts.</p></div>
            <button id="sdpAccessClose" class="secondary">Close</button>
          </div>
          <div id="sdpAccessRows" style="overflow:auto;margin-top:14px">Loading accounts...</div>
        </div>`;
      document.body.appendChild(panel);
      document.getElementById("sdpAccessClose").onclick = () => panel.remove();
    }
    const rows = panel.querySelector("#sdpAccessRows");
    rows.textContent = "Loading accounts...";
    const { data, error } = await client.functions.invoke("sdp-access-admin", { body: { action: "list" } });
    if (error || data?.error) { rows.textContent = data?.error || error.message; return; }
    const users = data.users || [];
    if (!users.length) { rows.textContent = "No account requests found."; return; }

    rows.innerHTML = users.map(u => `
      <article style="border:1px solid #32665b;border-radius:9px;padding:12px;margin:8px 0;background:#0c302c">
        <b>${escapeHtml(u.full_name || "Name not supplied")}</b>
        <div style="font-size:10px;color:#a6c0b6;margin:4px 0 9px">${escapeHtml(u.email || "")} · ${escapeHtml(u.account_status)} · ${escapeHtml(u.role || "No role")}</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
          <select data-role style="padding:8px;background:#092d28;color:white;border:1px solid #39695e;border-radius:6px">
            <option value="situation_room_admin">Situation Room Admin</option><option value="camera_admin">Camera Admin</option><option value="camera_operator">Camera Operator</option><option value="lga_coordinator">LGA Coordinator</option><option value="ward_officer">Ward Officer</option><option value="incident_verifier">Incident Verifier</option><option value="evidence_officer">Evidence Officer</option><option value="legal_officer">Legal Officer</option><option value="read_only">Read Only</option>
          </select>
          <select data-scope style="padding:8px;background:#092d28;color:white;border:1px solid #39695e;border-radius:6px"><option value="state">Statewide</option><option value="lga">LGA</option><option value="ward">Ward</option><option value="polling_unit">Polling Unit</option></select>
          <input data-scope-value placeholder="LGA / Ward / PU code (if required)" style="padding:8px;min-width:180px;background:#092d28;color:white;border:1px solid #39695e;border-radius:6px">
          <button data-action="approve" class="primary">Approve</button>
          <button data-action="suspend" class="secondary">Suspend</button>
          <button data-action="reinstate" class="secondary">Reinstate</button>
        </div>
      </article>`).join("");

    rows.querySelectorAll("article").forEach((card, index) => {
      const user = users[index];
      card.querySelectorAll("button[data-action]").forEach(button => {
        button.onclick = async () => {
          const action = button.dataset.action;
          const role = card.querySelector("[data-role]").value;
          const scope_type = card.querySelector("[data-scope]").value;
          const scope_value = card.querySelector("[data-scope-value]").value.trim();
          if (action === "approve" && scope_type !== "state" && !scope_value) {
            alert("Enter the LGA, ward or polling-unit code for this scope."); return;
          }
          if (action === "suspend" && !window.confirm("Suspend this account?")) return;
          button.disabled = true;
          const result = await client.functions.invoke("sdp-access-admin", {
            body: { action, user_id: user.user_id, role, scope_type, scope_value }
          });
          if (result.error || result.data?.error) {
            alert(result.data?.error || result.error.message);
            button.disabled = false;
          } else {
            alert(result.data?.message || "Access updated.");
            await manageAccess();
          }
        };
      });
    });
  }

  client.auth.onAuthStateChange(async function (event) {
    if (event === "SIGNED_OUT") {
      lock();
      form.reset();
      showLogin();
      say("You have signed out.");
    }
  });

  client.auth.getSession().then(async ({ data, error }) => {
    if (error) { lock(); say(error.message, "#ffaaa4"); return; }
    if (data.session) {
      try { await verifyAccess(); }
      catch (e) { await client.auth.signOut(); say(e.message, "#ffaaa4"); }
    } else lock();
  });
})();