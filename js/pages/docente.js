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

    <!-- ============================================================
         Modal de Entradas / Salidas — flujo autoadministrable por alumnos
         Pantalla 1: menú · 2: motivo · 3A: baño · 3B: otro · Entrada
         ============================================================ -->
    <style>
      #modalSalidasFull { position:fixed; inset:0; background:#0f172a; z-index:2000; display:none; }
      #modalSalidasFull.abierto { display:block; }
      #modalSalidasFull .msal-shell { display:flex; flex-direction:column; height:100%; background:#fff; }
      #modalSalidasFull .msal-header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:3px 10px; min-height:34px; background:#f8fafc; border-bottom:1px solid #e5e7eb; flex:0 0 auto; }
      #modalSalidasFull .msal-header-title { font-size:0.82rem; font-weight:700; color:#374151; }
      #modalSalidasFull .msal-cerrar { background:none; border:none; font-size:1.15rem; line-height:1; cursor:pointer; padding:2px 8px; color:#111827; }
      #modalSalidasFull .msal-body { flex:1 1 auto; overflow-y:auto; padding:12px; background:#fff; }
      #modalSalidasFull .msal-pantalla { display:none; }
      #modalSalidasFull .msal-titulo { margin:0 0 14px 0; font-size:1.2rem; font-weight:800; color:#111827; text-align:center; }
      #modalSalidasFull .msal-subtitulo { margin:18px 0 8px 0; font-size:0.78rem; font-weight:800; letter-spacing:0.06em; color:#6b7280; text-transform:uppercase; }
      #modalSalidasFull .msal-atras { display:inline-flex; align-items:center; gap:6px; min-height:40px; padding:8px 14px; margin-bottom:12px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:10px; font-size:0.95rem; font-weight:700; color:#374151; cursor:pointer; }
      #modalSalidasFull .msal-btn-grande { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; min-height:68px; margin-bottom:12px; border:none; border-radius:14px; font-size:1.05rem; font-weight:800; color:#fff; cursor:pointer; letter-spacing:0.02em; }
      #modalSalidasFull .msal-btn-salida { background:#f59e0b; }
      #modalSalidasFull .msal-btn-entrada { background:#10b981; }
      #modalSalidasFull .msal-btn-bano { background:#3b82f6; }
      #modalSalidasFull .msal-btn-otro { background:#8b5cf6; }
      #modalSalidasFull .msal-estado { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; }
      #modalSalidasFull .msal-bano-linea { font-size:0.95rem; font-weight:700; margin-bottom:8px; }
      #modalSalidasFull .msal-fuera-item { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 0; border-bottom:1px solid #f3f4f6; flex-wrap:wrap; }
      #modalSalidasFull .msal-fuera-nombre { font-weight:700; font-size:0.95rem; color:#111827; }
      #modalSalidasFull .msal-fuera-motivo { font-size:0.8rem; color:#6b7280; }
      #modalSalidasFull .msal-crono { font-size:1rem; font-weight:800; color:#10b981; font-variant-numeric:tabular-nums; }
      #modalSalidasFull .msal-crono-alerta { color:#dc2626 !important; }
      #modalSalidasFull .msal-badge-def { font-size:0.72rem; font-weight:800; color:#6d28d9; background:#ede9fe; padding:3px 10px; border-radius:999px; white-space:nowrap; }
      #modalSalidasFull .msal-btn-escape { min-height:38px; padding:6px 12px; background:#dc2626; color:#fff; border:none; border-radius:999px; font-size:0.8rem; font-weight:800; cursor:pointer; }
      #modalSalidasFull .msal-bloqueo { background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:14px; text-align:center; }
      #modalSalidasFull .msal-bloqueo-icono { font-size:2.2rem; line-height:1; }
      #modalSalidasFull .msal-bloqueo-titulo { font-weight:800; font-size:1.05rem; color:#991b1b; margin:8px 0 4px 0; }
      #modalSalidasFull .msal-bloqueo-sub { font-size:0.9rem; color:#7f1d1d; }
      #modalSalidasFull .msal-bloqueo-crono { font-size:1.5rem; font-weight:800; color:#dc2626; font-variant-numeric:tabular-nums; margin:6px 0; }
      #modalSalidasFull .msal-btn-definitiva { width:100%; min-height:48px; margin-top:10px; background:#6d28d9; color:#fff; border:none; border-radius:10px; font-size:0.95rem; font-weight:800; cursor:pointer; }
      #modalSalidasFull .msal-picker-row { display:flex; gap:8px; margin-bottom:10px; }
      #modalSalidasFull .msal-input { flex:1 1 auto; min-width:0; min-height:48px; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; }
      #modalSalidasFull .msal-btn-qr { flex:0 0 auto; min-height:48px; padding:10px 16px; background:#6b7280; color:#fff; border:none; border-radius:10px; font-size:0.95rem; font-weight:800; cursor:pointer; }
      #modalSalidasFull .msal-btn-registrar { width:100%; min-height:52px; background:#1E3A8A; color:#fff; border:none; border-radius:12px; font-size:1rem; font-weight:800; cursor:pointer; }
      #modalSalidasFull .msal-chip { display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:999px; background:#eff6ff; color:#1e40af; font-weight:800; font-size:0.95rem; margin-bottom:12px; }
      #modalSalidasFull .msal-campo { margin-bottom:12px; }
      #modalSalidasFull .msal-label { display:block; font-size:0.85rem; font-weight:700; color:#374151; margin-bottom:6px; }
      #modalSalidasFull .msal-input-motivo { width:100%; min-height:48px; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; font-size:16px; box-sizing:border-box; }
      #modalSalidasFull .msal-check { display:flex; align-items:center; gap:10px; min-height:48px; padding:8px 12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; margin-bottom:12px; }
      #modalSalidasFull .msal-historial { margin-top:14px; border-top:1px solid #e5e7eb; padding-top:10px; }
      #modalSalidasFull .msal-historial summary { cursor:pointer; font-size:0.85rem; font-weight:700; color:#4b5563; }
      #modalSalidasFull #listaHistorial { max-height:180px; overflow-y:auto; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:8px 10px; color:#1f2937; margin-top:8px; }
    </style>

    <div class="modal-salidas-full" id="modalSalidasFull">
      <div class="msal-shell">
        <!-- Encabezado MUY compacto: una sola línea delgada -->
        <div class="msal-header">
          <span class="msal-header-title">🚪 Entradas / Salidas</span>
          <span style="display:flex; align-items:center; gap:10px;">
            <span id="iconoBano" title="Estado del baño" style="font-size:1.05rem;">🚻✅</span>
            <button type="button" id="btnCerrarSalidasFull" class="msal-cerrar" title="Cerrar">✕</button>
          </span>
        </div>

        <!-- Pantalla de confirmación (tapa todo; autocierre 3 s) -->
        <div id="confirmacionSalidaEntrada" style="display:none;"></div>

        <div class="msal-body">
          <datalist id="msalAlumnosList">${datalistOptions}</datalist>

          <!-- ================= PANTALLA 1: MENÚ PRINCIPAL ================= -->
          <section class="msal-pantalla" id="msal-pantalla-1">
            <h2 class="msal-titulo">¿Qué desea registrar?</h2>
            <button type="button" id="btnAccionSalida" class="msal-btn-grande msal-btn-salida">📤 REGISTRAR SALIDA</button>
            <button type="button" id="btnAccionEntrada" class="msal-btn-grande msal-btn-entrada">📥 REGISTRAR ENTRADA</button>

            <h3 class="msal-subtitulo">Estado actual</h3>
            <div class="msal-estado">
              <div class="msal-bano-linea" id="msalBanoLinea">🚻✅ Baño libre</div>
              <div id="listaAlumnosFuera"><span style="color:#6b7280;">Cargando…</span></div>
            </div>

            <details class="msal-historial">
              <summary>📋 Historial reciente <span id="contadorHistorial" style="font-weight:400; color:#6b7280;"></span></summary>
              <div id="listaHistorial"><p style="color:#6b7280; font-size:0.9rem;">Cargando historial…</p></div>
            </details>
          </section>

          <!-- ================= PANTALLA 2: MOTIVO ================= -->
          <section class="msal-pantalla" id="msal-pantalla-2">
            <button type="button" class="msal-atras" data-back="1">← Atrás</button>
            <h2 class="msal-titulo">¿A dónde va?</h2>
            <button type="button" id="btnMotivoBano" class="msal-btn-grande msal-btn-bano">🚻 BAÑO</button>
            <button type="button" id="btnMotivoOtro" class="msal-btn-grande msal-btn-otro">📝 OTRO</button>
          </section>

          <!-- ================= PANTALLA 3A: BAÑO ================= -->
          <section class="msal-pantalla" id="msal-pantalla-3a">
            <button type="button" class="msal-atras" data-back="2">← Atrás</button>
            <div id="msal3aBloqueo" class="msal-bloqueo" style="display:none;"></div>
            <div id="msal3aForm" style="display:none;">
              <div class="msal-chip">🚻 Baño</div>
              <div class="msal-picker-slot"></div>
            </div>
          </section>

          <!-- ================= PANTALLA 3B: OTRO MOTIVO ================= -->
          <section class="msal-pantalla" id="msal-pantalla-3b">
            <button type="button" class="msal-atras" data-back="2">← Atrás</button>
            <div class="msal-campo">
              <label class="msal-label" for="msalMotivoEspecifico">Motivo específico *</label>
              <input type="text" id="msalMotivoEspecifico" class="msal-input-motivo" placeholder="Ej: cita con dirección" autocomplete="off">
            </div>
            <label class="msal-check"><input type="checkbox" id="chkRegresa" checked style="width:20px; height:20px; accent-color:#10b981;"> ¿Va a regresar?</label>
            <div id="msal3bBloqueo" class="msal-bloqueo" style="display:none;"></div>
            <div id="msal3bForm">
              <div class="msal-picker-slot"></div>
            </div>
          </section>

          <!-- ================= PANTALLA ENTRADA ================= -->
          <section class="msal-pantalla" id="msal-pantalla-entrada">
            <button type="button" class="msal-atras" data-back="1">← Atrás</button>
            <h2 class="msal-titulo">📥 Registrar entrada</h2>
            <div class="msal-picker-slot"></div>
          </section>

          <!-- Bloque único de búsqueda/QR (se mueve a la pantalla activa) -->
          <div id="msalPicker" style="display:none;">
            <div class="msal-picker-row">
              <input type="text" id="msalInputAlumno" class="msal-input" list="msalAlumnosList" placeholder="Nombre o CURP…" autocomplete="off">
              <button type="button" id="msalBtnQR" class="msal-btn-qr">📷 QR</button>
            </div>
            <button type="button" id="msalBtnRegistrar" class="msal-btn-registrar">✅ Registrar</button>
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
    SIREI.qr.abrir({
      titulo: 'Pasar asistencia',
      subtitulo: 'Escanea el QR de cada alumno',
      continuo: true,
      onLeido: (codigo) => {
        const curp = String(codigo).trim().toUpperCase();
        const alumno = alumnosGrupo.find(a => a.curp === curp);
        if (!alumno) {
          SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
          return;
        }
        const chkRetardo = document.getElementById('chkRetardo');
        const estado = chkRetardo && chkRetardo.checked ? 'Retardo' : 'Presente';
        const tipoToast = estado === 'Retardo' ? 'warning' : 'success';
        SIREI.utils.mostrarToast(nombreParaMostrar(alumno) + ' - ' + estado, tipoToast);

        // Actualizar la vista al instante
        actualizarEstadoAlumno(curp, estado);

        // El registro se manda en segundo plano (no bloquea la interfaz)
        SIREI.cola.agregar('registrarAsistencia', {
          idClase: claseActiva.idClase,
          curpAlumno: curp,
          estado: estado,
          tipo: 'QR',
          idDocente: idDocente,
          idGrupo: claseActiva.idGrupo,
          idAsignatura: claseActiva.idAsignatura,
          periodo: claseActiva.periodo
        });
      }
    });
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

    // Registro en segundo plano
    SIREI.cola.agregar('registrarAsistencia', {
      idClase: claseActiva.idClase,
      curpAlumno: curp,
      estado: estado,
      tipo: 'Manual',
      idDocente: idDocente,
      idGrupo: claseActiva.idGrupo,
      idAsignatura: claseActiva.idAsignatura,
      periodo: claseActiva.periodo
    });

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

    // Enviar en segundo plano: si falla la conexión, se reintenta automáticamente
    SIREI.cola.agregar('registrarAsistenciasMasivas', {
      idClase: claseActiva.idClase,
      idDocente: idDocente,
      idGrupo: claseActiva.idGrupo,
      idAsignatura: claseActiva.idAsignatura,
      periodo: claseActiva.periodo || '',
      asistencias: asistenciasData
    });
  });

  // ============================================================
  //  8. ENTRADAS / SALIDAS — flujo autoadministrable por el alumno
  //     Pantalla 1 (menú) · 2 (motivo) · 3A (baño) · 3B (otro) · Entrada
  //     + pantalla de confirmación (3 s) que vuelve a la Pantalla 1.
  // ============================================================

  let msalEstado = { fuera: [], fueraDefinitivo: [], banoOcupado: false };
  let msalPantalla = '1';
  let msalTick = null;

  function msalEl(id) { return document.getElementById(id); }
  function msalNorm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  function msalNombrePorCurp(curp) {
    const a = alumnosGrupo.find(function (x) { return x.curp === curp; });
    return a ? a.nombreCompleto : String(curp || '');
  }

  // Parser tolerante de fechas (ISO, dd/MM/yyyy HH:mm:ss, yyyy-MM-dd HH:mm:ss)
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
      const f = partes[0];
      const h = partes[1] || '00:00:00';
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

  function msalMMSS(seg) {
    const t = Math.max(0, Math.floor(seg));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }

  function msalSegundosDesde(ts) {
    const d = parsearFechaMovimiento(ts);
    if (!d) return null;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  }

  // Alumno que bloquea salidas temporales (regla 1): el primero con estado "Fuera"
  function msalBloqueadoConRegreso() {
    return msalEstado.fuera.length > 0 ? msalEstado.fuera[0] : null;
  }

  // ---------- Navegación entre pantallas ----------
  function msalIrA(nombre) {
    msalPantalla = String(nombre);
    const pantalla = msalEl('msal-pantalla-' + nombre);
    document.querySelectorAll('#modalSalidasFull .msal-pantalla').forEach(function (p) {
      p.style.display = 'none';
    });
    if (!pantalla) return;
    pantalla.style.display = 'block';

    // El bloque de búsqueda/QR es único y se reubica en la pantalla activa
    const picker = msalEl('msalPicker');
    const slot = pantalla.querySelector('.msal-picker-slot');
    if (picker) {
      if (slot) {
        slot.appendChild(picker);
        picker.style.display = 'block';
        const inp = msalEl('msalInputAlumno');
        if (inp) inp.value = '';
      } else {
        picker.style.display = 'none';
      }
    }

    if (nombre === '3a') msalEvaluarBano();
    if (nombre === '3b') msalEvaluarOtro();

    // Regla 5: sin autofocus (no abrir el teclado en móvil)
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }

  // Pantalla 3A: ¿se puede salir al baño?
  function msalEvaluarBano() {
    const bloqueo = msalEl('msal3aBloqueo');
    const form = msalEl('msal3aForm');
    if (!bloqueo || !form) return;

    const ocupante = msalEstado.fuera.find(function (s) { return msalNorm(s.motivo) === 'baño'; });
    const otro = !ocupante ? msalBloqueadoConRegreso() : null;
    const s = ocupante || otro;

    if (s) {
      const esBano = !!ocupante;
      const nombre = SIREI.utils.escapeHtml(msalNombrePorCurp(s.curp));
      const desde = s.salidaFormateada || s.salidaTimestamp || '';
      bloqueo.style.display = 'block';
      form.style.display = 'none';
      bloqueo.innerHTML = `
        <div class="msal-bloqueo-icono">${esBano ? '🚻' : '⏳'}</div>
        <div class="msal-bloqueo-titulo">${esBano ? 'Baño ocupado por:' : 'Hay una persona fuera:'} ${nombre}</div>
        <div class="msal-bloqueo-crono" data-crono-curp="${SIREI.utils.escapeHtml(s.curp)}" data-desde="${SIREI.utils.escapeHtml(desde)}">⏱️ --:--</div>
        <div class="msal-bloqueo-sub">${esBano ? 'No puedes salir al baño.' : 'Espera a que regrese para poder salir.'}</div>
        <button type="button" class="msal-btn-definitiva" data-ir-definitiva="1">📝 Registrar salida definitiva</button>
      `;
    } else {
      bloqueo.style.display = 'none';
      form.style.display = 'block';
    }
    msalTickCronos();
  }

  // Pantalla 3B: ¿se puede registrar "Otro"?
  function msalEvaluarOtro() {
    const bloqueo = msalEl('msal3bBloqueo');
    const form = msalEl('msal3bForm');
    const chk = msalEl('chkRegresa');
    if (!bloqueo || !form) return;

    const vaARegresar = chk ? chk.checked : true;
    const ocupado = vaARegresar ? msalBloqueadoConRegreso() : null;

    if (ocupado) {
      const nombre = SIREI.utils.escapeHtml(msalNombrePorCurp(ocupado.curp));
      const desde = ocupado.salidaFormateada || ocupado.salidaTimestamp || '';
      bloqueo.style.display = 'block';
      form.style.display = 'none';
      bloqueo.innerHTML = `
        <div class="msal-bloqueo-icono">⏳</div>
        <div class="msal-bloqueo-titulo">Hay una persona fuera</div>
        <div class="msal-bloqueo-sub">${nombre} — espere a que regrese</div>
        <div class="msal-bloqueo-crono" data-crono-curp="${SIREI.utils.escapeHtml(ocupado.curp)}" data-desde="${SIREI.utils.escapeHtml(desde)}">⏱️ --:--</div>
        <div class="msal-bloqueo-sub" style="margin-top:8px;">También puedes desactivar “¿Va a regresar?” para registrar una salida definitiva.</div>
      `;
    } else {
      bloqueo.style.display = 'none';
      form.style.display = 'block';
    }
    msalTickCronos();
  }

  // ---------- Cronómetros en vivo (cada segundo) ----------
  function msalTickCronos() {
    document.querySelectorAll('#modalSalidasFull [data-crono-curp]').forEach(function (el) {
      const seg = msalSegundosDesde(el.dataset.desde);
      if (seg == null) { el.textContent = '⏱️ --:--'; return; }
      el.textContent = '⏱️ ' + msalMMSS(seg);
      if (seg >= 300) el.classList.add('msal-crono-alerta');

      const item = el.closest('.msal-fuera-item');
      const btn = item ? item.querySelector('.msal-btn-escape') : null;
      if (btn) btn.style.display = (seg >= 300) ? 'inline-flex' : 'none';
    });
  }

  function msalIniciarTick() {
    msalDetenerTick();
    msalTick = setInterval(function () { try { msalTickCronos(); } catch (e) {} }, 1000);
  }

  function msalDetenerTick() {
    if (msalTick) { clearInterval(msalTick); msalTick = null; }
  }

  // ---------- Estado actual + historial ----------
  async function actualizarEstadoSalidas() {
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerSalidasClase',
          token: token,
          idClase: claseActiva.idClase
        })
      });
      const data = await resp.json();
      if (data.success) {
        const todas = data.salidas || [];
        msalEstado.fuera = todas.filter(function (s) { return s.estado === 'Fuera'; });
        msalEstado.fueraDefinitivo = todas.filter(function (s) { return s.estado === 'Fuera definitivo'; });
        msalEstado.banoOcupado = msalEstado.fuera.some(function (s) { return msalNorm(s.motivo) === 'baño'; });
        msalPintarEstadoActual();
      }
    } catch (e) {
      console.error('Error al leer salidas:', e);
    }
    try { await msalActualizarHistorial(); } catch (e) {}
  }

  function msalPintarEstadoActual() {
    const icono = msalEl('iconoBano');
    if (icono) {
      icono.textContent = msalEstado.banoOcupado ? '🚻🚫' : '🚻✅';
      icono.title = msalEstado.banoOcupado ? 'Baño ocupado' : 'Baño libre';
    }
    const linea = msalEl('msalBanoLinea');
    if (linea) {
      linea.textContent = msalEstado.banoOcupado ? '🚻🚫 Baño ocupado' : '🚻✅ Baño libre';
      linea.style.color = msalEstado.banoOcupado ? '#dc2626' : '#16a34a';
    }

    const cont = msalEl('listaAlumnosFuera');
    if (!cont) return;

    if (msalEstado.fuera.length === 0 && msalEstado.fueraDefinitivo.length === 0) {
      cont.innerHTML = '<span style="color:#10b981; font-weight:600;">✅ Todos los alumnos están dentro.</span>';
      return;
    }

    let html = '';

    // Con regreso pendiente: nombre + motivo + cronómetro + escape (>= 5 min)
    msalEstado.fuera.forEach(function (s) {
      const nombre = SIREI.utils.escapeHtml(msalNombrePorCurp(s.curp));
      const motivo = SIREI.utils.escapeHtml(s.motivo || 'Sin motivo') +
        (s.motivo_otro ? ' (' + SIREI.utils.escapeHtml(s.motivo_otro) + ')' : '');
      const desde = s.salidaFormateada || s.salidaTimestamp || '';
      const seg = msalSegundosDesde(desde);
      const alerta = (seg != null && seg >= 300);
      html += `
        <div class="msal-fuera-item" data-curp="${SIREI.utils.escapeHtml(s.curp)}">
          <div>
            <div class="msal-fuera-nombre">${nombre}</div>
            <div class="msal-fuera-motivo">${motivo}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="msal-crono${alerta ? ' msal-crono-alerta' : ''}" data-crono-curp="${SIREI.utils.escapeHtml(s.curp)}" data-desde="${SIREI.utils.escapeHtml(desde)}">⏱️ --:--</span>
            <button type="button" class="msal-btn-escape" data-curp="${SIREI.utils.escapeHtml(s.curp)}" style="display:${alerta ? 'inline-flex' : 'none'};">🏃 Registrar Escape</button>
          </div>
        </div>`;
    });

    // Sin regreso: nombre + motivo + badge
    msalEstado.fueraDefinitivo.forEach(function (s) {
      const nombre = SIREI.utils.escapeHtml(msalNombrePorCurp(s.curp));
      const motivo = SIREI.utils.escapeHtml(s.motivo || 'Sin motivo') +
        (s.motivo_otro ? ' (' + SIREI.utils.escapeHtml(s.motivo_otro) + ')' : '');
      html += `
        <div class="msal-fuera-item" data-curp="${SIREI.utils.escapeHtml(s.curp)}">
          <div>
            <div class="msal-fuera-nombre">${nombre}</div>
            <div class="msal-fuera-motivo">${motivo}</div>
          </div>
          <span class="msal-badge-def">🏃 Sin regreso</span>
        </div>`;
    });

    cont.innerHTML = html;
    msalTickCronos();
  }

  async function msalActualizarHistorial() {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerHistorialSalidas',
        token: token,
        idClase: claseActiva.idClase,
        limite: 15
      })
    });
    const dataHist = await resp.json();
    if (!dataHist.success) return;

    const movs = dataHist.movimientos || [];
    const contador = msalEl('contadorHistorial');
    if (contador) contador.textContent = '(' + movs.length + ' registros)';
    const lista = msalEl('listaHistorial');
    if (!lista) return;

    if (movs.length === 0) {
      lista.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">No hay movimientos registrados.</p>';
      return;
    }

    lista.innerHTML = movs.map(function (m) {
      const nombre = SIREI.utils.escapeHtml(msalNombrePorCurp(m.curp));
      const estado = m.estado || '';
      let icono = '🚪✅'; let color = '#065f46'; let extra = '';
      if (estado === 'Fuera definitivo') { icono = '🚪🚫'; color = '#6d28d9'; extra = 'Sin regreso'; }
      else if (estado === 'Escape') { icono = '🏃'; color = '#dc2626'; extra = 'Sin regreso'; }
      else if (estado === 'Fuera') { icono = '🚪'; color = '#92400e'; extra = 'Aún fuera'; }
      else if (estado === 'Dentro') { icono = '🚪✅'; color = '#065f46'; extra = m.duracion ? ('⏱️ ' + SIREI.utils.escapeHtml(m.duracion)) : '⏱️ --:--'; }

      const fecha = SIREI.utils.escapeHtml(m.salidaFormateada || m.salidaTimestamp || '');
      const motivoTxt = SIREI.utils.escapeHtml(m.motivo || '') + (m.motivo_otro ? ' (' + SIREI.utils.escapeHtml(m.motivo_otro) + ')' : '');
      return `<div style="display:flex; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:0.85rem;">
        <div style="min-width:0;">
          <div style="font-weight:600;">${nombre}</div>
          <div style="color:#6b7280; font-size:0.75rem;">${motivoTxt}</div>
        </div>
        <div style="text-align:right; white-space:nowrap;">
          <div style="color:${color};">${icono} <span style="font-size:0.72rem; color:#6b7280;">${fecha}</span></div>
          <div style="font-size:0.72rem; font-weight:700; color:#6b7280;">${extra}</div>
        </div>
      </div>`;
    }).join('');
  }

  // ---------- Formulario ----------
  function msalReiniciarFormulario() {
    const txt = msalEl('msalMotivoEspecifico');
    if (txt) txt.value = '';
    const chk = msalEl('chkRegresa');
    if (chk) chk.checked = true;
    const inp = msalEl('msalInputAlumno');
    if (inp) inp.value = '';
    const b3 = msalEl('msal3bBloqueo');
    if (b3) b3.style.display = 'none';
    const f3 = msalEl('msal3bForm');
    if (f3) f3.style.display = 'block';
    const b3a = msalEl('msal3aBloqueo');
    if (b3a) b3a.style.display = 'none';
    const f3a = msalEl('msal3aForm');
    if (f3a) f3a.style.display = 'none';
  }

  async function msalAbrirModal() {
    const modal = msalEl('modalSalidasFull');
    if (!modal) return;
    modal.classList.add('abierto');
    msalIrA('1');
    msalIniciarTick();
    await actualizarEstadoSalidas();
  }

  function msalCerrarModal() {
    const modal = msalEl('modalSalidasFull');
    if (modal) modal.classList.remove('abierto');
    msalDetenerTick();
    msalOcultarConfirmacion();
    msalReiniciarFormulario();
    msalIrA('1');
  }

  // ---------- Confirmación (3 s y vuelve a la Pantalla 1) ----------
  function msalOcultarConfirmacion() {
    if (window._msalTimeoutConf) { clearTimeout(window._msalTimeoutConf); window._msalTimeoutConf = null; }
    if (window._msalIntervalConf) { clearInterval(window._msalIntervalConf); window._msalIntervalConf = null; }
    const cont = msalEl('confirmacionSalidaEntrada');
    if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
  }

  function msalMostrarConfirmacion(datos) {
    // Si ya había una confirmación, se cierra de inmediato y se muestra la nueva
    msalOcultarConfirmacion();
    const cont = msalEl('confirmacionSalidaEntrada');
    if (!cont) return;

    const esEntrada = datos.tipo === 'entrada';
    const esDefinitiva = !!datos.definitiva;
    const nombre = SIREI.utils.escapeHtml(datos.nombre || '');
    const motivo = SIREI.utils.escapeHtml(datos.motivo || '');

    let icono, titulo, bloque;
    if (esEntrada) {
      icono = '✅';
      titulo = 'Tu entrada está registrada';
      bloque = `<p style="margin:8px 0 0 0; font-size:1rem; color:#374151;">Tiempo total fuera:</p>
                <p style="margin:4px 0 0 0; font-size:2.1rem; font-weight:800; color:#10b981; font-variant-numeric:tabular-nums;">⏱️ ${SIREI.utils.escapeHtml(datos.duracion || '00:00:00')}</p>`;
    } else if (esDefinitiva) {
      icono = '🚪';
      titulo = 'Salida registrada';
      bloque = `${motivo ? `<p style="margin:6px 0 0 0; font-size:1.05rem; color:#374151;">Motivo: <strong>${motivo}</strong></p>` : ''}
                <div style="margin-top:12px;"><span style="display:inline-block; font-size:0.9rem; font-weight:800; color:#6d28d9; background:#ede9fe; padding:6px 16px; border-radius:999px;">🏃 Sin regreso</span></div>`;
    } else {
      icono = '🚪';
      titulo = 'Ya puedes salir';
      bloque = `${motivo ? `<p style="margin:6px 0 0 0; font-size:1.05rem; color:#374151;">Motivo: <strong>${motivo}</strong></p>` : ''}
                <p style="margin:8px 0 0 0; font-size:1rem; color:#374151;">Tiempo fuera:</p>
                <p id="msalConfCrono" style="margin:4px 0 0 0; font-size:2.1rem; font-weight:800; color:#f59e0b; font-variant-numeric:tabular-nums;">00:00</p>`;
    }

    cont.style.zIndex = '2147483600';
    cont.innerHTML = `
      <div class="confirmacion-overlay">
        <div class="confirmacion-tarjeta">
          <div style="font-size:3.2rem; line-height:1;">${icono}</div>
          <h2 style="margin:10px 0 6px 0; font-size:1.5rem; color:#111827;">${titulo}</h2>
          <p style="margin:4px 0; font-size:1.25rem; font-weight:800; color:#1E3A8A;">${nombre}</p>
          ${bloque}
        </div>
      </div>`;
    cont.style.display = 'block';

    // Cronómetro en vivo solo para salidas temporales
    if (!esEntrada && !esDefinitiva && datos.salidaTimestamp) {
      const pintar = function () {
        const el = msalEl('msalConfCrono');
        if (!el) return;
        const seg = msalSegundosDesde(datos.salidaTimestamp);
        el.textContent = (seg == null) ? '00:00' : msalMMSS(seg);
      };
      pintar();
      window._msalIntervalConf = setInterval(pintar, 1000);
    }

    window._msalTimeoutConf = setTimeout(function () {
      msalOcultarConfirmacion();
      msalIrA('1');       // vuelve al menú para el siguiente alumno
    }, 3000);
  }

  // ---------- Registro ----------
  async function msalProcesar(curpRaw) {
    const curp = String(curpRaw || '').trim().toUpperCase();
    const alumno = alumnosGrupo.find(function (a) { return a.curp === curp; });
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
      return;
    }

    const esEntrada = (msalPantalla === 'entrada');
    let motivo = '';
    let motivoOtro = '';
    let vaARegresar = true;

    if (!esEntrada) {
      if (msalPantalla === '3a') {
        motivo = 'Baño';
      } else {
        const txt = msalEl('msalMotivoEspecifico');
        motivoOtro = txt ? txt.value.trim() : '';
        if (!motivoOtro) {
          SIREI.utils.mostrarToast('Escribe el motivo específico.', 'error');
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          return;
        }
        motivo = 'Otro';
        const chk = msalEl('chkRegresa');
        vaARegresar = chk ? chk.checked : true;
      }
    }

    // --- Entrada: el alumno debe tener una salida activa ---
    if (esEntrada) {
      const enFuera = msalEstado.fuera.some(function (s) { return s.curp === curp; });
      const enDefinitivo = msalEstado.fueraDefinitivo.some(function (s) { return s.curp === curp; });
      if (!enFuera && !enDefinitivo) {
        SIREI.utils.mostrarToast('Alumno no tiene salida activa', 'error');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        return;
      }
    }

    // --- Regla 1: bloqueo general para salidas temporales ---
    if (!esEntrada && vaARegresar) {
      const ocupante = msalBloqueadoConRegreso();
      if (ocupante) {
        SIREI.utils.mostrarToast('Hay una persona fuera (' + msalNombrePorCurp(ocupante.curp) + '). Espera a que regrese.', 'error');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        return;
      }
    }

    const btn = msalEl('msalBtnRegistrar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Registrando…'; }

    try {
      const params = esEntrada
        ? { accion: 'registrarEntrada', token: token, idClase: claseActiva.idClase, curpAlumno: curp }
        : { accion: 'registrarSalida', token: token, idClase: claseActiva.idClase, curpAlumno: curp, motivo: motivo, motivoOtro: motivoOtro, vaARegresar: vaARegresar ? 'true' : 'false' };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
      });
      const result = await response.json();

      if (!result.success) {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'Error al registrar'), 'error');
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        return;
      }

      // Duración de la entrada (backend o cálculo local de respaldo)
      let duracionFinal = result.duracion || '';
      if (esEntrada && !duracionFinal) {
        const rec = msalEstado.fuera.find(function (s) { return s.curp === curp; }) ||
                    msalEstado.fueraDefinitivo.find(function (s) { return s.curp === curp; });
        const desde = rec ? (rec.salidaFormateada || rec.salidaTimestamp) : null;
        const seg = msalSegundosDesde(desde);
        if (seg != null) duracionFinal = formatearDuracionHMS(seg);
      }

      const esDefinitiva = !esEntrada && (!vaARegresar || result.estado === 'Fuera definitivo');
      const motivoMostrar = (motivo === 'Otro' && motivoOtro) ? ('Otro: ' + motivoOtro) : (motivo || '');

      if (navigator.vibrate) navigator.vibrate(60);
      msalReiniciarFormulario();           // regla 7: reinicia tras éxito
      await actualizarEstadoSalidas();      // refresca (ocupa/libera el bloqueo)

      msalMostrarConfirmacion({
        tipo: esEntrada ? 'entrada' : 'salida',
        nombre: alumno.nombreCompleto,
        motivo: motivoMostrar,
        duracion: duracionFinal || '00:00:00',
        salidaTimestamp: result.salidaTimestamp || (esEntrada ? null : new Date().toISOString()),
        definitiva: esDefinitiva
      });
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar'; }
    }
  }

  // ---------- Escape desde la lista de alumnos fuera ----------
  async function msalRegistrarEscape(curp) {
    if (!curp) return;
    if (!SIREI.utils.confirmar('¿Registrar escape? Se liberará el bloqueo de salidas.')) return;
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
        SIREI.utils.mostrarToast('✅ Escape registrado. Asígnale una actitud en el panel Actitudinal.');
        await actualizarEstadoSalidas();
        if (msalPantalla === '3a') msalEvaluarBano();
        if (msalPantalla === '3b') msalEvaluarOtro();
      } else {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'Error al registrar escape'), 'error');
      }
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    }
  }

  // ---------- Eventos ----------
  document.getElementById('btnAbrirSalidas').addEventListener('click', msalAbrirModal);
  document.getElementById('btnCerrarSalidasFull').addEventListener('click', msalCerrarModal);

  // Botones "← Atrás"
  document.querySelectorAll('#modalSalidasFull .msal-atras').forEach(function (b) {
    b.addEventListener('click', function () { msalIrA(b.dataset.back || '1'); });
  });

  // Pantalla 1 → 2 / Entrada
  document.getElementById('btnAccionSalida').addEventListener('click', function () { msalIrA('2'); });
  document.getElementById('btnAccionEntrada').addEventListener('click', function () { msalIrA('entrada'); });

  // Pantalla 2 → 3A / 3B
  document.getElementById('btnMotivoBano').addEventListener('click', function () { msalIrA('3a'); });
  document.getElementById('btnMotivoOtro').addEventListener('click', function () {
    const chk = msalEl('chkRegresa');
    if (chk) chk.checked = true;
    msalIrA('3b');
  });

  // La casilla cambia los bloqueos de la Pantalla 3B
  const msalChkRegresa = msalEl('chkRegresa');
  if (msalChkRegresa) {
    msalChkRegresa.addEventListener('change', msalEvaluarOtro);
  }

  // "Registrar salida definitiva" del bloqueo del baño → 3B con "¿Va a regresar?" desactivada
  const msalBloqueoBano = msalEl('msal3aBloqueo');
  if (msalBloqueoBano) {
    msalBloqueoBano.addEventListener('click', function (e) {
      if (!e.target.closest('[data-ir-definitiva]')) return;
      const chk = msalEl('chkRegresa');
      if (chk) chk.checked = false;
      msalIrA('3b');
    });
  }

  // Botón de escape en la lista (delegado: la lista se repinta)
  const msalListaFuera = msalEl('listaAlumnosFuera');
  if (msalListaFuera) {
    msalListaFuera.addEventListener('click', function (e) {
      const btn = e.target.closest('.msal-btn-escape');
      if (!btn) return;
      msalRegistrarEscape(btn.dataset.curp);
    });
  }

  // Botón Registrar (por nombre o CURP)
  const msalBtnRegistrar = msalEl('msalBtnRegistrar');
  if (msalBtnRegistrar) {
    msalBtnRegistrar.addEventListener('click', async function () {
      const inp = msalEl('msalInputAlumno');
      const valor = inp ? inp.value.trim() : '';
      if (!valor) {
        SIREI.utils.mostrarToast('Escribe el nombre o CURP del alumno.', 'error');
        return;
      }
      const alumno = buscarAlumnoPorTexto(valor);
      if (!alumno) {
        SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
        return;
      }
      await msalProcesar(alumno.curp);
    });
  }

  // Botón QR: procesa de inmediato y cierra la cámara tras la lectura (regla 4)
  const msalBtnQR = msalEl('msalBtnQR');
  if (msalBtnQR) {
    msalBtnQR.addEventListener('click', function () {
      SIREI.qr.abrir({
        titulo: 'Entradas / Salidas',
        subtitulo: 'Escanea el QR del alumno',
        continuo: false,
        onLeido: function (codigo) {
          return msalProcesar(String(codigo || '').trim().toUpperCase());
        }
      });
    });
  }

  // Cerrar tocando el fondo oscuro (fuera de la hoja blanca)
  document.getElementById('modalSalidasFull').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) msalCerrarModal();
  });

  // El modal arranca siempre en la Pantalla 1
  msalIrA('1');

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
