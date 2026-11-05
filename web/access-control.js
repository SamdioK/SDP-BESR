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

  const ROLE_WORKSPACES = {
    situation_room_admin: {
      title: "Situation Room Administrator",
      description: "Coordinate situation room operations, review activity and oversee authorised escalation.",
      modules: ["Command overview", "Incident coordination", "Operational reporting", "Notifications", "Activity review"]
    },
    camera_admin: {
      title: "Camera Administrator",
      description: "Manage authorised camera inventory, assignments and device status.",
      modules: ["Camera inventory", "Device assignments", "Camera health", "Camera audit"]
    },
    camera_operator: {
      title: "Camera Operator",
      description: "Operate only assigned cameras under approved privacy procedures.",
      modules: ["Assigned cameras", "Connection status", "Incident references"]
    },
    lga_coordinator: {
      title: "LGA Coordinator",
      description: "Coordinate authorised field activity within your assigned LGA.",
      modules: ["LGA overview", "Ward coordination", "Field reports", "Incident escalation"]
    },
    ward_officer: {
      title: "Ward Officer",
      description: "Coordinate authorised reporting within your assigned ward.",
      modules: ["Ward overview", "Polling-unit directory", "Field reports", "Incident reporting"]
    },
    incident_verifier: {
      title: "Incident Verification Desk",
      description: "Review incident submissions and document verification decisions.",
      modules: ["Incident queue", "Verification checklist", "Evidence references", "Escalation history"]
    },
    evidence_officer: {
      title: "Evidence Management Desk",
      description: "Catalogue authorised evidence and maintain traceable handling records.",
      modules: ["Evidence register", "Case references", "Chain of custody", "Evidence audit"]
    },
    legal_officer: {
      title: "Legal and Compliance Desk",
      description: "Review legal and compliance issues and support statement clearance.",
      modules: ["Compliance matters", "Statement review", "Legal guidance", "Decision records"]
    },
    read_only: {
      title: "Read-only Monitoring Workspace",
      description: "View only information authorised for your geographical assignment.",
      modules: ["Situation summary", "Permitted reports", "Notifications"]
    }
  };

  function renderRoleWorkspace(access) {
    const config = ROLE_WORKSPACES[access.role];
    const overview = document.getElementById("view-overview");

    if (!config || !overview) return;

    const scopes = {
      state: "Benue State (Statewide)",
      lga: access.scope_value || "Assigned LGA",
      ward: access.scope_value || "Assigned Ward",
      polling_unit: access.scope_value || "Assigned Polling Unit"
    };

    let panel = document.getElementById("sdpRoleWorkspace");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "sdpRoleWorkspace";
      panel.style.cssText =
        "margin-bottom:16px;padding:20px;border:1px solid #8755a8;border-radius:12px;background:linear-gradient(120deg,#173d38,#302447)";
      overview.prepend(panel);
    }

    panel.innerHTML = `
      <div style="font-size:9px;letter-spacing:2px;color:#dfc5f4;font-weight:800">
        AUTHORISED ROLE WORKSPACE
      </div>

      <h1 style="font-size:23px;margin:10px 0;color:white">
        ${escapeHtml(config.title)}
      </h1>

      <p style="font-size:11px;line-height:1.6;color:#c4d8ce">
        ${escapeHtml(config.description)}
      </p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
        <span class="election-scope">
          ROLE: ${escapeHtml(access.role.replaceAll("_"," ").toUpperCase())}
        </span>
        <span class="election-scope">
          SCOPE: ${escapeHtml(scopes[access.scope_type] || "Unspecified")}
        </span>
        <span class="election-scope">ACCOUNT: ACTIVE</span>
      </div>

      <h3 style="font-size:11px;color:#f0c17c">WORKSPACE MODULES</h3>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px">
        ${config.modules.map(module => `
          <div style="padding:12px;border:1px solid #456b60;border-radius:8px;background:#092d28">
            <b style="font-size:10px;color:#e5f1e9">
              ${escapeHtml(module)}
            </b>
            <div style="font-size:8px;color:#e5bd68;margin-top:7px">
              MODULE INTEGRATION PENDING
            </div>
          </div>
        `).join("")}
      </div>

      <p style="font-size:9px;line-height:1.6;color:#e8c89f;margin-top:15px">
        Your account is active. Operational actions will be enabled after
        module permissions, database policies and server-side geographical
        restrictions have been implemented and tested.
      </p>
    `;

    // Hide modules until their permissions are implemented.
    document.querySelectorAll(".sidebar .nav [data-page]").forEach(button => {
      button.hidden = true;
    });

    document.querySelectorAll(".sidebar .nav-label").forEach(label => {
      label.textContent = "Authorised workspace";
    });

    const workspaceName =
      document.querySelector(".sidebar .workspace strong");

    if (workspaceName) workspaceName.textContent = config.title;

    const title = document.getElementById("topTitle");
    if (title) title.textContent = config.title;

    const avatar = document.querySelector(".topbar .avatar");

    if (avatar) {
      avatar.textContent = access.role
        .split("_")
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
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

    if (!ROLE_WORKSPACES[access.role]) {
      await client.auth.signOut({ scope: "local" });
      say("Your account has an unrecognised operational role. Contact the platform administrator.", "#ffaaa4");
      return;
    }

    gate.style.display = "none";
    app.style.visibility = "visible";

    renderRoleWorkspace(access);

    say("Access verified. Opening your authorised role workspace.", "#9ce0bd");
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

    // Load the complete verified Benue geographical directory.
    // Supabase returns a limited number of rows per request,
    // so retrieve the directory in batches.

    let geographyRows = [];
    let geographyLoadError = null;

    try {
      const PAGE_SIZE = 1000;
      let offset = 0;
      let keepLoading = true;

      while (keepLoading) {
        const { data: geo, error: geoError } = await client
          .from("benue_polling_units")
          .select(
            "lga_name,ward_code,ward_name,full_code,pu_name,pu_code"
          )
          .eq("verification_status", "verified")
          .order("lga_name", { ascending: true })
          .order("ward_code", { ascending: true })
          .order("pu_code", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (geoError) throw geoError;

        const batch = geo || [];

        geographyRows.push(...batch);

        if (batch.length < PAGE_SIZE) {
          keepLoading = false;
        } else {
          offset += PAGE_SIZE;
        }
      }

      console.log(
        "Complete verified geographical directory loaded:",
        geographyRows.length,
        "polling-unit records"
      );

      if (!geographyRows.length) {
        throw new Error(
          "No verified polling-unit records were returned."
        );
      }

    } catch (geoError) {
      geographyLoadError = geoError;
      console.error(
        "Geographical directory loading failed:",
        geoError
      );
    }

    rows.innerHTML = users.map(u => `
      <article style="border:1px solid #32665b;border-radius:9px;padding:12px;margin:8px 0;background:#0c302c">
        <b>${escapeHtml(u.full_name || "Name not supplied")}</b>
        <div style="font-size:10px;color:#a6c0b6;margin:4px 0 9px">${escapeHtml(u.email || "")} · ${escapeHtml(u.account_status)} · ${escapeHtml(u.role || "No role")}</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
          <select data-role style="padding:8px;background:#092d28;color:white;border:1px solid #39695e;border-radius:6px">
            <option value="situation_room_admin">Situation Room Admin</option><option value="camera_admin">Camera Admin</option><option value="camera_operator">Camera Operator</option><option value="lga_coordinator">LGA Coordinator</option><option value="ward_officer">Ward Officer</option><option value="incident_verifier">Incident Verifier</option><option value="evidence_officer">Evidence Officer</option><option value="legal_officer">Legal Officer</option><option value="read_only">Read Only</option>
          </select>
          <select data-scope style="padding:8px;background:#092d28;color:white;border:1px solid #39695e;border-radius:6px"><option value="state">Statewide</option><option value="lga">LGA</option><option value="ward">Ward</option><option value="polling_unit">Polling Unit</option></select>
          <div data-geography style="display:flex;gap:7px;flex-wrap:wrap">
            <select data-lga disabled><option value="">Loading LGAs...</option></select>
            <select data-ward disabled><option value="">Select ward</option></select>
            <select data-pu disabled><option value="">Select polling unit</option></select>
          </div>
          <button data-action="approve" class="primary">Approve</button>
          <button data-action="suspend" class="secondary">Suspend</button>
          <button data-action="reinstate" class="secondary">Reinstate</button>
        </div>
      </article>`).join("");

    rows.querySelectorAll("article").forEach((card, index) => {
      const user = users[index];
      const scopeSelect = card.querySelector("[data-scope]");
      const lgaSelect = card.querySelector("[data-lga]");
      const wardSelect = card.querySelector("[data-ward]");
      const puSelect = card.querySelector("[data-pu]");
      const lgas = [...new Set(geographyRows.map(x => x.lga_name).filter(Boolean))];
      lgaSelect.innerHTML = '<option value="">Select LGA</option>' +
        lgas.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
      lgaSelect.disabled = false;

      function fillWards() {
        const found = new Map();
        geographyRows.filter(x => x.lga_name === lgaSelect.value).forEach(x => {
          found.set(String(x.ward_code), x.ward_name);
        });
        wardSelect.innerHTML = '<option value="">Select ward</option>' +
          [...found].map(([code,name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)} (${escapeHtml(code)})</option>`).join("");
        wardSelect.disabled = !lgaSelect.value;
        puSelect.innerHTML = '<option value="">Select polling unit</option>';
        puSelect.disabled = true;
      }
      function fillPollingUnits() {
        const units = geographyRows.filter(x =>
          x.lga_name === lgaSelect.value && String(x.ward_code) === wardSelect.value);
        puSelect.innerHTML = '<option value="">Select polling unit</option>' +
          units.map(x => `<option value="${escapeHtml(x.full_code)}">${escapeHtml(x.pu_name || x.pu_code || x.full_code)} — ${escapeHtml(x.full_code)}</option>`).join("");
        puSelect.disabled = !wardSelect.value;
      }
      lgaSelect.addEventListener("change", fillWards);
      wardSelect.addEventListener("change", fillPollingUnits);
      scopeSelect.addEventListener("change", () => {
        const state = scopeSelect.value === "state";
        lgaSelect.hidden = wardSelect.hidden = puSelect.hidden = state;
        if (state) { lgaSelect.value = ""; fillWards(); }
      });
      scopeSelect.dispatchEvent(new Event("change"));

      card.querySelectorAll("button[data-action]").forEach(button => {
        button.onclick = async () => {
          const action = button.dataset.action;
          const role = card.querySelector("[data-role]").value;
          const scope_type = scopeSelect.value;
          const lga_name = lgaSelect.value;
          const ward_code = wardSelect.value;
          const full_code = puSelect.value;
          let scope_value = "";
          if (scope_type === "lga") scope_value = lga_name;
          if (scope_type === "ward") scope_value = lga_name && ward_code ? `${lga_name}|${ward_code}` : "";
          if (scope_type === "polling_unit") scope_value = full_code;
          if (action === "approve" && scope_type !== "state" && !scope_value) {
            alert("Select the required geography from the verified directory.");
            return;
          }
          if (action === "suspend" && !window.confirm("Suspend this account?")) return;
          button.disabled = true;
          const result = await client.functions.invoke("sdp-access-admin", {
            body: { action, user_id: user.user_id, role, scope_type, scope_value, lga_name, ward_code, full_code }
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
