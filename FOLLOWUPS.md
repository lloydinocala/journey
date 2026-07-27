# Journey-HVAC — Follow-ups to discuss

Running list of items parked for a decision or a later build phase. Newest first.

## Employee file — a per-employee record of jobs + tasks (with optional self-access)
**Raised:** 2026-07-27 · **Status:** idea, to scope

Lloyd's idea: an "employee file" that works like a customer file, but for a team
member — one place that lists **all of that employee's jobs and tasks/errands as
a record** (what they did, when, time worked, outcome). The employee could be
**granted access to their own file** for peace of mind.

Guiding principle (Lloyd's words): protect the business first, but do so with
**full, just, and fair treatment of every employee as a priority — this is a
people business.** So the record should be accurate and complete enough to
protect the company (documentation, time, completion, GPS at button presses),
while also being something an employee is comfortable seeing about themselves.

Building blocks that already exist to feed this:
- Tasks now capture Start/Stop times + GPS snapshots + completion/Incomplete
  reason, and a per-employee task-pay summary.
- Jobs carry status history, assignments (job_technicians), invoices, approvals.
- Per-user pay rates now live on the user record (standard + task hourly).
- There is already an EmployeePayroll view and a "My Pay & Benefits" (/my)
  self-service portal — the employee-file self-access could extend that.

**To scope:** what the file shows (jobs, tasks, time, pay, docs, discipline?),
who can see it (office always; employee = read-only subset?), and how self-access
is gated (the /my portal vs. a new view). Likely a medium build; worth a design
pass before starting.

**Where it lives (Lloyd, 2026-07-27):** build this in the **HR section**
(Rewards-HVAC · People / HR module), later — not now.

## Phone privacy — techs' personal numbers exposed on calls
**Raised:** 2026-07-27 · **Status:** open, needs decision

Today the job card "Call" button is a plain device `tel:` link, so a technician
calling a customer places the call from their **own personal cell number and
carrier**. The customer sees the tech's private number, can call/text it back
directly, and it lives on their phone after the job — no company number in the
middle.

Texting is on a separate, not-yet-live path: in-app messages stored per job and
archived to the office, with real outbound SMS pending A2P 10DLC approval on a
business number (provider TBD, e.g. Twilio).

**The concern:** keep technicians' personal numbers private, so all customer
contact (calls *and* texts) runs through one company business number.

**What that takes:**
- A single business number *can* do both SMS and voice if provisioned that way
  (e.g. a Twilio local number with both capabilities). A2P 10DLC covers the
  messaging side only; voice is a separate capability on the same number.
- Making calls actually route through the business number requires building
  voice handling (masked/proxy calling or forwarding) — it does not come for
  free once the number can text.
- Suggested sequencing: get the A2P texting number approved and live first,
  then add the calling/voice piece as its own step on the same number.

**Decision needed:** confirm the "one company number, personal numbers hidden"
goal, then scope the voice piece (masked calling vs. simple forwarding, call
recording y/n, after-hours routing).
