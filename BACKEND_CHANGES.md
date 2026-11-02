# SacraDigit backend prompt

Paste this whole file into Claude Code in the repository that holds `amplify/`. It is also the reference for every backend change the frontend expects.

---

You are updating the AWS Amplify Gen 2 backend of SacraDigit, the parish management system of Our Lady of Fatima Parish. The frontend lives in another repository (branch `feature/parish-requirements`) and is already written against this spec. Implement exactly what is below, and do not rename any model, field, mutation, query or status: the frontend checks for these exact names.

Read `amplify/data/resource.ts`, `amplify/auth/resource.ts`, `amplify/storage/resource.ts` and `amplify/functions/` first, and match how the existing functions (`setServerRole`, `notifyParishioner`, `takenSlots`, `donationTotals`) are built.

## Rules for this work

- Work on a new branch. Do not deploy to production, and do not delete or rewrite any data, unless the user says so.
- Keep every existing field. All new fields are optional, so existing rows stay valid.
- Do this in the two stages below, and stop after Stage A. **Stage B must wait** until the frontend has the new `amplify_outputs.json` live, or parishioners will lose the ability to save anything.
- Run the type check and `npx ampx sandbox` validation after each stage. Report anything you could not test.

## Why two stages

The frontend looks at `amplify_outputs.json` to see what exists. A mutation it can't see isn't used, so it keeps writing directly to the models. Stage A adds things and changes no one's access. Stage B removes direct writes.

## How the mutations reply

Every custom mutation below uses this shape, like `setServerRole`:

- Authorization: `allow.authenticated()`.
- Returns `a.json()`: `{ "success": true, "data": <the saved row> }` or `{ "success": false, "error": "<a sentence for the parishioner>" }`.
- Never trust names, status or amounts from the browser when the server can work them out. Take the caller's identity from the event.
- Rows a Lambda creates for a parishioner must set `owner` to `<sub>::<username>`, the format Amplify writes, or the person can't read their own row.
- Grant each function access with `allow.resource(fn)` on the schema.
- Read parish rules from the single `ParishSettings` row, merged over these defaults: `freeCancelDays` 3, `serverSignupCloseDays` 3, `fees.massIntentionMin` 50, `fees.blessingMin` 200.

---

# Stage A: add, without changing access

## A1. New models

```ts
ParishSettings: a.model({
  settings: a.json().required(),   // address, pin, fees, time limits, distance bands, refund terms
  updatedByName: a.string(),
}).authorization((allow) => [
  allow.publicApiKey().to(['read']),   // the homepage shows the fees
  allow.authenticated().to(['read']),
  allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
]),

PaymentRecord: a.model({
  requestType: a.string().required(),  // 'Service' | 'Mass Intention' | 'Donation'
  requestId: a.string().required(),
  payerName: a.string().required(),
  amount: a.float().required(),
  method: a.string(),
  referenceNumber: a.string(),         // empty for bank and cash gifts
  status: a.string().required(),       // 'submitted' | 'verified' | 'rejected'
  verifiedBy: a.string(),
  verifiedAt: a.datetime(),
  note: a.string(),                    // for Mass intentions: the record ids, comma separated
}).authorization((allow) => [
  allow.owner().to(['create', 'read']),
  allow.groups(['admin', 'staff']).to(['create', 'read', 'update']),
  allow.groups(['admin']).to(['delete']),
  allow.groups(['itech']).to(['read']),
]),

ConsentRecord: a.model({
  subjectKey: a.string().required(),   // the account's sub
  purpose: a.string().required(),      // 'sign-up' | 'parish-server' | 'profile' | 'service-request'
  version: a.string().required(),
  acceptedAt: a.datetime().required(),
}).authorization((allow) => [
  allow.owner().to(['create', 'read']),
  allow.groups(['admin']).to(['read']),
]),

MinistryCancellation: a.model({
  ministry: a.string().required(),
  massDate: a.date().required(),
  massTime: a.string().required(),
  volunteerId: a.string().required(),
  volunteerName: a.string(),
  reason: a.string().required(),
  emergency: a.boolean(),
}).authorization((allow) => [
  allow.owner().to(['create', 'read']),
  allow.groups(['admin', 'staff']).to(['read', 'delete']),
  allow.groups(['itech']).to(['read']),
]),
```

## A2. New fields and access on existing models

Give `staff` `update` on `Donation` now, so the Secretary can verify payments as soon as the frontend turns them on.

```ts
// AccessLog
actorRole: a.string(), actorKey: a.string(),  // actorKey = the staff member's sub
targetType: a.string(), targetId: a.string(),
before: a.string(), after: a.string(),         // JSON

// ParishionerPreference: sensitive personal information under RA 10173
birthdate: a.date(), sex: a.string(), isPwd: a.boolean(), pwdType: a.string(), accommodations: a.string(),

// ServerApplication
conditions: a.json(),   // [{ q, a: 'yes' | 'no' }]
isFirstTime: a.boolean(),
// and make confirmWith optional: the form no longer asks. Older rows keep their value.

// Donation
status: a.string(),     // 'submitted' | 'verified' | 'rejected'; empty = older, counts as verified
referenceNumber: a.string(),

// DonationGoal
closedReason: a.string(),

// ParishRecord
birthdate: a.date(),    // used by verifyRecord
```

