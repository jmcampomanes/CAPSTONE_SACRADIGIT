/* ============================================
   SacraDigit — User Facility Booking Scripts (AWS Amplify)
   Runs after user-shell.js.
   "My Bookings" filters client-side by
   requesterName === hardcoded demo name.
   Cancel deletes the booking (no "cancelled"
   status in the FacilityBooking schema).
   ============================================ */

import { client } from '../amplify-init.js';

document.addEventListener('DOMContentLoaded', () => {

  const REQUESTER_NAME = 'Maria P. Santos';

  const facilities = [
    { id: 'parish-hall', name: 'Parish Hall', desc: 'Large multi-purpose hall suitable for receptions, reunions, and parish events.', capacity: 200, availability: 'available', barColor: '#8b8fc7' },
    { id: 'adoration-chapel', name: 'Adoration Chapel', desc: 'Intimate chapel for prayer meetings, novenas, and small group gatherings.', capacity: 40, availability: 'available', barColor: '#c9a84c' },
    { id: 'catechetical-a', name: 'Catechetical Room A', desc: 'Classroom-style room ideal for Bible studies, seminars, and formations.', capacity: 30, availability: 'limited', barColor: '#6c91c2' },
    { id: 'catechetical-b', name: 'Catechetical Room B', desc: 'Smaller discussion room for group meetings and ministry gatherings.', capacity: 20, availability: 'available', barColor: '#9ca3af' },
    { id: 'multi-purpose', name: 'Multi-Purpose Hall', desc: 'Flexible open space for youth activities, concerts, and community events.', capacity: 150, availability: 'available', barColor: '#16a34a' },
  ];

  let myBookings = [];

  const badgeClass = { pending: 'badge-amber', approved: 'badge-green', declined: 'badge-red' };
  const statusLabel = { pending: 'Pending', approved: 'Approved', declined: 'Rejected' };
  const cancelableStatuses = ['pending', 'approved'];

  function renderFacilityGrid() {
    const grid = document.getElementById('facility-grid');
    grid.innerHTML = facilities.map(f => `
      <div class="facility-card">
        <div class="facility-card-bar" style="background-color:${f.barColor};"></div>
        <div class="facility-card-body">
          <p class="facility-name">${f.name}</p>
          <p class="facility-desc">${f.desc}</p>
          <div class="facility-meta">
            <span class="facility-capacity"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3.5-5.93"/></svg>Up to ${f.capacity} pax</span>
            <span class="facility-avail-badge ${f.availability}">${f.availability === 'available' ? 'Available' : 'Limited Slots'}</span>
          </div>
        </div>
        <div class="facility-card-footer"><button type="button" class="btn-book-this" data-facility-id="${f.id}">Book This Facility</button></div>
      </div>`).join('');

    grid.querySelectorAll('.btn-book-this').forEach(btn => btn.addEventListener('click', () => openModal(btn.dataset.facilityId)));
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function formatShortDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatTime12(time24) {
    let [h, m] = time24.split(':').map(Number);
    const mer = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${mer}`;
  }

  client.models.FacilityBooking.observeQuery({ filter: { requesterName: { eq: REQUESTER_NAME } } }).subscribe({
    next: ({ items }) => { myBookings = items; renderBookings(); },
    error: (err) => {
      console.error('Failed to load bookings:', err);
      document.getElementById('bookings-tbody').innerHTML = `<tr><td colspan="6" class="text-center text-red-500 text-sm py-8">Couldn't load bookings.</td></tr>`;
    },
  });

  function renderBookings() {
    const tbody = document.getElementById('bookings-tbody');
    const empty  = document.getElementById('bookings-empty');
    const count   = document.getElementById('bookings-count');

    count.textContent = `${myBookings.length} booking${myBookings.length === 1 ? '' : 's'}`;

    if (myBookings.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const sorted = myBookings.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

    tbody.innerHTML = sorted.map(b => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(b.facilityName)}</td>
        <td>${formatShortDate(b.date)}</td>
        <td>${escapeHtml(b.startTime)}</td>
        <td class="text-gray-500">${escapeHtml(b.purpose)}</td>
        <td><span class="badge ${badgeClass[b.status] || 'badge-gray'}">${statusLabel[b.status] || b.status}</span></td>
        <td><div class="booking-row-actions">
          <button type="button" class="btn-view-booking" data-id="${b.id}">View</button>
          ${cancelableStatuses.includes(b.status) ? `<button type="button" class="btn-cancel-booking" data-id="${b.id}">Cancel</button>` : ''}
        </div></td>
      </tr>`).join('');
  }

  document.getElementById('bookings-tbody').addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view-booking');
    if (viewBtn) { openDetailModal(viewBtn.dataset.id); return; }
    const cancelBtn = e.target.closest('.btn-cancel-booking');
    if (cancelBtn) openCancelModal(cancelBtn.dataset.id);
  });

  renderFacilityGrid();

  const modal          = document.getElementById('booking-modal');
  const facilitySelect  = document.getElementById('book-facility');
  const dateInput        = document.getElementById('book-date');
  const timeInput         = document.getElementById('book-time');
  const purposeInput       = document.getElementById('book-purpose');
  const attendeesInput      = document.getElementById('book-attendees');
  const notesInput           = document.getElementById('book-notes');

  const bookingDetailModal = document.getElementById('booking-detail-modal');
  const cancelModal          = document.getElementById('cancel-modal');
  let cancelTargetId = null;

  facilitySelect.innerHTML = '<option value="">Choose a facility…</option>' +
    facilities.map(f => `<option value="${f.name}">${f.name} (up to ${f.capacity} pax)</option>`).join('');

  function openModal(preSelectFacilityId = null) {
    facilitySelect.value = '';
    dateInput.value = '';
    timeInput.value = '';
    purposeInput.value = '';
    attendeesInput.value = '';
    notesInput.value = '';
    if (preSelectFacilityId) {
      const f = facilities.find(f => f.id === preSelectFacilityId);
      if (f) facilitySelect.value = f.name;
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    bookingDetailModal.classList.add('hidden');
    cancelModal.classList.add('hidden');
    document.body.style.overflow = '';
    cancelTargetId = null;
  }

  function openDetailModal(id) {
    const b = myBookings.find(x => x.id === id);
    if (!b) return;
    const statusBadge = document.getElementById('detail-status-badge');
    statusBadge.textContent = statusLabel[b.status] || b.status;
    statusBadge.className = `badge ${badgeClass[b.status] || 'badge-gray'}`;

    document.getElementById('detail-grid').innerHTML = `
      <div><p class="modal-detail-item-label">Facility</p><p class="modal-detail-item-value">${escapeHtml(b.facilityName)}</p></div>
      <div><p class="modal-detail-item-label">Date</p><p class="modal-detail-item-value">${formatShortDate(b.date)}</p></div>
      <div><p class="modal-detail-item-label">Time</p><p class="modal-detail-item-value">${escapeHtml(b.startTime)}</p></div>
      <div><p class="modal-detail-item-label">Purpose</p><p class="modal-detail-item-value">${escapeHtml(b.purpose)}</p></div>`;

    bookingDetailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function openCancelModal(id) {
    const b = myBookings.find(x => x.id === id);
    if (!b) return;
    cancelTargetId = id;
    document.getElementById('cancel-target-name').textContent = `${b.facilityName} — ${formatShortDate(b.date)}, ${b.startTime}`;
    cancelModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  document.getElementById('btn-book').addEventListener('click', () => openModal());
  document.getElementById('btn-empty-book')?.addEventListener('click', () => openModal());

  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', closeModal));
  [modal, bookingDetailModal, cancelModal].forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('cancel-confirm-submit').addEventListener('click', async () => {
    if (!cancelTargetId) return;
    const b = myBookings.find(x => x.id === cancelTargetId);
    try {
      const result = await client.models.FacilityBooking.delete({ id: cancelTargetId });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
      closeModal();
      window.showToast(`Booking for ${b ? b.facilityName : 'facility'} on ${b ? formatShortDate(b.date) : ''} has been cancelled.`);
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      window.showToast(err.message || "Couldn't cancel the booking.", true);
    }
  });

  document.getElementById('booking-submit').addEventListener('click', async () => {
    const facility = facilitySelect.value;
    const date      = dateInput.value;
    const time       = timeInput.value;
    const purpose     = purposeInput.value.trim();

    let valid = true;
    [{ el: facilitySelect, val: facility }, { el: dateInput, val: date }, { el: timeInput, val: time }, { el: purposeInput, val: purpose }].forEach(({ el, val }) => {
      if (!val) {
        el.classList.add('border-red-400');
        el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
        el.addEventListener('change', () => el.classList.remove('border-red-400'), { once: true });
        valid = false;
      }
    });

    if (!valid) { window.showToast('Please fill in all required fields.', true); return; }

    try {
      const result = await client.models.FacilityBooking.create({
        requesterName: REQUESTER_NAME,
        facilityName: facility,
        date,
        startTime: formatTime12(time),
        purpose,
        attendees: attendeesInput.value ? parseInt(attendeesInput.value, 10) : undefined,
        notes: notesInput.value.trim() || undefined,
        status: 'pending',
      });
      if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));

      closeModal();
      window.showToast(`Booking request submitted for ${facility} on ${formatShortDate(date)}.`);
    } catch (err) {
      console.error('Failed to submit booking:', err);
      window.showToast(err.message || "Couldn't submit the booking.", true);
    }
  });

});
