(() => {
  'use strict';
  const API = '/api/resources';
  const $ = (id) => document.getElementById(id);
  const form = $('resourceForm');
  const dialog = $('resourceDialog');
  const grid = $('resourceGrid');
  const message = $('message');
  const apiStatus = $('apiStatus');
  const statusDot = document.querySelector('.status-dot');
  const typeFilter = $('typeFilter');
  const subjectFilter = $('subjectFilter');
  const searchInput = $('searchInput');
  let resources = [];
  let isSaving = false;

  function safeText(value) { return String(value ?? ''); }
  function escapeHtml(value) {
    return safeText(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function validHttpUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; }
    catch { return false; }
  }
  function displayMessage(text, kind = 'info') {
    message.textContent = text;
    message.className = `message${kind === 'error' ? ' error' : ''}`;
    message.hidden = false;
  }
  function clearMessage() { message.hidden = true; message.textContent = ''; }
  async function api(path = '', options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) }
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
    return body;
  }
  function setApiStatus(online, text) {
    apiStatus.textContent = text;
    statusDot.classList.toggle('online', online);
    statusDot.classList.toggle('offline', !online);
  }
  function updateStats() {
    $('totalCount').textContent = resources.length;
    $('subjectCount').textContent = new Set(resources.map(r => r.subject.trim().toLowerCase()).filter(Boolean)).size;
    $('typeCount').textContent = new Set(resources.map(r => r.resource_type)).size;
  }
  function updateSubjectFilter() {
    const current = subjectFilter.value;
    const subjects = [...new Set(resources.map(r => r.subject).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    subjectFilter.innerHTML = '<option value="">All subjects</option>' + subjects.map(subject => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join('');
    if (subjects.includes(current)) subjectFilter.value = current;
  }
  const typeSymbols = {PDF:'▧', Notes:'▤', Video:'▷', Website:'↗', Presentation:'▣', Article:'≡', Other:'◇'};
  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const type = typeFilter.value;
    const subject = subjectFilter.value;
    const shown = resources.filter(r => {
      const matchesQuery = !query || [r.title, r.subject, r.description, r.url, r.resource_type].some(v => safeText(v).toLowerCase().includes(query));
      return matchesQuery && (!type || r.resource_type === type) && (!subject || r.subject === subject);
    });
    updateStats();
    if (!shown.length) {
      const hasFilters = Boolean(query || type || subject);
      grid.innerHTML = `<div class="empty-state"><strong>${hasFilters ? 'No matching resources' : 'Your library is ready to grow'}</strong><span>${hasFilters ? 'Try a different search or clear your filters.' : 'Add your first resource to keep useful learning materials close at hand.'}</span></div>`;
      return;
    }
    grid.innerHTML = shown.map(r => {
      const id = Number(r.id);
      const icon = typeSymbols[r.resource_type] || '◇';
      const description = r.description ? escapeHtml(r.description) : 'No description provided.';
      return `<article class="resource-card">
        <div class="card-top"><span class="type-pill">${icon} ${escapeHtml(r.resource_type)}</span><div class="card-menu"><button class="small-action" type="button" data-edit="${id}" aria-label="Edit ${escapeHtml(r.title)}" title="Edit">✎</button><button class="small-action" type="button" data-delete="${id}" aria-label="Delete ${escapeHtml(r.title)}" title="Delete">×</button></div></div>
        <h3>${escapeHtml(r.title)}</h3><p class="description">${description}</p>
        <div class="card-bottom"><span class="subject-label" title="${escapeHtml(r.subject)}">${escapeHtml(r.subject)}</span><a class="open-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a></div>
      </article>`;
    }).join('');
  }
  async function loadResources() {
    grid.innerHTML = '<div class="loading-card">Loading your study resources…</div>';
    try {
      const data = await api();
      resources = Array.isArray(data.resources) ? data.resources : [];
      setApiStatus(true, 'Database connected');
      if (message.classList.contains('error')) clearMessage();
      updateSubjectFilter();
      render();
    } catch (error) {
      resources = [];
      updateStats();
      setApiStatus(false, 'Database unavailable');
      grid.innerHTML = '<div class="empty-state"><strong>Could not load resources</strong><span>Check that the Cloudflare Pages D1 binding is configured as <code>DB</code> and that the SQL schema has been applied.</span></div>';
      displayMessage(error.message || 'Unable to reach the resource API.', 'error');
    }
  }
  function openNewDialog() {
    form.reset();
    $('resourceId').value = '';
    $('dialogTitle').textContent = 'Add a resource';
    $('saveButton').textContent = 'Save resource';
    $('formError').hidden = true;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    $('titleInput').focus();
  }
  function closeDialog() { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); }
  function openEditDialog(id) {
    const resource = resources.find(r => Number(r.id) === id);
    if (!resource) return;
    $('resourceId').value = String(resource.id);
    $('titleInput').value = resource.title || '';
    $('subjectInput').value = resource.subject || '';
    $('resourceTypeInput').value = resource.resource_type || '';
    $('urlInput').value = resource.url || '';
    $('descriptionInput').value = resource.description || '';
    $('dialogTitle').textContent = 'Edit resource';
    $('saveButton').textContent = 'Save changes';
    $('formError').hidden = true;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    $('titleInput').focus();
  }
  function showFormError(text) { $('formError').textContent = text; $('formError').hidden = false; }
  async function saveResource(event) {
    event.preventDefault();
    if (isSaving) return;
    const title = $('titleInput').value.trim();
    const subject = $('subjectInput').value.trim();
    const resource_type = $('resourceTypeInput').value;
    const url = $('urlInput').value.trim();
    const description = $('descriptionInput').value.trim();
    if (!title || title.length > 150) return showFormError('Enter a title from 1 to 150 characters.');
    if (!subject || subject.length > 100) return showFormError('Enter a subject from 1 to 100 characters.');
    if (!resource_type) return showFormError('Choose a resource type.');
    if (!validHttpUrl(url) || url.length > 500) return showFormError('Enter a valid HTTP or HTTPS URL up to 500 characters.');
    if (description.length > 2000) return showFormError('Keep the description within 2,000 characters.');
    const id = $('resourceId').value;
    isSaving = true;
    $('saveButton').disabled = true;
    $('saveButton').textContent = 'Saving…';
    try {
      await api(id ? `/${encodeURIComponent(id)}` : '', { method: id ? 'PUT' : 'POST', body: JSON.stringify({title, subject, resource_type, url, description}) });
      closeDialog();
      displayMessage(id ? 'Resource updated successfully.' : 'Resource added successfully.');
      await loadResources();
    } catch (error) { showFormError(error.message || 'Could not save this resource.'); }
    finally {
      isSaving = false;
      $('saveButton').disabled = false;
      $('saveButton').textContent = $('resourceId').value ? 'Save changes' : 'Save resource';
    }
  }
  async function deleteResource(id) {
    const resource = resources.find(r => Number(r.id) === id);
    if (!resource || !window.confirm(`Delete “${resource.title}”? This cannot be undone.`)) return;
    try {
      await api(`/${encodeURIComponent(id)}`, {method:'DELETE'});
      displayMessage('Resource deleted.');
      await loadResources();
    } catch (error) { displayMessage(error.message || 'Could not delete this resource.', 'error'); }
  }
  $('addResource').addEventListener('click', openNewDialog);
  $('addResourceTop').addEventListener('click', openNewDialog);
  $('closeDialog').addEventListener('click', closeDialog);
  $('cancelDialog').addEventListener('click', closeDialog);
  form.addEventListener('submit', saveResource);
  [searchInput, typeFilter, subjectFilter].forEach(el => el.addEventListener(el === searchInput ? 'input' : 'change', render));
  grid.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) openEditDialog(Number(edit.dataset.edit));
    if (del) deleteResource(Number(del.dataset.delete));
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  loadResources();
})();
