const TOKEN_KEY = 'ypf_audit_token';
const USER_KEY = 'ypf_audit_user';

export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } },
  set(token, user) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

async function raw(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(session.token ? { authorization: 'Bearer ' + session.token } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    session.clear(); location.hash = '#/login'; throw new Error('Sesión expirada');
  }
  return res;
}
async function req(method, path, body) {
  const res = await raw(method, path, body);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),
  changePassword: (actual, nueva) => req('POST', '/auth/password', { actual, nueva }),
  users: () => req('GET', '/users'),
  createUser: (u) => req('POST', '/users', u),
  resetPassword: (id, password) => req('POST', `/users/${id}/password`, { password }),
  deleteUser: (id) => req('DELETE', '/users/' + id),
  conversions: (todos) => req('GET', '/conversions' + (todos ? '?todos=1' : '')),
  conversion: (id) => req('GET', '/conversions/' + id),
  saveConversion: (c) => req('POST', '/conversions', c),
  renameConversion: (id, titulo) => req('PATCH', '/conversions/' + id, { titulo }),
  deleteConversion: (id) => req('DELETE', '/conversions/' + id),
  /** Descarga el Excel original guardado. */
  async downloadOriginal(id, filename) {
    const res = await raw('GET', `/conversions/${id}/file`);
    if (!res.ok) throw new Error('No se pudo descargar el archivo');
    saveBlob(await res.blob(), filename);
  },
};

export function saveBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
