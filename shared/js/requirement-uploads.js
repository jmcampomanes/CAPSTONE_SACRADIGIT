/* ============================================
   SacraDigit — Requirement uploads
   Documents parishioners upload for a request. They
   hold personal data, so they go in the private path
   requirementUploads/{identity}/, which only the
   owner, admin and staff can read. certificateUploads/
   is not used: any signed-in user can read that.

   Until the path is deployed (BACKEND_CHANGES.md)
   uploadsReady() is false and the forms ask people to
   bring the document to the parish office instead.
   ============================================ */

import { uploadData, getUrl } from 'aws-amplify/storage';
import outputs from '../../amplify_outputs.json';

export const MAX_UPLOAD_MB = 10;
export const UPLOAD_ACCEPT = 'image/jpeg,image/png,application/pdf';

const paths = outputs.storage?.buckets?.[0]?.paths || {};
export const uploadsReady = () => Object.keys(paths).some(p => p.startsWith('requirementUploads/'));

/** The reason a file can't be uploaded, or '' when it's fine. */
export function uploadProblem(file) {
  if (!UPLOAD_ACCEPT.split(',').includes(file.type)) return 'Please choose a JPG, PNG or PDF file.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Please choose a file under ${MAX_UPLOAD_MB} MB.`;
  return '';
}

/** Uploads one document. Returns { path, name } to save on the request. */
export async function uploadRequirement(file, itemId) {
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const { path } = await uploadData({
    path: ({ identityId }) => `requirementUploads/${identityId}/${itemId}-${Date.now()}-${safeName}`,
    data: file,
    options: { contentType: file.type },
  }).result;
  return { path, name: file.name };
}

/** A short-lived link to view an uploaded document. */
export async function uploadedFileUrl(path) {
  const { url } = await getUrl({ path, options: { expiresIn: 300 } });
  return url.toString();
}
