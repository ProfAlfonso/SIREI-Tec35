// ============================================================
//  coordinador.js - Panel del Coordinador
//  Versión 2.0 - Usa fetch directo, no depende de SIREI.api
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('sirei_token');
  const rol = sessionStorage.getItem('sirei_rol') || '';
  if (!token || rol.toLowerCase() !== 'coordinador') {
    window.location.href = 'index.html';
    return;
  }

  // Mostrar nombre
  const userNameSpan = document.getElementById('userName');
  if (userNameSpan) {
    userNameSpan.textContent = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');
  }
  const userRoleSpan = document.getElementById('userRole');
  if (userRoleSpan) userRoleSpan.textContent = 'Coordinador';

  // Menú móvil (copiado de admin.js)
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(link => link.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('active');
    }));
  }

  // Cargar pestaña inicial (Coordinación)
  cargarTabla('coordinacion');

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
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });
});

// ========== Función cargarTabla (adaptada) ==========
async function cargarTabla(tab) {
  const mainContainer = document.getElementById('tabContent');
  if (!mainContainer) return;

  // Ocultar todas las pestañas existentes
  Array.from(mainContainer.children).forEach(child => {
    child.style.display = 'none';
  });

  let tabContainer = document.getElementById('tab-container-' + tab);
  if (!tabContainer) {
    tabContainer = document.createElement('div');
    tabContainer.id = 'tab-container-' + tab;
    mainContainer.appendChild(tabContainer);
    tabContainer.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando...</p></div>';

    try {
      switch(tab) {
        case 'datos':
          await cargarDatosEscolares(tabContainer);
          break;
        case 'asignaturas':
          await cargarAsignaturas(tabContainer);
          break;
        case 'docentes':
          await cargarDocentes(tabContainer);
          break;
        case 'alumnos':
          await cargarAlumnos(tabContainer);
          break;
        case 'coordinacion':
          // Cargar el script de grupos dinámicamente
          if (typeof window.cargarGrupos === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/grupos.js';
            script.onload = () => window.cargarGrupos(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Grupos.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarGrupos(tabContainer);
          }
          break;
        case 'periodos':
          if (typeof window.cargarPeriodos === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/periodos.js?v=7';
            script.onload = () => window.cargarPeriodos(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Periodos.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarPeriodos(tabContainer);
          }
          break;
        case 'calificacionesFinales':
          if (typeof window.cargarCalificacionesFinalesCoordinador === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/calificaciones_finales.js?v=2';
            script.onload = () => window.cargarCalificacionesFinalesCoordinador(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Calificaciones Finales.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarCalificacionesFinalesCoordinador(tabContainer);
          }
          break;
        default:
          tabContainer.innerHTML = '<div class="error">Pestaña no reconocida.</div>';
      }
    } catch (error) {
      console.error("Error al cargar pestaña:", error);
      tabContainer.innerHTML = `<div class="error">Error al cargar: ${error.message}</div>`;
    }
  } else {
    tabContainer.style.display = 'block';
  }
}

// ========== Funciones de solo lectura para datos, asignaturas, docentes, alumnos ==========

async function cargarDatosEscolares(container) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerConfiguracion',
        token: sessionStorage.getItem('sirei_token')
      })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Error al obtener configuración');
    const config = data.datos || {};
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Datos de la Escuela (solo lectura)</h2>
        <div class="config-logo">
          <div id="logoPreviewContainer">${config.logoUrl ? `<img src="${config.logoUrl}" width="120" style="border-radius:12px; border:1px solid #ddd;">` : '<p>Sin logo</p>'}</div>
        </div>
        <table class="info-table">
          <tr><td><strong>Nombre:</strong></td><td>${SIREI.utils.escapeHtml(config.nombreInstitucion)}</td></tr>
          <tr><td><strong>País:</strong></td><td>${SIREI.utils.escapeHtml(config.pais)}</td></tr>
          <tr><td><strong>Ciudad:</strong></td><td>${SIREI.utils.escapeHtml(config.ciudad)}</td></tr>
          <tr><td><strong>Código Postal:</strong></td><td>${SIREI.utils.escapeHtml(config.codigoPostal)}</td></tr>
          <tr><td><strong>Dirección:</strong></td><td>${SIREI.utils.escapeHtml(config.direccion)}</td></tr>
          <tr><td><strong>Teléfono:</strong></td><td>${SIREI.utils.escapeHtml(config.telefono)}</td></tr>
          <tr><td><strong>Celular:</strong></td><td>${SIREI.utils.escapeHtml(config.celular)}</td></tr>
          <tr><td><strong>Ciclo Escolar:</strong></td><td>${SIREI.utils.escapeHtml(config.cicloEscolar)}</td></tr>
          <tr><td><strong>Periodo escolar:</strong></td><td>${SIREI.utils.escapeHtml(config.periodo)}</td></tr>
          <tr><td><strong>Decimales en calificaciones:</strong></td><td>${SIREI.utils.escapeHtml(config.decimalesCalificacion || config.decimales_calificacion || '')}</td></tr>
          <tr><td><strong>Calificación mínima aprobatoria:</strong></td><td>${SIREI.utils.escapeHtml(config.calificacionMinimaAprobatoria || config.calificacion_minima_aprobatoria || '6')}</td></tr>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function cargarAsignaturas(container) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAsignaturas',
        token: sessionStorage.getItem('sirei_token')
      })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Error al obtener asignaturas');
    const asignaturas = data.asignaturas || [];
    let html = `<div class="card"><h2 class="card-title">Mapa Curricular (solo lectura)</h2>`;
    if (asignaturas.length === 0) {
      html += '<p>No hay asignaturas registradas.</p>';
    } else {
      html += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr style="background:#f9fafb;"><th>ID</th><th>Nombre</th><th>Abreviatura</th><th>Grado</th></tr></thead><tbody>`;
      asignaturas.forEach(a => {
        html += `<tr><td>${SIREI.utils.escapeHtml(a.id)}</td><td>${SIREI.utils.escapeHtml(a.nombre)}</td><td>${SIREI.utils.escapeHtml(a.abreviatura)}</td><td>${SIREI.utils.escapeHtml(a.grado)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function cargarDocentes(container) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerDocentes',
        token: sessionStorage.getItem('sirei_token')
      })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Error al obtener docentes');
    const docentes = data.docentes || [];
    let html = `<div class="card"><h2 class="card-title">Docentes (solo lectura)</h2>`;
    if (docentes.length === 0) {
      html += '<p>No hay docentes registrados.</p>';
    } else {
      html += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr style="background:#f9fafb;"><th>ID</th><th>Nombre</th><th>Email</th><th>Celular</th></tr></thead><tbody>`;
      docentes.forEach(d => {
        html += `<tr><td>${SIREI.utils.escapeHtml(d.id)}</td><td>${SIREI.utils.escapeHtml(d.nombre)}</td><td>${SIREI.utils.escapeHtml(d.emailPersonal)}</td><td>${SIREI.utils.escapeHtml(d.celular)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}

async function cargarAlumnos(container) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAlumnos',
        token: sessionStorage.getItem('sirei_token')
      })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Error al obtener alumnos');
    const alumnos = data.alumnos || [];
    let html = `<div class="card"><h2 class="card-title">Alumnos (solo lectura)</h2>`;
    if (alumnos.length === 0) {
      html += '<p>No hay alumnos registrados.</p>';
    } else {
      html += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr style="background:#f9fafb;"><th>ID</th><th>Apellido Paterno</th><th>Apellido Materno</th><th>Nombre(s)</th><th>CURP</th></tr></thead><tbody>`;
      alumnos.forEach(a => {
        html += `<tr><td>${SIREI.utils.escapeHtml(a.id)}</td><td>${SIREI.utils.escapeHtml(a.apellidoPaterno)}</td><td>${SIREI.utils.escapeHtml(a.apellidoMaterno)}</td><td>${SIREI.utils.escapeHtml(a.nombres)}</td><td>${SIREI.utils.escapeHtml(a.curp)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
  }
}