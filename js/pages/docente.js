// ============================================================
//  SIREI - Panel del Docente
//  Versión 3.2 - CORREGIDA (cronómetro y duración)
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

  const alumnoFuera = salidas.find(s => s.estado === 'Fuera');

  // ---- Datalist para autocompletado ----
  const datalistId = 'alumnos-list';
  const datalistOptions = alumnosGrupo.map(a =>
    `<option value="${a.nombreCompleto}">${a.nombreCompleto} (${a.curp})</option>`
  ).join('');

  // ---- HTML principal ----
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

    <!-- Modal de Salidas (REDISEÑADO) -->
    <div class="modal-salidas-full" id="modalSalidasFull">
      <!-- Cabecera -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; background:#f8fafc; border-bottom:2px solid #e5e7eb;">
        <h2 style="margin:0; font-size:1.3rem; display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.8rem;">🚪</span> Entradas / Salidas
        </h2>
        <button id="btnCerrarSalidasFull" style="background:none; border:none; font-size:2rem; cursor:pointer; padding:0 10px;">✕</button>
      </div>

      <!-- Contenido del modal -->
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
            <button class="boton-motivo" data-motivo="Enfermería" style="padding:14px; background:#fff; border:2px solid #e5e7eb; border-radius:10px; font-size:1rem; cursor:pointer; display:flex; align-items:center; gap:10px; justify-content:center;">
              <span style="font-size:1.5rem;">🏥</span> Enfermería
            </button>
            <button class="boton-motivo otro" data-motivo="Otro" style="grid-column: span 2; padding:14px; background:#fff; border:2px dashed #e5e7eb; border-radius:10px; font-size:1rem; cursor:pointer; display:flex; align-items:center; gap:10px; justify-content:center;">
              <span style="font-size:1.5rem;">📝</span> Otro
            </button>
          </div>
          <div class="campo-otro-motivo" id="campoOtroMotivo" style="display:none; margin-top:12px;">
            <label style="font-weight:500; display:block; margin-bottom:4px;">Especifica el motivo:</label>
            <textarea id="textoOtroMotivo" rows="2" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;"></textarea>
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

        <!-- Botón Confirmar (fuera de seccion-motivo) -->
        <div style="margin-top:12px;">
          <button id="btnConfirmarSalidaEntrada" class="btn-confirmar" style="width:100%; padding:14px; background:#1E3A8A; color:white; border:none; border-radius:10px; font-size:1rem; font-weight:600; cursor:pointer;">
            ✅ Confirmar
          </button>
        </div>

        <!-- Historial de movimientos -->
        <div id="historial-salidas" style="margin-top:16px; border-top:2px solid #e5e7eb; padding-top:12px;">
          <h3 style="font-size:1rem; margin:0 0 8px 0; display:flex; align-items:center; gap:6px;">
            <span>📋</span> Historial reciente
            <span id="contadorHistorial" style="font-size:0.75rem; color:#6b7280; font-weight:400;"></span>
          </h3>
          <div id="listaHistorial" style="max-height:200px; overflow-y:auto;">
            <p style="color:#6b7280; font-size:0.9rem;">Cargando historial...</p>
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
          return `<div class="alumno-item">
            <span>${SIREI.utils.escapeHtml(alumno.nombreCompleto)}</span>
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
        return `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6; font-size:0.9rem;">
          <span>${SIREI.utils.escapeHtml(alumno.nombreCompleto)}</span>
          <span style="color:${color}; font-weight:600;">${estado}</span>
        </div>`;
      }).join('')}
    </div>
  `;
  contenedorAsistencia.innerHTML = modalQR;

  // ---- Configurar eventos ----
  configurarEventosPaneles(container, idDocente, claseActiva, token, alumnosGrupo);
}

// ============================================================
//  SECCIÓN 4.5: EVENTOS DE LOS PANELES (CORREGIDO)
// ============================================================

