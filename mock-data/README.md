# SacraDigit mock community

A fake parish community for testing record auto-fill and conflict checks. **Everyone here is invented.** The files are local only: nothing has been written to the database.

```
node tools/mock-community/generate.mjs     # build these files (same seed = same people)
node tools/mock-community/validate.mjs     # check them
```

Options: `--seed 7` for a different community, `--scale 2` for about twice the size, `--out folder` for another location. The JSON files are ignored by git because they total about 40 MB and rebuild in seconds. Exact counts are in `manifest.json`.

## Files

| File | What it holds |
| --- | --- |
| `persons.json` | Every identity, with name history, parents, birth and death dates, residency, contact details |
| `families.json` | Couples: church, civil or live-in; children; how each one ended |
| `family-trees.json` | The same families as nested trees, one per founding or arriving family |
| `households.json` | Who lives together today, with addresses |
| `records-baptism.json`, `-confirmation`, `-first-communion`, `-marriage`, `-death` | The parish registers |
| `certificate-requests.json` | Rows shaped like the `CertificateRequest` table |
| `autofill-scenarios.json` | Test cases with the expected answer |
| `manifest.json` | Counts and the seed used |

## The record shape

Each register entry has these main parts:

- `details`: uses the exact keys of the request forms (`groom-name`, `witness-1`, `baptism-date`, and so on), with names as `{ firstName, middleName, lastName, extension }`. A form can be filled straight from it.
- `register`: book, page and line, for the Generate Certificate modal.
- `parishRecord`: the exact row for the `ParishRecord` table.
- `personIds`: who the record belongs to. The real table has no such link.
- `dataQuality`: what is deliberately wrong with this entry, and the correct name.

`nameHistory` on a person is what connects a woman's married name to the maiden name in her marriage record.

## Using the scenarios

Each scenario gives an `input` (what someone typed) and an `expected` result. Example, trimmed:

```json
{
  "category": "marriage-groom-request",
  "input": { "certificateType": "Marriage Certificate", "typed": { "groom-name": { "firstName": "...", "lastName": "..." } } },
  "expected": { "outcome": "unique-match", "recordIds": ["MAR-00123"], "autofill": { "details": {} } }
}
```

| Outcome | What the system should do |
| --- | --- |
| `unique-match` | Fill the form |
| `unique-match-with-warning` | Fill the form and show staff the warning |
| `partial-match` | Fill what exists; leave blanks for staff |
| `variant-match` | Fill the form, and ask staff to confirm the spelling |
| `multiple-matches` | Ask which one; never choose silently |
| `duplicate-records` | Flag the double entry |
| `not-digitized` | Send staff to the paper book |
| `no-record` | Say there is no record here, and why |
| `no-person` | Offer manual entry |
| `conflict` | Stop and flag for staff |
| `allowed`, `blocked` | Result of a wedding eligibility check |

`tools/mock-community/lookup.mjs` is a small reference matcher that satisfies these cases. Use it as a starting point or a comparison.

## Rules the data follows

- Records begin in 1974, when the parish was established. Older events have no record here.
- A child's middle name is the mother's maiden surname. A child registered under the mother's surname has no middle name and no father on the record.
- Marriage records keep the name each person had before the wedding, so brides appear under their maiden names.
- Older entries contain realistic flaws: `Ma.` for Maria, a dropped `ñ`, all capitals, surname typos, blank fields, unscanned pages and double entries.

## Safety

- Emails use `mock-sacradigit.test`, a reserved domain that cannot reach a real inbox.
- Mobile numbers use the `0900` prefix, in the app's 11-digit format.
- Priests, bishops, catechists and secretaries are invented. The real clergy are not in the registers.
- Names are random combinations of common Filipino names, so one can match a real person by coincidence.
- Every person, record, household and request has `isMock: true`.

If this data is ever loaded into a shared database, load it into a test environment. Certificate emails go to whatever address a row holds, and the `.test` domain only protects you while the rows stay unchanged.
