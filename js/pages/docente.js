// ============================================================
//  SIREI - Panel del Docente
//  Versión 3.3 - CORREGIDA (modal de salidas responsive + QR con debounce)
//  Cambios:
//   - Modal de salidas ahora ocupa toda la pantalla en móviles y es scrollable.
//   - Los lectores QR (asistencia y salidas) solo procesan una lectura cada 1 segundo.
//   - Se agregó un botón para cerrar la cámara en cada lector QR.
// ============================================================

// ============================================================
//  SECCIÓN 1: CARGA INICIAL Y VALIDACIÓN DE SESIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  const token = sessionStorage.getItem('sirei_token');
  const rol = sessionStorage.getItem('sirei_rol') || '';
  if (!token || rol.toLowerCase() !== 'docente') {
    window.location.href = 'index.html';
    return;
  }

  const userNameSpan = document.getElementById('userName');
  if (userNameSpan) {
    userNameSpan.textContent = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');
  }
  const userRoleSpan = document.getElementById('userRole');
  if (userRoleSpan) userRoleSpan.textContent = 'Docente';

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
  }

  // Navegación entre pestañas
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      cargarTabla(item.dataset.tab);
    });
  });

  await cargarTabla('inicio');

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
  });
});

// ============================================================
//  SECCIÓN 1.5: NAVEGACIÓN DE PESTAÑAS Y CARGA DE TABLAS
// ============================================================

async function cargarTabla(tab) {
  const mainContainer = document.getElementById('tabContent');
  if (!mainContainer) return;

  Array.from(mainContainer.children).forEach(child => {
    child.style.display = 'none';
  });

  let tabContainer = document.getElementById('tab-container-' + tab);
  if (!tabContainer) {
    tabContainer = document.createElement('div');
    tabContainer.id = 'tab-container-' + tab;
    mainContainer.appendChild(tabContainer);
  }
  tabContainer.style.display = 'block';

  if (tab === 'inicio') {
    await cargarInicio(tabContainer);
  } else if (tab === 'resultados') {
    await cargarResultadosTab(tabContainer);
  }
}

async function cargarResultadosTab(container) {
  if (typeof window.cargarResultadosDocente === 'undefined') {
    const script = document.createElement('script');
    script.src = 'js/pages/resultados_docente.js?v=1';
    script.onload = () => window.cargarResultadosDocente(container);
    script.onerror = () => { container.innerHTML = '<div class="error">Error al cargar Resultados.</div>'; };
    document.head.appendChild(script);
  } else {
    window.cargarResultadosDocente(container);
  }
}

// ============================================================
//  SECCIÓN 2: FUNCIONES AUXILIARES (OBTENER DATOS)
// ============================================================

async function obtenerGrupos() {
  const cacheKey = 'coordinador_grupos';
  if (window._sireiCache && window._sireiCache[cacheKey]) {
    return window._sireiCache[cacheKey];
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      accion: 'obtenerGrupos',
      token: sessionStorage.getItem('sirei_token')
    })
  });
  const data = await response.json();
  if (data.success) {
    if (!window._sireiCache) window._sireiCache = {};
    window._sireiCache[cacheKey] = data.grupos || [];
    return window._sireiCache[cacheKey];
  }
  return [];
}

async function obtenerAsignaturas() {
  const cacheKey = 'coordinador_asignaturas';
  if (window._sireiCache && window._sireiCache[cacheKey]) {
    return window._sireiCache[cacheKey];
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      accion: 'obtenerAsignaturas',
      token: sessionStorage.getItem('sirei_token')
    })
  });
  const data = await response.json();
  if (data.success) {
    if (!window._sireiCache) window._sireiCache = {};
    window._sireiCache[cacheKey] = data.asignaturas || [];
    return window._sireiCache[cacheKey];
  }
  return [];
}

// ============================================================
//  SECCIÓN 3: FUNCIÓN PRINCIPAL - CARGAR VISTA DE INICIO
// ============================================================

async function cargarInicio(containerParam) {
  const container = containerParam || document.getElementById('tabContent');
  if (!container) return;

  // Mostrar UI inmediatamente con estado de carga
  container.innerHTML = `
    <div class="card" style="text-align:center; padding:40px;">
      <div class="loader-moderno"><div class="spinner"></div><p>Cargando tus datos...</p></div>
    </div>
  `;

  const nombreDocente = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');
  const token = sessionStorage.getItem('sirei_token');

  // ---- Paralelizar peticiones independientes: idDocente, grupos (caché), asignaturas (caché) ----
  let idDocente = null;
  let asignaciones = [], grupos = [], asignaturas = [], claseActiva = null;

  const resultados = await Promise.all([
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerIdDocentePorNombre',
        token: token,
        nombre: nombreDocente
      })
    }).then(r => r.json()).catch(() => ({ success: false })),
    obtenerGrupos().catch(() => []),
    obtenerAsignaturas().catch(() => [])
  ]);

  const dataId = resultados[0];
  if (dataId.success && dataId.idDocente) {
    idDocente = dataId.idDocente;
    window._sireiIdDocente = idDocente;
  } else {
    container.innerHTML = `<div class="card"><div class="error">No se encontró tu perfil de docente. Contacta al administrador.</div></div>`;
    return;
  }

  grupos = resultados[1] || [];
  asignaturas = resultados[2] || [];

  // ---- Finalizar clases vencidas (olvidadas) antes de leer la clase activa ----
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'finalizarClasesVencidas',
        token: token
      })
    }).then(r => r.json());
  } catch (e) {
    console.error('No se pudo verificar clases vencidas:', e);
  }

  // ---- Paralelizar asignaciones y clase activa (dependen de idDocente) ----
  const resultados2 = await Promise.all([
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAsignacionesDocente',
        token: token,
        idDocente: idDocente
      })
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerClaseActiva',
        token: token,
        idDocente: idDocente
      })
    }).then(r => r.json()).catch(() => ({ success: false }))
  ]);

  if (resultados2[0] && resultados2[0].success) asignaciones = resultados2[0].asignaciones || [];
  if (resultados2[1] && resultados2[1].success) claseActiva = resultados2[1].claseActiva;

  if (claseActiva) {
    await mostrarPanelesClaseActiva(container, idDocente, claseActiva, grupos, asignaturas, token);
  } else {
    mostrarOpcionesInicio(container, asignaciones, grupos, asignaturas, idDocente, token);
  }
}

// ============================================================
//  SECCIÓN 4: MOSTRAR PANELES CUANDO HAY CLASE ACTIVA
// ============================================================

// Nombre del alumno según orden: 'apellido' -> "ApellidoP ApellidoM Nombres",
// 'nombre' -> "Nombres ApellidoP ApellidoM". Con fallback a nombreCompleto.
function formatoNombreAlumno(a, orden) {
  if (!a) return '';
  const nom = (a.nombres || '').trim();
  const apP = (a.apellidoPaterno || '').trim();
  const apM = (a.apellidoMaterno || '').trim();
  if (!nom && !apP && !apM) return a.nombreCompleto || '';
  if (orden === 'apellido') {
    const t = [apP, apM, nom].filter(Boolean).join(' ');
    return t || a.nombreCompleto;
  }
  const t = [nom, apP, apM].filter(Boolean).join(' ');
  return t || a.nombreCompleto;
}