`Blessing.status` and `MassIntention.status` are free strings, so they need no schema change. They gain these values. `Blessing`: `temporary-approval`, `payment-submitted`, `void`, `cancelled`. `MassIntention`: `pending`.

## A3. Storage

In `amplify/storage/resource.ts`, follow the two-path pattern `avatars/` already uses:

```ts
'requirementUploads/{entity_id}/*': [allow.entity('identity').to(['read', 'write', 'delete'])],
'requirementUploads/*': [allow.groups(['admin', 'staff']).to(['read', 'list'])],
```

Do not reuse `certificateUploads/*`: any signed-in user can read it.

## A4. Mutations

**`createServiceRequest({ input: AWSJSON })`** creates a `Blessing` for the caller.
- `input` holds `requesterName, type, email, contact, notes, details, location, preferredDate, date, time`. Ignore any `status`.
- Always save `status: 'pending'`. The office approves everything a parishioner sends.
- Remove `details['Temporary Approval']` if present.
- Check the slot still has room, using the same count as `takenSlots`. For a public baptism (`details['Public Baptism Date Id']`), read that `Announcement` and check `media.baptism.capacity`, `closesOn` and that it isn't `cancelled`.
- Refuse a private Baptism on the date and time of an announced public date. The browser hides those slots.
- Blessings (`House Blessing`, `Vehicle / Item Blessing`, `Business Dedication`, `Pet Blessing`): refuse when `details['Offered Amount']` is below `fees.blessingMin`.
- `Wedding`: repeat the form's checks. Refuse unless the account's first and last name match `details["Groom's Full Name"]` or `details["Bride's Full Name"]`, both `{ firstName, middleName, lastName, extension }`. Refuse if `details["Groom's Birthdate"]` or `details["Bride's Birthdate"]` makes that person under 18 on the wedding date. Staff walk-ins don't use this mutation.

**`changeMyRequest({ id, action, date, time, reason, reminder })`**. The caller must own the row.
- `cancel`: allowed for `pending`, `temporary-approval`, `payment-submitted` and `scheduled`, and only when today is at least `freeCancelDays` before the date. Set `status: 'declined'` and `declineReason: 'Cancelled by the parishioner.'`, exactly, because the frontend reads that sentence.
- `reschedule`: keep the current status. Refuse when `details['Baptism Type']` is `Public`. Check room, set `preferredDate`, `date` and `time`, and write `reason` under `details['Reschedule Reason']` in the format of `detailsWithRescheduleReason` in the frontend's `shared/js/service-schedule.js`.
- `set-reminder`: set `details['Day-before reminder']` to `reminder`. Change nothing else.

**`submitServicePayment({ requestId, method, referenceNumber })`**. The caller must own the row, its status must be `temporary-approval`, and today must not be after `details['Temporary Approval'].deadline`. Take the amount from `details['Temporary Approval'].amount`, never from the browser. Create the `PaymentRecord` with `requestType: 'Service'`, `status: 'submitted'`, and set the request to `payment-submitted`. Return the updated `Blessing`.

**`submitDonation({ amount, method, purpose, date, anonymous, referenceNumber })`**. Refuse a `purpose` matching a `DonationGoal` with `active: false`. Take `donor` from the account. Create the `Donation` with `status: 'submitted'`, and a `PaymentRecord` with `requestType: 'Donation'`, `requestId` set to the donation's id. `referenceNumber` may be empty for bank and cash gifts. Return the `Donation`.

**`submitMassIntentions({ records: AWSJSON, amount, method, referenceNumber })`**. Each record holds `donor, email, type, names, massDate, offering`. Refuse when `amount` is below `fees.massIntentionMin`; the minimum is per intention, however many names it has. Create each row with `status: 'pending'`, then one `PaymentRecord` with `requestType: 'Mass Intention'`, `requestId` set to the first row's id, and `note` set to all the ids joined by commas.

**`submitServerApplication({ input: AWSJSON })`**. Save `status: 'pending'`, set `applicantKey` to the caller's sub, and drop any `reviewedBy`, `reviewedAt`, `validUntil` and `reason` sent.

**`volunteerForSlot({ ministry, massDate, massTime, massTitle, volunteerId, volunteerName, swapRequested })`**. Set `volunteerId` from the caller. Check that:
- the caller has a `ServerApplication` with `status: 'approved'`, `validUntil` not passed, and `ministry` matching the label: `lector` is `Lectors`, `choir` is `Choir`, `altar-server` is `Altar Servers`, `usher` is `Ushers`
- today is at least `serverSignupCloseDays` before the Mass
- the Mass has room: lector 2, choir 6, altar-server 3, usher 4
- the caller isn't already on that Mass in that ministry

**`takeOverSlot({ id })`**. The row's `swapRequested` must be true, the Mass must not have passed, and the caller must be approved for that ministry. Set `volunteerId` and `volunteerName` to the caller and `swapRequested` to false.

