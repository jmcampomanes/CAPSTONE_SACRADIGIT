# SacraDigit — Backend changes to deploy

The `amplify/` source is not in this repository, so these changes must be made where that code lives. Deploy in the order below. The frontend already checks for each item (`client.models.X`, `client.queries.x`) and keeps working until it exists.

Everything here goes in `amplify/data/resource.ts` unless stated otherwise.

## 1. ParishSettings (Parish Rules & Fees)

One record holding every setting in `shared/js/parish-rules.js`. Public read, because the homepage shows the fees.

```ts
ParishSettings: a.model({
  settings: a.json().required(),   // { address, pin, fees, paymentDeadlineDays, freeCancelDays, ... }
  updatedByName: a.string(),
}).authorization((allow) => [
  allow.publicApiKey().to(['read']),
  allow.authenticated().to(['read']),
  allow.groups(['admin']).to(['create', 'read', 'update', 'delete']),
]),
```

Also add `ParishSettings` writes to the Head Admin only. Until this is deployed, the published defaults are used and the Parish Rules & Fees page says saving isn't switched on.

## 2. PaymentRecord

Owners can create and read, but never update: this is what makes payment status trustworthy.

```ts
PaymentRecord: a.model({
  requestType: a.string().required(),   // 'Service' | 'Mass Intention' | 'Donation'
  requestId: a.string().required(),
  payerName: a.string().required(),
  amount: a.float().required(),
  method: a.string(),
  referenceNumber: a.string(),
  status: a.string().required(),        // 'submitted' | 'verified' | 'rejected'
  verifiedBy: a.string(),
  verifiedAt: a.datetime(),
  note: a.string(),
}).authorization((allow) => [
  allow.owner().to(['create', 'read']),
  allow.groups(['admin', 'staff']).to(['create', 'read', 'update']),
  allow.groups(['admin']).to(['delete']),
  allow.groups(['itech']).to(['read']),
]),
```

## 3. ConsentRecord

```ts
ConsentRecord: a.model({
  subjectKey: a.string().required(),    // the account's sub
  purpose: a.string().required(),       // 'sign-up' | 'parish-server' | 'profile' | 'service-request'
  version: a.string().required(),
  acceptedAt: a.datetime().required(),
}).authorization((allow) => [
  allow.owner().to(['create', 'read']),
  allow.groups(['admin']).to(['read']),
]),
```

## 4. Storage: private requirement uploads

In `amplify/storage/resource.ts`:

```ts
'requirementUploads/{entity_id}/*': [
  allow.entity('identity').to(['read', 'write', 'delete']),
  allow.groups(['admin', 'staff']).to(['read', 'list']),
],
```

Do not reuse `certificateUploads/*`: any signed-in user can read it.

## 5. Role rules

`shared/js/permissions.js` hides what a role can't use, but only the rules below enforce it. Keep the two the same.

Tighten these existing models:

| Model | Change | Why |
|---|---|---|
| `Blessing`, `MassIntention`, `FacilityBooking`, `CertificateRequest` | Owner may update only their own contact and note fields. Status changes go through a staff-only mutation, or a custom resolver that rejects `status` from owners. | Owners can currently set their own request to approved. |
| `Announcement` | Add a `publishAnnouncement` mutation that checks the reviewer differs from the author. | Review before publishing can't be enforced from the browser. |
| `ParishionerPreference` | Remove `itech` read. | The model will hold PWD and accommodation details. |

## 6. AccessLog: audit fields

```ts
// add to AccessLog
actorRole: a.string(),
targetType: a.string(),
targetId: a.string(),
before: a.string(),   // JSON of the changed fields
after: a.string(),
```

`shared/js/activity-log.js` starts sending these as soon as they appear in `amplify_outputs.json`.

Also change its rules:

```ts
allow.groups(['itech', 'admin']).to(['read']),
allow.groups(['staff']).to(['read']),   // the page shows a Secretary only their own entries
```

The second line only filters in the browser. For a real limit, add an `actorKey` field holding the signed-in sub and use an owner rule.

**Known weakness:** any signed-in user, including parishioners, can currently create AccessLog rows, and the `userName` is whatever the browser sends, so entries can be forged. The fix is to remove `allow.authenticated().to(['create'])` and add a `logActivity` custom mutation whose Lambda takes the name and role from the caller's token. Updates and deletes must stay disabled for every group, so the log stays append-only.

## 7. ParishionerPreference: personal details

```ts
// add to ParishionerPreference
birthdate: a.date(),
sex: a.string(),
isPwd: a.boolean(),
pwdType: a.string(),
accommodations: a.string(),
```

These are sensitive personal information under RA 10173. Remove `itech` read from this model first (section 5). My Profile shows these fields as soon as they appear in `amplify_outputs.json`.

The Honor Roll calls `ParishionerPreference.list`. It must keep working for signed-in parishioners without exposing these fields; move that read to a query returning only `parishionerKey` and `showOnHonorRoll`.

## 8. Request statuses and automatic void

`Blessing.status` gains: `temporary-approval`, `payment-submitted`, `void`, `cancelled`. It is a free string, so no schema change is needed, but these two functions must change.

**takenSlots:** must also return rows with `temporary-approval` and `payment-submitted` so those slots stay held, and must leave out `void` and `cancelled`. It returns no `details`, so parishioners only see an expired hold as free after the job below runs.

**Scheduled function:** run hourly, and for each `Blessing` with `status = 'temporary-approval'` whose `details['Temporary Approval'].deadline` is before today, set `status: 'void'`, set `declineReason`, and send the `cancelled` email.

```ts
// amplify/functions/void-unpaid/resource.ts
export const voidUnpaid = defineFunction({ name: 'void-unpaid', schedule: 'every 1h' });
```

Until it runs, staff use Mark Void, and staff pages already treat expired holds as void.

**notifyParishioner:** the frontend sends `approved` for temporary approval and confirmation, `rescheduled` for a rejected payment, and `cancelled` for void. Add the amount and deadline `detailsLines` to the email template if they aren't already shown.

The deadline sits in `details`, which owners can edit. For a stricter rule, store it on a staff-only `paymentDueOn` field and have the function read that.

## 9. Wedding emails

The wedding form emails both people when a request is sent, using `status: 'received'`. `notifyParishioner` must:

1. Accept `received` from a parishioner and word it as "We received your request."
2. Allow `to` to be any address for that one status, and limit it to two sends per request, so the form can't be used to send mail to strangers.

Until this is deployed, that first email fails quietly and the request still saves. Staff status emails already go to both people.

## 10. Parish Server applications and ministry

```ts
// ServerApplication
confirmWith: a.string(),       // was required; the form no longer asks
conditions: a.json(),          // [{ q, a: 'yes' | 'no' }]
isFirstTime: a.boolean(),

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

Until then, the form sends `confirmWith: 'Not asked'`, keeps the answers in `message`, and cancellations reach the office only through Messages.

**Enforce who can take a slot.** The check that only assessed servers can volunteer runs in the browser. Add a `volunteerForSlot` mutation that reads the caller's approved `ServerApplication` before creating the row, and remove owner `create` from `MinistrySignup`.

**Known weakness:** `MinistrySignup` allows any signed-in user to `update`, so anyone can take over or edit another person's slot. That rule exists only so `takeOver` works. Replace it with a `takeOverSlot` mutation that checks `swapRequested` is true and the caller is approved for that ministry, then remove `allow.authenticated().to(['read', 'update'])`'s update.