async function mostrarPanelesClaseActiva(container, idDocente, claseActiva, grupos, asignaturas, token) {
  const grupo = grupos.find(g => g.id == claseActiva.idGrupo);
  const asignatura = asignaturas.find(a => a.id === claseActiva.idAsignatura);
  const inicio = claseActiva.inicio ? new Date(claseActiva.inicio).toLocaleString('es-ES') : new Date().toLocaleString('es-ES');

  // ---- Obtener alumnos, asistencias y salidas en paralelo ----
  let alumnosGrupo = [], asistencias = [], salidas = [];
  const datosParalelos = await Promise.all([
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAlumnosPorGrupo',
        token: token,
        idGrupo: claseActiva.idGrupo,
        idSubgrupo: claseActiva.idSubgrupo || ''
      })
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAsistenciasClase',
        token: token,
        idClase: claseActiva.idClase
      })
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerSalidasClase',
        token: token,
        idClase: claseActiva.idClase
      })
    }).then(r => r.json()).catch(() => ({ success: false }))
  ]);
  if (datosParalelos[0].success) alumnosGrupo = datosParalelos[0].alumnos || [];
  if (datosParalelos[1].success) asistencias = datosParalelos[1].asistencias || [];
  if (datosParalelos[2].success) salidas = datosParalelos[2].salidas || [];

  // Ordenar por apellido paterno por defecto (estándar en listas escolares de México)
  alumnosGrupo.sort((a, b) => {
    const apA = (a.apellidoPaterno || '').toLowerCase();
    const apB = (b.apellidoPaterno || '').toLowerCase();
    if (apA !== apB) return apA.localeCompare(apB);
    return (a.nombreCompleto || '').toLowerCase().localeCompare((b.nombreCompleto || '').toLowerCase());
  });

  const alumnoFuera = salidas.find(s => s.estado === 'Fuera');

  // ---- Datalist para autocompletado ----
  const datalistId = 'alumnos-list';
  const datalistOptions = alumnosGrupo.map(a =>
    `<option value="${a.nombreCompleto}">${a.nombreCompleto} (${a.curp})</option>`
  ).join('');

  // ---- HTML principal (con mejoras en el modal de salidas para móviles) ----
  let html = `
    <div class="panel-docente">
      <!-- Cabecera de clase -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px; margin-bottom:16px;">
        <p><strong>Grupo:</strong> ${grupo ? SIREI.utils.escapeHtml(grupo.nombre) : 'Desconocido'}</p>
        <p><strong>Asignatura:</strong> ${asignatura ? SIREI.utils.escapeHtml(asignatura.nombre) : 'Desconocida'}</p>
        <p><strong>Periodo:</strong> ${claseActiva.periodo || 'No asignado'}</p>
        <p><strong>Inicio:</strong> ${inicio}</p>
        <button id="btnFinalizarClase" class="btn btn-danger" style="margin-top:8px; width:100%;">Finalizar clase</button>
      </div>

      <!-- Navegación de pestañas -->
      <div class="nav-paneles">
        <button class="btn-panel activo" data-panel="asistencia">📋 Asistencia</button>
        <button class="btn-panel" data-panel="actitudinal">😊 Actitudinal</button>
        <button class="btn-panel" data-panel="academico">📚 Académico</button>
      </div>

      <!-- Contenido de los paneles -->
      <div id="contenido-asistencia" class="contenido-panel activo"></div>
      <div id="contenido-actitudinal" class="contenido-panel">
        <!-- Se cargará dinámicamente con actitudes_docente.js -->
        <div id="actitudesDocenteContainer"></div>
      </div>
      <div id="contenido-academico" class="contenido-panel">
        <!-- Se cargará dinámicamente con academico_docente.js -->
        <div id="academicoDocenteContainer"></div>
      </div>

      <!-- Botón flotante para salidas -->
      <button class="btn-flotante-salidas" id="btnAbrirSalidas">🚪</button>
    </div>

    <!-- Modal de Salidas (REDISEÑADO para móviles) -->
    <div class="modal-salidas-full" id="modalSalidasFull">
      <div style="display:flex; flex-direction:column; width:100%; height:100%; background:transparent; padding:0;">
      <!-- Cabecera (compacta para móviles) -->
<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:#f8fafc; border-bottom:1px solid #e5e7eb; flex-shrink:0; min-height:40px;">
  <h2 style="margin:0; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
    <span style="font-size:1.2rem;">🚪</span> Entradas / Salidas
    <span id="iconoBano" title="Estado del baño" style="font-size:1.1rem; margin-left:4px;">🚻✅</span>
  </h2>
  <button id="btnCerrarSalidasFull" style="background:none; border:none; font-size:1.3rem; cursor:pointer; padding:0 6px;">✕</button>
</div>
      <div id="confirmacionSalidaEntrada" style="display:none;"></div>

      <!-- Contenido del modal (scrollable) -->
      <div style="padding:16px 20px; flex:1; overflow-y:auto;">

        <!-- Resumen de alumnos fuera -->
        <div id="estado-salidas" style="margin-bottom:20px; padding:12px; background:#fef3c7; border-radius:10px; border-left:4px solid #f59e0b;">
          <p style="margin:0; font-weight:600; color:#92400e;">📤 Alumnos fuera de clase:</p>
          <div id="listaAlumnosFuera" style="margin-top:6px; font-size:0.95rem;">
            <span style="color:#6b7280;">Cargando...</span>
          </div>
        </div>

        <!-- Botón Escape (oculto por defecto) -->
        <button id="btnEscapeSalida" style="display:none; margin-top:10px; padding:10px 16px; background:#dc2626; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer; width:100%;">
          🏃 Registrar como Escape (ir a Actitudinal)
        </button>

        <!-- Botones de acción (grandes y táctiles) -->
        <div style="display:flex; gap:12px; margin-bottom:20px;">
          <button id="btnAccionSalida" class="btn-salida" style="flex:1; padding:16px; background:#f59e0b; color:white; border:none; border-radius:12px; font-size:1.1rem; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(245,158,11,0.3); display:flex; align-items:center; justify-content:center; gap:8px;">
            📤 Registrar Salida
          </button>
          <button id="btnAccionEntrada" class="btn-entrada" style="flex:1; padding:16px; background:#10b981; color:white; border:none; border-radius:12px; font-size:1.1rem; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center; gap:8px;">
            📥 Registrar Entrada
          </button>
        </div>

        <!-- Sección de motivo (solo para salida) -->
        <div id="seccion-motivo" style="display:none; margin-bottom:16px; padding:16px; background:#f9fafb; border-radius:12px; border:1px solid #e5e7eb;">
          <p style="font-weight:600; margin:0 0 12px 0;">Selecciona el motivo:</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="boton-motivo" data-motivo="Baño" style="padding:14px; background:#fff; border:2px solid #e5e7eb; border-radius:10px; font-size:1rem; cursor:pointer; display:flex; align-items:center; gap:10px; justify-content:center;">
              <span style="font-size:1.5rem;">🚻</span> Baño
            </button>
            <button class="boton-motivo otro" data-motivo="Otro" style="grid-column: span 2; padding:14px; background:#fff; border:2px dashed #e5e7eb; border-radius:10px; font-size:1rem; cursor:pointer; display:flex; align-items:center; gap:10px; justify-content:center;">
              <span style="font-size:1.5rem;">📝</span> Otro
            </button>
          </div>
          <div class="campo-otro-motivo" id="campoOtroMotivo" style="display:none; margin-top:12px;">
            <label style="font-weight:500; display:block; margin-bottom:4px;">Especifica el motivo:</label>
            <textarea id="textoOtroMotivo" rows="2" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;"></textarea>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-top:10px;">
              <label style="display:flex; align-items:center; gap:8px; font-weight:500; font-size:0.9rem; cursor:pointer;">
                <input type="checkbox" id="chkRegresa" checked style="width:18px; height:18px; accent-color:#10b981;"> ¿Va a regresar?
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-weight:500; font-size:0.8rem; cursor:pointer;">
                <input type="checkbox" id="chkMantenerMotivo" style="width:16px; height:16px; accent-color:#1E3A8A;"> Mantener
              </label>
            </div>
          </div>
        </div>

        <!-- Selección de alumno + QR -->
        <div style="margin-bottom:16px;">
          <label style="font-weight:500; display:block; margin-bottom:4px;">👤 Alumno (nombre o CURP)</label>
          <div style="display:flex; gap:10px; align-items:center;">
            <input type="text" id="inputSalidaFull" list="${datalistId}" placeholder="Ej: Juan Pérez o CURP" style="flex:3; padding:12px; border-radius:10px; border:1px solid #d1d5db; font-size:1rem;">
            <datalist id="${datalistId}">${datalistOptions}</datalist>
            <button id="btnEscanearSalidaFull" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:10px; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
              📷 QR
            </button>
          </div>
          <div id="qr-reader-salida-full" style="width:100%; max-width:300px; margin:10px auto; display:none;"></div>
        </div>

        <!-- Botón Confirmar -->
        <div style="margin-top:12px;">
          <button id="btnConfirmarSalidaEntrada" class="btn-confirmar" style="width:100%; padding:14px; background:#1E3A8A; color:white; border:none; border-radius:10px; font-size:1rem; font-weight:600; cursor:pointer;">
            ✅ Confirmar
          </button>
        </div>

        <!-- Historial de movimientos -->
        <div id="historial-salidas" style="margin-top:16px; border-top:2px solid #e5e7eb; padding-top:12px;">
          <h3 style="font-size:1rem; margin:0 0 8px 0; display:flex; align-items:center; gap:6px; color:#1f2937;">
            <span>📋</span> Historial reciente
            <span id="contadorHistorial" style="font-size:0.75rem; color:#4b5563; font-weight:400;"></span>
          </h3>
          <div id="listaHistorial" style="max-height:200px; overflow-y:auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; color:#1f2937;">
            <p style="color:#4b5563; font-size:0.9rem;">Cargando historial...</p>
          </div>
      </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // ---- Precargar actitudes y académico en segundo plano inmediatamente ----
  window._precargaActitudes = null;
  window._precargaAcademico = null;

  function precargarActitudes() {
    const container = document.getElementById('actitudesDocenteContainer');
    if (!container || container.dataset.cargado) return;
    container.dataset.cargado = 'true';
    if (typeof window.cargarActitudesDocente === 'undefined') {
      const script = document.createElement('script');
      script.src = 'js/pages/actitudes_docente.js';
      script.onload = () => {
        window._precargaActitudes = window.cargarActitudesDocente(container, idDocente, claseActiva.idGrupo, claseActiva.idAsignatura, claseActiva.periodo, token, claseActiva.idSubgrupo);
      };
      script.onerror = () => {
        container.innerHTML = '<div class="error">Error al cargar módulo de actitudes.</div>';
      };
      document.head.appendChild(script);
    } else {
      window._precargaActitudes = window.cargarActitudesDocente(container, idDocente, claseActiva.idGrupo, claseActiva.idAsignatura, claseActiva.periodo, token, claseActiva.idSubgrupo);
    }
  }

  function precargarAcademico() {
    const container = document.getElementById('academicoDocenteContainer');
    if (!container || container.dataset.cargado) return;
    container.dataset.cargado = 'true';
    if (typeof window.cargarAcademicoDocente === 'undefined') {
      const script = document.createElement('script');
      script.src = 'js/pages/academico_docente.js';
      script.onload = () => {
        window._precargaAcademico = window.cargarAcademicoDocente(container, idDocente, claseActiva.idGrupo, claseActiva.idAsignatura, claseActiva.periodo, token, claseActiva.idSubgrupo);
      };
      script.onerror = () => {
        container.innerHTML = '<div class="error">Error al cargar módulo académico.</div>';
      };
      document.head.appendChild(script);
    } else {
      window._precargaAcademico = window.cargarAcademicoDocente(container, idDocente, claseActiva.idGrupo, claseActiva.idAsignatura, claseActiva.periodo, token, claseActiva.idSubgrupo);
    }
  }

  // Precargar después de 1 segundo para no competir con la carga inicial
  setTimeout(precargarActitudes, 1000);
  setTimeout(precargarAcademico, 1500);

  // ---- Manejo de pestañas (ya con datos precargados) ----
  document.querySelectorAll('.btn-panel').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      if (panel === 'actitudinal') {
        const container = document.getElementById('actitudesDocenteContainer');
        if (container && !container.dataset.cargado) {
          precargarActitudes();
        }
      }
      if (panel === 'academico') {
        const container = document.getElementById('academicoDocenteContainer');
        if (container && !container.dataset.cargado) {
          precargarAcademico();
        }
      }
    });
  });

  // ---- Rellenar el panel de asistencia ----
  const contenedorAsistencia = document.getElementById('contenido-asistencia');

  const conteos = { Presente: 0, Retardo: 0, Ausente: 0, Pendiente: 0 };
  alumnosGrupo.forEach(alumno => {
    const asist = asistencias.find(a => a.curp === alumno.curp);
    const estado = asist ? asist.estado : 'Pendiente';
    conteos[estado] = (conteos[estado] || 0) + 1;
  });
  const total = alumnosGrupo.length;

  const modalQR = `
    <div style="margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <button id="btnAsistenciaQR" class="btn btn-primary" style="flex:1;">📷 QR</button>
      <button id="btnAsistenciaManual" class="btn btn-secondary" style="flex:1;">✏️ Manual</button>
      <button id="btnOrdenAsistencia" class="btn btn-secondary" style="padding:6px 10px; flex:0 0 auto;" title="Alternar orden de la lista">🔤 Apellido</button>
      <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
        <label for="chkRetardo" style="font-size:0.9rem; font-weight:500;">⏰ Retardo</label>
        <input type="checkbox" id="chkRetardo" style="width:20px; height:20px; accent-color:#f59e0b;">
      </div>
    </div>
    <!-- CONTADORES -->
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; font-size:0.9rem; background:#f9fafb; padding:8px 12px; border-radius:8px;">
      <span style="color:#10b981;">✅ Presentes: <strong id="count-presente">${conteos.Presente}</strong></span>
      <span style="color:#f59e0b;">⏰ Retardo: <strong id="count-retardo">${conteos.Retardo}</strong></span>
      <span style="color:#ef4444;">❌ Ausentes: <strong id="count-ausente">${conteos.Ausente}</strong></span>
      <span style="color:#6b7280;">⏳ Pendientes: <strong id="count-pendiente">${conteos.Pendiente}</strong></span>
      <span style="color:#1f2937;">👥 Total: <strong>${total}</strong></span>
    </div>
    <div id="vistaQR" style="display:none; background:white; border-radius:8px; padding:12px; border:1px solid #d1d5db; margin-bottom:12px;">
      <p><strong>Escanea el QR del alumno</strong></p>
      <button id="btnAbrirCamara" class="btn btn-primary" style="width:100%; margin-bottom:8px;">📷 Abrir cámara</button>
      <div id="qr-reader-asistencia" style="width:100%; max-width:300px; margin:0 auto; display:none;"></div>
      <div style="margin-top:8px;">
        <p><small>O ingresa CURP o nombre:</small></p>
        <input type="text" id="inputQR" list="${datalistId}" placeholder="CURP o nombre..." style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db;">
        <datalist id="${datalistId}">${datalistOptions}</datalist>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button id="btnConfirmarQR" class="btn btn-primary" style="flex:1;">Confirmar</button>
          <button id="btnCerrarQR" class="btn btn-secondary" style="flex:1;">Cancelar</button>
        </div>
      </div>
    </div>
    <div id="vistaManual" style="display:none;">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <span style="font-weight:500;">Cambiar todos a:</span>
        <select id="selectCambioMasivo" style="padding:6px 10px; border-radius:6px; border:1px solid #d1d5db;">
          <option value="Presente">Presente</option>
          <option value="Retardo">Retardo</option>
          <option value="Ausente">Ausente</option>
        </select>
        <button id="btnAplicarCambioMasivo" class="btn btn-secondary" style="padding:4px 12px;">Aplicar</button>
        <button id="btnSincronizar" class="btn btn-secondary" style="padding:4px 12px;">🔄 Sincronizar</button>
      </div>
      <div class="lista-alumnos-manual">
        ${alumnosGrupo.map(alumno => {
          const asist = asistencias.find(a => a.curp === alumno.curp);
          const estadoActual = asist ? asist.estado : 'Pendiente';
          return `<div class="alumno-item" data-curp="${alumno.curp}">
            <span>${SIREI.utils.escapeHtml(formatoNombreAlumno(alumno, 'apellido'))}</span>
            <select class="select-estado-manual" data-curp="${alumno.curp}">
              <option value="Presente" ${estadoActual === 'Presente' ? 'selected' : ''}>Presente</option>
              <option value="Retardo" ${estadoActual === 'Retardo' ? 'selected' : ''}>Retardo</option>
              <option value="Ausente" ${estadoActual === 'Ausente' ? 'selected' : ''}>Ausente</option>
              <option value="Pendiente" ${estadoActual === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            </select>
          </div>`;
        }).join('')}
      </div>
      <button id="btnGuardarManual" class="btn btn-primary" style="width:100%; margin-top:12px;">Guardar todos</button>
    </div>
    <div id="resumen-asistencia" style="margin-top:12px; border-top:1px solid #e5e7eb; padding-top:12px;">
      ${alumnosGrupo.map(alumno => {
        const asist = asistencias.find(a => a.curp === alumno.curp);
        const estado = asist ? asist.estado : 'Pendiente';
        const color = estado === 'Presente' ? '#10b981' : estado === 'Retardo' ? '#f59e0b' : estado === 'Ausente' ? '#ef4444' : '#6b7280';
        return `<div data-curp="${alumno.curp}" style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6; font-size:0.9rem;">
          <span>${SIREI.utils.escapeHtml(formatoNombreAlumno(alumno, 'apellido'))}</span>
          <span style="color:${color}; font-weight:600;">${estado}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      <select id="filtroWhatsApp" style="flex:1; min-width:160px; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
        <option value="todos">Todos</option>
        <option value="Presente">Solo los presentes</option>
        <option value="Ausente">Solo los ausentes</option>
        <option value="Pendiente">Solo los pendientes</option>
        <option value="Retardo">Solo los retardos</option>
      </select>
      <button id="btnEnviarWhatsApp" class="btn btn-primary" style="flex:2; min-width:200px; background:#25D366; border:none;">📲 Enviar por WhatsApp</button>
    </div>
  `;
  contenedorAsistencia.innerHTML = modalQR;

  // ---- Configurar eventos (incluyendo las mejoras de QR y modal) ----
  configurarEventosPaneles(container, idDocente, claseActiva, token, alumnosGrupo, grupo, asignatura);
}

// ============================================================
//  SECCIÓN 4.5: EVENTOS DE LOS PANELES (CORREGIDO)
// ============================================================

function configurarEventosPaneles(container, idDocente, claseActiva, token, alumnosGrupo, grupoInfo, asignaturaInfo) {
  let qrReaderAsistencia = null;
  let qrReaderSalidaFull = null;
  let escaneoActivo = false;

  // Orden de la lista de asistencia: 'apellido' (por defecto) o 'nombre'
  let ordenAsistencia = 'apellido';

  function compararAlumnos(a, b) {
    if (ordenAsistencia === 'apellido') {
      const apA = (a.apellidoPaterno || '').toLowerCase();
      const apB = (b.apellidoPaterno || '').toLowerCase();
      if (apA !== apB) return apA.localeCompare(apB);
      return (a.nombreCompleto || '').toLowerCase().localeCompare((b.nombreCompleto || '').toLowerCase());
    }
    return (a.nombreCompleto || '').toLowerCase().localeCompare((b.nombreCompleto || '').toLowerCase());
  }

  function alumnosOrdenados() {
    return alumnosGrupo.slice().sort(compararAlumnos);
  }

  // Nombre a mostrar según el orden activo (apellido-primero o nombre-primero)
  function nombreParaMostrar(a) {
    return formatoNombreAlumno(a, ordenAsistencia);
  }

  // Todas las variantes de nombre para búsqueda (tolerante al orden mostrado)
  function variantesNombre(a) {
    const v = [a.nombreCompleto, formatoNombreAlumno(a, 'apellido'), formatoNombreAlumno(a, 'nombre')];
    return v.filter(Boolean);
  }

  function buscarAlumnoPorTexto(valor) {
    const v = String(valor || '').trim();
    if (!v) return null;
    let al = alumnosGrupo.find(a => a.curp === v.toUpperCase());
    if (al) return al;
    const low = v.toLowerCase();
    return alumnosGrupo.find(a => variantesNombre(a).some(x => String(x).toLowerCase().includes(low))) || null;
  }

  // Actualiza los textos de nombres en lista manual y resumen según el orden activo
  function actualizarNombresAsistencia() {
    const mapaNombres = {};
    alumnosGrupo.forEach(a => { mapaNombres[a.curp] = nombreParaMostrar(a); });
    document.querySelectorAll('.lista-alumnos-manual .alumno-item').forEach(item => {
      const span = item.querySelector('span');
      if (span && mapaNombres[item.dataset.curp]) span.textContent = mapaNombres[item.dataset.curp];
    });
    const resumen = document.getElementById('resumen-asistencia');
    if (resumen) {
      resumen.querySelectorAll('div[data-curp]').forEach(row => {
        const span = row.querySelector('span:first-child');
        if (span && mapaNombres[row.dataset.curp]) span.textContent = mapaNombres[row.dataset.curp];
      });
    }
  }

  // Reordena la lista manual y el resumen sin perder los estados ya seleccionados
  function reordenarAsistencia() {
    const ordenados = alumnosOrdenados();
    const mapaOrden = {};
    ordenados.forEach((a, i) => { mapaOrden[a.curp] = i; });

    const listaManual = document.querySelector('.lista-alumnos-manual');
    if (listaManual) {
      const items = Array.from(listaManual.querySelectorAll('.alumno-item'));
      items.sort((x, y) => {
        const ix = mapaOrden[x.dataset.curp] != null ? mapaOrden[x.dataset.curp] : 9999;
        const iy = mapaOrden[y.dataset.curp] != null ? mapaOrden[y.dataset.curp] : 9999;
        return ix - iy;
      });
      items.forEach(item => listaManual.appendChild(item));
    }

    const resumen = document.getElementById('resumen-asistencia');
    if (resumen) {
      const rows = Array.from(resumen.querySelectorAll('div[data-curp]'));
      rows.sort((x, y) => {
        const ix = mapaOrden[x.dataset.curp] != null ? mapaOrden[x.dataset.curp] : 9999;
        const iy = mapaOrden[y.dataset.curp] != null ? mapaOrden[y.dataset.curp] : 9999;
        return ix - iy;
      });
      rows.forEach(r => resumen.appendChild(r));
    }

    actualizarNombresAsistencia();
  }

  // ---- Función para actualizar contadores ----
  function actualizarContadores() {
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (!resumenDiv) return;
    const items = resumenDiv.querySelectorAll('div[data-curp]');
    let conteos = { Presente: 0, Retardo: 0, Ausente: 0, Pendiente: 0 };
    items.forEach(item => {
      const estadoSpan = item.querySelector('span:last-child');
      if (estadoSpan) {
        const estado = estadoSpan.textContent;
        if (conteos.hasOwnProperty(estado)) conteos[estado]++;
      }
    });
    ['presente', 'retardo', 'ausente', 'pendiente'].forEach(key => {
      const el = document.getElementById('count-' + key);
      if (el) el.textContent = conteos[key.charAt(0).toUpperCase() + key.slice(1)];
    });
  }

  // ---- Sincronizar selectores con resumen (por CURP, tolerante al formato de nombre) ----
  function sincronizarSelectores() {
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (!resumenDiv) return;
    const items = resumenDiv.querySelectorAll('div[data-curp]');
    for (const item of items) {
      const spanEstado = item.querySelector('span:last-child');
      if (spanEstado && item.dataset.curp) {
        const select = document.querySelector(`.select-estado-manual[data-curp="${item.dataset.curp}"]`);
        if (select) select.value = spanEstado.textContent.trim();
      }
    }
  }

  // ---- Actualizar estado de un alumno ----
  function actualizarEstadoAlumno(curp, nuevoEstado) {
    // Actualizar resumen (búsqueda por CURP, no por texto del nombre)
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (resumenDiv) {
      const row = resumenDiv.querySelector(`div[data-curp="${curp}"]`);
      if (row) {
        const spanEstado = row.querySelector('span:last-child');
        if (spanEstado) {
          const color = nuevoEstado === 'Presente' ? '#10b981' : nuevoEstado === 'Retardo' ? '#f59e0b' : nuevoEstado === 'Ausente' ? '#ef4444' : '#6b7280';
          spanEstado.textContent = nuevoEstado;
          spanEstado.style.color = color;
        }
      }
    }
    // Actualizar selector manual
    const selectManual = document.querySelector(`.select-estado-manual[data-curp="${curp}"]`);
    if (selectManual) selectManual.value = nuevoEstado;

    // Actualizar contadores
    actualizarContadores();

    // Vibración (feedback táctil)
    if (navigator.vibrate) navigator.vibrate(50);
  }

  // ---- 1. NAVEGACIÓN DE PESTAÑAS ----
  document.querySelectorAll('.btn-panel').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-panel').forEach(b => b.classList.remove('activo'));
      document.querySelectorAll('.contenido-panel').forEach(p => p.classList.remove('activo'));
      btn.classList.add('activo');
      document.getElementById('contenido-' + btn.dataset.panel).classList.add('activo');
    });
  });

  // ---- 1.1 ORDEN DE LA LISTA (apellido / nombre). P10: default apellido paterno ----
  const btnOrden = document.getElementById('btnOrdenAsistencia');
  if (btnOrden) {
    btnOrden.addEventListener('click', () => {
      ordenAsistencia = (ordenAsistencia === 'apellido') ? 'nombre' : 'apellido';
      btnOrden.textContent = (ordenAsistencia === 'apellido') ? '🔤 Apellido' : '🔤 Nombre';
      reordenarAsistencia();
      SIREI.utils.mostrarToast('Orden: ' + (ordenAsistencia === 'apellido' ? 'apellido paterno' : 'nombre'), 'warning');
    });
  }

  // ---- 1.2 ENVIAR POR WHATSAPP (filtros + resumen + formato; respeta orden actual) ----
  const btnWhats = document.getElementById('btnEnviarWhatsApp');
  if (btnWhats) {
    btnWhats.addEventListener('click', () => {
      const nombreAsignatura = (asignaturaInfo && asignaturaInfo.nombre) || claseActiva.idAsignatura || 'Asignatura';
      const nombreGrupo = (grupoInfo && grupoInfo.nombre) || '';
      const nombreProfesor = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user') || '';
      const ahora = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fechaHora = pad(ahora.getDate()) + '/' + pad(ahora.getMonth() + 1) + '/' + ahora.getFullYear() + ' ' + pad(ahora.getHours()) + ':' + pad(ahora.getMinutes());
      const filtroSel = document.getElementById('filtroWhatsApp');
      const filtro = filtroSel ? filtroSel.value : 'todos';
      // Mapa curp -> estado actual del resumen (incluye cambios QR/manual sin guardar)
      const mapaEstados = {};
      const resumenDiv = document.getElementById('resumen-asistencia');
      if (resumenDiv) {
        resumenDiv.querySelectorAll('div[data-curp]').forEach(row => {
          const curp = row.dataset.curp;
          const spanEstado = row.querySelector('span:last-child');
          if (curp && spanEstado) mapaEstados[curp] = (spanEstado.textContent || '').trim() || 'Pendiente';
        });
      }
      const ordenados = alumnosOrdenados();
      let cPres = 0, cRet = 0, cAus = 0, cPen = 0;
      ordenados.forEach(a => {
        const est = mapaEstados[a.curp] || 'Pendiente';
        if (est === 'Presente') cPres++;
        else if (est === 'Retardo') cRet++;
        else if (est === 'Ausente') cAus++;
        else if (est === 'Pendiente') cPen++;
      });
      const total = ordenados.length;
      // Limpia caracteres de formato de WhatsApp en nombres para no romper el mensaje
      const limpiarWA = (s) => String(s == null ? '' : s).replace(/[*_~`]/g, '').trim();
      const formatoEstado = (est) => {
        if (est === 'Ausente') return '*Ausente*';
        if (est === 'Pendiente') return '_Pendiente_';
        return est;
      };
      const etiquetasFiltro = { todos: 'Todos', Presente: 'Solo presentes', Ausente: 'Solo ausentes', Pendiente: 'Solo pendientes', Retardo: 'Solo retardos' };
      const lineas = ordenados
        .filter(a => (filtro === 'todos') || ((mapaEstados[a.curp] || 'Pendiente') === filtro))
        .map(a => {
          const est = mapaEstados[a.curp] || 'Pendiente';
          return '- ' + limpiarWA(nombreParaMostrar(a)) + ': ' + formatoEstado(est);
        });
      const mensaje = 'Asignatura: ' + nombreAsignatura + '\n'
        + 'Profesor: ' + nombreProfesor + '\n'
        + 'Fecha: ' + fechaHora + '\n'
        + 'Grupo: ' + nombreGrupo + '\n'
        + '✅ Presentes: ' + cPres + '\n'
        + '⏰ Retardo: ' + cRet + '\n'
        + '❌ Ausentes: ' + cAus + '\n'
        + '⏳ Pendientes: ' + cPen + '\n'
        + '👥 Total: ' + total + '\n'
        + 'Asistencia (' + (etiquetasFiltro[filtro] || 'Todos') + '):\n'
        + (lineas.length > 0 ? lineas.join('\n') : '(Sin alumnos en este filtro)');
      window.open('https://wa.me/?text=' + encodeURIComponent(mensaje), '_blank');
    });
  }

  // ---- 2. ASISTENCIA QR (cierra cámara al leer) ----
  document.getElementById('btnAsistenciaQR').addEventListener('click', () => {
    document.getElementById('vistaQR').style.display = 'block';
    document.getElementById('vistaManual').style.display = 'none';
    document.getElementById('inputQR').value = '';
    document.getElementById('qr-reader-asistencia').style.display = 'none';
    escaneoActivo = false;
    if (qrReaderAsistencia) {
      qrReaderAsistencia.stop().catch(() => {});
      qrReaderAsistencia = null;
    }
  });

  document.getElementById('btnAbrirCamara').addEventListener('click', () => {
    const readerContainer = document.getElementById('qr-reader-asistencia');
    const btnCam = document.getElementById('btnAbrirCamara');
    if (qrReaderAsistencia) {
      qrReaderAsistencia.stop().catch(() => {});
      qrReaderAsistencia = null;
      readerContainer.style.display = 'none';
      escaneoActivo = false;
      btnCam.textContent = '📷 Abrir cámara';
      return;
    }
    btnCam.textContent = '❌ Cerrar cámara';
    readerContainer.style.display = 'block';
    readerContainer.innerHTML = '';
    qrReaderAsistencia = new Html5Qrcode("qr-reader-asistencia");
    const config = { fps: 10, qrbox: { width: 200, height: 200 } };
    qrReaderAsistencia.start(
      { facingMode: "environment" },
      config,
      async (decodedText) => {
        // Cerrar cámara INMEDIATAMENTE para no leer el mismo código repetido
        if (qrReaderAsistencia) {
          qrReaderAsistencia.stop().catch(() => {});
          qrReaderAsistencia = null;
        }
        const readerContainer = document.getElementById('qr-reader-asistencia');
        if (readerContainer) readerContainer.style.display = 'none';
        const btnCam = document.getElementById('btnAbrirCamara');
        if (btnCam) btnCam.textContent = '📷 Abrir cámara';
        escaneoActivo = false;

        const curp = decodedText.trim().toUpperCase();
        const alumno = alumnosGrupo.find(a => a.curp === curp);
        if (!alumno) {
          SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
          return;
        }
        const chkRetardo = document.getElementById('chkRetardo');
        const estado = chkRetardo && chkRetardo.checked ? 'Retardo' : 'Presente';
        const tipoToast = estado === 'Retardo' ? 'warning' : 'success';
        SIREI.utils.mostrarToast(`${nombreParaMostrar(alumno)} - ${estado}`, tipoToast);

        // Actualizar vista
        actualizarEstadoAlumno(curp, estado);
        if (navigator.vibrate) navigator.vibrate(50);

        // Enviar al servidor (incluyendo idDocente)
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarAsistencia',
            token: token,
            idClase: claseActiva.idClase,
            curpAlumno: curp,
            estado: estado,
            tipo: 'QR',
            idDocente: idDocente,
            idGrupo: claseActiva.idGrupo,
            idAsignatura: claseActiva.idAsignatura,
            periodo: claseActiva.periodo
          })
        }).catch(e => console.error(e));
      },
      (err) => {}
    );
    escaneoActivo = true;
  });

  // ---- 3. ASISTENCIA MANUAL ----
  document.getElementById('btnAsistenciaManual').addEventListener('click', () => {
    document.getElementById('vistaQR').style.display = 'none';
    document.getElementById('vistaManual').style.display = 'block';
    sincronizarSelectores();
    if (qrReaderAsistencia) {
      qrReaderAsistencia.stop().catch(() => {});
      qrReaderAsistencia = null;
      document.getElementById('btnAbrirCamara').textContent = '📷 Abrir cámara';
    }
    document.getElementById('qr-reader-asistencia').style.display = 'none';
    escaneoActivo = false;
  });

  // ---- 4. Confirmar asistencia (input manual) ----
  document.getElementById('btnConfirmarQR').addEventListener('click', async () => {
    const input = document.getElementById('inputQR');
    const valor = input.value.trim();
    if (!valor) {
      SIREI.utils.mostrarToast('Ingresa CURP o nombre del alumno.', 'error');
      return;
    }
    const alumno = buscarAlumnoPorTexto(valor);
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      return;
    }
    const curp = alumno.curp;
    const chkRetardo = document.getElementById('chkRetardo');
    const estado = chkRetardo && chkRetardo.checked ? 'Retardo' : 'Presente';
    const tipoToast = estado === 'Retardo' ? 'warning' : 'success';
    SIREI.utils.mostrarToast(`${nombreParaMostrar(alumno)} - ${estado}`, tipoToast);

    actualizarEstadoAlumno(curp, estado);

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'registrarAsistencia',
        token: token,
        idClase: claseActiva.idClase,
        curpAlumno: curp,
        estado: estado,
        tipo: 'Manual',
        idDocente: idDocente,
        idGrupo: claseActiva.idGrupo,
        idAsignatura: claseActiva.idAsignatura,
        periodo: claseActiva.periodo
      })
    }).catch(e => console.error(e));

    input.value = '';
  });

  document.getElementById('btnCerrarQR').addEventListener('click', () => {
    document.getElementById('vistaQR').style.display = 'none';
    if (qrReaderAsistencia) {
      qrReaderAsistencia.stop().catch(() => {});
      qrReaderAsistencia = null;
      document.getElementById('btnAbrirCamara').textContent = '📷 Abrir cámara';
    }
    document.getElementById('qr-reader-asistencia').style.display = 'none';
    escaneoActivo = false;
  });

  // ---- 5. CAMBIO MASIVO ----
  document.getElementById('btnAplicarCambioMasivo').addEventListener('click', () => {
    const selectMasivo = document.getElementById('selectCambioMasivo');
    const nuevoEstado = selectMasivo.value;
    const selects = document.querySelectorAll('.select-estado-manual');
    selects.forEach(sel => sel.value = nuevoEstado);
  });

  // ---- 6. SINCRONIZAR ----
  document.getElementById('btnSincronizar').addEventListener('click', () => {
    sincronizarSelectores();
    SIREI.utils.mostrarToast('Selectores sincronizados con los estados actuales.');
  });

  // ---- 7. GUARDAR MANUAL (en segundo plano, no bloquea la UI) ----
  document.getElementById('btnGuardarManual').addEventListener('click', () => {
    const selects = document.querySelectorAll('.select-estado-manual');
    const asistenciasData = [];
    const actualizaciones = {};

    for (const select of selects) {
      let estado = select.value;
      if (estado === 'Pendiente') estado = 'Ausente';
      const curp = select.dataset.curp;
      asistenciasData.push({ curp, estado });
      actualizaciones[curp] = estado;
    }

    // Actualizar vista local inmediatamente (por CURP, tolerante al formato de nombre)
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (resumenDiv) {
      const items = resumenDiv.querySelectorAll('div[data-curp]');
      items.forEach(item => {
        const spanEstado = item.querySelector('span:last-child');
        if (spanEstado && actualizaciones[item.dataset.curp] !== undefined) {
          const nuevoEstado = actualizaciones[item.dataset.curp];
          const color = nuevoEstado === 'Presente' ? '#10b981' : nuevoEstado === 'Retardo' ? '#f59e0b' : nuevoEstado === 'Ausente' ? '#ef4444' : '#6b7280';
          spanEstado.textContent = nuevoEstado;
          spanEstado.style.color = color;
        }
      });
      actualizarContadores();
    }

    // Mostrar feedback inmediato
    SIREI.utils.mostrarToast('Guardando en segundo plano...', 'success');

    // Enviar al servidor sin await (background)
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'registrarAsistenciasMasivas',
        token: token,
        idClase: claseActiva.idClase,
        idDocente: idDocente,
        idGrupo: claseActiva.idGrupo,
        idAsignatura: claseActiva.idAsignatura,
        periodo: claseActiva.periodo || '',
        asistencias: JSON.stringify(asistenciasData)
      })
    })
    .then(r => r.json())
    .then(result => {
      if (result.success) {
        SIREI.utils.mostrarToast('Asistencias guardadas.');
      } else {
        SIREI.utils.mostrarToast('Error al guardar: ' + (result.message || ''), 'error');
      }
    })
    .catch(() => {
      SIREI.utils.mostrarToast('Error de conexión al guardar. Reintentando...', 'error');
      // Reintentar una vez
      setTimeout(() => {
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarAsistenciasMasivas',
            token: token,
            idClase: claseActiva.idClase,
            idDocente: idDocente,
            idGrupo: claseActiva.idGrupo,
            idAsignatura: claseActiva.idAsignatura,
            periodo: claseActiva.periodo || '',
            asistencias: JSON.stringify(asistenciasData)
          })
        }).catch(() => SIREI.utils.mostrarToast('No se pudo guardar. Revisa conexión.', 'error'));
      }, 3000);
    });
  });

  // ---- 8. SALIDAS (REDISEÑADO Y CORREGIDO) ----
  // (Se mantiene la lógica de actualización de estado, pero se asegura que el modal sea responsive)
  qrReaderSalidaFull = null;

  // Función para actualizar el estado y el historial sin recargar
  async function actualizarEstadoSalidas() {
    try {
      const responseFuera = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerSalidasClase',
          token: token,
          idClase: claseActiva.idClase
        })
      });
      const dataFuera = await responseFuera.json();
      const listaDiv = document.getElementById('listaAlumnosFuera');
      const btnEscape = document.getElementById('btnEscapeSalida');

      if (dataFuera.success) {
        const todas = dataFuera.salidas || [];
        const fuera = todas.filter(s => s.estado === 'Fuera');
        const fueraDefinitivo = todas.filter(s => s.estado === 'Fuera definitivo');
        // P4: icono de baño (solo cuenta Fuera con regreso; Fuera definitivo nunca es baño)
        try {
          const banoOcupado = fuera.some(s => String(s.motivo || '').toLowerCase() === 'baño');
          const iconoBano = document.getElementById('iconoBano');
          if (iconoBano) {
            iconoBano.textContent = banoOcupado ? '🚻🚫' : '🚻✅';
            iconoBano.style.color = banoOcupado ? '#dc2626' : '#16a34a';
            iconoBano.title = banoOcupado ? 'Baño ocupado' : 'Baño desocupado';
          }
        } catch (e) {}

        // Limpiar cronómetro anterior
        if (window._intervalSalida) {
          clearInterval(window._intervalSalida);
          window._intervalSalida = null;
        }
        if (btnEscape) btnEscape.style.display = 'none';

        if (fuera.length === 0 && fueraDefinitivo.length === 0) {
          listaDiv.innerHTML = '<span style="color:#10b981;">✅ Todos los alumnos están dentro.</span>';
        } else {
          let html = '';

          // Salidas definitivas: sin cronómetro, no esperan entrada y no bloquean otras salidas
          fueraDefinitivo.forEach(sd => {
            const alumnoD = alumnosGrupo.find(a => a.curp === sd.curp);
            const nombreD = alumnoD ? SIREI.utils.escapeHtml(alumnoD.nombreCompleto) : SIREI.utils.escapeHtml(sd.curp || '');
            const motivoD = SIREI.utils.escapeHtml(sd.motivo || 'Sin motivo') + (sd.motivo_otro ? ' (' + SIREI.utils.escapeHtml(sd.motivo_otro) + ')' : '');
            html += `
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid #f3f4f6;">
                <span><strong>${nombreD}</strong> - ${motivoD}</span>
                <span style="font-size:0.78rem; font-weight:700; color:#6d28d9; background:#ede9fe; padding:2px 10px; border-radius:12px;">Sin regreso</span>
              </div>`;
          });

          // Alumno que va a regresar: cronómetro y opción de escape
          if (fuera.length > 0) {
            const s = fuera[0];
            const alumno = alumnosGrupo.find(a => a.curp === s.curp);
            const nombre = alumno ? SIREI.utils.escapeHtml(alumno.nombreCompleto) : s.curp;
            let salidaTimestamp = s.salidaFormateada || s.salidaTimestamp || '';

            if (!salidaTimestamp) {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid #f3f4f6;">
                  <span><strong>${nombre}</strong> - Motivo: ${s.motivo || 'Sin motivo'}</span>
                  <span id="cronometroSalida" style="font-size:1.2rem; font-weight:bold; color:#6b7280;">--:--</span>
                </div>`;
            } else {
              html += `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid #f3f4f6;">
                  <span><strong>${nombre}</strong> - Motivo: ${s.motivo || 'Sin motivo'}</span>
                  <span id="cronometroSalida" style="font-size:1.2rem; font-weight:bold; color:#10b981;">00:00</span>
                </div>`;

              const actualizarCrono = () => {
                const crono = document.getElementById('cronometroSalida');
                if (!crono) return;
                
                try {
                  const ahora = new Date();
                  let fechaSalida;
                  if (salidaTimestamp.includes('T')) {
                    fechaSalida = new Date(salidaTimestamp);
                  } else if (salidaTimestamp.includes('/')) {
                    const partes = salidaTimestamp.split(' ');
                    if (partes.length < 2) { crono.textContent = '--:--'; return; }
                    const fechaPartes = partes[0].split('/');
                    const horaPartes = partes[1].split(':');
                    if (fechaPartes.length < 3 || horaPartes.length < 3) { crono.textContent = '--:--'; return; }
                    
                    fechaSalida = new Date(
                      parseInt(fechaPartes[2]),      
                      parseInt(fechaPartes[1]) - 1,   
                      parseInt(fechaPartes[0]),       
                      parseInt(horaPartes[0]),        
                      parseInt(horaPartes[1]),        
                      parseInt(horaPartes[2])         
                    );
                  } else {
                    crono.textContent = '--:--'; return;
                  }
                  
                  const diffMs = ahora - fechaSalida;
                  if (diffMs < 0 || isNaN(fechaSalida.getTime())) { 
                    crono.textContent = '00:00'; 
                    return; 
                  }
                  const totalSegundos = Math.floor(diffMs / 1000);
                  const minutos = Math.floor(totalSegundos / 60);
                  const segundos = totalSegundos % 60;
                  const minutosStr = String(minutos).padStart(2, '0');
                  const segundosStr = String(segundos).padStart(2, '0');
                  crono.textContent = `${minutosStr}:${segundosStr}`;

                  if (totalSegundos > 300) {
                    crono.style.color = '#ef4444';
                    if (btnEscape) {
                      btnEscape.style.display = 'block';
                      btnEscape.dataset.curp = s.curp;
                    }
                  } else {
                    crono.style.color = '#10b981';
                    if (btnEscape) btnEscape.style.display = 'none';
                  }
                } catch (e) {
                  console.error('Error en cronómetro:', e);
                  if (crono) crono.textContent = '--:--';
                }
              };

              actualizarCrono();
              window._intervalSalida = setInterval(actualizarCrono, 1000);
            }
          }

          listaDiv.innerHTML = html;
        }
      }

      // Obtener historial
      const responseHist = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerHistorialSalidas',
          token: token,
          idClase: claseActiva.idClase,
          limite: 15
        })
      });
      const dataHist = await responseHist.json();
      if (dataHist.success) {
        const movs = dataHist.movimientos || [];
        const contador = document.getElementById('contadorHistorial');
        if (contador) contador.textContent = `(${movs.length} registros)`;
        const listaHist = document.getElementById('listaHistorial');
        if (movs.length === 0) {
          listaHist.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">No hay movimientos registrados.</p>';
        } else {
          listaHist.innerHTML = movs.map(m => {
            const alumno = alumnosGrupo.find(a => a.curp === m.curp);
            const nombre = alumno ? SIREI.utils.escapeHtml(alumno.nombreCompleto) : SIREI.utils.escapeHtml(m.curp || '');
            const estado = m.estado || '';
            const esDefinitivo = estado === 'Fuera definitivo';
            const esEscape = estado === 'Escape';
            const esFuera = estado === 'Fuera';
            const esDentro = estado === 'Dentro';
            let icono = '🚪✅'; let color = '#065f46';
            if (esDefinitivo) { icono = '🚪🚫'; color = '#6d28d9'; }
            else if (esEscape) { icono = '🏃'; color = '#dc2626'; }
            else if (esFuera) { icono = '🚪'; color = '#92400e'; }
            const fecha = SIREI.utils.escapeHtml(m.salidaFormateada || m.salidaTimestamp || '');
            const motivoExtra = m.motivo_otro ? ` (${SIREI.utils.escapeHtml(m.motivo_otro)})` : '';
            const motivoTxt = SIREI.utils.escapeHtml(m.motivo || '') + motivoExtra;
            // P2: duración clara según estado
            let duracionHtml = '';
            if (esDentro) {
              duracionHtml = m.duracion
                ? `<span style="font-size:0.8rem; font-weight:700; color:#059669; margin-left:4px;">⏱️ ${SIREI.utils.escapeHtml(m.duracion)}</span>`
                : '<span style="font-size:0.75rem; color:#6b7280; margin-left:4px;">⏱️ --:--</span>';
            } else if (esFuera) {
              duracionHtml = '<span style="font-size:0.75rem; font-weight:700; color:#f59e0b; margin-left:4px;">Aún fuera</span>';
            } else if (esEscape || esDefinitivo) {
              duracionHtml = '<span style="font-size:0.75rem; font-weight:700; color:#6b7280; margin-left:4px;">Sin regreso</span>';
            }
            return `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:0.9rem;">
              <div>
                <span style="font-weight:500;">${nombre}</span>
                <span style="font-size:0.75rem; color:#6b7280; margin-left:8px;">${motivoTxt}</span>
              </div>
              <div style="text-align:right;">
                <span style="color:${color};">${icono}</span>
                <span style="font-size:0.75rem; color:#6b7280;">${fecha}</span><br>
                ${duracionHtml}
              </div>
            </div>`;
          }).join('');
        }
      }
    } catch (e) {
      console.error('Error al actualizar estado de salidas:', e);
    }
  }

  // Resalta visualmente la acción activa (Salida o Entrada)
  function marcarAccionActiva(accion) {
    const btnSalida = document.getElementById('btnAccionSalida');
    const btnEntrada = document.getElementById('btnAccionEntrada');
    if (!btnSalida || !btnEntrada) return;
    if (accion === 'salida') {
      btnSalida.style.opacity = '1';
      btnSalida.style.outline = '3px solid #1E3A8A';
      btnSalida.style.boxShadow = '0 0 0 2px #fff, 0 0 0 5px #1E3A8A';
      btnEntrada.style.opacity = '0.45';
      btnEntrada.style.outline = 'none';
      btnEntrada.style.boxShadow = 'none';
    } else {
      btnEntrada.style.opacity = '1';
      btnEntrada.style.outline = '3px solid #1E3A8A';
      btnEntrada.style.boxShadow = '0 0 0 2px #fff, 0 0 0 5px #1E3A8A';
      btnSalida.style.opacity = '0.45';
      btnSalida.style.outline = 'none';
      btnSalida.style.boxShadow = 'none';
    }
  }

  // Reinicia el estado del modal (solo al cerrar o tras éxito). P9.
  function reiniciarEstadoModalSalidas() {
    const modal = document.getElementById('modalSalidasFull');
    if (modal) {
      modal.dataset.accion = 'salida';
      modal.dataset.motivo = '';
    }
    const campoOtro = document.getElementById('campoOtroMotivo');
    if (campoOtro) campoOtro.style.display = 'none';
    const inputSal = document.getElementById('inputSalidaFull');
    if (inputSal) inputSal.value = '';
    const txtOtro = document.getElementById('textoOtroMotivo');
    if (txtOtro) txtOtro.value = '';
    const chkRegresa = document.getElementById('chkRegresa');
    if (chkRegresa) chkRegresa.checked = true;
    const chkMant = document.getElementById('chkMantenerMotivo');
    if (chkMant) chkMant.checked = false;
    document.querySelectorAll('.boton-motivo').forEach(b => { b.style.borderColor = '#e5e7eb'; });
    const seccion = document.getElementById('seccion-motivo');
    if (seccion) seccion.style.display = 'block';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    if (btnConfirm) btnConfirm.textContent = '✅ Confirmar Salida';
    marcarAccionActiva('salida');
    ocultarConfirmacionSalidaEntrada();
  }

  function cerrarModalSalidas(reiniciar) {
    const modal = document.getElementById('modalSalidasFull');
    if (modal) modal.classList.remove('abierto');
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
      const btnQR = document.getElementById('btnEscanearSalidaFull');
      if (btnQR) btnQR.textContent = '📷 QR';
      const contQR = document.getElementById('qr-reader-salida-full');
      if (contQR) contQR.style.display = 'none';
    }
    if (reiniciar) reiniciarEstadoModalSalidas();
  }

  // Abrir modal (P1: sin autofocus ni .focus(); P9: conserva modo/motivo mientras esté abierto)
  document.getElementById('btnAbrirSalidas').addEventListener('click', () => {
    const modal = document.getElementById('modalSalidasFull');
    modal.classList.add('abierto');
    // Solo asigna default si aún no hay modo en memoria (recién cerrado o primera vez)
    if (!modal.dataset.accion) modal.dataset.accion = 'salida';
    const accionActual = modal.dataset.accion || 'salida';
    const seccionMotivo = document.getElementById('seccion-motivo');
    if (seccionMotivo) seccionMotivo.style.display = (accionActual === 'salida') ? 'block' : 'none';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    if (btnConfirm) btnConfirm.textContent = (accionActual === 'entrada') ? '✅ Confirmar Entrada' : '✅ Confirmar Salida';
    marcarAccionActiva(accionActual);
    // Sincroniza el resaltado del motivo guardado en memoria
    const motivoGuardado = modal.dataset.motivo || '';
    document.querySelectorAll('.boton-motivo').forEach(b => {
      b.style.borderColor = (b.dataset.motivo === motivoGuardado && motivoGuardado) ? '#3b82f6' : '#e5e7eb';
    });
    if (motivoGuardado === 'Otro') {
      const campoOtro = document.getElementById('campoOtroMotivo');
      if (campoOtro) campoOtro.style.display = 'block';
    }
    // Cargar datos actualizados
    actualizarEstadoSalidas();
    // Cerrar QR si estaba abierto
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
      document.getElementById('qr-reader-salida-full').style.display = 'none';
      document.getElementById('btnEscanearSalidaFull').textContent = '📷 QR';
    }
    // P1: NO enfocar ningún input al abrir (evita que se abra el teclado en móvil)
  });

  // Cerrar modal con el botón ✕ (P9: reinicia estado)
  document.getElementById('btnCerrarSalidasFull').addEventListener('click', () => {
    cerrarModalSalidas(true);
  });

  // Cerrar modal haciendo clic fuera (en el fondo oscuro) (P9: reinicia estado)
  document.getElementById('modalSalidasFull').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      cerrarModalSalidas(true);
    }
  });

  // Botón Registrar Salida (P9: conserva motivo/texto, solo cambia modo visible)
  document.getElementById('btnAccionSalida').addEventListener('click', () => {
    const seccion = document.getElementById('seccion-motivo');
    if (seccion) seccion.style.display = 'block';
    document.getElementById('modalSalidasFull').dataset.accion = 'salida';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    if (btnConfirm) btnConfirm.textContent = '✅ Confirmar Salida';
    marcarAccionActiva('salida');
    // P1: sin .focus() para no abrir el teclado
  });

  // Botón Registrar Entrada (P9: conserva estado, solo cambia modo)
  document.getElementById('btnAccionEntrada').addEventListener('click', () => {
    const sec = document.getElementById('seccion-motivo');
    if (sec) sec.style.display = 'none';
    document.getElementById('modalSalidasFull').dataset.accion = 'entrada';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    if (btnConfirm) btnConfirm.textContent = '✅ Confirmar Entrada';
    marcarAccionActiva('entrada');
    // P1: sin .focus() para no abrir el teclado
  });

  // Selección de motivo (Baño, Otro). "Otro" guarda dataset.motivo='Otro' para que
  // la casilla "¿Va a regresar?" sí se tome en cuenta (salida definitiva si se desactiva).
  document.querySelectorAll('.boton-motivo').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.boton-motivo').forEach(b => b.style.borderColor = '#e5e7eb');
      const motivo = btn.dataset.motivo;
      if (motivo === 'Otro') {
        document.getElementById('campoOtroMotivo').style.display = 'block';
        // P1: sin .focus() para no abrir el teclado; el usuario toca el campo si quiere escribir
        btn.style.borderColor = '#3b82f6';
        document.getElementById('modalSalidasFull').dataset.motivo = 'Otro';
        return;
      }
      document.getElementById('modalSalidasFull').dataset.motivo = motivo;
      document.getElementById('campoOtroMotivo').style.display = 'none';
      btn.style.borderColor = '#3b82f6';
    });
  });

  // ---- P5: pantalla de confirmación fullscreen (tapa todo el modal, autocierre 2s) ----
  function ocultarConfirmacionSalidaEntrada() {
    if (window._timeoutConfirmacion) { clearTimeout(window._timeoutConfirmacion); window._timeoutConfirmacion = null; }
    if (window._intervalConfirmacion) { clearInterval(window._intervalConfirmacion); window._intervalConfirmacion = null; }
    const cont = document.getElementById('confirmacionSalidaEntrada');
    if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
  }

  // Parser tolerante de fechas de salida/entrada (ISO, dd/MM/yyyy HH:mm:ss, yyyy-MM-dd HH:mm:ss)
  function parsearFechaMovimiento(v) {
    if (v == null || v === '') return null;
    try {
      if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getTime());
      const s = String(v).trim();
      if (!s) return null;
      if (s.indexOf('T') >= 0) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      }
      const partes = s.split(' ');
      const f = partes[0]; const h = partes[1] || '00:00:00';
      const hp = h.split(':');
      const hh = Number(hp[0] || 0), mm = Number(hp[1] || 0), ss = Number(hp[2] || 0);
      if (f.indexOf('/') >= 0) {
        const fp = f.split('/');
        if (fp.length !== 3) return null;
        const d = new Date(Number(fp[2]), Number(fp[1]) - 1, Number(fp[0]), hh, mm, ss);
        return isNaN(d.getTime()) ? null : d;
      }
      if (f.indexOf('-') >= 0) {
        const fp = f.split('-');
        if (fp.length !== 3) return null;
        const d = new Date(Number(fp[0]), Number(fp[1]) - 1, Number(fp[2]), hh, mm, ss);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  }

  function formatearDuracionHMS(totalSeg) {
    const t = Math.max(0, Math.floor(totalSeg));
    const h = String(Math.floor(t / 3600)).padStart(2, '0');
    const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function mostrarConfirmacionSalidaEntrada(datos) {
    // Si hay una confirmación previa visible, se cierra inmediatamente y se muestra la nueva (P5)
    ocultarConfirmacionSalidaEntrada();
    const cont = document.getElementById('confirmacionSalidaEntrada');
    if (!cont) return;
    const esSalida = datos.tipo === 'salida';
    const esDefinitiva = !!datos.definitiva;
    const colorFondo = esSalida ? '#f59e0b' : '#10b981';
    const titulo = esSalida ? 'Ya puedes salir' : 'Tu entrada está registrada';
    const icono = esSalida ? '🚪' : '✅';
    const nombreSeguro = SIREI.utils.escapeHtml(datos.nombre || '');
    const motivoSeguro = SIREI.utils.escapeHtml(datos.motivo || '');
    let bloqueTiempo = '';
    if (esSalida && !esDefinitiva) {
      bloqueTiempo = `<p style="margin:8px 0 0 0; font-size:1rem; color:#374151;">Tiempo fuera:</p><p id="cronoConfirmacion" style="margin:0; font-size:2rem; font-weight:800; color:${colorFondo};">00:00</p>`;
    } else if (esSalida && esDefinitiva) {
      bloqueTiempo = `<p style="margin:8px 0 0 0; font-size:1rem; font-weight:700; color:#6d28d9;">Salida definitiva · Sin regreso</p>`;
    } else {
      bloqueTiempo = `<p style="margin:8px 0 0 0; font-size:1rem; color:#374151;">Tiempo total fuera:</p><p style="margin:0; font-size:2rem; font-weight:800; color:${colorFondo};">⏱️ ${SIREI.utils.escapeHtml(datos.duracion || '—')}</p>`;
    }
    cont.innerHTML = `
      <div class="confirmacion-overlay" style="background:rgba(0,0,0,0.75);">
        <div class="confirmacion-tarjeta">
          <div style="font-size:3rem;">${icono}</div>
          <h2 style="margin:8px 0; font-size:1.6rem; color:#111827;">${titulo}</h2>
          <p style="margin:4px 0; font-size:1.25rem; font-weight:700; color:#1E3A8A;">${nombreSeguro}</p>
          ${esSalida && motivoSeguro ? `<p style="margin:4px 0; font-size:1.05rem; color:#374151;">Motivo: <strong>${motivoSeguro}</strong></p>` : ''}
          ${bloqueTiempo}
        </div>
      </div>`;
    cont.style.display = 'block';
    // Cronómetro en vivo solo en salidas CON regreso
    if (esSalida && !esDefinitiva && datos.salidaTimestamp) {
      const salidaTs = datos.salidaTimestamp;
      const pintar = () => {
        const el = document.getElementById('cronoConfirmacion');
        if (!el) return;
        const fechaSalida = parsearFechaMovimiento(salidaTs);
        if (!fechaSalida) { el.textContent = '00:00'; return; }
        const seg = Math.max(0, Math.floor((new Date() - fechaSalida) / 1000));
        el.textContent = String(Math.floor(seg / 60)).padStart(2, '0') + ':' + String(seg % 60).padStart(2, '0');
      };
      pintar();
      window._intervalConfirmacion = setInterval(pintar, 1000);
    }
    window._timeoutConfirmacion = setTimeout(ocultarConfirmacionSalidaEntrada, 2000);
  }

  function obtenerMotivoSalidaActual() {
    const modal = document.getElementById('modalSalidasFull');
    const motivoSel = modal ? (modal.dataset.motivo || '') : '';
    if (motivoSel === 'Baño') return { motivo: 'Baño', motivoOtro: '', valido: true };
    // "Otro" (o texto escrito en su campo) exige especificar el motivo; la casilla
    // "¿Va a regresar?" decide si es salida con regreso o definitiva.
    const txt = document.getElementById('textoOtroMotivo');
    const otroTexto = txt ? txt.value.trim() : '';
    if (motivoSel === 'Otro' || otroTexto) {
      if (!otroTexto) return { valido: false };
      return { motivo: 'Otro', motivoOtro: otroTexto, valido: true };
    }
    return { valido: false };
  }

  // Procesa salida/entrada por CURP (usado por Confirm manual y por QR). P3+P5.
  async function procesarSalidaEntradaPorCurp(curpRaw) {
    const accion = document.getElementById('modalSalidasFull').dataset.accion || 'salida';
    const curp = String(curpRaw || '').trim().toUpperCase();
    const alumno = alumnosGrupo.find(a => a.curp === curp);
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return;
    }
    let motivo = '', motivoOtro = '', vaARegresar = true;
    if (accion === 'salida') {
      const res = obtenerMotivoSalidaActual();
      if (!res.valido) {
        SIREI.utils.mostrarToast('Selecciona un motivo primero', 'error');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        return;
      }
      motivo = res.motivo; motivoOtro = res.motivoOtro || '';
      if (motivo === 'Otro') {
        const chkRegresa = document.getElementById('chkRegresa');
        vaARegresar = chkRegresa ? chkRegresa.checked : true;
      } else if (motivo === 'Baño') {
        vaARegresar = true;
      }
    }
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    const textoOriginal = btnConfirm ? btnConfirm.textContent : '';
    if (btnConfirm) { btnConfirm.disabled = true; btnConfirm.textContent = '⏳ Procesando...'; }
    // Para entradas: obtener la hora de salida activa ANTES de registrar, para calcular
    // la duración localmente (salida -> entrada) aunque el backend no la devuelva.
    let salidaActivaTs = null;
    if (accion === 'entrada') {
      try {
        const rSal = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ accion: 'obtenerSalidasClase', token: token, idClase: claseActiva.idClase })
        });
        const dSal = await rSal.json();
        if (dSal.success) {
          const rec = (dSal.salidas || []).find(s => s.curp === alumno.curp && s.estado === 'Fuera');
          if (rec) salidaActivaTs = rec.salidaFormateada || rec.salidaTimestamp || null;
        }
      } catch (e) { console.error('No se pudo leer salida activa:', e); }
    }
    try {
      let response;
      if (accion === 'salida') {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarSalida',
            token: token,
            idClase: claseActiva.idClase,
            curpAlumno: alumno.curp,
            motivo: motivo,
            motivoOtro: motivoOtro,
            vaARegresar: vaARegresar ? 'true' : 'false'
          })
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarEntrada',
            token: token,
            idClase: claseActiva.idClase,
            curpAlumno: alumno.curp
          })
        });
      }
      const result = await response.json();
      if (result.success) {
        const mensaje = accion === 'salida' ? 'Salida registrada' : 'Entrada registrada';
        SIREI.utils.mostrarToast(`✅ ${mensaje} para ${alumno.nombreCompleto}`);
        if (navigator.vibrate) navigator.vibrate(50);
        // Duración: backend -> historial -> cálculo local (salida -> entrada)
        let duracionFinal = result.duracion || '';
        if (accion === 'entrada' && !duracionFinal) {
          try {
            const rHist = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ accion: 'obtenerHistorialSalidas', token: token, idClase: claseActiva.idClase, limite: 30 })
            });
            const dHist = await rHist.json();
            if (dHist.success) {
              const movs = dHist.movimientos || [];
              const rec = movs.find(m => m.curp === alumno.curp && m.estado === 'Dentro' && m.duracion) || movs.find(m => m.curp === alumno.curp && m.duracion);
              if (rec && rec.duracion) duracionFinal = rec.duracion;
            }
          } catch (e) { console.error('No se pudo releer duración:', e); }
        }
        if (accion === 'entrada' && !duracionFinal && salidaActivaTs) {
          const fSal = parsearFechaMovimiento(salidaActivaTs);
          if (fSal) {
            const seg = Math.max(0, Math.floor((new Date() - fSal) / 1000));
            duracionFinal = formatearDuracionHMS(seg);
          }
        }
        const motivoMostrar = (motivo === 'Otro' && motivoOtro) ? ('Otro: ' + motivoOtro) : motivo;
        const esDefinitiva = (accion === 'salida') && (!vaARegresar || result.estado === 'Fuera definitivo');
        mostrarConfirmacionSalidaEntrada({
          tipo: accion,
          nombre: alumno.nombreCompleto,
          motivo: motivoMostrar,
          duracion: duracionFinal,
          salidaTimestamp: result.salidaTimestamp || salidaActivaTs || new Date().toISOString(),
          definitiva: esDefinitiva
        });
        // P9: reinicia estado solo tras éxito (pero mantiene modal abierto)
        const input = document.getElementById('inputSalidaFull');
        if (input) input.value = '';
        const modal = document.getElementById('modalSalidasFull');
        if (modal) modal.dataset.motivo = '';
        const txtOtro = document.getElementById('textoOtroMotivo');
        const chkMant = document.getElementById('chkMantenerMotivo');
        if (!chkMant || !chkMant.checked) { if (txtOtro) txtOtro.value = ''; }
        const campoOtro = document.getElementById('campoOtroMotivo');
        if (campoOtro) campoOtro.style.display = 'none';
        document.querySelectorAll('.boton-motivo').forEach(b => { b.style.borderColor = '#e5e7eb'; });
        const chkRegresa = document.getElementById('chkRegresa');
        if (chkRegresa) chkRegresa.checked = true;
        await actualizarEstadoSalidas();
        if (qrReaderSalidaFull) {
          qrReaderSalidaFull.stop().catch(() => {});
          qrReaderSalidaFull = null;
          document.getElementById('qr-reader-salida-full').style.display = 'none';
          document.getElementById('btnEscanearSalidaFull').textContent = '📷 QR';
        }
      } else {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'Error al registrar'), 'error');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      }
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    } finally {
      if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = textoOriginal; }
    }
  }

  // Botón Confirmar (unificado para salida y entrada, vía input manual)
  document.getElementById('btnConfirmarSalidaEntrada').addEventListener('click', async () => {
    const input = document.getElementById('inputSalidaFull');
    const valor = input ? input.value.trim() : '';
    if (!valor) {
      SIREI.utils.mostrarToast('Ingresa el nombre o CURP del alumno.', 'error');
      return;
    }
    const alumno = buscarAlumnoPorTexto(valor);
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      return;
    }
    await procesarSalidaEntradaPorCurp(alumno.curp);
  });

  // QR para salidas/entradas (P3: procesa automáticamente según modo activo)
  document.getElementById('btnEscanearSalidaFull').addEventListener('click', () => {
    const readerContainer = document.getElementById('qr-reader-salida-full');
    const btn = document.getElementById('btnEscanearSalidaFull');
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
      readerContainer.style.display = 'none';
      btn.textContent = '📷 QR';
      return;
    }
    btn.textContent = '❌ Cerrar cámara';
    readerContainer.style.display = 'block';
    readerContainer.innerHTML = '';
    qrReaderSalidaFull = new Html5Qrcode("qr-reader-salida-full");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    let qrProcesando = false;
    qrReaderSalidaFull.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        if (qrProcesando) return;
        qrProcesando = true;
        // Cerrar lector INMEDIATAMENTE para evitar duplicados (P3)
        const cerrarLector = () => {
          try {
            if (qrReaderSalidaFull) { qrReaderSalidaFull.stop().catch(() => {}); qrReaderSalidaFull = null; }
          } catch (e) {}
          const rc = document.getElementById('qr-reader-salida-full');
          if (rc) rc.style.display = 'none';
          const bq = document.getElementById('btnEscanearSalidaFull');
          if (bq) bq.textContent = '📷 QR';
        };
        cerrarLector();
        const curp = String(decodedText || '').trim().toUpperCase();
        procesarSalidaEntradaPorCurp(curp).finally(() => { qrProcesando = false; });
      },
      (err) => {}
    );
  });

  // Botón Escape
  document.getElementById('btnEscapeSalida').addEventListener('click', async () => {
    const btn = document.getElementById('btnEscapeSalida');
    const curp = btn.dataset.curp;
    if (!curp) {
      SIREI.utils.mostrarToast('No hay alumno fuera para registrar escape.', 'error');
      return;
    }
    if (!SIREI.utils.confirmar(`¿Registrar a ${curp} como escape? Esto lo marcará como fuera y lo llevará al panel Actitudinal para asignar una actitud negativa.`)) return;

    btn.disabled = true;
    btn.textContent = '⏳ Procesando...';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'registrarEscape',
          token: token,
          idClase: claseActiva.idClase,
          curpAlumno: curp
        })
      });
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast('✅ Escape registrado. Redirigiendo a Actitudinal...');
        await actualizarEstadoSalidas();
        const btnActitudinal = document.querySelector('.btn-panel[data-panel="actitudinal"]');
        if (btnActitudinal) {
          btnActitudinal.click();
        } else {
          SIREI.utils.mostrarToast('No se encontró la pestaña Actitudinal.', 'error');
        }
      } else {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'Error al registrar escape'), 'error');
      }
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🏃 Registrar como Escape (ir a Actitudinal)';
      btn.style.display = 'none';
    }
  });

  // ---- 9. FINALIZAR CLASE (optimizado: el backend marca ausentes en lote) ----
  document.getElementById('btnFinalizarClase').addEventListener('click', async () => {
    if (!SIREI.utils.confirmar('¿Finalizar clase? Los alumnos pendientes se marcarán como ausentes.')) return;
    const btn = document.getElementById('btnFinalizarClase');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Finalizando...';

    const timeoutMs = 3000;
    let timeoutId = setTimeout(() => {
      SIREI.utils.mostrarToast('La clase se está finalizando en segundo plano...', 'warning');
      btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
    }, timeoutMs);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'finalizarClase',
          token: token,
          idDocente: idDocente
        })
      });
      clearTimeout(timeoutId);
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast('Clase finalizada.');
        setTimeout(() => cargarTabla('inicio'), 500);
      } else {
        SIREI.utils.mostrarToast(result.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Finalizar clase';
      }
    } catch (e) {
      clearTimeout(timeoutId);
      SIREI.utils.mostrarToast('Error: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Finalizar clase';
    }
  });
}

