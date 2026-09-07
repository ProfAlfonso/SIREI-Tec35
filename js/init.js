// ============================================================
//  init.js - Inicialización de la interfaz de administración
//  Se carga después de sirei.js y admin.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (typeof API_URL === 'undefined') {
    const container = document.getElementById('tabContent');
    if (container) container.innerHTML = '<div class="error">Error: No se definió API_URL. Revisa admin.html.</div>';
    return;
  }

  const token = sessionStorage.getItem('sirei_token');
  const nombreUsuario = sessionStorage.getItem('sirei_user');
  
  if (!token || !nombreUsuario) {
    window.location.href = 'index.html';
    return;
  }

  // Validación de inactividad (30 minutos)
  const lastActive = sessionStorage.getItem('sirei_last_active');
  const now = new Date().getTime();
  if (lastActive && (now - parseInt(lastActive)) > 30 * 60 * 1000) {
    alert("Tu sesión ha expirado por inactividad.");
    cerrarSesion();
    return;
  }
  sessionStorage.setItem('sirei_last_active', now);

  // Actualizar timer con cada click
  document.addEventListener('click', () => {
    sessionStorage.setItem('sirei_last_active', new Date().getTime());
  });

  const nombreCompleto = sessionStorage.getItem('sirei_nombre') || nombreUsuario;
  const userNameSpan = document.getElementById('userName');
  if (userNameSpan) userNameSpan.innerText = nombreCompleto;

  const rolSpan = document.getElementById('userRole');
  if (rolSpan) rolSpan.innerText = sessionStorage.getItem('sirei_rol') || 'Administrador';

  // Menú móvil
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (menuToggle && sidebar && overlay) {
    const closeMenu = () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
    };
    const openMenu = () => {
      sidebar.classList.add('mobile-open');
      overlay.classList.add('active');
    };
    menuToggle.addEventListener('click', openMenu);
    overlay.addEventListener('click', closeMenu);
    document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMenu();
    });
  }

  // Cargar pestaña inicial (Datos)
  cargarTabla('datos');

  // Navegación
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      cargarTabla(item.dataset.tab);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);

  function cerrarSesion() {
    SIREI.api.peticionAPI('logout').finally(() => {
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }
});