function configurarEventosPaneles(container, idDocente, claseActiva, token, alumnosGrupo) {
  let qrReaderAsistencia = null;
  let qrReaderSalidaFull = null;
  let escaneoActivo = false;

  // ---- Función para actualizar contadores ----
  function actualizarContadores() {
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (!resumenDiv) return;
    const items = resumenDiv.querySelectorAll('div');
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

  // ---- Sincronizar selectores con resumen ----
  function sincronizarSelectores() {
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (!resumenDiv) return;
    const items = resumenDiv.querySelectorAll('div');
    for (const item of items) {
      const spanNombre = item.querySelector('span:first-child');
      const spanEstado = item.querySelector('span:last-child');
      if (spanNombre && spanEstado) {
        const nombreCompleto = spanNombre.textContent.trim();
        const alumno = alumnosGrupo.find(a => a.nombreCompleto === nombreCompleto);
        if (alumno) {
          const select = document.querySelector(`.select-estado-manual[data-curp="${alumno.curp}"]`);
          if (select) select.value = spanEstado.textContent;
        }
      }
    }
  }

  // ---- Actualizar estado de un alumno ----
  function actualizarEstadoAlumno(curp, nuevoEstado) {
    // Actualizar resumen
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (resumenDiv) {
      const items = resumenDiv.querySelectorAll('div');
      for (const item of items) {
        const spanNombre = item.querySelector('span:first-child');
        const spanEstado = item.querySelector('span:last-child');
        if (spanNombre && spanNombre.textContent.trim() === alumnosGrupo.find(a => a.curp === curp)?.nombreCompleto) {
          const color = nuevoEstado === 'Presente' ? '#10b981' : nuevoEstado === 'Retardo' ? '#f59e0b' : nuevoEstado === 'Ausente' ? '#ef4444' : '#6b7280';
          spanEstado.textContent = nuevoEstado;
          spanEstado.style.color = color;
          break;
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

  // ---- 2. ASISTENCIA QR ----
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
    if (qrReaderAsistencia) {
      qrReaderAsistencia.stop().catch(() => {});
      qrReaderAsistencia = null;
      readerContainer.style.display = 'none';
      escaneoActivo = false;
      return;
    }
    readerContainer.style.display = 'block';
    readerContainer.innerHTML = '';
    qrReaderAsistencia = new Html5Qrcode("qr-reader-asistencia");
    const config = { fps: 10, qrbox: { width: 200, height: 200 } };
    qrReaderAsistencia.start(
      { facingMode: "environment" },
      config,
      async (decodedText) => {
        const curp = decodedText.trim().toUpperCase();
        const alumno = alumnosGrupo.find(a => a.curp === curp);
        if (!alumno) {
          SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
          return;
        }
        const chkRetardo = document.getElementById('chkRetardo');
        const estado = chkRetardo && chkRetardo.checked ? 'Retardo' : 'Presente';
        const tipoToast = estado === 'Retardo' ? 'warning' : 'success';
        SIREI.utils.mostrarToast(`${alumno.nombreCompleto} - ${estado}`, tipoToast);

        // Actualizar vista
        actualizarEstadoAlumno(curp, estado);

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
    let alumno = alumnosGrupo.find(a => a.curp === valor.toUpperCase());
    if (!alumno) {
      const nombreLower = valor.toLowerCase();
      alumno = alumnosGrupo.find(a => a.nombreCompleto.toLowerCase().includes(nombreLower));
    }
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      return;
    }
    const curp = alumno.curp;
    const chkRetardo = document.getElementById('chkRetardo');
    const estado = chkRetardo && chkRetardo.checked ? 'Retardo' : 'Presente';
    const tipoToast = estado === 'Retardo' ? 'warning' : 'success';
    SIREI.utils.mostrarToast(`${alumno.nombreCompleto} - ${estado}`, tipoToast);

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

    // Actualizar vista local inmediatamente
    const resumenDiv = document.getElementById('resumen-asistencia');
    if (resumenDiv) {
      const items = resumenDiv.querySelectorAll('div');
      items.forEach(item => {
        const spanNombre = item.querySelector('span:first-child');
        const spanEstado = item.querySelector('span:last-child');
        if (spanNombre && spanEstado) {
          const nombreCompleto = spanNombre.textContent.trim();
          const alumno = alumnosGrupo.find(a => a.nombreCompleto === nombreCompleto);
          if (alumno && actualizaciones[alumno.curp] !== undefined) {
            const nuevoEstado = actualizaciones[alumno.curp];
            const color = nuevoEstado === 'Presente' ? '#10b981' : nuevoEstado === 'Retardo' ? '#f59e0b' : nuevoEstado === 'Ausente' ? '#ef4444' : '#6b7280';
            spanEstado.textContent = nuevoEstado;
            spanEstado.style.color = color;
          }
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

      if (fuera.length === 0) {
        listaDiv.innerHTML = '<span style="color:#10b981;">✅ Todos los alumnos están dentro.</span>';
        if (btnEscape) btnEscape.style.display = 'none';
        if (window._intervalSalida) {
          clearInterval(window._intervalSalida);
          window._intervalSalida = null;
        }
      } else {
        const s = fuera[0];
        const alumno = alumnosGrupo.find(a => a.curp === s.curp);
        const nombre = alumno ? SIREI.utils.escapeHtml(alumno.nombreCompleto) : s.curp;
        
        // Usar salidaFormateada que el backend envía en formato dd/MM/yyyy HH:mm:ss
        let salidaTimestamp = s.salidaFormateada || s.salidaTimestamp || '';

        // Si no hay timestamp válido, mostrar --:--
        if (!salidaTimestamp) {
          listaDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
              <span><strong>${nombre}</strong> - Motivo: ${s.motivo || 'Sin motivo'}</span>
              <span id="cronometroSalida" style="font-size:1.2rem; font-weight:bold; color:#6b7280;">--:--</span>
            </div>
          `;
          if (btnEscape) btnEscape.style.display = 'none';
          return;
        }

        // Crear contenedor con el cronómetro
        listaDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
            <span><strong>${nombre}</strong> - Motivo: ${s.motivo || 'Sin motivo'}</span>
            <span id="cronometroSalida" style="font-size:1.2rem; font-weight:bold; color:#10b981;">00:00</span>
          </div>
        `;

        // Detener intervalo anterior
        if (window._intervalSalida) clearInterval(window._intervalSalida);

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
            
            // Calcular diferencia
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

            // Cambiar color y mostrar botón de escape a los 5 minutos
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

        // Ejecutar inmediatamente y luego cada segundo
        actualizarCrono();
        window._intervalSalida = setInterval(actualizarCrono, 1000);
      }
    }

    // Obtener historial (últimos 15 movimientos)
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
          const nombre = alumno ? SIREI.utils.escapeHtml(alumno.nombreCompleto) : m.curp;
          const esSalida = m.estado === 'Fuera' || m.estado === 'Escape';
          const icono = esSalida ? (m.estado === 'Escape' ? '🏃' : '🚪') : '🚪✅';
          const color = esSalida ? (m.estado === 'Escape' ? '#dc2626' : '#92400e') : '#065f46';
          const fecha = m.salidaFormateada || m.salidaTimestamp;
          const motivoExtra = m.motivo_otro ? ` (${m.motivo_otro})` : '';
          const duracionMostrar = m.duracion ? ` ⏱️${m.duracion}` : '';
          return `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:0.9rem;">
            <div>
              <span style="font-weight:500;">${nombre}</span>
              <span style="font-size:0.75rem; color:#6b7280; margin-left:8px;">${m.motivo || ''}${motivoExtra}</span>
            </div>
            <div>
              <span style="color:${color};">${icono}</span>
              <span style="font-size:0.75rem; color:#6b7280;">${fecha}</span>
              ${duracionMostrar ? `<span style="font-size:0.7rem; color:#059669; margin-left:4px;">${duracionMostrar}</span>` : ''}
            </div>
          </div>`;
        }).join('');
      }
    }
  } catch (e) {
    console.error('Error al actualizar estado de salidas:', e);
  }
}

  // Abrir modal (default: Registrar Salida)
  document.getElementById('btnAbrirSalidas').addEventListener('click', () => {
    const modal = document.getElementById('modalSalidasFull');
    modal.classList.add('abierto');
    // Resetear campos
    document.getElementById('campoOtroMotivo').style.display = 'none';
    document.getElementById('inputSalidaFull').value = '';
    document.getElementById('textoOtroMotivo').value = '';
    // Default: Registrar Salida
    const seccionMotivo = document.getElementById('seccion-motivo');
    seccionMotivo.style.display = 'block';
    document.getElementById('modalSalidasFull').dataset.accion = 'salida';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    btnConfirm.textContent = '✅ Confirmar Salida';
    // Limpiar selección de motivo
    document.querySelectorAll('.boton-motivo').forEach(b => b.style.borderColor = '#e5e7eb');
    // Cargar datos actualizados
    actualizarEstadoSalidas();
    // Cerrar QR si estaba abierto
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
      document.getElementById('qr-reader-salida-full').style.display = 'none';
    }
    document.getElementById('inputSalidaFull').focus();
  });

  // Cerrar modal con el botón ✕
  document.getElementById('btnCerrarSalidasFull').addEventListener('click', () => {
    document.getElementById('modalSalidasFull').classList.remove('abierto');
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
    }
  });

  // Cerrar modal haciendo clic fuera (en el fondo oscuro)
  document.getElementById('modalSalidasFull').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('modalSalidasFull').classList.remove('abierto');
      if (qrReaderSalidaFull) {
        qrReaderSalidaFull.stop().catch(() => {});
        qrReaderSalidaFull = null;
      }
    }
  });

  // Botón Registrar Salida
  document.getElementById('btnAccionSalida').addEventListener('click', () => {
    const seccion = document.getElementById('seccion-motivo');
    seccion.style.display = 'block';
    document.getElementById('campoOtroMotivo').style.display = 'none';
    document.getElementById('textoOtroMotivo').value = '';
    document.getElementById('modalSalidasFull').dataset.accion = 'salida';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    btnConfirm.textContent = '✅ Confirmar Salida';
    document.querySelectorAll('.boton-motivo').forEach(b => b.style.borderColor = '#e5e7eb');
    document.getElementById('inputSalidaFull').focus();
  });

  // Botón Registrar Entrada
  document.getElementById('btnAccionEntrada').addEventListener('click', () => {
    document.getElementById('seccion-motivo').style.display = 'none';
    document.getElementById('modalSalidasFull').dataset.accion = 'entrada';
    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    btnConfirm.textContent = '✅ Confirmar Entrada';
    document.getElementById('inputSalidaFull').focus();
  });

  // Selección de motivo (Baño, Enfermería, Otro)
  document.querySelectorAll('.boton-motivo').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.boton-motivo').forEach(b => b.style.borderColor = '#e5e7eb');
      const motivo = btn.dataset.motivo;
      if (motivo === 'Otro') {
        document.getElementById('campoOtroMotivo').style.display = 'block';
        document.getElementById('textoOtroMotivo').focus();
        btn.style.borderColor = '#3b82f6';
        document.getElementById('modalSalidasFull').dataset.motivo = '';
        return;
      }
      document.getElementById('modalSalidasFull').dataset.motivo = motivo;
      document.getElementById('campoOtroMotivo').style.display = 'none';
      btn.style.borderColor = '#3b82f6';
    });
  });

  // Botón Confirmar (unificado para salida y entrada)
  document.getElementById('btnConfirmarSalidaEntrada').addEventListener('click', async () => {
    const accion = document.getElementById('modalSalidasFull').dataset.accion;
    const input = document.getElementById('inputSalidaFull');
    let valor = input.value.trim();
    if (!valor) {
      SIREI.utils.mostrarToast('Ingresa el nombre o CURP del alumno.', 'error');
      return;
    }

    let alumno = alumnosGrupo.find(a => a.curp === valor.toUpperCase());
    if (!alumno) {
      const nombreLower = valor.toLowerCase();
      alumno = alumnosGrupo.find(a => a.nombreCompleto.toLowerCase().includes(nombreLower));
    }
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      return;
    }
    const curp = alumno.curp;

    let motivo = '';
    if (accion === 'salida') {
      motivo = document.getElementById('modalSalidasFull').dataset.motivo || '';
      if (!motivo) {
        const otroTexto = document.getElementById('textoOtroMotivo').value.trim();
        if (otroTexto) {
          motivo = otroTexto;
        } else {
          SIREI.utils.mostrarToast('Selecciona un motivo o especifica "Otro".', 'error');
          return;
        }
      }
      if (!motivo) {
        SIREI.utils.mostrarToast('Selecciona un motivo.', 'error');
        return;
      }
    }

    const btnConfirm = document.getElementById('btnConfirmarSalidaEntrada');
    const textoOriginal = btnConfirm.textContent;
    btnConfirm.disabled = true;
    btnConfirm.textContent = '⏳ Procesando...';

    try {
      let response;
      if (accion === 'salida') {
        // Si motivo es "Otro", enviar también motivoOtro
        const motivoOtro = (motivo === 'Otro') ? document.getElementById('textoOtroMotivo').value.trim() : '';
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarSalida',
            token: token,
            idClase: claseActiva.idClase,
            curpAlumno: curp,
            motivo: motivo,
            motivoOtro: motivoOtro
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
            curpAlumno: curp
          })
        });
      }
      const result = await response.json();
      if (result.success) {
        const mensaje = accion === 'salida' ? 'Salida registrada' : 'Entrada registrada';
        SIREI.utils.mostrarToast(`✅ ${mensaje} para ${alumno.nombreCompleto}`);
        
        input.value = '';
        document.getElementById('seccion-motivo').style.display = 'none';
        document.getElementById('campoOtroMotivo').style.display = 'none';
        document.getElementById('textoOtroMotivo').value = '';
        document.getElementById('modalSalidasFull').dataset.motivo = '';
        document.querySelectorAll('.boton-motivo').forEach(b => b.style.borderColor = '#e5e7eb');
        if (accion === 'entrada') {
          btnConfirm.textContent = '✅ Confirmar Entrada';
        } else {
          btnConfirm.textContent = '✅ Confirmar Salida';
        }
        
        await actualizarEstadoSalidas();
        
        if (qrReaderSalidaFull) {
          qrReaderSalidaFull.stop().catch(() => {});
          qrReaderSalidaFull = null;
          document.getElementById('qr-reader-salida-full').style.display = 'none';
        }
        
        if (navigator.vibrate) navigator.vibrate(50);
        
      } else {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'Error al registrar'), 'error');
      }
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.textContent = textoOriginal;
    }
  });

  // QR para salidas
  document.getElementById('btnEscanearSalidaFull').addEventListener('click', () => {
    const readerContainer = document.getElementById('qr-reader-salida-full');
    if (qrReaderSalidaFull) {
      qrReaderSalidaFull.stop().catch(() => {});
      qrReaderSalidaFull = null;
      readerContainer.style.display = 'none';
      return;
    }
    readerContainer.style.display = 'block';
    readerContainer.innerHTML = '';
    qrReaderSalidaFull = new Html5Qrcode("qr-reader-salida-full");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    qrReaderSalidaFull.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        const curp = decodedText.trim().toUpperCase();
        document.getElementById('inputSalidaFull').value = curp;
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

    // Mostrar feedback de progreso si tarda >3s
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

      // Mostrar feedback de progreso si tarda >3s
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