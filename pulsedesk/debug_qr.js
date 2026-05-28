const fetch = globalThis.fetch || require('node-fetch');
(async () => {
  try {
    const login = await fetch('http://localhost:3000/api/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pulsedesk.com', senha: 'admin123' })
    });
    const loginData = await login.json();
    console.log('login status', login.status, loginData);
    if (!loginData.token) return;

    const q = await fetch('http://localhost:3000/api/admin/funcionarios/1/qrcode', {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    const qd = await q.json();
    console.log('qr status', q.status, qd.url ? 'has url' : 'err', qd);
    console.log('qr len', qd.qr ? qd.qr.length : '-');
  } catch (err) {
    console.error('failed', err);
  }
})();
