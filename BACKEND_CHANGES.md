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
