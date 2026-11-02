/* ============================================
   SacraDigit — Parishioner writes that the backend checks
   A parishioner must not be able to set their own
   status: approved, paid, verified. Once the mutations
   in BACKEND_CHANGES.md are deployed, owners only read
   these models, and every change goes through a Lambda
   that decides the status itself.

   Each function here uses its mutation when
   amplify_outputs.json has it, and otherwise does what
   the page always did, so the frontend works before
   and after the backend change. All return { data }.
   ============================================ */

import { client } from './amplify-init.js';

const has = (name) => !!client.mutations?.[name];

async function call(name, args) {
  const { data, errors } = await client.mutations[name](args);
  if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
  // { success, data } or { success: false, error } (AWSJSON may arrive as a string).
  const res = typeof data === 'string' ? JSON.parse(data) : data;
  if (!res?.success) throw new Error(res?.error || 'That didn’t save. Please try again.');
  return { data: res.data };
}

const direct = async (promise) => {
  const res = await promise;
  if (res.errors?.length) throw new Error(res.errors.map(e => e.message).join('; '));
  return { data: res.data };
};

export const createServiceRequest = (input) => (has('createServiceRequest')
  ? call('createServiceRequest', { input: JSON.stringify(input) })
  : direct(client.models.Blessing.create(input)));

/** action: 'cancel' | 'reschedule' | 'set-reminder'. `fallback` is the direct update. */
export const changeMyRequest = (id, action, fields, fallback) => (has('changeMyRequest')
  ? call('changeMyRequest', { id, action, ...fields })
  : direct(client.models.Blessing.update({ id, ...fallback })));

/** Saves the payment and moves the request to payment-submitted. */
export async function submitServicePayment({ request, amount, method, referenceNumber, payerName, savePayment }) {
  if (has('submitServicePayment')) return call('submitServicePayment', { requestId: request.id, method, referenceNumber });
  await savePayment({ requestType: 'Service', requestId: request.id, payerName, amount, method, referenceNumber });
  return direct(client.models.Blessing.update({ id: request.id, status: 'payment-submitted' }));
}

export const hasDonationMutation = () => has('submitDonation');
export const submitDonation = (input) => call('submitDonation', input);

export const hasIntentionMutation = () => has('submitMassIntentions');
export const submitMassIntentions = (records, { method, referenceNumber, amount }) => call('submitMassIntentions', {
  records: JSON.stringify(records), amount, method, referenceNumber,
});

export const submitServerApplication = (input) => (has('submitServerApplication')
  ? call('submitServerApplication', { input: JSON.stringify(input) })
  : direct(client.models.ServerApplication.create(input)));

export const volunteerForSlot = (input) => (has('volunteerForSlot')
  ? call('volunteerForSlot', input)
  : direct(client.models.MinistrySignup.create(input)));

export const takeOverSlot = (signupId, me) => (has('takeOverSlot')
  ? call('takeOverSlot', { id: signupId })
  : direct(client.models.MinistrySignup.update({ id: signupId, volunteerId: me.id, volunteerName: me.name, swapRequested: false })));
