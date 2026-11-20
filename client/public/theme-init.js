// Aplica el tema antes de renderizar para evitar parpadeo (archivo externo por la política CSP)
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) { /* sin acceso a localStorage */ }
