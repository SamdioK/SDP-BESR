# SDP-BESR Operational Manual
## Module 04 — Election Management

**System:** Social Democratic Party (SDP) Benue State Election Situation Room  
**Module:** Election Management  
**Interface baseline:** v0.2.6 + Election Management Phase 1  
**Audience:** System administrators, authorised election configuration officers, trainers and trainees

## 1. Purpose

Election Management establishes the electoral structure used by the Situation Room. It maintains election cycles, election contests, participating political parties and candidates. Other modules will later use these records to associate field reports, incidents, deployment records and results with the correct election.

This module is a configuration workspace. It is not the place for entering polling-unit results or incident reports.

## 2. Access and security

- Sign in through the existing SDP-BESR administrator authentication gate.
- Only accounts authorised by the existing `is_gps_admin()` function can access the configuration tables.
- Database Row Level Security (RLS) is enabled on the module tables.
- Draft records must not be treated as official or approved records.
- Publication actions are recorded in `election_configuration_audit`.
- Never share administrator credentials or Supabase secret/service-role keys.

## 3. Module sections

### 3.1 Election cycles

An election cycle groups the elections taking place within a defined electoral period.

To create a cycle:
1. Open **Election Management** from the dashboard navigation.
2. Select **Election cycles**.
3. Select **Add election cycle**.
4. Enter the cycle name and election year.
5. Confirm the state and country.
6. Add a commencement date if officially known.
7. Add the official INEC reference URL and administrative notes where available.
8. Select **Save election cycle**.

New cycles are saved as **Draft**. A cycle should only be published after its details have been checked.

### 3.2 Election contests

A contest represents a specific electoral position and its constituency or district.

Supported categories:
- Governorship
- Senatorial
- Federal House of Representatives
- State House of Assembly
- Other (where formally approved for use)

To create a contest:
1. Create the relevant election cycle first.
2. Open **Contests** and select **Add contest**.
3. Select the election cycle.
4. Select the contest category.
5. Enter a clear contest title.
6. Enter the constituency or district where applicable.
7. Enter an election date only when supported by an official announcement.
8. Add the official reference and notes.
9. Save the contest as a draft.

Do not invent constituency names, boundaries or election dates. Confirm them against current INEC records.

### 3.3 Political parties

To register a party:
1. Open **Political parties**.
2. Select **Add political party**.
3. Enter the full party name and abbreviation.
4. Optionally enter the official colour and logo URL.
5. Select the registration status based on the available verification.
6. Add any official reference or notes.
7. Save the record.

Party names and abbreviations must be checked for duplicates and spelling accuracy.

### 3.4 Candidates

To register a candidate:
1. Ensure the relevant contest exists.
2. Ensure the political party has been registered.
3. Open **Candidates** and select **Add candidate**.
4. Select the correct contest and party.
5. Enter the candidate's full name.
6. Enter a running mate only where applicable.
7. Add a photograph URL and nomination reference if available.
8. Select the candidate status.
9. Save the record.

The module links a candidate to one party and one contest. It prevents the same party from being assigned two candidate records for the same contest.

## 4. Publishing configuration

The Publish action is available for draft election cycles and contests.

Before publishing:
- Confirm the election cycle name and year.
- Check official election dates and references.
- Verify the contest category and constituency.
- Confirm the record is not a duplicate.
- Obtain the required internal authorisation.

Publishing a cycle changes its status to **Upcoming**. Publishing a contest changes its status to **Published**. The action records the approving administrator and publication timestamp.

## 5. Status definitions

| Status | Meaning |
|---|---|
| Draft | Saved but not approved for operational use |
| Upcoming | Published election cycle awaiting its active period |
| Active | Election cycle currently in operation |
| Published | Contest configuration approved for use |
| Suspended | Contest temporarily suspended |
| Completed | Election or contest has concluded |
| Archived | Retained for historical reference |
| Pending verification | Party record requires confirmation |
| Nominated | Candidate recorded as nominated |
| Withdrawn | Candidate withdrawal recorded |
| Disqualified | Candidate disqualification recorded |

## 6. Troubleshooting

**“Election configuration could not be loaded.”**
- Confirm the SQL migration has been applied to the correct Supabase project.
- Confirm the user is signed in.
- Confirm the administrator permission function returns true.
- Check the browser console and Supabase logs for the underlying error.

**“Create an election cycle before adding contests.”**
- Create and save an election cycle first.

**“Create at least one contest and one political party before registering candidates.”**
- Add the required contest and party records first.

**Duplicate record error**
- Search the existing list before creating a duplicate party abbreviation, party name, cycle or candidate/contest pairing.

**Permission denied**
- Do not bypass RLS. Ask the authorised system administrator to review the account's administrator status and database policies.

## 7. Trainer practical exercise

Ask trainees to demonstrate the following in a training environment using clearly labelled test data:
1. Create a draft election cycle.
2. Create one draft contest linked to that cycle.
3. Register a test political party.
4. Register a test candidate linked to the contest and party.
5. Explain why a draft must not be treated as an official record.
6. Identify the audit trail and explain what it records.

Do not enter fabricated candidate or party information into the live operational database.

## 8. Known phase boundary

This release provides initial create, read and publish workflows. Editing, archival workflows, bulk import, verified electoral geography linking, candidate document review, role-specific approval and integration with downstream monitoring/results modules are subsequent controlled enhancements.

## 9. Completion checklist

- [ ] Migration applied to the correct Supabase project.
- [ ] RLS and administrator policies tested.
- [ ] Cycle creation tested.
- [ ] Contest creation tested.
- [ ] Party registration tested.
- [ ] Candidate registration tested.
- [ ] Publication and audit trail tested.
- [ ] Mobile layout checked.
- [ ] Trainer and trainee exercise completed.
