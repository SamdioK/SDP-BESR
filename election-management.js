/* SDP-BESR Election Management
 * Frontend controller for the existing authenticated Supabase client.
 * Requires window.sdpSupabase and the Election Management DOM section.
 */
(() => {
  "use strict";
  const client = window.sdpSupabase;
  const root = document.getElementById("view-elections");
  if (!root) return;

  const state = { tab: "cycles", cycles: [], contests: [], parties: [], candidates: [], user: null };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const notice = (message, type = "ok") => {
    const el = $("emNotice");
    el.textContent = message;
    el.className = `em-notice show ${type}`;
  };
  const clearNotice = () => {
    const el = $("emNotice");
    el.textContent = "";
    el.className = "em-notice";
  };
  const dateText = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB") : "Not set";
  const status = value => `<span class="em-status ${esc(value).toLowerCase()}">${esc(value || "draft")}</span>`;
  const setLoading = message => $("emContent").innerHTML = `<div class="em-loading">${esc(message)}</div>`;

  if (!client) {
    setLoading("Secure database connection is unavailable. Reload the page after administrator sign-in.");
    return;
  }

  const tabs = {
    cycles: { title: "Election cycles", hint: "Create and manage electoral cycles.", button: "＋ Add election cycle" },
    contests: { title: "Election contests", hint: "Define the positions and constituencies being contested.", button: "＋ Add contest" },
    parties: { title: "Political parties", hint: "Maintain participating political-party records.", button: "＋ Add political party" },
    candidates: { title: "Candidates", hint: "Register candidates against the correct election contest and party.", button: "＋ Add candidate" }
  };

  async function loadAll() {
    clearNotice();
    setLoading("Loading election configuration from the SDP-BESR database…");
    try {
      const [cycles, contests, parties, candidates, user] = await Promise.all([
        client.from("election_cycles").select("*").order("created_at", { ascending: false }),
        client.from("election_contests").select("*, election_cycles(name, election_year)").order("created_at", { ascending: false }),
        client.from("political_parties").select("*").order("party_name"),
        client.from("election_candidates").select("*, election_contests(title, contest_type), political_parties(party_name, abbreviation)").order("created_at", { ascending: false }),
        client.auth.getUser()
      ]);
      for (const result of [cycles, contests, parties, candidates]) {
        if (result.error) throw result.error;
      }
      state.cycles = cycles.data || [];
      state.contests = contests.data || [];
      state.parties = parties.data || [];
      state.candidates = candidates.data || [];
      state.user = user.data?.user || null;
      render();
    } catch (error) {
      setLoading("Election configuration could not be loaded.");
      notice(`${error.message || "Database request failed"} — confirm that the Election Management SQL migration has been applied and your account has administrator access.`, "err");
    }
  }

  function render() {
    $("emCycleCount").textContent = state.cycles.length;
    $("emContestCount").textContent = state.contests.length;
    $("emPartyCount").textContent = state.parties.length;
    $("emCandidateCount").textContent = state.candidates.length;
    const config = tabs[state.tab];
    $("emSectionTitle").textContent = config.title;
    $("emSectionHint").textContent = config.hint;
    $("emCreate").textContent = config.button;
    $("emAddRecord").textContent = config.button;
    document.querySelectorAll("[data-em-tab]").forEach(b => b.classList.toggle("active", b.dataset.emTab === state.tab));

    const rows = {
      cycles: state.cycles.map(x => `<tr>
        <td><b>${esc(x.name)}</b><div class="em-muted">${esc(x.state_name)}, ${esc(x.country)}</div></td>
        <td>${esc(x.election_year)}</td><td>${dateText(x.commencement_date)}</td>
        <td>${status(x.status)}</td><td><div class="em-actions">${x.status === "draft" ? `<button class="em-action publish" data-em-publish="cycle" data-id="${x.id}">Publish</button>` : ""}</div></td>
      </tr>`),
      contests: state.contests.map(x => `<tr>
        <td><b>${esc(x.title)}</b><div class="em-muted">${esc(x.contest_type)}</div></td>
        <td>${esc(x.constituency_name || "Statewide / not specified")}</td>
        <td>${esc(x.election_cycles?.name || "Cycle unavailable")}</td><td>${dateText(x.election_date)}</td>
        <td>${status(x.status)}</td><td><div class="em-actions">${x.status === "draft" ? `<button class="em-action publish" data-em-publish="contest" data-id="${x.id}">Publish</button>` : ""}</div></td>
      </tr>`),
      parties: state.parties.map(x => `<tr>
        <td><b>${esc(x.party_name)}</b></td><td>${esc(x.abbreviation)}</td>
        <td>${esc(x.official_colour || "Not recorded")}</td><td>${status(x.registration_status)}</td>
      </tr>`),
      candidates: state.candidates.map(x => `<tr>
        <td><b>${esc(x.candidate_name)}</b><div class="em-muted">${esc(x.running_mate || "")}</div></td>
        <td>${esc(x.political_parties?.abbreviation || "Party not linked")} · ${esc(x.political_parties?.party_name || "")}</td>
        <td>${esc(x.election_contests?.title || "Contest unavailable")}</td><td>${status(x.candidate_status)}</td>
      </tr>`)
    };
    const headers = {
      cycles: ["Election cycle", "Year", "Commencement", "Status", "Actions"],
      contests: ["Contest", "Constituency", "Election cycle", "Election date", "Status", "Actions"],
      parties: ["Political party", "Abbreviation", "Official colour", "Registration status"],
      candidates: ["Candidate", "Political party", "Contest", "Candidate status"]
    };
    const data = rows[state.tab];
    $("emContent").innerHTML = data.length
      ? `<div class="em-table-wrap"><table class="em-table"><thead><tr>${headers[state.tab].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${data.join("")}</tbody></table></div>`
      : `<div class="em-empty">▤<b>No ${esc(state.tab)} have been configured</b>Use “${esc(config.button)}” to create the first record. Saved records will appear here.</div>`;
  }

  function field(label, name, type = "text", required = false, options = null, full = false, help = "") {
    const req = required ? "required" : "";
    let control = "";
    if (type === "select") {
      control = `<select name="${name}" ${req}><option value="">Select ${label.toLowerCase()}</option>${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select>`;
    } else if (type === "textarea") {
      control = `<textarea name="${name}" ${req}></textarea>`;
    } else {
      control = `<input type="${type}" name="${name}" ${req}>`;
    }
    return `<div class="em-field ${full ? "full" : ""}"><label>${label}${required ? " *" : ""}</label>${control}${help ? `<small class="em-help">${help}</small>` : ""}</div>`;
  }

  function openForm(kind) {
    const cycleOptions = state.cycles.map(x => ({ value: x.id, label: `${x.name} (${x.election_year})` }));
    const contestOptions = state.contests.map(x => ({ value: x.id, label: x.title }));
    const partyOptions = state.parties.map(x => ({ value: x.id, label: `${x.party_name} (${x.abbreviation})` }));
    const types = [
      {value:"governorship",label:"Governorship"},
      {value:"senatorial",label:"Senatorial"},
      {value:"federal_constituency",label:"Federal House of Representatives"},
      {value:"state_assembly",label:"State House of Assembly"},
      {value:"other",label:"Other"}
    ];
    const forms = {
      cycles: {
        title:"Create election cycle", button:"Save election cycle",
        fields: field("Election cycle name","name","text",true) +
          field("Election year","election_year","number",true) +
          field("Commencement date","commencement_date","date") +
          field("State","state_name","text",true) +
          field("Country","country","text",true) +
          field("Official INEC reference URL","official_inec_reference_url","url",false,null,true) +
          field("Administrative notes","notes","textarea",false,null,true)
      },
      contests: {
        title:"Create election contest", button:"Save contest",
        fields: field("Election cycle","cycle_id","select",true,cycleOptions,true) +
          field("Contest category","contest_type","select",true,types) +
          field("Contest title","title","text",true) +
          field("Constituency / district name","constituency_name") +
          field("Election date","election_date","date") +
          field("Official INEC reference URL","official_inec_reference_url","url",false,null,true) +
          field("Notes","notes","textarea",false,null,true)
      },
      parties: {
        title:"Register political party", button:"Save political party",
        fields: field("Political party name","party_name","text",true) +
          field("Abbreviation","abbreviation","text",true) +
          field("Official colour (optional)","official_colour") +
          field("Party logo URL (optional)","logo_url","url") +
          field("Registration status","registration_status","select",true,[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"},{value:"pending_verification",label:"Pending verification"}]) +
          field("Official reference / notes","notes","textarea",false,null,true)
      },
      candidates: {
        title:"Register candidate", button:"Save candidate",
        fields: field("Election contest","contest_id","select",true,contestOptions,true) +
          field("Political party","party_id","select",true,partyOptions) +
          field("Candidate full name","candidate_name","text",true) +
          field("Running mate (where applicable)","running_mate") +
          field("Candidate photograph URL (optional)","photo_url","url") +
          field("Nomination / verification reference","nomination_reference") +
          field("Candidate status","candidate_status","select",true,[{value:"draft",label:"Draft"},{value:"nominated",label:"Nominated"},{value:"withdrawn",label:"Withdrawn"},{value:"disqualified",label:"Disqualified"}]) +
          field("Notes","notes","textarea",false,null,true)
      }
    };
    if (kind === "contests" && !cycleOptions.length) return notice("Create an election cycle before adding contests.", "err");
    if (kind === "candidates" && (!contestOptions.length || !partyOptions.length)) return notice("Create at least one contest and one political party before registering candidates.", "err");
    const form = forms[kind];
    $("emModalTitle").textContent = form.title;
    $("emSave").textContent = form.button;
    $("emFormBody").innerHTML = `<div class="em-form-grid">${form.fields}<div class="em-field full"><small class="em-help">New records are saved as drafts where applicable. Verify all details against official records before publication.</small></div></div>`;
    $("emModal").classList.add("open");
    $("emModal").setAttribute("aria-hidden","false");
    $("emForm").dataset.kind = kind;
  }

  function closeForm() {
    $("emModal").classList.remove("open");
    $("emModal").setAttribute("aria-hidden","true");
    $("emForm").reset();
  }

  async function submitForm(event) {
    event.preventDefault();
    const kind = $("emForm").dataset.kind;
    const formData = Object.fromEntries(new FormData($("emForm")).entries());
    const table = {cycles:"election_cycles",contests:"election_contests",parties:"political_parties",candidates:"election_candidates"}[kind];
    const payload = {...formData, created_by: state.user?.id || null};
    if (kind === "cycles") {
      payload.election_year = Number(payload.election_year);
      payload.status = "draft";
      payload.state_name = payload.state_name.trim();
      payload.country = payload.country.trim();
    }
    if (kind === "contests") payload.status = "draft";
    try {
      $("emSave").disabled = true;
      $("emSave").textContent = "Saving…";
      const { data, error } = await client.from(table).insert(payload).select("id").single();
      if (error) throw error;
      if (kind === "candidates") {
        const link = await client.from("election_contest_parties").upsert(
          { contest_id: payload.contest_id, party_id: payload.party_id, created_by: state.user?.id || null },
          { onConflict: "contest_id,party_id" }
        );
        if (link.error) throw link.error;
      }
      closeForm();
      notice(`${formsLabel(kind)} saved successfully. Record ID: ${data.id}`, "ok");
      await loadAll();
      notice(`${formsLabel(kind)} saved successfully.`, "ok");
    } catch (error) {
      notice(error.message || "The record could not be saved.", "err");
    } finally {
      $("emSave").disabled = false;
      $("emSave").textContent = formsLabel(kind);
    }
  }
  function formsLabel(kind) {
    return ({cycles:"Save election cycle",contests:"Save contest",parties:"Save political party",candidates:"Save candidate"})[kind] || "Save";
  }

  async function publish(kind, id) {
    const table = kind === "cycle" ? "election_cycles" : "election_contests";
    const nextStatus = kind === "cycle" ? "upcoming" : "published";
    const promptText = kind === "cycle"
      ? "Publish this election cycle as Upcoming? Confirm that its details have been checked."
      : "Publish this contest? Confirm the contest and constituency details against official records.";
    if (!window.confirm(promptText)) return;
    try {
      const { error } = await client.from(table).update({
        status: nextStatus,
        published_at: new Date().toISOString(),
        approved_by: state.user?.id || null
      }).eq("id", id);
      if (error) throw error;
      notice("Configuration published. The action has been recorded.", "ok");
      await loadAll();
    } catch (error) {
      notice(error.message || "Publication failed.", "err");
    }
  }

  document.querySelectorAll("[data-em-tab]").forEach(button => button.addEventListener("click", () => {
    state.tab = button.dataset.emTab; clearNotice(); render();
  }));
  $("emCreate").addEventListener("click", () => openForm(state.tab));
  $("emAddRecord").addEventListener("click", () => openForm(state.tab));
  $("emClose").addEventListener("click", closeForm);
  $("emCancel").addEventListener("click", closeForm);
  $("emModal").addEventListener("click", e => { if (e.target === $("emModal")) closeForm(); });
  $("emForm").addEventListener("submit", submitForm);
  $("emContent").addEventListener("click", e => {
    const button = e.target.closest("[data-em-publish]");
    if (button) publish(button.dataset.emPublish, button.dataset.id);
  });
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") loadAll();
    if (event === "SIGNED_OUT") {
      state.cycles = []; state.contests = []; state.parties = []; state.candidates = [];
      setLoading("Sign in with an authorised administrator account to view election configuration.");
    }
  });
  client.auth.getSession().then(({ data }) => {
    if (data?.session) loadAll();
    else setLoading("Sign in with an authorised administrator account to view election configuration.");
  });
})();
