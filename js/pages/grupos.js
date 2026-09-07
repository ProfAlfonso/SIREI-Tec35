// ============================================================
//  pages/grupos.js - Gestión de Grupos y Asignaciones
//  Versión 2.1 - Corregido cambio de estado (envía todos los campos)
// ============================================================

// ============================================================
//  SECCIÓN 1: CARGA DE MÓDULO Y VARIABLES GLOBALES
// ============================================================

window.cargarGrupos = async function(container) {
  // Estado local
  let gruposCache = [];
  let asignaturasCache = [];
  let docentesCache = [];
  let grupoSeleccionadoId = null;
  let ordenColumna = 'nombre';
  let ordenDireccion = 'asc';
  let ordenAsignacionCol = 'asignatura';
  let ordenAsignacionDir = 'asc';

  // ============================================================
  //  SECCIÓN 2: FUNCIONES DE OBTENCIÓN DE DATOS (CON CACHÉ)
  // ============================================================

  const obtenerGrupos = async (forzarRecarga = false) => {
    if (!forzarRecarga && window._sireiCache && window._sireiCache['coordinador_grupos']) {
      return window._sireiCache['coordinador_grupos'];
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
      window._sireiCache['coordinador_grupos'] = data.grupos || [];
      return window._sireiCache['coordinador_grupos'];
    }
    return [];
  };

  const obtenerAsignaturas = async () => {
    if (window._sireiCache && window._sireiCache['coordinador_asignaturas']) {
      return window._sireiCache['coordinador_asignaturas'];
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
      window._sireiCache['coordinador_asignaturas'] = data.asignaturas || [];
      return window._sireiCache['coordinador_asignaturas'];
    }
    return [];
  };

  const obtenerDocentes = async () => {
    if (window._sireiCache && window._sireiCache['coordinador_docentes']) {
      return window._sireiCache['coordinador_docentes'];
    }
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerDocentes',
        token: sessionStorage.getItem('sirei_token')
      })
    });
    const data = await response.json();
    if (data.success) {
      if (!window._sireiCache) window._sireiCache = {};
      window._sireiCache['coordinador_docentes'] = data.docentes || [];
      return window._sireiCache['coordinador_docentes'];
    }
    return [];
  };

  const obtenerPeriodoEscolar = async () => {
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
      if (data.success && data.datos && data.datos.periodo) return data.datos.periodo;
      return '';
    } catch (e) {
      return '';
    }
  };

  const obtenerAsignaciones = async (idGrupo) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAsignaciones',
        token: sessionStorage.getItem('sirei_token'),
        idGrupo: idGrupo
      })
    });
    const data = await response.json();
    if (data.success) return data.asignaciones || [];
    return [];
  };

  const obtenerAlumnosGrupo = async (idGrupo) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerAlumnosPorGrupo',
          token: sessionStorage.getItem('sirei_token'),
          idGrupo: idGrupo
        })
      });
      const data = await response.json();
      if (data.success) return data.alumnos || [];
      return [];
    } catch (e) {
      return [];
    }
  };

  const obtenerSubgrupos = async (idGrupo, idAsignatura) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerSubgrupos',
          token: sessionStorage.getItem('sirei_token'),
          idGrupo: idGrupo,
          idAsignatura: idAsignatura || ''
        })
      });
      const data = await response.json();
      if (data.success) return data.subgrupos || [];
      return [];
    } catch (e) {
      return [];
    }
  };

  const guardarSubgrupos = async (payload) => {
    const body = new URLSearchParams({
      accion: 'guardarSubgrupos',
      token: sessionStorage.getItem('sirei_token'),
      idGrupo: payload.idGrupo,
      idAsignatura: payload.idAsignatura,
      subgrupos: JSON.stringify(payload.subgrupos || [])
    });
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });
    return await response.json();
  };

  // ============================================================
  //  SECCIÓN 3: FUNCIONES DE LIMPIEZA DE CACHÉ Y RENDERIZADO
  // ============================================================

  const limpiarCache = () => {
    if (window._sireiCache) {
      delete window._sireiCache['coordinador_grupos'];
      delete window._sireiCache['coordinador_asignaturas'];
      delete window._sireiCache['coordinador_docentes'];
    }
  };

  // ============================================================
  //  SECCIÓN 4: RENDERIZADO PRINCIPAL (VISTA GRUPOS)
  // ============================================================

  const renderizar = async () => {
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Gestión de Grupos</h2>
        <div style="display:flex; gap: 10px; margin-bottom: 20px; flex-wrap:wrap;">
          <button id="btnNuevoGrupo" class="btn btn-primary">+ Nuevo Grupo</button>
          <button id="btnRefrescar" class="btn btn-secondary">⟳ Recargar datos</button>
        </div>
        <div style="display:flex; gap: 10px; flex-wrap:wrap; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <button id="btnVerGrupo" class="btn-modern btn-info-modern" disabled><i class="bi bi-eye"></i> Ver</button>
          <button id="btnEditarGrupo" class="btn-modern btn-warning-modern" disabled><i class="bi bi-pencil"></i> Editar</button>
          <button id="btnEliminarGrupo" class="btn-modern btn-danger-modern" disabled><i class="bi bi-trash"></i> Eliminar</button>
          <button id="btnAsignarAsignatura" class="btn-modern btn-primary-modern" disabled><i class="bi bi-plus-circle"></i> Asignar Asignatura</button>
          <span style="margin-left: auto; font-size: 0.85rem; color: #6b7280;" id="seleccionInfoGrupo">Ninguno seleccionado</span>
        </div>
        <div id="gruposLista" style="margin-top: 10px;">
          <div class="loader-moderno"><div class="spinner"></div><p>Cargando grupos...</p></div>
        </div>
      </div>
      <div class="card" id="detalleGrupo" style="display:none;">
        <h2 class="card-title">Asignaciones del Grupo <span id="nombreGrupoDetalle"></span></h2>
        <div id="asignacionesDetalle"></div>
        <div style="margin-top: 16px;">
          <button id="btnCerrarDetalle" class="btn btn-secondary">Cerrar detalle</button>
        </div>
      </div>
    `;

    // Cargar datos y renderizar tabla
    await cargarGrupos();

    // Eventos de los botones principales
    document.getElementById('btnNuevoGrupo').addEventListener('click', mostrarFormularioNuevoGrupo);
    document.getElementById('btnRefrescar').addEventListener('click', async () => {
      limpiarCache();
      await cargarGrupos();
      SIREI.utils.mostrarToast('Datos recargados');
    });
    document.getElementById('btnVerGrupo').addEventListener('click', async () => {
      if (grupoSeleccionadoId === null) return;
      const btn = document.getElementById('btnVerGrupo');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cargando...';
      try {
        await verGrupo(grupoSeleccionadoId);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-eye"></i> Ver';
      }
    });
    document.getElementById('btnEditarGrupo').addEventListener('click', () => {
      if (grupoSeleccionadoId !== null) mostrarFormularioEditarGrupo(grupoSeleccionadoId);
    });
    document.getElementById('btnEliminarGrupo').addEventListener('click', () => {
      if (grupoSeleccionadoId !== null) eliminarGrupo(grupoSeleccionadoId);
    });
    document.getElementById('btnAsignarAsignatura').addEventListener('click', () => {
      if (grupoSeleccionadoId !== null) mostrarFormularioAsignacion(grupoSeleccionadoId);
    });
    document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
      document.getElementById('detalleGrupo').style.display = 'none';
    });
  };

  // ============================================================
  //  SECCIÓN 5: CARGAR Y MOSTRAR LISTA DE GRUPOS (SIN GRADO)
  // ============================================================

  const cargarGrupos = async () => {
    const listaDiv = document.getElementById('gruposLista');
    const seleccionInfo = document.getElementById('seleccionInfoGrupo');
    if (!listaDiv) return;

    try {
      gruposCache = await obtenerGrupos();
      if (gruposCache.length === 0) {
        listaDiv.innerHTML = '<p style="color:#6b7280;">No hay grupos registrados.</p>';
        return;
      }

      // Ordenar (por nombre, observaciones, aula o periodo)
      const gruposOrdenados = [...gruposCache].sort((a, b) => {
        const valA = String(a[ordenColumna] || '').toLowerCase();
        const valB = String(b[ordenColumna] || '').toLowerCase();
        return ordenDireccion === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      // ---- GENERAR TABLA (sin columna Grado) ----
      let html = `<table class="grupos-table" style="width:100%; border-collapse:collapse;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:10px; width:40px;">#</th>
          <th data-columna="nombre" style="padding:10px; cursor:pointer;">Nombre <span class="sort-icon">${ordenColumna==='nombre'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
          <th data-columna="turno" style="padding:10px; cursor:pointer;">Observaciones <span class="sort-icon">${ordenColumna==='turno'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
          <th data-columna="aula" style="padding:10px; cursor:pointer;">Aula <span class="sort-icon">${ordenColumna==='aula'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
          <th data-columna="periodo" style="padding:10px; cursor:pointer;">Periodo <span class="sort-icon">${ordenColumna==='periodo'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
        </tr></thead><tbody>`;
      gruposOrdenados.forEach(g => {
        const checked = grupoSeleccionadoId === g.id ? 'checked' : '';
        html += `<tr class="fila-grupo" data-id="${g.id}" style="cursor:pointer;">
          <td style="padding:10px; text-align:center;">
            <input type="radio" name="seleccionGrupo" value="${g.id}" class="seleccion-grupo" ${checked}>
          </td>
          <td style="padding:10px;">${SIREI.utils.escapeHtml(g.nombre)}</td>
          <td style="padding:10px;">${SIREI.utils.escapeHtml(g.turno)}</td>
          <td style="padding:10px;">${SIREI.utils.escapeHtml(g.aula)}</td>
          <td style="padding:10px;">${SIREI.utils.escapeHtml(g.periodo)}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
      listaDiv.innerHTML = html;

      // ---- EVENTOS DE ORDENAMIENTO ----
      document.querySelectorAll('.grupos-table th[data-columna]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.columna;
          if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
          else { ordenColumna = col; ordenDireccion = 'asc'; }
          cargarGrupos();
        });
      });

      // ---- EVENTOS DE SELECCIÓN (radio buttons) ----
      const radioButtons = document.querySelectorAll('.seleccion-grupo');
      const verBtn = document.getElementById('btnVerGrupo');
      const editarBtn = document.getElementById('btnEditarGrupo');
      const eliminarBtn = document.getElementById('btnEliminarGrupo');
      const asignarBtn = document.getElementById('btnAsignarAsignatura');

      const actualizarEstadoBotones = (id) => {
        const habilitado = id !== null;
        verBtn.disabled = !habilitado;
        editarBtn.disabled = !habilitado;
        eliminarBtn.disabled = !habilitado;
        asignarBtn.disabled = !habilitado;
        if (id !== null) {
          const grupo = gruposCache.find(g => g.id == id);
          seleccionInfo.textContent = `Seleccionado: ${grupo ? grupo.nombre : ''}`;
        } else {
          seleccionInfo.textContent = 'Ninguno seleccionado';
        }
      };

      // Clic en fila selecciona el radio
      document.querySelectorAll('.fila-grupo').forEach(fila => {
        fila.addEventListener('click', function(e) {
          if (e.target.type === 'radio') return;
          const radio = this.querySelector('.seleccion-grupo');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });

      radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
          if (this.checked) {
            grupoSeleccionadoId = parseInt(this.value);
          } else {
            grupoSeleccionadoId = null;
          }
          actualizarEstadoBotones(grupoSeleccionadoId);
        });
      });

      // Inicializar estado de botones
      const checkedRadio = document.querySelector('.seleccion-grupo:checked');
      if (checkedRadio) {
        grupoSeleccionadoId = parseInt(checkedRadio.value);
      } else {
        grupoSeleccionadoId = null;
      }
      actualizarEstadoBotones(grupoSeleccionadoId);

    } catch (error) {
      listaDiv.innerHTML = `<div style="color:#ef4444;">Error: ${error.message}</div>`;
    }
  };


  // ============================================================
  //  SECCIÓN 6: VER DETALLE DE GRUPO (MUESTRA TODAS LAS ASIGNACIONES)
  // ============================================================

  const verGrupo = async (idGrupo) => {
    const detalleDiv = document.getElementById('detalleGrupo');
    const nombreSpan = document.getElementById('nombreGrupoDetalle');
    const asignacionesDiv = document.getElementById('asignacionesDetalle');
    if (!detalleDiv || !nombreSpan || !asignacionesDiv) return;

    const grupo = gruposCache.find(g => g.id == idGrupo);
    nombreSpan.textContent = grupo ? grupo.nombre : idGrupo;

    try {
      const asignaciones = await obtenerAsignaciones(idGrupo);
      const asignaturas = await obtenerAsignaturas();
      const docentes = await obtenerDocentes();

      // Ordenar asignaciones
      const asignacionesOrdenadas = [...asignaciones].sort((a, b) => {
        let valA, valB;
        if (ordenAsignacionCol === 'asignatura') {
          const asigA = asignaturas.find(s => s.id === a.idAsignatura);
          const asigB = asignaturas.find(s => s.id === b.idAsignatura);
          valA = (asigA ? asigA.nombre : a.idAsignatura).toLowerCase();
          valB = (asigB ? asigB.nombre : b.idAsignatura).toLowerCase();
        } else if (ordenAsignacionCol === 'docente') {
          const docA = docentes.find(d => d.id == a.idDocente);
          const docB = docentes.find(d => d.id == b.idDocente);
          valA = (docA ? docA.nombre : a.idDocente).toLowerCase();
          valB = (docB ? docB.nombre : b.idDocente).toLowerCase();
        } else {
          valA = String(a[ordenAsignacionCol] || '').toLowerCase();
          valB = String(b[ordenAsignacionCol] || '').toLowerCase();
        }
        return ordenAsignacionDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      if (asignaciones.length === 0) {
        asignacionesDiv.innerHTML = '<p>No hay asignaturas asignadas a este grupo.</p>';
      } else {
        // ---- GENERACIÓN DE TABLA DE ASIGNACIONES (CON DATOS COMPLETOS) ----
        let html = `<table class="asignaciones-table" style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#f9fafb;">
            <th data-columna="asignatura" style="padding:10px; cursor:pointer;">Asignatura <span class="sort-icon">${ordenAsignacionCol==='asignatura'?(ordenAsignacionDir==='asc'?'▲':'▼'):'↕'}</span></th>
            <th data-columna="docente" style="padding:10px; cursor:pointer;">Docente <span class="sort-icon">${ordenAsignacionCol==='docente'?(ordenAsignacionDir==='asc'?'▲':'▼'):'↕'}</span></th>
            <th data-columna="periodo" style="padding:10px; cursor:pointer;">Periodo <span class="sort-icon">${ordenAsignacionCol==='periodo'?(ordenAsignacionDir==='asc'?'▲':'▼'):'↕'}</span></th>
            <th data-columna="estado" style="padding:10px; cursor:pointer;">Estado <span class="sort-icon">${ordenAsignacionCol==='estado'?(ordenAsignacionDir==='asc'?'▲':'▼'):'↕'}</span></th>
            <th style="padding:10px;">Acciones</th>
          </tr></thead><tbody>`;
        asignacionesOrdenadas.forEach(a => {
          const asig = asignaturas.find(s => s.id === a.idAsignatura);
          const doc = docentes.find(d => d.id == a.idDocente);
          const estadoActual = a.estado || 'Activo';
          const esActivo = estadoActual === 'Activo';
          // Almacenamos todos los datos en atributos data-* para usarlos al cambiar estado
          html += `<tr>
            <td style="padding:10px;">${asig ? SIREI.utils.escapeHtml(asig.nombre) : a.idAsignatura}</td>
            <td style="padding:10px;">${doc ? SIREI.utils.escapeHtml(doc.nombre) : a.idDocente}</td>
            <td style="padding:10px;">${SIREI.utils.escapeHtml(a.periodo)}</td>
            <td style="padding:10px;"><span style="color:${esActivo ? '#10b981' : '#ef4444'}; font-weight:600;">${SIREI.utils.escapeHtml(estadoActual)}</span></td>
            <td style="padding:10px;">
              <button class="btn-cambiar-estado-asignacion btn btn-secondary"
                      data-id="${a.id}"
                      data-grupo="${a.idGrupo}"
                      data-asignatura="${a.idAsignatura}"
                      data-docente="${a.idDocente}"
                      data-periodo="${a.periodo || ''}"
                      data-estado="${estadoActual}"
                      style="padding:4px 8px; font-size:0.8rem;">
                ${esActivo ? 'Desactivar' : 'Activar'}
              </button>
              <button class="btn-eliminar-asignacion btn btn-danger" data-id="${a.id}" style="padding:4px 8px; font-size:0.8rem;">Eliminar</button>
            </td>
          </tr>`;
        });
        html += `</tbody></table>`;
        asignacionesDiv.innerHTML = html;

        // Ordenamiento en asignaciones
        document.querySelectorAll('.asignaciones-table th[data-columna]').forEach(th => {
          th.addEventListener('click', () => {
            const col = th.dataset.columna;
            if (ordenAsignacionCol === col) ordenAsignacionDir = ordenAsignacionDir === 'asc' ? 'desc' : 'asc';
            else { ordenAsignacionCol = col; ordenAsignacionDir = 'asc'; }
            verGrupo(idGrupo);
          });
        });

        // Eventos de cambio de estado (con todos los datos)
        document.querySelectorAll('.btn-cambiar-estado-asignacion').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const b = e.currentTarget;
            const id = b.dataset.id;
            const estadoActual = b.dataset.estado;
            const nuevoEstado = estadoActual === 'Activo' ? 'Inactivo' : 'Activo';
            // Recuperar todos los datos de la asignación desde los atributos data-*
            const datosAsignacion = {
              id: id,
              idGrupo: b.dataset.grupo,
              idAsignatura: b.dataset.asignatura,
              idDocente: b.dataset.docente,
              periodo: b.dataset.periodo,
              estado: nuevoEstado
            };
            await cambiarEstadoAsignacion(datosAsignacion, idGrupo);
          });
        });

        // Eventos de eliminar asignación
        document.querySelectorAll('.btn-eliminar-asignacion').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const b = e.currentTarget;
            const id = b.dataset.id;
            await eliminarAsignacion(id, idGrupo);
          });
        });
      }
      // ---- SUBGRUPOS DEL GRUPO ----
      const subgrupos = await obtenerSubgrupos(idGrupo, null);
      if (subgrupos.length > 0) {
        let subHtml = `<h3 style="margin-top:24px;">Subgrupos de asignaturas particionadas</h3>
          <table class="subgrupos-table" style="width:100%; border-collapse:collapse;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:10px;">Asignatura</th>
            <th style="padding:10px;">Subgrupo</th>
            <th style="padding:10px;">Docente</th>
            <th style="padding:10px;">Alumnos</th>
            <th style="padding:10px;">Acciones</th>
          </tr></thead><tbody>`;
        subgrupos.forEach(sg => {
          subHtml += `<tr>
            <td style="padding:10px;">${SIREI.utils.escapeHtml(sg.nombreAsignatura)}</td>
            <td style="padding:10px;">${SIREI.utils.escapeHtml(sg.nombreSubgrupo)}</td>
            <td style="padding:10px;">${SIREI.utils.escapeHtml(sg.nombreDocente)}</td>
            <td style="padding:10px;">${sg.numMiembros}</td>
            <td style="padding:10px;">
              <button class="btn-editar-subgrupos btn btn-secondary" data-asignatura="${sg.idAsignatura}" data-nombre="${SIREI.utils.escapeHtml(sg.nombreAsignatura)}" style="padding:4px 8px; font-size:0.8rem;">Editar</button>
            </td>
          </tr>`;
        });
        subHtml += `</tbody></table>`;
        asignacionesDiv.innerHTML += subHtml;
        document.querySelectorAll('.btn-editar-subgrupos').forEach(btn => {
          btn.addEventListener('click', () => {
            mostrarFormularioAsignacion(idGrupo, btn.dataset.asignatura);
          });
        });
      }
      detalleDiv.style.display = 'block';
    } catch (error) {
      asignacionesDiv.innerHTML = `<div style="color:#ef4444;">Error: ${error.message}</div>`;
    }
  };

  // ============================================================
  //  SECCIÓN 7: CAMBIAR ESTADO DE ASIGNACIÓN (CON TODOS LOS CAMPOS)
  // ============================================================

  const cambiarEstadoAsignacion = async (datosAsignacion, idGrupo) => {
    // datosAsignacion contiene todos los campos: id, idGrupo, idAsignatura, idDocente, periodo, estado
    const btn = document.querySelector(`.btn-cambiar-estado-asignacion[data-id="${datosAsignacion.id}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'actualizarAsignacion',
          token: sessionStorage.getItem('sirei_token'),
          ...datosAsignacion
        })
      });
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast(`Estado cambiado a ${datosAsignacion.estado}`);
        // Recargar detalle para mostrar el nuevo estado
        await verGrupo(idGrupo);
      } else {
        SIREI.utils.mostrarToast(result.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = datosAsignacion.estado === 'Activo' ? 'Activar' : 'Desactivar'; }
      }
    } catch (error) {
      SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = datosAsignacion.estado === 'Activo' ? 'Activar' : 'Desactivar'; }
    }
  };

  // ============================================================
  //  SECCIÓN 8: ELIMINAR ASIGNACIÓN (CON FEEDBACK)
  // ============================================================

  const eliminarAsignacion = async (idAsignacion, idGrupo) => {
    if (!SIREI.utils.confirmar('¿Eliminar esta asignación?')) return;
    const btn = document.querySelector(`.btn-eliminar-asignacion[data-id="${idAsignacion}"]`);
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'eliminarAsignacion',
          token: sessionStorage.getItem('sirei_token'),
          id: idAsignacion
        })
      });
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast('Asignación eliminada');
        await verGrupo(idGrupo);
      } else {
        SIREI.utils.mostrarToast(result.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
      }
    } catch (error) {
      SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
    }
  };

  // ============================================================
  //  SECCIÓN 9: FORMULARIOS (NUEVO GRUPO, EDITAR, ELIMINAR, ASIGNAR)
  //  Subsección 9.1: Nuevo Grupo
  //  Subsección 9.2: Editar Grupo
  //  Subsección 9.3: Eliminar Grupo
  //  Subsección 9.4: Asignar Asignatura
  // ============================================================

  // ---------- 9.1 NUEVO GRUPO ----------
  const mostrarFormularioNuevoGrupo = async () => {
    const periodoEscolar = await obtenerPeriodoEscolar();
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Nuevo Grupo</h2>
        <p style="color:#6b7280; margin-bottom:16px;">El grado es opcional. Puedes incluirlo en el nombre.</p>
        <form id="formNuevoGrupo">
          <div class="form-group"><label>Nombre del grupo *</label><input type="text" id="nombreGrupo" required></div>
          <div class="form-group"><label>Observaciones</label><input type="text" id="turnoGrupo" placeholder="Notas adicionales sobre el grupo"></div>
          <div class="form-group"><label>Aula</label><input type="text" id="aulaGrupo"></div>
          <div class="form-group"><label>Periodo (Datos Escolares)</label><input type="text" id="periodoGrupo" value="${SIREI.utils.escapeHtml(periodoEscolar)}" readonly style="background:#f3f4f6; color:#374151; cursor:not-allowed;"></div>
          <div class="form-buttons">
            <button type="submit" class="btn btn-primary" id="submitNuevoGrupo">Guardar</button>
            <button type="button" id="cancelarGrupoBtn" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById('formNuevoGrupo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitNuevoGrupo');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';

      const data = {
        nombre: document.getElementById('nombreGrupo').value.trim(),
        grado: '',  // ya no se pide, se envía vacío
        turno: document.getElementById('turnoGrupo').value.trim(),
        aula: document.getElementById('aulaGrupo').value.trim(),
        periodo: document.getElementById('periodoGrupo').value.trim()
      };
      if (!data.nombre) {
        SIREI.utils.mostrarToast('El nombre es obligatorio.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
        return;
      }
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'agregarGrupo',
            token: sessionStorage.getItem('sirei_token'),
            ...data
          })
        });
        const result = await response.json();
        if (result.success) {
          SIREI.utils.mostrarToast('Grupo creado.');
          limpiarCache();
          await renderizar();
        } else {
          SIREI.utils.mostrarToast(result.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar';
        }
      } catch (error) {
        SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
      }
    });
    document.getElementById('cancelarGrupoBtn').addEventListener('click', renderizar);
  };

  // ---------- 9.2 EDITAR GRUPO ----------
  const mostrarFormularioEditarGrupo = async (id) => {
    const grupo = gruposCache.find(g => g.id == id);
    if (!grupo) {
      SIREI.utils.mostrarToast('Grupo no encontrado', 'error');
      return;
    }
    const periodoEscolar = await obtenerPeriodoEscolar();
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Editar Grupo</h2>
        <form id="formEditarGrupo">
          <div class="form-group"><label>Nombre del grupo *</label><input type="text" id="nombreGrupo" value="${SIREI.utils.escapeHtml(grupo.nombre)}" required></div>
          <div class="form-group"><label>Observaciones</label><input type="text" id="turnoGrupo" value="${SIREI.utils.escapeHtml(grupo.turno)}" placeholder="Notas adicionales"></div>
          <div class="form-group"><label>Aula</label><input type="text" id="aulaGrupo" value="${SIREI.utils.escapeHtml(grupo.aula)}"></div>
          <div class="form-group"><label>Periodo (Datos Escolares)</label><input type="text" id="periodoGrupo" value="${SIREI.utils.escapeHtml(periodoEscolar || grupo.periodo)}" readonly style="background:#f3f4f6; color:#374151; cursor:not-allowed;"></div>
          <div class="form-buttons">
            <button type="submit" class="btn btn-primary" id="submitEditarGrupo">Actualizar</button>
            <button type="button" id="cancelarEditarBtn" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById('formEditarGrupo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitEditarGrupo');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Actualizando...';

      const data = {
        id: id,
        nombre: document.getElementById('nombreGrupo').value.trim(),
        grado: '',  // ya no se pide
        turno: document.getElementById('turnoGrupo').value.trim(),
        aula: document.getElementById('aulaGrupo').value.trim(),
        periodo: document.getElementById('periodoGrupo').value.trim()
      };
      if (!data.nombre) {
        SIREI.utils.mostrarToast('El nombre es obligatorio.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Actualizar';
        return;
      }
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'actualizarGrupo',
            token: sessionStorage.getItem('sirei_token'),
            ...data
          })
        });
        const result = await response.json();
        if (result.success) {
          SIREI.utils.mostrarToast('Grupo actualizado.');
          limpiarCache();
          await renderizar();
        } else {
          SIREI.utils.mostrarToast(result.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Actualizar';
        }
      } catch (error) {
        SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Actualizar';
      }
    });
    document.getElementById('cancelarEditarBtn').addEventListener('click', renderizar);
  };

  // ---------- 9.3 ELIMINAR GRUPO ----------
  const eliminarGrupo = async (id) => {
    if (!SIREI.utils.confirmar('¿Eliminar este grupo? Se eliminarán también sus asignaciones.')) return;
    const btn = document.getElementById('btnEliminarGrupo');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'eliminarGrupo',
          token: sessionStorage.getItem('sirei_token'),
          id: id
        })
      });
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast('Grupo eliminado.');
        limpiarCache();
        grupoSeleccionadoId = null;
        await renderizar();
      } else {
        SIREI.utils.mostrarToast(result.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
      }
    } catch (error) {
      SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
    }
  };

  // ---------- 9.4 ASIGNAR ASIGNATURA (multi-grupo + subgrupos) ----------
  const mostrarFormularioAsignacion = async (idGrupoInicial, idAsignaturaEditar = null) => {
    const grupos = await obtenerGrupos();
    const asignaturas = await obtenerAsignaturas();
    const docentes = await obtenerDocentes();
    const periodoEscolar = await obtenerPeriodoEscolar();
    const esc = SIREI.utils.escapeHtml;

    if (!grupos.length) {
      SIREI.utils.mostrarToast('No hay grupos registrados.', 'error');
      return;
    }

    // Estado local del formulario
    let grupoSeleccion = new Set();
    if (idGrupoInicial) grupoSeleccion.add(String(idGrupoInicial));
    let tipoSeleccion = idAsignaturaEditar ? 'subgrupo' : 'completo';
    let subgruposDef = [];      // { id, nombreSubgrupo, idDocente }
    let alumnosSub = [];        // { curp, nombreCompleto, subgrupoId }

    const gruposPertenece = (asignatura) => {
      if (asignatura.grupos && asignatura.grupos.length) return asignatura.grupos;
      return String(asignatura.grado || '').split(/[,\t]/).map(s => s.trim()).filter(Boolean);
    };
    const asignaturaParaSeleccion = (asignatura) => {
      const lista = gruposPertenece(asignatura).map(g => g.toLowerCase());
      const seleccion = [...grupoSeleccion]
        .map(id => { const g = grupos.find(x => x.id == id); return g ? g.nombre : ''; })
        .filter(n => n)
        .map(n => n.toLowerCase());
      return seleccion.length > 0 && seleccion.every(n => lista.includes(n));
    };

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">${idAsignaturaEditar ? 'Editar subgrupos de asignatura' : 'Asignar Asignatura'}</h2>
        <form id="formAsignacion">
          <div class="form-group">
            <label>Grupo(s) *</label>
            <div id="gruposCheckbox" style="display:flex; gap:14px; flex-wrap:wrap;"></div>
          </div>
          <div class="form-group">
            <label>Asignatura *</label>
            <select id="selectAsignatura" required>
              <option value="">Seleccionar...</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tipo de asignación</label>
            <div style="display:flex; gap:18px;">
              <label><input type="radio" name="tipoAsignacion" value="completo" ${tipoSeleccion === 'completo' ? 'checked' : ''}> Todo el grupo</label>
              <label><input type="radio" name="tipoAsignacion" value="subgrupo" ${tipoSeleccion === 'subgrupo' ? 'checked' : ''}> Particionar en subgrupos</label>
            </div>
          </div>
          <div class="form-group" id="divDocente" style="${tipoSeleccion === 'subgrupo' ? 'display:none;' : ''}">
            <label>Docente *</label>
            <select id="selectDocente" required ${tipoSeleccion === 'subgrupo' ? 'disabled' : ''}>
              <option value="">Seleccionar...</option>
              ${docentes.map(d => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label>Periodo (Datos Escolares)</label><input type="text" id="periodoAsignacion" value="${esc(periodoEscolar)}" readonly style="background:#f3f4f6; color:#374151; cursor:not-allowed;"></div>
          <div id="panelSubgrupos" style="display:none; border:1px solid #e5e7eb; padding:16px; border-radius:8px; margin-bottom:16px;">
            <h3>Subgrupos de la asignatura</h3>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
              <input type="text" id="nombreSubgrupoNuevo" placeholder="Nombre del subgrupo (ej. Baile)" style="flex:1; min-width:150px; padding:8px; border-radius:8px; border:1px solid #d1d5db;">
              <select id="docenteSubgrupoNuevo" style="padding:8px; border-radius:8px; border:1px solid #d1d5db; min-width:170px;">
                <option value="">Docente...</option>
                ${docentes.map(d => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join('')}
              </select>
              <button type="button" id="btnAgregarSubgrupo" class="btn btn-secondary">+ Agregar subgrupo</button>
            </div>
            <div id="listaSubgrupos"></div>
            <p style="color:#6b7280; margin:14px 0 6px;">Asigna cada alumno del grupo a un subgrupo (los que queden sin subgrupo no cursan la asignatura):</p>
            <div id="tablaMiembros" style="max-height:340px; overflow:auto; border:1px solid #e5e7eb; border-radius:8px;"></div>
          </div>
          <div class="form-buttons">
            <button type="submit" class="btn btn-primary" id="submitAsignacion">Guardar</button>
            <button type="button" id="cancelarAsignacionBtn" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    const poblarGruposCheckbox = () => {
      const div = document.getElementById('gruposCheckbox');
      div.innerHTML = grupos.map(g => `
        <label style="font-weight:400; display:flex; align-items:center; gap:6px;">
          <input type="checkbox" class="checkbox-grupo" value="${esc(g.id)}" ${grupoSeleccion.has(String(g.id)) ? 'checked' : ''} ${tipoSeleccion === 'subgrupo' && String(g.id) !== String(idGrupoInicial) ? 'disabled' : ''}> ${esc(g.nombre)}
        </label>`).join('');
      div.querySelectorAll('.checkbox-grupo').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) grupoSeleccion.add(String(cb.value));
          else grupoSeleccion.delete(String(cb.value));
          if (tipoSeleccion === 'subgrupo') {
            grupoSeleccion = new Set([String(idGrupoInicial)]);
            poblarGruposCheckbox();
          }
          poblarAsignaturas();
        });
      });
    };

    const poblarAsignaturas = () => {
      const select = document.getElementById('selectAsignatura');
      const validas = asignaturas.filter(asignaturaParaSeleccion);
      select.innerHTML = '<option value="">Seleccionar...</option>' +
        validas.map(a => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('');
      if (idAsignaturaEditar) select.value = idAsignaturaEditar;
      if (tipoSeleccion === 'subgrupo' && select.value) cargarEditorSubgrupos(select.value);
    };

    const renderSubgrupos = () => {
      const div = document.getElementById('listaSubgrupos');
      if (subgruposDef.length === 0) {
        div.innerHTML = '<p style="color:#6b7280;">Aún no hay subgrupos. Agrega el primero arriba.</p>';
      } else {
        div.innerHTML = subgruposDef.map((sg, idx) => `
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
            <span style="font-weight:600; min-width:120px;">${esc(sg.nombreSubgrupo)}</span>
            <select class="select-docente-subgrupo" data-idx="${idx}" style="padding:6px; border-radius:8px; border:1px solid #d1d5db; min-width:170px;">
              <option value="">Docente...</option>
              ${docentes.map(d => `<option value="${esc(d.id)}" ${String(d.id) === String(sg.idDocente) ? 'selected' : ''}>${esc(d.nombre)}</option>`).join('')}
            </select>
            <button type="button" class="btn-eliminar-subgrupo btn btn-danger" data-idx="${idx}" style="padding:4px 8px; font-size:0.8rem;">Eliminar</button>
          </div>`).join('');
        div.querySelectorAll('.select-docente-subgrupo').forEach(sel => {
          sel.addEventListener('change', () => { subgruposDef[Number(sel.dataset.idx)].idDocente = sel.value; });
        });
        div.querySelectorAll('.btn-eliminar-subgrupo').forEach(btn => {
          btn.addEventListener('click', () => {
            const removed = Number(btn.dataset.idx);
            subgruposDef.splice(removed, 1);
            alumnosSub.forEach(a => {
              if (a.subgrupoId === '') return;
              const n = Number(a.subgrupoId);
              if (n === removed) a.subgrupoId = '';
              else if (n > removed) a.subgrupoId = String(n - 1);
            });
            renderSubgrupos();
            renderTablaMiembros();
          });
        });
      }
    };

    const renderTablaMiembros = () => {
      const div = document.getElementById('tablaMiembros');
      if (alumnosSub.length === 0) {
        div.innerHTML = '<p style="color:#6b7280; padding:12px;">No hay alumnos en el grupo.</p>';
        return;
      }
      const opciones = '<option value="">— Sin subgrupo —</option>' +
        subgruposDef.map((sg, idx) => `<option value="${idx}">${esc(sg.nombreSubgrupo)}</option>`).join('');
      div.innerHTML = `<table style="width:100%; border-collapse:collapse;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px; text-align:left;">Alumno</th>
          <th style="padding:8px; text-align:left;">Subgrupo</th>
        </tr></thead><tbody>` +
        alumnosSub.map((a, idx) => {
          return `<tr>
            <td style="padding:6px;">${esc(a.nombreCompleto)}</td>
            <td style="padding:6px;"><select class="select-subgrupo-alumno" data-curp="${esc(a.curp)}" style="padding:6px; border-radius:8px; border:1px solid #d1d5db;">${opciones}</select></td>
          </tr>`;
        }).join('') + `</tbody></table>`;
      // rellenar valores seleccionados
      div.querySelectorAll('.select-subgrupo-alumno').forEach(sel => {
        const curp = sel.dataset.curp;
        const alumno = alumnosSub.find(a => a.curp === curp);
        if (alumno && alumno.subgrupoId !== '') {
          const idx = alumno.subgrupoId;
          if (subgruposDef[Number(idx)]) sel.value = String(idx);
        }
        sel.addEventListener('change', () => {
          const a = alumnosSub.find(x => x.curp === curp);
          if (a) a.subgrupoId = sel.value;
        });
      });
    };

    const cargarEditorSubgrupos = async (idAsignatura) => {
      if (!idAsignatura) return;
      const [alumnos, sg] = await Promise.all([
        obtenerAlumnosGrupo(idGrupoInicial),
        obtenerSubgrupos(idGrupoInicial, idAsignatura)
      ]);
      subgruposDef = sg.map(s => ({ id: String(s.id), nombreSubgrupo: s.nombreSubgrupo, idDocente: s.idDocente || '' }));
      const mapa = {};
      sg.forEach((s, idx) => (s.miembros || []).forEach(m => { mapa[m.curp] = idx; }));
      alumnosSub = alumnos.map(a => ({
        curp: a.curp,
        nombreCompleto: a.nombreCompleto,
        subgrupoId: mapa[a.curp] !== undefined ? String(mapa[a.curp]) : ''
      }));
      renderSubgrupos();
      renderTablaMiembros();
    };

    document.querySelectorAll('input[name="tipoAsignacion"]').forEach(radio => {
      radio.addEventListener('change', () => {
        tipoSeleccion = document.querySelector('input[name="tipoAsignacion"]:checked').value;
        const divDocente = document.getElementById('divDocente');
        const selectDocente = document.getElementById('selectDocente');
        divDocente.style.display = tipoSeleccion === 'subgrupo' ? 'none' : '';
        selectDocente.disabled = tipoSeleccion === 'subgrupo';
        document.getElementById('panelSubgrupos').style.display = tipoSeleccion === 'subgrupo' ? 'block' : 'none';
        if (tipoSeleccion === 'subgrupo') {
          grupoSeleccion = new Set([String(idGrupoInicial)]);
          poblarGruposCheckbox();
          const sel = document.getElementById('selectAsignatura');
          if (sel.value) cargarEditorSubgrupos(sel.value);
        }
      });
    });

    document.getElementById('selectAsignatura').addEventListener('change', (e) => {
      if (tipoSeleccion === 'subgrupo') {
        if (e.target.value) cargarEditorSubgrupos(e.target.value);
        else { subgruposDef = []; alumnosSub = []; renderSubgrupos(); renderTablaMiembros(); }
      }
    });

    document.getElementById('btnAgregarSubgrupo').addEventListener('click', () => {
      const nombre = document.getElementById('nombreSubgrupoNuevo').value.trim();
      const idDocente = document.getElementById('docenteSubgrupoNuevo').value;
      if (!nombre) { SIREI.utils.mostrarToast('Escribe el nombre del subgrupo.', 'error'); return; }
      if (!idDocente) { SIREI.utils.mostrarToast('Selecciona el docente del subgrupo.', 'error'); return; }
      subgruposDef.push({ id: '', nombreSubgrupo: nombre, idDocente: idDocente });
      document.getElementById('nombreSubgrupoNuevo').value = '';
      document.getElementById('docenteSubgrupoNuevo').value = '';
      renderSubgrupos();
      renderTablaMiembros();
    });

    document.getElementById('formAsignacion').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submitAsignacion');
      const idAsignatura = document.getElementById('selectAsignatura').value;
      if (!idAsignatura) {
        SIREI.utils.mostrarToast('Selecciona una asignatura.', 'error');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';

      try {
        if (tipoSeleccion === 'subgrupo') {
          if (subgruposDef.length === 0) {
            SIREI.utils.mostrarToast('Agrega al menos un subgrupo.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Guardar';
            return;
          }
          const sinDocente = subgruposDef.some(sg => !sg.idDocente);
          if (sinDocente) {
            SIREI.utils.mostrarToast('Todos los subgrupos deben tener docente.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Guardar';
            return;
          }
          const payload = {
            idGrupo: idGrupoInicial,
            idAsignatura: idAsignatura,
            subgrupos: subgruposDef.map(sg => ({
              id: sg.id,
              nombreSubgrupo: sg.nombreSubgrupo,
              idDocente: sg.idDocente,
              miembros: alumnosSub.filter(a => String(a.subgrupoId) === String(subgruposDef.indexOf(sg)) && sg.idDocente)
                .map(a => ({ curp: a.curp, nombreAlumno: a.nombreCompleto }))
            }))
          };
          const result = await guardarSubgrupos(payload);
          if (result.success) {
            SIREI.utils.mostrarToast('Subgrupos guardados.');
            limpiarCache();
            await renderizar();
            await verGrupo(idGrupoInicial);
          } else {
            SIREI.utils.mostrarToast(result.message, 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Guardar';
          }
        } else {
          const idDocente = document.getElementById('selectDocente').value;
          if (!idDocente) {
            SIREI.utils.mostrarToast('Selecciona un docente.', 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Guardar';
            return;
          }
          const body = new URLSearchParams({
            accion: 'agregarAsignacion',
            token: sessionStorage.getItem('sirei_token'),
            idAsignatura: idAsignatura,
            idDocente: idDocente,
            tipo: 'completo'
          });
          [...grupoSeleccion].forEach(g => body.append('idGrupos', g));
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
          });
          const result = await response.json();
          if (result.success) {
            SIREI.utils.mostrarToast(result.message);
            limpiarCache();
            await renderizar();
            await verGrupo(idGrupoInicial);
          } else {
            SIREI.utils.mostrarToast(result.message, 'error');
            submitBtn.disabled = false; submitBtn.textContent = 'Guardar';
          }
        }
      } catch (error) {
        SIREI.utils.mostrarToast('Error: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
      }
    });

    document.getElementById('cancelarAsignacionBtn').addEventListener('click', async () => {
      await renderizar();
      await verGrupo(idGrupoInicial);
    });

    // Inicialización
    poblarGruposCheckbox();
    poblarAsignaturas();
  };

  // ============================================================
  //  SECCIÓN 10: INICIALIZACIÓN
  // ============================================================

  await renderizar();
};