## A5. Queries

**`verifyRecord({ certificateType, fullName, birthdate, groomName, brideName, eventDate })`**, authenticated, returns `a.json()`.

- Marriage: `ParishRecord.fullName` holds `Groom Name & Bride Name`. Compare both names and `dateOfEvent`.
- Every other type: compare `fullName`, `dateOfEvent` and `birthdate`.
- Ignore case and extra spaces. Treat `Ma.` as `Maria` and a missing `ñ` as a match, because older entries contain these flaws.
- Any difference, or a record with no `birthdate`, returns `{ "match": false }`, with no hint about which field failed.
- On a match return only `{ match: true, recordId, fullName, dateOfEvent, officiant }`.
- Limit each account to 10 checks an hour, and write every check to `AccessLog`.

**Change these existing queries:**

- `takenSlots`: also return rows with `temporary-approval` and `payment-submitted`. Leave out `void` and `cancelled`.
- `donationTotals`, `faithfulGivers`: count only rows with no status or `status: 'verified'`.
- `communityIntentions`: skip `status: 'pending'`.

## A6. Scheduled function

```ts
export const voidUnpaid = defineFunction({ name: 'void-unpaid', schedule: 'every 1h' });
```

For each `Blessing` with `status: 'temporary-approval'` whose `details['Temporary Approval'].deadline` is before today in Asia/Manila: set `status: 'void'` and `declineReason: 'Payment was not received by the deadline.'`, then send the `cancelled` email.

## A7. `notifyParishioner`

- Accept `status: 'received'` from a parishioner, worded "We received your request." For this status only, allow `to` to be any address, and limit it to two sends per request, so the form can't mail strangers.
- Staff already use `approved` for temporary approval and for confirmation, `rescheduled` for a rejected payment, and `cancelled` for void. Show `detailsLines` and `declineReason` in those emails, because the amount and deadline are there.

**Stop here.** Report what changed. The user will copy the new `amplify_outputs.json` into the frontend repository, publish it, and tell you when to start Stage B.

---

# Stage B: tighten access

Start only when the user confirms that the frontend is live with the Stage A `amplify_outputs.json`.

## B1. Parishioners read, and the Lambdas write

| Model | Remove from the owner | Owner keeps | Why |
|---|---|---|---|
| `Blessing` | create, update, delete | read | Owners can set their own request to approved today |
| `Donation` | create, update, delete | read | A donor could mark their own gift verified |
| `MassIntention` | create, update, delete | read | Same |
| `PaymentRecord` | create | read | A payer could create a row already verified |
| `ServerApplication` | create | read, delete (withdrawing) | An applicant could create a row already approved |

Staff and admin group rules stay as they are, so walk-ins and approvals keep working.

## B2. `MinistrySignup`

```ts
allow.authenticated().to(['read']),
allow.ownerDefinedIn('volunteerId').identityClaim('sub').to(['read', 'update', 'delete']),
allow.groups(['admin', 'staff']).to(['create', 'read', 'update', 'delete']),
allow.groups(['itech']).to(['read']),
```

This replaces owner `create` and the authenticated `update`. Using `volunteerId` matters: a server who took over a slot, or was assigned by the office, must still be able to cancel it.

## B3. Unused owner access

Remove owner `update` from `CertificateRequest` and `FacilityBooking`; the frontend only creates and deletes these. Keep the rest.

## B4. `AccessLog`

```ts
allow.groups(['admin', 'staff', 'media', 'itech']).to(['create']),
allow.groups(['admin', 'itech']).to(['read']),
allow.ownerDefinedIn('actorKey').identityClaim('sub').to(['read']),
```

Keep it append-only: no `update` or `delete` for anyone. The last line is what limits a Secretary to their own entries. Parishioners stop being able to write to the log; the frontend logs only staff actions.

## B5. `ParishionerPreference`

Remove `itech` read, because the model now holds PWD and accommodation details. IT's Data Backup page doesn't use this model.

---

# No backend work needed

These frontend features are stored in existing fields, so don't add anything for them:

- Public baptism dates: `Announcement` with `audience: 'Public Baptism'` and `media.kind: 'public-baptism'`
- Call for Help and announcement review: `Announcement.media` (`kind`, `review`)
- Assigned priest, baptism type, uploads list, distance fee, age-based documents, temporary approval: `Blessing.details`
- Requirements & Rules, Statistics, Payment Reports, Roles & Access, color palettes and date formats

# Report when finished

For each stage list what changed, what you tested, and anything skipped.

# Known limits, on purpose

Do not try to fix these unless asked; each would need frontend changes.

- **Announcement review** runs in the browser. Banns and public baptism dates publish directly through the same `Announcement.update`, so `published` can't be locked to a mutation yet.
- **`CertificateRequest` and `FacilityBooking`:** an owner can still create a row with any status.
- **`AccessLog.userName`** is what the browser sends. `actorKey` is also browser-sent, so a staff member could forge an entry. A later fix is a Lambda that reads the name from the token.
