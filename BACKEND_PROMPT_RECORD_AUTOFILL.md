# Backend prompt: certificate requests fill themselves in

Paste this whole file into Claude Code in the repository that holds `amplify/`. The frontend (branch `feature/parish-requirements`) is already written against it. Do not rename any model, field, mutation, query or key below.

---

You are updating the AWS Amplify Gen 2 backend of SacraDigit (Our Lady of Fatima Parish). Read `amplify/data/resource.ts` and `amplify/functions/` first, and match how `verifyRecord` and the other custom mutations are built (`allow.authenticated()`, returns `a.json()`, `allow.resource(fn)` on the schema).

## Rules

- Work on a new branch. Do not deploy to production and do not delete or rewrite data.
- All new fields are optional, so existing rows stay valid.
- Run the type check and `npx ampx sandbox` validation, and report anything you could not test.

## Goal

When a parishioner requests a certificate, the office should not retype what the parish already holds. The frontend fills the admin's Generate Certificate form from the request and from the linked `ParishRecord`. The backend must therefore (1) store the matched record on the request, with values the server read itself, and (2) give the admin enough record data to fill the form.

## 1. `submitCertificateRequest({ input: AWSJSON })`

Create it if it does not exist yet. The frontend calls it first and falls back to `CertificateRequest.create` only while it is missing. `input` holds `{ certificateType, purpose, notes?, details, verification? }`.

- Authorization `allow.authenticated()`. Returns `a.json()`: `{ "success": true, "data": <saved CertificateRequest> }` or `{ "success": false, "error": "<a sentence for the parishioner>" }`.
- Set `requesterName` and `email` from the caller's account, `status: 'pending'`, and `owner` as `<sub>::<username>`. Ignore any `status`, `linkedRecordId`, `reviewedBy` or `rejectionReason` sent by the browser.
- Without `verification`: save `details` as sent.
- With `verification` (`{ fullName, birthdate, eventDate }`, or `{ groomName, brideName, eventDate }` for marriage): run the same matching as `verifyRecord`, including its rate limit and `AccessLog` entry. If nothing matches, return `{ success: false, error: "We couldn't match those details to a record." }` and save nothing.
- On a match:
  - set `linkedRecordId` to the matched `ParishRecord.id`
  - set these keys in `details`, overwriting anything the browser sent, as plain strings: `"Verified Against Record": "Yes"`, `"Record Name"` (`fullName`), `"Record Event Date"` (`dateOfEvent`), `"Record Officiant"` (`officiant`, only if the record has one)
  - keep the rest of what the browser sent in `details`
- Reject a `certificateType` that is not one of: Baptismal Certificate, Confirmation Certificate, First Communion Certificate, Marriage Certificate, Death Certificate.
- A parishioner already has the same type pending for the same record: return an error, `"You already have a pending request for this certificate."`.
- Grant the function read access to `ParishRecord` and create access to `CertificateRequest` and `AccessLog` with `allow.resource(fn)`.

## 2. `ParishRecord`: fields the admin form can use

Add these optional fields so the form no longer depends on earlier requests:

```ts
// ParishRecord
birthdate: a.date(),          // already added for verifyRecord; keep
fatherName: a.json(),         // { firstName, middleName, lastName, extension }
motherName: a.json(),         // maiden name, same shape
sponsors: a.json(),           // [{ name: { firstName, middleName, lastName, extension }, role }]
birthplace: a.string(),
placeOfEvent: a.string(),     // place of baptism, marriage or death
bookNo: a.string(), pageNo: a.string(), lineNo: a.string(),
```

Authorization does not change: staff and admin only. Parishioners must still never read `ParishRecord`.

## 3. `verifyRecord` stays minimal

Do not widen its reply. It still returns only `{ match: true, recordId, fullName, dateOfEvent, officiant }`. Parents, sponsors and book numbers stay on the server and reach the admin only through the linked record.

## 4. Backfill (optional, dry run first)

Write a one-off function or script, not scheduled, that for each `ParishRecord` with no `fatherName` and no `motherName` copies parents from the newest `CertificateRequest` with the same `linkedRecordId`, reading `details["father-name"]` and `details["mother-name"]` (for marriages, the groom's and bride's keys do not map to one record, so skip them). Run it as a dry run that only reports what it would change, and wait for the user before writing.

## Report back

List the exact names added so the frontend can switch from the request's `details` to the record fields: `fatherName`, `motherName`, `sponsors`, `birthplace`, `placeOfEvent`, `bookNo`, `pageNo`, `lineNo`.