// ============================================================
//  SECCIÓN 5: MOSTRAR OPCIONES PARA INICIAR CLASE
// ============================================================

function mostrarOpcionesInicio(container, asignaciones, grupos, asignaturas, idDocente, token) {
  let html = `<div class="card">
    <h2 class="card-title">Bienvenido, ${sessionStorage.getItem('sirei_nombre')}</h2>
    <p style="color:#4b5563; margin-bottom:20px;">Aquí puedes iniciar una nueva clase.</p>`;

  if (asignaciones.length === 0) {
    html += `<p>No tienes asignaciones activas. Contacta al coordinador.</p>`;
  } else {
    const gruposConAsignaciones = [];
    const idsGrupo = [...new Set(asignaciones.map(a => a.idGrupo))];
    idsGrupo.forEach(idG => {
      const grupo = grupos.find(g => g.id == idG);
      if (grupo) {
        const asigs = asignaciones.filter(a => a.idGrupo == idG);
        gruposConAsignaciones.push({ grupo, asignaciones: asigs });
      }
    });

    html += `
      <div style="margin-bottom:16px;">
        <label for="selectGrupo">Selecciona el grupo:</label>
        <select id="selectGrupo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin:8px 0;">
          <option value="">-- Elige un grupo --</option>
          ${gruposConAsignaciones.map(item => `<option value="${item.grupo.id}">${SIREI.utils.escapeHtml(item.grupo.nombre)}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:16px;">
        <label for="selectAsignatura">Selecciona la asignatura:</label>
        <select id="selectAsignatura" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin:8px 0;" disabled>
          <option value="">-- Primero elige un grupo --</option>
        </select>
      </div>
      <button id="btnIniciarClase" class="btn btn-primary" disabled>Iniciar clase</button>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;

  if (asignaciones.length > 0) {
    const selectGrupo = document.getElementById('selectGrupo');
    const selectAsignatura = document.getElementById('selectAsignatura');
    const btnIniciar = document.getElementById('btnIniciarClase');

    selectGrupo.addEventListener('change', () => {
      const idGrupo = parseInt(selectGrupo.value);
      if (!idGrupo) {
        selectAsignatura.innerHTML = '<option value="">-- Primero elige un grupo --</option>';
        selectAsignatura.disabled = true;
        btnIniciar.disabled = true;
        return;
      }
      const asigs = asignaciones.filter(a => a.idGrupo == idGrupo && a.estado === 'Activo');
      if (asigs.length === 0) {
        selectAsignatura.innerHTML = '<option value="">-- Sin asignaturas activas --</option>';
        selectAsignatura.disabled = true;
        btnIniciar.disabled = true;
        return;
      }
      selectAsignatura.disabled = false;
      selectAsignatura.innerHTML = `<option value="">-- Elige una asignatura --</option>` +
        asigs.map(a => {
          const asig = asignaturas.find(s => s.id === a.idAsignatura);
          const etiqueta = asig ? SIREI.utils.escapeHtml(asig.nombre) : a.idAsignatura;
          const subEtiqueta = (a.tipo === 'subgrupo' && a.nombreSubgrupo) ? ` (${SIREI.utils.escapeHtml(a.nombreSubgrupo)})` : '';
          return `<option value="${a.idAsignatura}|${a.idSubgrupo || ''}">${etiqueta}${subEtiqueta}</option>`;
        }).join('');
      btnIniciar.disabled = false;
    });

    btnIniciar.addEventListener('click', async () => {
      const idGrupo = parseInt(selectGrupo.value);
      const valorCompuesto = selectAsignatura.value;
      const [idAsignatura, idSubgrupo] = valorCompuesto.split('|');
      if (!idGrupo || !idAsignatura) {
        SIREI.utils.mostrarToast('Selecciona grupo y asignatura.', 'error');
        return;
      }
      btnIniciar.disabled = true;
      btnIniciar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creando clase...';

      const timeoutMs = 3000;
      let timeoutId = setTimeout(() => {
        SIREI.utils.mostrarToast('La clase se está creando en segundo plano...', 'warning');
        btnIniciar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
      }, timeoutMs);

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'iniciarClase',
            token: token,
            idDocente: idDocente,
            idGrupo: idGrupo,
            idAsignatura: idAsignatura,
            idSubgrupo: idSubgrupo || ''
          })
        });
        clearTimeout(timeoutId);
        const result = await response.json();
        if (result.success) {
          SIREI.utils.mostrarToast('Clase iniciada.');
          setTimeout(() => cargarTabla('inicio'), 500);
        } else {
          SIREI.utils.mostrarToast(result.message, 'error');
          btnIniciar.disabled = false;
          btnIniciar.textContent = 'Iniciar clase';
        }
      } catch (e) {
        clearTimeout(timeoutId);
        SIREI.utils.mostrarToast('Error: ' + e.message, 'error');
        btnIniciar.disabled = false;
        btnIniciar.textContent = 'Iniciar clase';
      }
    });
  }
}
