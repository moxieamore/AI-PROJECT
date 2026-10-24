const RESOURCE_TYPES = new Set(['PDF', 'Notes', 'Video', 'Website', 'Presentation', 'Article', 'Other']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type'
    }
  });
}
function error(message, status = 400) { return json({ error: message }, status); }
function validate(input) {
  const data = {
    title: typeof input?.title === 'string' ? input.title.trim() : '',
    subject: typeof input?.subject === 'string' ? input.subject.trim() : '',
    resource_type: typeof input?.resource_type === 'string' ? input.resource_type : '',
    url: typeof input?.url === 'string' ? input.url.trim() : '',
    description: typeof input?.description === 'string' ? input.description.trim() : ''
  };
  if (data.title.length < 1 || data.title.length > 150) return { error: 'Title must be between 1 and 150 characters.' };
  if (data.subject.length < 1 || data.subject.length > 100) return { error: 'Subject must be between 1 and 100 characters.' };
  if (!RESOURCE_TYPES.has(data.resource_type)) return { error: 'Choose a valid resource type.' };
  if (data.url.length < 1 || data.url.length > 500) return { error: 'URL must be between 1 and 500 characters.' };
  try {
    const url = new URL(data.url);
    if (!['http:', 'https:'].includes(url.protocol)) return { error: 'URL must use HTTP or HTTPS.' };
  } catch { return { error: 'Enter a valid URL.' }; }
  if (data.description.length > 2000) return { error: 'Description must not exceed 2,000 characters.' };
  return { data };
}
async function readJson(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) throw new Error('Request body must be JSON.');
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 16000) throw new Error('Request body is too large.');
  return request.json();
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-allow-headers': 'Content-Type' } });
  if (!env.DB) return error('Database binding DB is not configured. Add a D1 binding named DB in Pages settings.', 500);

  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/api/health') {
    try {
      await env.DB.prepare('SELECT 1').first();
      return json({ ok: true, database: 'connected' });
    } catch (e) {
      return error('D1 query failed. Confirm that schema.sql has been applied to the database bound as DB.', 500);
    }
  }
  if (pathname === '/api/resources' || pathname.startsWith('/api/resources/')) {
    const idText = pathname === '/api/resources' ? null : pathname.slice('/api/resources/'.length);
    const id = idText === null ? null : Number(idText);
    if (idText !== null && (!Number.isSafeInteger(id) || id < 1)) return error('Resource ID must be a positive integer.', 400);
    try {
      if (request.method === 'GET' && id === null) {
        const url = new URL(request.url);
        const search = (url.searchParams.get('q') || '').trim().slice(0, 150);
        const type = url.searchParams.get('type') || '';
        const subject = url.searchParams.get('subject') || '';
        let stmt = 'SELECT id, title, subject, resource_type, url, description, created_at, updated_at FROM study_resources';
        const clauses = [];
        const binds = [];
        if (search) { clauses.push('(title LIKE ? OR subject LIKE ? OR description LIKE ?)'); const pattern = `%${search}%`; binds.push(pattern, pattern, pattern); }
        if (type && RESOURCE_TYPES.has(type)) { clauses.push('resource_type = ?'); binds.push(type); }
        if (subject.trim()) { clauses.push('subject = ?'); binds.push(subject.trim().slice(0, 100)); }
        if (clauses.length) stmt += ' WHERE ' + clauses.join(' AND ');
        stmt += ' ORDER BY created_at DESC, id DESC LIMIT 500';
        const result = await env.DB.prepare(stmt).bind(...binds).all();
        return json({ resources: result.results || [], count: (result.results || []).length });
      }
      if (request.method === 'GET' && id !== null) {
        const resource = await env.DB.prepare('SELECT id, title, subject, resource_type, url, description, created_at, updated_at FROM study_resources WHERE id = ?').bind(id).first();
        return resource ? json({ resource }) : error('Resource not found.', 404);
      }
      if (request.method === 'POST' && id === null) {
        let input;
        try { input = await readJson(request); } catch (e) { return error(e.message || 'Invalid JSON.'); }
        const checked = validate(input);
        if (checked.error) return error(checked.error);
        const { title, subject, resource_type, url, description } = checked.data;
        const result = await env.DB.prepare('INSERT INTO study_resources (title, subject, resource_type, url, description) VALUES (?, ?, ?, ?, ?)').bind(title, subject, resource_type, url, description).run();
        const resource = await env.DB.prepare('SELECT id, title, subject, resource_type, url, description, created_at, updated_at FROM study_resources WHERE id = ?').bind(result.meta.last_row_id).first();
        return json({ resource }, 201);
      }
      if (request.method === 'PUT' && id !== null) {
        let input;
        try { input = await readJson(request); } catch (e) { return error(e.message || 'Invalid JSON.'); }
        const checked = validate(input);
        if (checked.error) return error(checked.error);
        const { title, subject, resource_type, url, description } = checked.data;
        const result = await env.DB.prepare("UPDATE study_resources SET title = ?, subject = ?, resource_type = ?, url = ?, description = ?, updated_at = datetime('now') WHERE id = ?").bind(title, subject, resource_type, url, description, id).run();
        if (!result.meta.changes) return error('Resource not found.', 404);
        const resource = await env.DB.prepare('SELECT id, title, subject, resource_type, url, description, created_at, updated_at FROM study_resources WHERE id = ?').bind(id).first();
        return json({ resource });
      }
      if (request.method === 'DELETE' && id !== null) {
        const result = await env.DB.prepare('DELETE FROM study_resources WHERE id = ?').bind(id).run();
        if (!result.meta.changes) return error('Resource not found.', 404);
        return json({ success: true, id });
      }
      return error('Method not allowed for this endpoint.', 405);
    } catch (e) {
      console.error('Study Resource Organizer API database error:', e);
      return error('The database operation failed. Confirm schema.sql is applied and the Pages D1 binding named DB points to the intended database.', 500);
    }
  }
  return error('API endpoint not found.', 404);
}
