/* ============================================
   SacraDigit Admin — Cloud Access Scripts
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------------------------------
     0. SAMPLE DATA
     In production these would come from the
     Firebase Admin SDK / monitoring endpoints.
  ------------------------------------------ */

  const services = [
    { name: 'Firestore',  status: 'ok',   label: 'Operational', meta: '42ms avg latency' },
    { name: 'Auth',       status: 'ok',   label: 'Operational', meta: '128 active sessions' },
    { name: 'Storage',    status: 'ok',   label: 'Operational', meta: '6.8 / 10 GB used' },
    { name: 'Hosting',    status: 'ok',   label: 'Operational', meta: '99.98% uptime (30d)' },
    { name: 'Functions',  status: 'warn', label: 'Degraded',    meta: '2 functions slow to respond' },
    { name: 'Backup',     status: 'ok',   label: 'Up to date',  meta: 'Last run 2 hrs ago' },
  ];

  const folders = [
    { name: 'Baptismal Records',    files: 612, size: '2.4 GB' },
    { name: 'Confirmation Records', files: 248, size: '0.9 GB' },
    { name: 'Marriage Records',     files: 184, size: '1.6 GB' },
    { name: 'Death Records',        files: 156, size: '0.8 GB' },
    { name: 'Parish Announcements', files: 64,  size: '0.5 GB' },
    { name: 'Financial Documents',  files: 20,  size: '0.6 GB' },
  ];

  const accessLog = [
    { user: 'Fr. Mark D.',     file: 'Reyes, Ana L. — Marriage Cert.',     action: 'View',     time: '10 min ago' },
    { user: 'Sis. Elena R.',   file: 'Santos, Maria T. — Baptismal Cert.', action: 'Edit',     time: '38 min ago' },
    { user: 'Admin User',      file: 'June 2026 Backup Archive',           action: 'Download', time: '2 hrs ago' },
    { user: 'Fr. Mark D.',     file: 'Garcia, Pedro M. — Death Cert.',     action: 'View',     time: '3 hrs ago' },
    { user: 'Sis. Elena R.',   file: 'Cruz, Jose R. — Confirmation Cert.', action: 'Download', time: '5 hrs ago' },
    { user: 'Admin User',      file: 'Parish Financial Report Q2',         action: 'Edit',     time: 'Yesterday' },
  ];

  const roles = [
    {
      role: 'System Admin',
      permissions: [
        { label: 'Full Access',        granted: true },
        { label: 'Manage Roles',       granted: true },
        { label: 'Delete Records',     granted: true },
        { label: 'Export Data',        granted: true },
      ],
      users: 'Admin User',
    },
    {
      role: 'Parish Priest',
      permissions: [
        { label: 'View Records',       granted: true },
        { label: 'Approve Requests',   granted: true },
        { label: 'Delete Records',     granted: false },
        { label: 'Export Data',        granted: true },
      ],
      users: 'Fr. Mark D.',
    },
    {
      role: 'Records Staff',
      permissions: [
        { label: 'View Records',       granted: true },
        { label: 'Upload Records',     granted: true },
        { label: 'Approve Requests',   granted: false },
        { label: 'Delete Records',     granted: false },
      ],
      users: 'Sis. Elena R.',
    },
    {
      role: 'Volunteer',
      permissions: [
        { label: 'View Records',       granted: true },
        { label: 'Upload Records',     granted: false },
        { label: 'Approve Requests',   granted: false },
        { label: 'Delete Records',     granted: false },
      ],
      users: '3 volunteers',
    },
  ];

  const actionTagClass = {
    'View': 'action-view',
    'Download': 'action-download',
    'Edit': 'action-edit',
  };

  /* ------------------------------------------
     1. RENDER — Service health grid
  ------------------------------------------ */
  function renderHealth() {
    const grid = document.getElementById('health-grid');
    grid.innerHTML = services.map(s => `
      <div class="health-card">
        <div class="health-icon ${s.status}">
          ${healthIcon(s.status)}
        </div>
        <div class="min-w-0">
          <p class="health-name">${escapeHtml(s.name)}</p>
          <p class="health-status ${s.status}">${escapeHtml(s.label)}</p>
          <p class="health-meta">${escapeHtml(s.meta)}</p>
        </div>
      </div>
    `).join('');
  }

  function healthIcon(status) {
    if (status === 'ok') {
      return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
    }
    if (status === 'warn') {
      return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.93 4.93h.01"/></svg>`;
    }
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
  }

  /* ------------------------------------------
     2. RENDER — Storage folders list
  ------------------------------------------ */
  function renderFolders() {
    const list = document.getElementById('folders-list');
    list.innerHTML = folders.map(f => `
      <li>
        <a href="digital-archives.html" class="folder-row">
          <div class="folder-icon">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
          </div>
          <span class="folder-name">${escapeHtml(f.name)}</span>
          <span class="folder-meta">
            <span class="folder-size">${escapeHtml(f.size)}</span>
            ${f.files} files
          </span>
        </a>
      </li>
    `).join('');
  }

  /* ------------------------------------------
     3. RENDER — Recent access log
  ------------------------------------------ */
  function renderAccessLog() {
    const tbody = document.getElementById('access-log-tbody');
    tbody.innerHTML = accessLog.map(a => `
      <tr>
        <td class="font-medium text-gray-900">${escapeHtml(a.user)}</td>
        <td class="text-gray-500">${escapeHtml(a.file)}</td>
        <td><span class="action-tag ${actionTagClass[a.action] || ''}">${escapeHtml(a.action)}</span></td>
        <td class="text-gray-400">${escapeHtml(a.time)}</td>
      </tr>
    `).join('');
  }

  /* ------------------------------------------
     4. RENDER — Access roles & permissions
  ------------------------------------------ */
  function renderRoles() {
    const tbody = document.getElementById('roles-tbody');
    tbody.innerHTML = roles.map(r => `
      <tr>
        <td class="font-semibold text-gray-900">${escapeHtml(r.role)}</td>
        <td>
          ${r.permissions.map(p => `<span class="permission-tag ${p.granted ? 'granted' : ''}">${p.granted ? '✓' : '–'} ${escapeHtml(p.label)}</span>`).join('')}
        </td>
        <td class="assigned-users">${escapeHtml(r.users)}</td>
      </tr>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  renderHealth();
  renderFolders();
  renderAccessLog();
  renderRoles();


  /* ------------------------------------------
     5. UPLOAD MODAL
  ------------------------------------------ */
  const uploadModal     = document.getElementById('upload-modal');
  const dropzone        = document.getElementById('upload-dropzone');
  const fileInput        = document.getElementById('upload-file-input');
  const uploadFilename    = document.getElementById('upload-filename');
  const uploadFolderSelect = document.getElementById('upload-folder');

  // Populate destination folder dropdown from the folders dataset
  uploadFolderSelect.innerHTML = folders
    .map(f => `<option value="${escapeHtml(f.name)}">${escapeHtml(f.name)}</option>`)
    .join('');

  document.getElementById('btn-upload').addEventListener('click', () => openModal(uploadModal));

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(uploadModal));
  });

  uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) closeModal(uploadModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(uploadModal);
  });

  function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFilename.textContent = `Selected: ${fileInput.files[0].name}`;
      uploadFilename.classList.remove('hidden');
    }
  });

  ['dragover', 'dragenter'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover'));
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      uploadFilename.textContent = `Selected: ${e.dataTransfer.files[0].name}`;
      uploadFilename.classList.remove('hidden');
    }
  });

  document.getElementById('upload-submit').addEventListener('click', () => {
    if (!fileInput.files.length) {
      showToast('Please select a file to upload.', true);
      return;
    }

    const folderName = uploadFolderSelect.value;
    const folder = folders.find(f => f.name === folderName);
    if (folder) {
      folder.files += 1;
      renderFolders();
    }

    closeModal(uploadModal);
    showToast(`File uploaded to "${folderName}".`);

    // Reset form
    fileInput.value = '';
    uploadFilename.classList.add('hidden');
  });


  /* ------------------------------------------
     6. TOAST NOTIFICATIONS
  ------------------------------------------ */
  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#b91c1c' : '#1e2a4a';
    toast.classList.remove('hidden');
    requestAnimationFrame(() => toast.classList.add('show'));

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 200);
    }, 3000);
  }

});