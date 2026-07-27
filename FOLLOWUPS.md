# Journey-HVAC — Follow-ups to discuss

Running list of items parked for a decision or a later build phase. Newest first.

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
