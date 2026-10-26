// ============================================================
//  academico_docente.js - Módulo Académico (Docente)
//  Gestión de evidencias y entregas
//  Versión 2.2:
//    - Evidencias separadas por asignatura (ya no se mezclan las de otras materias).
//    - Una sola consulta de entregas para toda la lista (más rápido).
//    - La cámara QR se cierra sola al leer y muestra el nombre del alumno.
//    - Autoregistro del alumno: bienvenida, ponderación, identificación,
//      resumen y confirmación final del docente.
//    - Sección "Evidencias" disponible sin necesidad de iniciar clase.
//  Versión 2.1 - CORREGIDA:
//    - El campo de texto para observaciones ahora ocupa todo el ancho en móviles.
//    - El botón de dictado por voz se ha rediseñado para que no estorbe.
//    - El textarea tiene un tamaño mínimo adecuado para pantallas pequeñas.
// ============================================================

window.cargarAcademicoDocente = async function(container, idDocente, idGrupo, idAsignatura, periodo, token, idSubgrupo) {
  const esc = SIREI.utils.escapeHtml;

  // === Estado ===
  let evidencias = [];
  let evidenciaSeleccionada = null;
  let alumnosGrupo = [];
  let entregasExistentes = {};

  // === Obtener alumnos del grupo (con caché corta) ===
  async function obtenerAlumnosGrupo(forzar) {
    const clave = 'alumnos_' + idGrupo + '_' + (idSubgrupo || '');
    if (!forzar) {
      const cache = SIREI.cacheLocal.get(clave);
      if (cache) return cache;
    }
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerAlumnosPorGrupo',
        token: token,
        idGrupo: idGrupo,
        idSubgrupo: idSubgrupo || ''
      })
    });
    const data = await response.json();
    if (data.success) {
      const alumnos = data.alumnos || [];
      SIREI.cacheLocal.set(clave, alumnos, SIREI.TTL.ALUMNOS);
      return alumnos;
    }
    return [];
  }

  // === Obtener evidencias de la clase ===
  async function obtenerEvidencias() {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerEvidencias',
        token: token,
        idClase: idGrupo
      })
    });
    const data = await response.json();
    if (!data.success) return [];
    const lista = data.evidencias || [];
    // Solo las evidencias de la asignatura en la que se está trabajando.
    // Las evidencias antiguas sin asignatura se conservan para no ocultarlas.
    if (!idAsignatura) return lista;
    return lista.filter(function (ev) {
      return !ev.idAsignatura || String(ev.idAsignatura) === String(idAsignatura);
    });
  }

  // === Obtener entregas (de una evidencia o de toda la clase) ===
  async function obtenerEntregas(idEvidencia) {
    const params = {
      accion: 'obtenerEntregas',
      token: token,
      idClase: idGrupo
    };
    if (idEvidencia) params.idEvidencia = idEvidencia;
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params)
    });
    const data = await response.json();
    if (data.success) return data.entregas || [];
    return [];
  }

  // === Renderizar vista principal ===
  function formatearFechaSi(fecha) {
    if (!fecha) return '';
    try {
      const d = new Date(fecha);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } catch (e) {}
    return fecha;
  }

  function parseFechaMax(fechaStr) {
    if (!fechaStr) return null;
    try {
      if (fechaStr.includes('T')) return new Date(fechaStr);
      const partes = fechaStr.split(' ');
      const fechaPartes = partes[0].split('/');
      const horaPartes = partes[1] ? partes[1].split(':') : ['0', '0', '0'];
      return new Date(
        parseInt(fechaPartes[2]), parseInt(fechaPartes[1]) - 1, parseInt(fechaPartes[0]),
        parseInt(horaPartes[0] || '0'), parseInt(horaPartes[1] || '0'), parseInt(horaPartes[2] || '0')
      );
    } catch (e) { return null; }
  }

  async function renderizar() {
    let panelAcademico = null;

    // 1) Intento con el endpoint combinado (una sola llamada).
    if (!window._panelAcademicoNoDisponible) {
      try {
        const panel = await SIREI.api.panelAcademico(idGrupo, idAsignatura, idSubgrupo);
        if (panel && panel.success === true && Array.isArray(panel.alumnos) && Array.isArray(panel.evidencias)) {
          panelAcademico = panel;
        } else if (panel && panel.success === false && /acci[oó]n no v[aá]lida/i.test(String(panel.message || ''))) {
          window._panelAcademicoNoDisponible = true;
        }
      } catch (e) {
        console.warn('Panel académico no disponible; se usará el modo de respaldo.', e);
      }
    }

    // 2) Cargar datos (panel combinado o llamadas separadas de respaldo).
    try {
      if (panelAcademico) {
        alumnosGrupo = panelAcademico.alumnos || [];
        evidencias = (panelAcademico.evidencias || []).filter(function (ev) {
          if (!idAsignatura) return true;
          return !ev.idAsignatura || String(ev.idAsignatura) === String(idAsignatura);
        });
        entregasExistentes = {};
        (panelAcademico.entregas || []).forEach(function (e) {
          if (!entregasExistentes[e.idEvidencia]) entregasExistentes[e.idEvidencia] = {};
          entregasExistentes[e.idEvidencia][e.curpAlumno] = e;
        });
        if (alumnosGrupo.length) {
          SIREI.cacheLocal.set('alumnos_' + idGrupo + '_' + (idSubgrupo || ''), alumnosGrupo, SIREI.TTL.ALUMNOS);
        }
      } else {
        const resultados = await Promise.all([
          obtenerAlumnosGrupo(),
          obtenerEvidencias(),
          obtenerEntregas()          // una sola consulta para todas las evidencias
        ]);
        alumnosGrupo = resultados[0] || [];
        evidencias = resultados[1] || [];

        // Mapear entregas existentes por evidencia y alumno
        entregasExistentes = {};
        (resultados[2] || []).forEach(function (e) {
          if (!entregasExistentes[e.idEvidencia]) entregasExistentes[e.idEvidencia] = {};
          entregasExistentes[e.idEvidencia][e.curpAlumno] = e;
        });
      }
    } catch (e) {
      console.error('Error al cargar datos:', e);
    }

    // Si la pestaña se cerró o se suspendió mientras cargaba, no se pinta
    // (evita ids duplicados con la pestaña Evidencias).
    if (container.isConnected === false) return;
    if (container.dataset && container.dataset.suspendido === '1') return;

    container.innerHTML = `
      <div class="academico-docente">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <h3 style="margin:0;">Evidencias de Aprendizaje</h3>
          <button id="btnNuevaEvidencia" class="btn btn-primary" style="padding:10px 20px;">
            + Nueva Evidencia
          </button>
        </div>

        <div id="listaEvidencias" style="margin-bottom:20px;">
          <p style="color:#4b5563; font-size:0.88rem; margin:0 0 12px 0;">
            👆 Toca una evidencia para que el alumno registre su entrega. Usa <strong>Ver entregas</strong> para calificar o revisar al grupo.
          </p>
          ${evidencias.length === 0 ? '<p style="color:#6b7280;">No hay evidencias creadas para esta clase.</p>' : ''}
          ${evidencias.map(ev => {
            const fechaMax = ev.fechaMaximaEntrega;
            let fechaColor = '#6b7280';
            let fechaMaxFormateada = '';
            if (fechaMax) {
              const ahora = new Date();
              const fechaMaxDate = parseFechaMax(fechaMax);
              if (fechaMaxDate) {
                fechaColor = ahora <= fechaMaxDate ? '#10b981' : '#ef4444';
              }
              fechaMaxFormateada = formatearFechaSi(fechaMax);
            }
            const entregasEv = entregasExistentes[ev.id] ? Object.keys(entregasExistentes[ev.id]).length : 0;
            const pendientesEv = Math.max(0, alumnosGrupo.length - entregasEv);
            return `
              <div class="evidencia-item" data-id="${ev.id}" style="background:white; border-radius:10px; padding:12px 16px; margin-bottom:10px; border:1px solid #e5e7eb; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                  <div style="min-width:0; flex:1 1 220px;">
                    <strong style="font-size:1.05rem;">${esc(ev.nombreEvidencia)}</strong>
                    <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">
                      ${ev.calificacionNumerica ? 'Calificaci\u00f3n num\u00e9rica' : ''}
                      ${ev.escalaSuficiencia ? 'Escala de suficiencia' : ''}
                      ${ev.instrumentoEvaluacion ? ` <a href="${esc(ev.instrumentoEvaluacion)}" target="_blank" style="color:#3b82f6;">Instrumento</a>` : ''}
                      ${fechaMax ? ` <span style="color:${fechaColor};">${fechaMaxFormateada}</span>` : ''}
                      ${ev.periodo ? ` <span style="color:#6b7280;">[${esc(ev.periodo)}]</span>` : ''}
                    </div>
                    <div style="margin-top:7px; display:flex; gap:6px; flex-wrap:wrap;">
                      <span style="font-size:0.75rem; font-weight:700; color:#166534; background:#dcfce7; border-radius:999px; padding:3px 10px;">✅ ${entregasEv} entregadas</span>
                      <span style="font-size:0.75rem; font-weight:700; color:#92400e; background:#fef3c7; border-radius:999px; padding:3px 10px;">⏳ ${pendientesEv} pendientes</span>
                    </div>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                    <button class="btn-registrar-evidencia btn btn-primary" data-id="${ev.id}" style="padding:8px 12px; font-size:0.8rem;">📝 Registrar entrega</button>
                    <button class="btn-ver-entregas btn btn-secondary" data-id="${ev.id}" style="padding:8px 12px; font-size:0.8rem;">📋 Ver entregas</button>
                    <button class="btn-eliminar-evidencia btn btn-danger" data-id="${ev.id}" style="padding:4px 10px; font-size:0.75rem;">Eliminar</button>
                    <span style="font-size:0.75rem; color:#6b7280;">${formatearFechaSi(ev.timestampCreacion)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Detalle de evidencia seleccionada -->
        <div id="detalleEvidencia" style="display:none; background:white; border-radius:12px; padding:16px; border:1px solid #e5e7eb; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
            <h4 id="detalleNombre" style="margin:0;">Evidencia seleccionada</h4>
            <button id="btnCerrarDetalle" class="btn btn-secondary" style="padding:4px 12px;">Cerrar</button>
          </div>
          <div id="detalleContenido"></div>
        </div>
      </div>
    `;

    // --- Eventos ---

    // Clic en una evidencia para seleccionarla
    document.querySelectorAll('.evidencia-item').forEach(item => {
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-eliminar-evidencia')) return;
        const id = parseInt(this.dataset.id);
        const ev = evidencias.find(e => e.id === id) || evidencias.find(e => String(e.id) === String(this.dataset.id));
        if (!ev) return;
        // El botón "Ver entregas" abre el panel del docente; el resto abre el registro del alumno.
        if (e.target.closest('.btn-ver-entregas')) {
          mostrarDetalleEvidencia(ev);
          return;
        }
        abrirWizardEvidencia(ev);
      });
    });

    // Botón "Nueva Evidencia"
    document.getElementById('btnNuevaEvidencia').addEventListener('click', () => {
      mostrarFormularioNuevaEvidencia();
    });

    // Cerrar detalle
    document.getElementById('btnCerrarDetalle')?.addEventListener('click', () => {
      document.getElementById('detalleEvidencia').style.display = 'none';
      evidenciaSeleccionada = null;
    });

    // Eliminar evidencia
    document.querySelectorAll('.btn-eliminar-evidencia').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (!SIREI.utils.confirmar('¿Eliminar esta evidencia? Se perderán todas las entregas asociadas.')) return;
        try {
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              accion: 'eliminarEvidencia',
              token: token,
              id: id
            })
          });
          const result = await response.json();
          if (result.success) {
            SIREI.utils.mostrarToast('Evidencia eliminada.');
            await renderizar(); // Recargar
          } else {
            SIREI.utils.mostrarToast(result.message || 'Error al eliminar', 'error');
          }
        } catch (e) {
          SIREI.utils.mostrarToast('Error de conexión', 'error');
        }
      });
    });
  }

  let ultimosRegistros = [];
  let entregasPorAlumno = {};    // curp -> entrega (caché local; evita reconsultar tras cada guardado)
  let guardandoEntrega = false;  // candado anti doble registro

  // === Autoregistro del alumno (asistente a pantalla completa) ===
  let wizardEv = null;
  let wizardPaso = 1;
  let wizardCalificacion = '';
  let wizardEscala = '';
  let wizardAlumno = null;
  let wizardAlumnosFiltro = '';
  let wizardTimeoutExito = null;

  async function mostrarDetalleEvidencia(ev, saltarRefresco) {
    evidenciaSeleccionada = ev;
    const detalleDiv = document.getElementById('detalleEvidencia');
    const contenidoDiv = document.getElementById('detalleContenido');
    const nombreSpan = document.getElementById('detalleNombre');
    const esc = SIREI.utils.escapeHtml;

    nombreSpan.textContent = ev.nombreEvidencia;

    // Solo se consulta al servidor al abrir/refrescar; tras guardar se usa la caché local
    // (el guardado va en segundo plano, así que reconsultar mostraría datos viejos).
    if (!saltarRefresco) {
      const entregasServidor = await obtenerEntregas(ev.id);
      entregasPorAlumno = {};
      entregasServidor.forEach(function (e) {
        entregasPorAlumno[e.curpAlumno] = e;
      });
    }
    const entregas = Object.keys(entregasPorAlumno).map(function (k) { return entregasPorAlumno[k]; });
    const respuestaRapida = !ev.calificacionNumerica && !ev.escalaSuficiencia;

    const fechaMax = ev.fechaMaximaEntrega;
    let fechaColor = '#6b7280';
    let fechaHtml = '';
    if (fechaMax) {
      const ahora = new Date();
      const fechaMaxDate = parseFechaMax(fechaMax);
      if (fechaMaxDate) {
        fechaColor = ahora <= fechaMaxDate ? '#10b981' : '#ef4444';
      }
      fechaHtml = `<p style="color:${fechaColor}; font-weight:600;">Fecha maxima: ${formatearFechaSi(fechaMax)}</p>`;
    }

    const feedbackHtml = ultimosRegistros.length > 0 ? `
      <div style="margin-top:8px; padding:8px; background:#f0fdf4; border-radius:8px; font-size:0.8rem; color:#065f46;">
        <strong>Ultimos registros:</strong>
        ${ultimosRegistros.slice(0, 5).map(r => `<div>${r}</div>`).join('')}
      </div>
    ` : '';

    // ---- Listas de entregados / pendientes para acceso rápido ----
    const curpsEntregados = {};
    entregas.forEach(function (e) { curpsEntregados[e.curpAlumno] = true; });
    const listaPendientes = alumnosGrupo.filter(function (a) { return !curpsEntregados[a.curp]; });
    const listaEntregados = alumnosGrupo.filter(function (a) { return curpsEntregados[a.curp]; });

    function chipsAlumnos(lista, tipo) {
      if (lista.length === 0) return '<span style="color:#6b7280; font-size:0.85rem;">Ninguno</span>';
      return lista.map(function (a) {
        return '<button type="button" class="chip-alumno-evidencia" data-curp="' + esc(a.curp) + '" ' +
          'style="padding:8px 12px; border-radius:999px; border:1px solid ' + (tipo === 'ok' ? '#86efac' : '#fcd34d') + '; ' +
          'background:' + (tipo === 'ok' ? '#f0fdf4' : '#fffbeb') + '; color:#1f2937; font-size:0.85rem; cursor:pointer; margin:0 6px 6px 0;">' +
          (tipo === 'ok' ? '✅' : '⏳') + ' ' + esc(a.nombreCompleto) + '</button>';
      }).join('');
    }

    contenidoDiv.innerHTML = `
      <!-- Encabezado de la evidencia -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; margin-bottom:14px;">
        <div style="min-width:0;">
          <div style="font-weight:700; font-size:1rem;">${esc(ev.nombreEvidencia)}</div>
          <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">
            ${ev.calificacionNumerica ? 'Calificación numérica' : 'Sin calificación'}
            ${ev.escalaSuficiencia ? ' · Escala de suficiencia' : ''}
            ${ev.periodo ? ' · ' + esc(ev.periodo) : ''}
          </div>
          ${fechaHtml}
          ${ev.instrumentoEvaluacion ? `<div><a href="${esc(ev.instrumentoEvaluacion)}" target="_blank" style="color:#3b82f6; font-size:0.85rem;">📄 Instrumento de evaluación</a></div>` : ''}
        </div>
        <div style="display:flex; gap:6px; flex:0 0 auto;">
          <span title="Entregados" style="background:#dcfce7; color:#166534; border-radius:999px; padding:6px 12px; font-weight:700; font-size:0.85rem;">✅ ${entregas.length}</span>
          <span title="Pendientes" style="background:#fef3c7; color:#92400e; border-radius:999px; padding:6px 12px; font-weight:700; font-size:0.85rem;">⏳ ${alumnosGrupo.length - entregas.length}</span>
        </div>
      </div>

      <!-- Paso 1: elegir alumno -->
      <div style="font-weight:700; margin-bottom:6px; font-size:0.9rem;">1. Elige al alumno</div>
      <div style="display:flex; gap:8px; margin-bottom:4px;">
        <input type="text" id="busquedaAlumnoEvidencia" list="alumnosListEvidencia" placeholder="Escribe nombre o CURP…" style="flex:1; min-width:0; padding:10px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;">
        <datalist id="alumnosListEvidencia">
          ${alumnosGrupo.map(a => `<option value="${esc(a.nombreCompleto)}" data-curp="${esc(a.curp)}">`).join('')}
        </datalist>
        <button id="btnEscanearEvidencia" class="btn btn-secondary" style="flex:0 0 auto;">📷 QR</button>
      </div>

      <!-- Tarjeta del alumno seleccionado -->
      <div id="tarjetaAlumnoEvidencia"></div>

      <!-- Paso 2: observaciones (se comparten entre alumnos con "Mantener") -->
      <div style="margin-top:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span style="font-weight:600; font-size:0.9rem;">2. Observaciones (opcional)</span>
          <label style="display:flex; align-items:center; gap:6px; font-weight:500; font-size:0.8rem; cursor:pointer;">
            <input type="checkbox" id="chkMantenerObsEvidencia" style="width:16px; height:16px; accent-color:#1E3A8A;"> Mantener
          </label>
        </div>
        <div style="position:relative; width:100%;">
          <textarea id="observacionesEvidencia" rows="2" placeholder="Observaciones (opcional)..." style="width:100%; padding:10px 44px 10px 10px; border-radius:8px; border:1px solid #d1d5db; resize:vertical; min-height:44px; font-size:16px; box-sizing:border-box;"></textarea>
          <button id="btnDictadoEvidenciaObs" type="button" style="position:absolute; right:6px; bottom:6px; width:36px; height:36px; padding:0; font-size:1.2rem; border:none; background:transparent; display:flex; align-items:center; justify-content:center; border-radius:50%; cursor:pointer;" title="Dictar por voz">🎤</button>
        </div>
      </div>

      <!-- Paso 3: guardar -->
      <button id="btnGuardarEntrega" class="btn btn-primary" style="width:100%; margin-top:12px; padding:14px; font-size:1rem;" disabled>✅ Guardar entrega</button>

      <!-- Listas rápidas -->
      <details style="margin-top:14px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px;">
        <summary style="cursor:pointer; font-weight:600; font-size:0.9rem;">⏳ Pendientes (${listaPendientes.length}) — toca un nombre</summary>
        <div style="margin-top:8px;">${chipsAlumnos(listaPendientes, 'pend')}</div>
      </details>
      <details style="margin-top:8px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px;">
        <summary style="cursor:pointer; font-weight:600; font-size:0.9rem;">✅ Ya entregaron (${listaEntregados.length})</summary>
        <div style="margin-top:8px;">${chipsAlumnos(listaEntregados, 'ok')}</div>
      </details>

      ${feedbackHtml}
    `;

    detalleDiv.style.display = 'block';

    let alumnoActual = null;

    // Accesos al DOM: se consultan al vuelo para que el modo continuo del QR
    // siga funcionando después de cada repintado.
    function elBusqueda() { return document.getElementById('busquedaAlumnoEvidencia'); }
    function elTarjeta() { return document.getElementById('tarjetaAlumnoEvidencia'); }
    function elObs() { return document.getElementById('observacionesEvidencia'); }
    function elGuardar() { return document.getElementById('btnGuardarEntrega'); }

    // Limpia las observaciones solo si la casilla "Mantener" no está activa
    function limpiarObsEvidencia() {
      const chk = document.getElementById('chkMantenerObsEvidencia');
      const obs = elObs();
      if ((!chk || !chk.checked) && obs) obs.value = '';
    }

    // Pinta la tarjeta del alumno seleccionado con su estado actual
    function seleccionarAlumno(alumno) {
      const tarjeta = elTarjeta();
      const btn = elGuardar();
      if (!tarjeta) return;

      alumnoActual = alumno || null;

      if (!alumno) {
        tarjeta.innerHTML = '';
        if (btn) { btn.disabled = true; btn.textContent = '✅ Guardar entrega'; }
        return;
      }

      const entrega = entregasPorAlumno[alumno.curp];
      const yaEntrego = !!entrega;

      tarjeta.innerHTML = `
        <div style="margin-top:10px; border:2px solid ${yaEntrego ? '#86efac' : '#fcd34d'}; border-radius:12px; padding:12px; background:${yaEntrego ? '#f0fdf4' : '#fffbeb'};">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="font-size:1.05rem;">${esc(alumno.nombreCompleto)}</strong>
            <span style="font-size:0.8rem; font-weight:700; color:${yaEntrego ? '#166534' : '#92400e'};">${yaEntrego ? '✅ Ya entregó' : '⏳ Pendiente'}</span>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            ${ev.calificacionNumerica ? `<input type="number" id="indCalif" placeholder="Calificación 0-10" min="0" max="10" step="0.1" value="${entrega && entrega.calificacion ? esc(entrega.calificacion) : ''}" style="flex:1; min-width:120px; padding:10px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;">` : ''}
            ${ev.escalaSuficiencia ? `<select id="indEscala" style="flex:1; min-width:140px; padding:10px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;">
              <option value="">Escala…</option>
              <option value="Excelente" ${entrega && entrega.escala === 'Excelente' ? 'selected' : ''}>Excelente</option>
              <option value="Suficiente" ${entrega && entrega.escala === 'Suficiente' ? 'selected' : ''}>Suficiente</option>
              <option value="Insuficiente" ${entrega && entrega.escala === 'Insuficiente' ? 'selected' : ''}>Insuficiente</option>
            </select>` : ''}
          </div>
        </div>
      `;

      if (btn) {
        btn.disabled = false;
        btn.textContent = yaEntrego ? '💾 Actualizar entrega' : '✅ Guardar entrega';
      }
    }

    // ---- Guardado único: candado anti doble registro + cola en segundo plano ----
    function guardarEntrega(alumno, saltarValidacion) {
      if (!alumno) { SIREI.utils.mostrarToast('Elige un alumno primero.', 'error'); return; }
      if (guardandoEntrega) return;               // <-- evita el doble registro
      guardandoEntrega = true;

      const califInput = document.getElementById('indCalif');
      const escalaSelect = document.getElementById('indEscala');
      const obs = elObs();
      const calificacion = califInput ? califInput.value.trim() : '';
      const escala = escalaSelect ? escalaSelect.value : '';
      const observaciones = obs ? obs.value.trim() : '';

      // Validación local: evita encolar algo que el servidor rechazaría
      if (!saltarValidacion && ev.calificacionNumerica) {
        const n = parseFloat(calificacion);
        if (calificacion === '' || isNaN(n) || n < 0 || n > 10) {
          SIREI.utils.mostrarToast('Escribe una calificación de 0 a 10.', 'error');
          guardandoEntrega = false;
          return;
        }
      }
      if (!saltarValidacion && ev.escalaSuficiencia && !escala) {
        SIREI.utils.mostrarToast('Selecciona la escala de suficiencia.', 'error');
        guardandoEntrega = false;
        return;
      }

      const btn = elGuardar();
      if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

      // Se encola: la interfaz responde al instante y el registro se envía en segundo plano
      SIREI.cola.agregar('registrarEntrega', {
        idClase: idGrupo,
        idEvidencia: ev.id,
        nombreEvidencia: ev.nombreEvidencia,
        curpAlumno: alumno.curp,
        calificacion: calificacion,
        escala: escala,
        idDocente: idDocente,
        observaciones: observaciones || ''
      });

      // Actualización optimista local
      entregasPorAlumno[alumno.curp] = {
        curpAlumno: alumno.curp,
        idEvidencia: ev.id,
        calificacion: calificacion,
        escala: escala,
        observaciones: observaciones
      };

      const detalle = (calificacion ? ' (' + calificacion + ')' : '') + (escala ? ' [' + escala + ']' : '');
      SIREI.utils.mostrarToast('✅ ' + alumno.nombreCompleto + detalle);
      ultimosRegistros.unshift(new Date().toLocaleString('es-ES') + ' - ' + alumno.nombreCompleto + detalle);
      if (navigator.vibrate) navigator.vibrate(80);

      limpiarObsEvidencia();
      const busq = elBusqueda();
      if (busq) busq.value = '';

      guardandoEntrega = false;
      mostrarDetalleEvidencia(ev, true);   // repinta sin reconsultar al servidor
    }

    // ---- Selección por texto ----
    const inputBusqueda = elBusqueda();
    if (inputBusqueda) {
      inputBusqueda.addEventListener('input', function () {
        const q = inputBusqueda.value.toLowerCase().trim();
        if (!q) { seleccionarAlumno(null); return; }
        const alumno = alumnosGrupo.find(function (a) {
          return a.nombreCompleto.toLowerCase().includes(q) || (a.curp && a.curp.toLowerCase().includes(q));
        });
        if (!alumno) {
          const t = elTarjeta();
          if (t) t.innerHTML = '<p style="color:#ef4444; margin-top:8px;">Alumno no encontrado.</p>';
          return;
        }
        seleccionarAlumno(alumno);
      });
    }

    // ---- Botón guardar ----
    const btnGuardar = elGuardar();
    if (btnGuardar) {
      btnGuardar.addEventListener('click', function () { guardarEntrega(alumnoActual, false); });
    }

    // ---- Chips de acceso rápido ----
    contenidoDiv.querySelectorAll('.chip-alumno-evidencia').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const alumno = alumnosGrupo.find(function (a) { return a.curp === chip.dataset.curp; });
        if (!alumno) return;
        const busq = elBusqueda();
        if (busq) busq.value = alumno.nombreCompleto;
        seleccionarAlumno(alumno);
        if (respuestaRapida) {
          guardarEntrega(alumno, true);
        } else {
          const calif = document.getElementById('indCalif');
          if (calif) calif.focus();
        }
      });
    });

    // ---- Lector QR: se cierra solo al leer (no se queda escaneando) ----
    const btnEscanear = document.getElementById('btnEscanearEvidencia');
    if (btnEscanear) {
      btnEscanear.addEventListener('click', function () {
        SIREI.qr.abrir({
          titulo: 'Registrar entrega',
          subtitulo: ev.nombreEvidencia,
          continuo: false,
          etiqueta: function (codigo) {
            const curp = String(codigo || '').trim().toUpperCase();
            const al = alumnosGrupo.find(function (a) { return String(a.curp).toUpperCase() === curp; });
            return al ? al.nombreCompleto : null;
          },
          onLeido: function (codigo) {
            const curp = String(codigo).trim().toUpperCase();
            const alumno = alumnosGrupo.find(function (a) { return a.curp === curp; });
            if (!alumno) {
              SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
              return 'No pertenece al grupo';
            }
            const busq = elBusqueda();
            if (busq) busq.value = alumno.nombreCompleto;
            seleccionarAlumno(alumno);
            if (respuestaRapida) {
              guardarEntrega(alumno, true);
              return 'Registrado';
            }
            SIREI.utils.mostrarToast('Escribe la calificación y pulsa Guardar.', 'warning');
            return 'Falta calificación';
          }
        });
      });
    }

    // --- DICTADO POR VOZ (corregido) ---
    const btnDictado = document.getElementById('btnDictadoEvidenciaObs');
    if (btnDictado) {
      btnDictado.addEventListener('click', () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          SIREI.utils.mostrarToast('Dictado no soportado en este navegador.', 'error');
          return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognizer = new SR();
        recognizer.lang = 'es-MX';
        recognizer.interimResults = false;
        recognizer.continuous = false;
        recognizer.onresult = (event) => {
          const texto = event.results[0][0].transcript;
          const obs = elObs();
          if (obs) {
            obs.value += (obs.value ? ' ' : '') + texto;
            // Ajustar altura automáticamente
            obs.style.height = 'auto';
            obs.style.height = obs.scrollHeight + 'px';
          }
        };
        recognizer.onerror = (err) => {
          if (err.error === 'not-allowed') {
            SIREI.utils.mostrarToast('Permiso de micrófono denegado.', 'error');
          } else {
            SIREI.utils.mostrarToast('Error al dictar. Intenta de nuevo.', 'error');
          }
        };
        recognizer.onend = () => {
          // Opcional: feedback de que terminó
        };
        recognizer.start();
        // Feedback visual: cambiar el botón mientras escucha
        btnDictado.textContent = '⏳';
        btnDictado.style.background = '#f59e0b';
        setTimeout(() => {
          btnDictado.textContent = '🎤';
          btnDictado.style.background = '';
        }, 5000); // si no termina, se restaura
        // También restaurar cuando termine el reconocimiento
        recognizer.onend = () => {
          btnDictado.textContent = '🎤';
          btnDictado.style.background = '';
        };
      });
    }

    async function guardarEntregaIndividual(curpAlumno, calificacion, escala, evidencia, observaciones) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'registrarEntrega',
            token: token,
            idClase: idGrupo,
            idEvidencia: evidencia.id,
            nombreEvidencia: evidencia.nombreEvidencia,
            curpAlumno: curpAlumno,
            calificacion: calificacion,
            escala: escala,
            idDocente: idDocente,
            observaciones: observaciones || ''
          })
        });
        const result = await response.json();
        return result.success;
      } catch (e) {
        console.error('Error al guardar entrega:', e);
        return false;
      }
    }
  }

  // === Formulario para nueva evidencia (modal) ===
  function mostrarFormularioNuevaEvidencia() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:1000;';
    
    const modal = document.createElement('div');
    modal.style.cssText = 'background:white; padding:24px; border-radius:16px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    modal.innerHTML = `
      <h3 style="margin-top:0;">Nueva Evidencia</h3>
      <form id="formNuevaEvidencia">
        <div class="form-group">
          <label>Nombre de la evidencia *</label>
          <input type="text" id="nombreEvidencia" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
        </div>
        <div class="form-group" style="display:flex; flex-direction:column; gap:8px;">
          <label style="display:flex; align-items:center; gap:10px; font-weight:400; cursor:pointer;">
            <input type="checkbox" id="checkCalificacion" style="width:18px; height:18px; accent-color:#3b82f6;"> Calificaci\u00f3n num\u00e9rica (0-10)
          </label>
          <label style="display:flex; align-items:center; gap:10px; font-weight:400; cursor:pointer;">
            <input type="checkbox" id="checkEscala" style="width:18px; height:18px; accent-color:#3b82f6;"> Escala de suficiencia (Excelente, Suficiente, Insuficiente)
          </label>
        </div>
        <div class="form-group">
          <label>Periodo</label>
          <select id="selectPeriodoEvidencia" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
            <option value="">Cargando...</option>
          </select>
        </div>
        <div class="form-group">
          <label>Instrumento de evaluaci\u00f3n (link)</label>
          <input type="url" id="instrumentoEvaluacion" placeholder="https://..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
        </div>
        <div class="form-group">
          <label>Fecha m\u00e1xima de entrega (opcional)</label>
          <input type="datetime-local" id="fechaMaximaEntrega" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
          <span style="font-size:0.8rem; color:#6b7280;">Si no se especifica, no habr\u00e1 fecha l\u00edmite.</span>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-primary" style="flex:1;">Crear evidencia</button>
          <button type="button" id="btnCancelarModal" class="btn btn-secondary" style="flex:1;">Cancelar</button>
        </div>
      </form>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('btnCancelarModal').addEventListener('click', () => {
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    (async () => {
      try {
        let data = SIREI.cacheLocal.get('periodos');
        if (!data) {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ accion: 'obtenerPeriodos', token: token })
          });
          data = await res.json();
          if (data && data.success) {
            SIREI.cacheLocal.set('periodos', data, SIREI.TTL.PERIODOS);
          }
        }
        const selectP = document.getElementById('selectPeriodoEvidencia');
        if (data.success && data.periodos && data.periodos.length) {
          const ahora = new Date();
          let selectedIdx = 0;
          selectP.innerHTML = '<option value="">Selecciona un periodo</option>';
          data.periodos.forEach((p, idx) => {
            const opt = document.createElement('option');
            opt.value = p.nombre;
            opt.textContent = p.nombre;
            selectP.appendChild(opt);
            try {
              const ini = new Date(p.fechaInicio);
              const fin = new Date(p.fechaFin);
              if (ahora >= ini && ahora <= fin) selectedIdx = idx + 1;
            } catch (e) {}
          });
          selectP.selectedIndex = selectedIdx;
        } else {
          selectP.innerHTML = '<option value="">No hay periodos disponibles</option>';
        }
      } catch (e) {
        console.error('Error al cargar periodos:', e);
      }
    })();

    document.getElementById('formNuevaEvidencia').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('nombreEvidencia').value.trim();
      if (!nombre) {
        SIREI.utils.mostrarToast('El nombre es obligatorio.', 'error');
        return;
      }

      const calificacionNumerica = document.getElementById('checkCalificacion').checked;
      const escalaSuficiencia = document.getElementById('checkEscala').checked;
      
      const instrumento = document.getElementById('instrumentoEvaluacion').value.trim();
      let fechaMaxima = document.getElementById('fechaMaximaEntrega').value;
      
      if (fechaMaxima) {
        const fechaSeleccionada = new Date(fechaMaxima);
        const ahora = new Date();
        if (fechaSeleccionada < ahora) {
          SIREI.utils.mostrarToast('La fecha máxima no puede ser anterior a la fecha actual.', 'error');
          return;
        }
        const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
        const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
        const año = fechaSeleccionada.getFullYear();
        const horas = String(fechaSeleccionada.getHours()).padStart(2, '0');
        const minutos = String(fechaSeleccionada.getMinutes()).padStart(2, '0');
        fechaMaxima = `${dia}/${mes}/${año} ${horas}:${minutos}:00`;
      } else {
        fechaMaxima = '';
      }

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Creando...';

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            accion: 'crearEvidencia',
            token: token,
            idClase: idGrupo,
            idDocente: idDocente,
            idGrupo: idGrupo,
            idAsignatura: idAsignatura || '',
            periodo: document.getElementById('selectPeriodoEvidencia').value || '',
            nombreEvidencia: nombre,
            calificacionNumerica: calificacionNumerica ? 'true' : 'false',
            escalaSuficiencia: escalaSuficiencia ? 'true' : 'false',
            instrumentoEvaluacion: instrumento,
            fechaMaximaEntrega: fechaMaxima
          })
        });
        const result = await response.json();
        if (result.success) {
          SIREI.utils.mostrarToast('✅ Evidencia creada.');
          overlay.remove();
          await renderizar();
        } else {
          console.error("❌ Respuesta del servidor:", result);
          SIREI.utils.mostrarToast(result.message || 'Error al crear (sin mensaje específico)', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Crear evidencia';
        }
      } catch (e) {
        SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear evidencia';
      }
    });
  }

  // ============================================================
  //  AUTOREGISTRO DE EVIDENCIAS (flujo del alumno)
  //  1 Bienvenida · 2 Ponderación · 3 Identificación · 4 Resumen · 5 Éxito
  // ============================================================

  function wizardTienePonderacion() {
    return !!(wizardEv && (wizardEv.calificacionNumerica || wizardEv.escalaSuficiencia));
  }

  function crearOverlayWizard() {
    const previo = document.getElementById('evidenciaWizardOverlay');
    if (previo) previo.remove();

    const overlay = document.createElement('div');
    overlay.id = 'evidenciaWizardOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:#f8fafc; z-index:2147483600; display:flex; flex-direction:column;';
    overlay.innerHTML = `
      <div style="flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:#1E3A8A; color:#fff;">
        <div style="min-width:0;">
          <div style="font-weight:800; font-size:1rem;">📚 Evidencias de aprendizaje</div>
          <div style="font-size:0.75rem; color:#bfdbfe;">Registro del alumno</div>
        </div>
        <button type="button" id="evidWizardCerrar" style="background:#1e40af; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-size:0.9rem; font-weight:700; cursor:pointer;">✕ Cerrar</button>
      </div>
      <div id="evidWizardContenido" style="flex:1 1 auto; overflow-y:auto; padding:18px 14px 28px 14px;"></div>`;
    document.body.appendChild(overlay);
    document.getElementById('evidWizardCerrar').addEventListener('click', cerrarWizardEvidencia);
    window.cerrarWizardEvidencia = cerrarWizardEvidencia;
  }

  function cerrarWizardEvidencia() {
    if (wizardTimeoutExito) { clearTimeout(wizardTimeoutExito); wizardTimeoutExito = null; }
    const overlay = document.getElementById('evidenciaWizardOverlay');
    if (overlay) overlay.remove();
    window.cerrarWizardEvidencia = null;
    wizardEv = null;
    wizardAlumno = null;
    wizardPaso = 1;
    // Refresca la lista para actualizar contadores
    renderizar().catch(function () {});
  }

  function abrirWizardEvidencia(ev) {
    if (!ev) return;
    wizardEv = ev;
    wizardPaso = 1;
    wizardCalificacion = '';
    wizardEscala = '';
    wizardAlumno = null;
    wizardAlumnosFiltro = '';
    crearOverlayWizard();
    wizardPintar();
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
  }

  function wizardFilaResumen(etiqueta, valorHtml) {
    return '<div style="display:flex; justify-content:space-between; gap:12px; padding:11px 14px; border-bottom:1px solid #f3f4f6;">' +
      '<span style="font-size:0.85rem; color:#6b7280; font-weight:700;">' + esc(etiqueta) + '</span>' +
      '<span style="font-size:0.92rem; color:#111827; text-align:right;">' + valorHtml + '</span>' +
      '</div>';
  }

  function wizardPintar() {
    const cont = document.getElementById('evidWizardContenido');
    if (!cont || !wizardEv) return;
    const ev = wizardEv;

    const botonPrincipal = 'width:100%; min-height:54px; border:none; border-radius:12px; background:#1E3A8A; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;';

    // ---------- PASO 1: BIENVENIDA ----------
    if (wizardPaso === 1) {
      const requisitos = [];
      if (ev.calificacionNumerica) requisitos.push('una calificación numérica');
      if (ev.escalaSuficiencia) requisitos.push('una escala de suficiencia');
      const fechaMax = ev.fechaMaximaEntrega
        ? '<div style="margin-top:8px; font-size:0.85rem; color:#92400e;">📅 Fecha máxima de entrega: <strong>' + esc(formatearFechaSi(ev.fechaMaximaEntrega)) + '</strong></div>'
        : '';
      cont.innerHTML = `
        <div style="max-width:560px; margin:0 auto; text-align:center;">
          <div style="font-size:3.2rem; line-height:1;">👋</div>
          <h2 style="margin:12px 0 6px 0; font-size:1.45rem; color:#111827;">Bienvenido</h2>
          <p style="margin:0; color:#4b5563;">Vas a registrar la evidencia:</p>
          <div style="margin:16px 0; background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:16px; box-shadow:0 2px 10px rgba(0,0,0,.05);">
            <div style="font-size:1.2rem; font-weight:800; color:#1E3A8A;">${esc(ev.nombreEvidencia)}</div>
            <div style="font-size:0.85rem; color:#6b7280; margin-top:4px;">
              ${ev.grupo ? esc(ev.grupo) : ''}${ev.periodo ? ' · ' + esc(ev.periodo) : ''}
            </div>
            ${ev.nombreProfesor ? '<div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">Docente: ' + esc(ev.nombreProfesor) + '</div>' : ''}
            ${ev.instrumentoEvaluacion ? '<div style="margin-top:8px;"><a href="' + esc(ev.instrumentoEvaluacion) + '" target="_blank" rel="noopener" style="color:#2563eb; font-size:0.85rem; font-weight:700;">📄 Ver instrumento de evaluación</a></div>' : ''}
            ${fechaMax}
            <div style="margin-top:12px; font-size:0.88rem; color:#374151;">
              ${requisitos.length ? 'Se pedirá <strong>' + requisitos.join(' y ') + '</strong>.' : 'Esta evidencia no requiere ponderación.'}
            </div>
          </div>
          <button type="button" id="evidWizardSiguiente" style="${botonPrincipal}">Comenzar →</button>
        </div>`;
      document.getElementById('evidWizardSiguiente').addEventListener('click', function () {
        wizardPaso = wizardTienePonderacion() ? 2 : 3;
        wizardPintar();
      });
      return;
    }

    // ---------- PASO 2: PONDERACIÓN ----------
    if (wizardPaso === 2) {
      cont.innerHTML = `
        <div style="max-width:560px; margin:0 auto;">
          <h2 style="margin:0 0 4px 0; font-size:1.3rem; color:#111827;">Ponderación</h2>
          <p style="margin:0 0 16px 0; color:#4b5563; font-size:0.92rem;">Pregunta a tu maestro qué ponderación corresponde a tu evidencia y selecciónala.</p>

          ${ev.calificacionNumerica ? `
            <label style="display:block; font-weight:700; color:#374151; margin-bottom:6px;">Calificación numérica (0 a 10)</label>
            <input type="number" id="evidWizardCalif" min="0" max="10" step="0.1" inputmode="decimal" value="${esc(wizardCalificacion)}"
              style="width:100%; min-height:56px; padding:10px 14px; border-radius:12px; border:2px solid #d1d5db; font-size:1.4rem; font-weight:800; text-align:center; box-sizing:border-box; margin-bottom:16px;">
          ` : ''}

          ${ev.escalaSuficiencia ? `
            <div style="font-weight:700; color:#374151; margin-bottom:6px;">Escala de suficiencia</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
              ${['Excelente', 'Suficiente', 'Insuficiente'].map(function (op) {
                const sel = wizardEscala === op;
                return '<button type="button" class="evid-wizard-escala" data-escala="' + op + '" style="flex:1 1 120px; min-height:58px; border-radius:12px; border:2px solid ' +
                  (sel ? '#1E3A8A' : '#d1d5db') + '; background:' + (sel ? '#eff6ff' : '#fff') + '; color:#111827; font-weight:800; font-size:1rem; cursor:pointer;">' + op + '</button>';
              }).join('')}
            </div>
          ` : ''}

          <div style="display:flex; gap:10px;">
            <button type="button" id="evidWizardAtras" style="flex:1; min-height:54px; border:none; border-radius:12px; background:#e5e7eb; color:#111827; font-size:1rem; font-weight:800; cursor:pointer;">← Atrás</button>
            <button type="button" id="evidWizardSiguiente" style="flex:2; min-height:54px; border:none; border-radius:12px; background:#1E3A8A; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;">Continuar →</button>
          </div>
        </div>`;

      const inputCalif = document.getElementById('evidWizardCalif');
      if (inputCalif) {
        inputCalif.addEventListener('input', function () { wizardCalificacion = this.value; });
        inputCalif.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') document.getElementById('evidWizardSiguiente').click();
        });
      }
      cont.querySelectorAll('.evid-wizard-escala').forEach(function (b) {
        b.addEventListener('click', function () {
          wizardEscala = b.dataset.escala;
          wizardPintar();
        });
      });
      document.getElementById('evidWizardAtras').addEventListener('click', function () {
        wizardPaso = 1;
        wizardPintar();
      });
      document.getElementById('evidWizardSiguiente').addEventListener('click', function () {
        if (ev.calificacionNumerica) {
          const n = parseFloat(wizardCalificacion);
          if (wizardCalificacion === '' || isNaN(n) || n < 0 || n > 10) {
            SIREI.utils.mostrarToast('Escribe una calificación de 0 a 10.', 'error');
            return;
          }
        }
        if (ev.escalaSuficiencia && !wizardEscala) {
          SIREI.utils.mostrarToast('Selecciona la escala de suficiencia.', 'error');
          return;
        }
        wizardPaso = 3;
        wizardPintar();
      });
      return;
    }

    // ---------- PASO 3: IDENTIFICACIÓN ----------
    if (wizardPaso === 3) {
      cont.innerHTML = `
        <div style="max-width:620px; margin:0 auto;">
          <h2 style="margin:0 0 4px 0; font-size:1.3rem; color:#111827;">Identifícate</h2>
          <p style="margin:0 0 14px 0; color:#4b5563; font-size:0.92rem;">Escanea tu código QR o búscate en la lista.</p>

          <button type="button" id="evidWizardQR" style="width:100%; min-height:58px; border:none; border-radius:12px; background:#0f766e; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;">📷 Escanear mi código QR</button>

          <input type="text" id="evidWizardBuscar" placeholder="Escribe tu nombre o CURP…" value="${esc(wizardAlumnosFiltro)}" autocomplete="off"
            style="width:100%; min-height:50px; margin-top:12px; padding:10px 14px; border-radius:12px; border:1px solid #d1d5db; font-size:1rem; box-sizing:border-box;">

          <div id="evidWizardLista" style="margin-top:10px; max-height:38vh; overflow-y:auto; border:1px solid #e5e7eb; border-radius:12px; background:#fff;"></div>
          <div id="evidWizardSeleccion"></div>

          <div style="display:flex; gap:10px; margin-top:16px;">
            <button type="button" id="evidWizardAtras" style="flex:1; min-height:54px; border:none; border-radius:12px; background:#e5e7eb; color:#111827; font-size:1rem; font-weight:800; cursor:pointer;">← Atrás</button>
            <button type="button" id="evidWizardSiguiente" style="flex:2; min-height:54px; border:none; border-radius:12px; background:#1E3A8A; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;" ${wizardAlumno ? '' : 'disabled'}>Continuar →</button>
          </div>
        </div>`;

      function pintarSeleccionWizard() {
        const contSel = document.getElementById('evidWizardSeleccion');
        const btnSig = document.getElementById('evidWizardSiguiente');
        if (btnSig) btnSig.disabled = !wizardAlumno;
        if (!contSel) return;
        if (!wizardAlumno) { contSel.innerHTML = ''; return; }
        const ya = entregasExistentes[ev.id] && entregasExistentes[ev.id][wizardAlumno.curp];
        contSel.innerHTML = '<div style="margin-top:12px; border:2px solid #86efac; background:#f0fdf4; border-radius:12px; padding:12px; text-align:center;">' +
          '<div style="font-size:0.78rem; color:#166534; font-weight:700;">Alumno seleccionado</div>' +
          '<div style="font-size:1.15rem; font-weight:800; color:#111827;">' + esc(wizardAlumno.nombreCompleto) + '</div>' +
          (ya ? '<div style="font-size:0.78rem; color:#92400e; font-weight:700; margin-top:2px;">Ya tiene un registro; se actualizará</div>' : '') +
          '</div>';
      }

      function pintarListaAlumnosWizard() {
        const contLista = document.getElementById('evidWizardLista');
        if (!contLista) return;
        const q = String(wizardAlumnosFiltro || '').toLowerCase().trim();
        const lista = alumnosGrupo.filter(function (a) {
          if (!q) return true;
          return String(a.nombreCompleto || '').toLowerCase().indexOf(q) >= 0 ||
                 String(a.curp || '').toLowerCase().indexOf(q) >= 0;
        });
        if (!lista.length) {
          contLista.innerHTML = '<p style="padding:14px; margin:0; color:#6b7280;">Sin coincidencias.</p>';
          return;
        }
        contLista.innerHTML = lista.map(function (a) {
          const ya = entregasExistentes[ev.id] && entregasExistentes[ev.id][a.curp];
          const sel = wizardAlumno && String(wizardAlumno.curp) === String(a.curp);
          return '<button type="button" class="evid-wizard-alumno" data-curp="' + esc(a.curp) + '" style="display:flex; width:100%; justify-content:space-between; align-items:center; gap:8px; padding:12px 14px; background:' +
            (sel ? '#eff6ff' : '#fff') + '; border:none; border-bottom:1px solid #f3f4f6; text-align:left; cursor:pointer;">' +
            '<span style="font-weight:600; color:#111827; font-size:0.95rem;">' + esc(a.nombreCompleto) + '</span>' +
            '<span style="font-size:0.72rem; font-weight:700; color:' + (ya ? '#166534' : '#92400e') + ';">' + (ya ? '✅ Ya entregó' : '⏳ Pendiente') + '</span>' +
            '</button>';
        }).join('');
        contLista.querySelectorAll('.evid-wizard-alumno').forEach(function (b) {
          b.addEventListener('click', function () {
            wizardAlumno = alumnosGrupo.find(function (x) { return String(x.curp) === String(b.dataset.curp); }) || null;
            pintarListaAlumnosWizard();
            pintarSeleccionWizard();
          });
        });
      }

      const inputBuscar = document.getElementById('evidWizardBuscar');
      if (inputBuscar) {
        inputBuscar.addEventListener('input', function () {
          wizardAlumnosFiltro = inputBuscar.value;
          pintarListaAlumnosWizard();
        });
      }

      document.getElementById('evidWizardQR').addEventListener('click', function () {
        SIREI.qr.abrir({
          titulo: 'Identifícate',
          subtitulo: 'Escanea tu código QR',
          continuo: false,
          etiqueta: function (codigo) {
            const curp = String(codigo || '').trim().toUpperCase();
            const al = alumnosGrupo.find(function (a) { return String(a.curp).toUpperCase() === curp; });
            return al ? al.nombreCompleto : null;
          },
          onLeido: function (codigo) {
            const curp = String(codigo || '').trim().toUpperCase();
            const al = alumnosGrupo.find(function (a) { return String(a.curp).toUpperCase() === curp; });
            if (!al) {
              SIREI.utils.mostrarToast('Ese código no pertenece a este grupo.', 'error');
              return 'No pertenece al grupo';
            }
            wizardAlumno = al;
            wizardAlumnosFiltro = '';
            if (wizardPaso === 3) wizardPintar();
            return al.nombreCompleto;
          }
        });
      });

      document.getElementById('evidWizardAtras').addEventListener('click', function () {
        wizardPaso = wizardTienePonderacion() ? 2 : 1;
        wizardPintar();
      });
      document.getElementById('evidWizardSiguiente').addEventListener('click', function () {
        if (!wizardAlumno) {
          SIREI.utils.mostrarToast('Selecciona a un alumno primero.', 'error');
          return;
        }
        wizardPaso = 4;
        wizardPintar();
      });

      pintarListaAlumnosWizard();
      pintarSeleccionWizard();
      return;
    }

    // ---------- PASO 4: RESUMEN ----------
    if (wizardPaso === 4) {
      if (!wizardAlumno) { wizardPaso = 3; wizardPintar(); return; }
      const esNueva = !(entregasExistentes[ev.id] && entregasExistentes[ev.id][wizardAlumno.curp]);
      const filasPonderacion = [];
      if (ev.calificacionNumerica) filasPonderacion.push(wizardFilaResumen('Calificación', '<strong>' + esc(wizardCalificacion) + '</strong>'));
      if (ev.escalaSuficiencia) filasPonderacion.push(wizardFilaResumen('Escala', '<strong>' + esc(wizardEscala) + '</strong>'));
      if (!filasPonderacion.length) filasPonderacion.push(wizardFilaResumen('Ponderación', 'No aplica'));

      let avisoFecha = '';
      if (ev.fechaMaximaEntrega) {
        const fechaMax = parseFechaMax(ev.fechaMaximaEntrega);
        if (fechaMax && new Date() > fechaMax) {
          avisoFecha = '<div style="margin-top:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:10px 12px; color:#991b1b; font-size:0.85rem; font-weight:700;">⏰ La fecha máxima de entrega ya pasó; el registro quedará como fuera de fecha.</div>';
        }
      }

      cont.innerHTML = `
        <div style="max-width:620px; margin:0 auto;">
          <h2 style="margin:0 0 4px 0; font-size:1.3rem; color:#111827;">Revisa tu registro</h2>
          <p style="margin:0 0 14px 0; color:#4b5563; font-size:0.92rem;">Verifica que todo esté correcto antes de continuar.</p>

          <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
            ${wizardFilaResumen('Evidencia', '<strong>' + esc(ev.nombreEvidencia) + '</strong>')}
            ${wizardFilaResumen('Alumno', '<strong>' + esc(wizardAlumno.nombreCompleto) + '</strong>')}
            ${filasPonderacion.join('')}
            ${wizardFilaResumen('Fecha y hora', esc(new Date().toLocaleString('es-MX')))}
          </div>

          ${!esNueva ? '<div style="margin-top:10px; background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:10px 12px; color:#92400e; font-size:0.85rem; font-weight:700;">⚠ Este alumno ya había registrado la evidencia; el registro se actualizará.</div>' : ''}
          ${avisoFecha}

          <div style="margin-top:14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:14px; text-align:center;">
            <div style="font-size:1.7rem; line-height:1;">📣</div>
            <div style="font-weight:800; color:#1E3A8A; font-size:1rem; margin-top:6px;">Pide al maestro que revise lo que vas a registrar</div>
            <div style="color:#374151; font-size:0.88rem; margin-top:4px;">El maestro es quien presiona el botón <strong>Registrar</strong>.</div>
          </div>

          <div style="display:flex; gap:10px; margin-top:16px;">
            <button type="button" id="evidWizardAtras" style="flex:1; min-height:54px; border:none; border-radius:12px; background:#e5e7eb; color:#111827; font-size:1rem; font-weight:800; cursor:pointer;">← Atrás</button>
            <button type="button" id="evidWizardRegistrar" style="flex:2; min-height:54px; border:none; border-radius:12px; background:#1E3A8A; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;">✅ Registrar (docente)</button>
          </div>
        </div>`;

      document.getElementById('evidWizardAtras').addEventListener('click', function () {
        wizardPaso = 3;
        wizardPintar();
      });
      document.getElementById('evidWizardRegistrar').addEventListener('click', wizardRegistrar);
      return;
    }

    // ---------- PASO 5: ÉXITO ----------
    if (wizardPaso === 5) {
      cont.innerHTML = `
        <div style="max-width:560px; margin:0 auto; text-align:center; padding-top:24px;">
          <div style="font-size:4rem; line-height:1;">✅</div>
          <h2 style="margin:12px 0 6px 0; font-size:1.45rem; color:#111827;">Registro exitoso</h2>
          <p style="margin:0; font-size:1.15rem; font-weight:800; color:#1E3A8A;">${esc(wizardAlumno ? wizardAlumno.nombreCompleto : '')}</p>
          <p style="margin:6px 0 20px 0; color:#4b5563;">La evidencia <strong>${esc(ev.nombreEvidencia)}</strong> quedó registrada.</p>
          <button type="button" id="evidWizardListo" style="width:100%; min-height:54px; border:none; border-radius:12px; background:#1E3A8A; color:#fff; font-size:1.05rem; font-weight:800; cursor:pointer;">Listo, siguiente alumno</button>
          <p style="margin-top:12px; color:#9ca3af; font-size:0.8rem;">Esta pantalla se cerrará sola en unos segundos.</p>
        </div>`;
      document.getElementById('evidWizardListo').addEventListener('click', cerrarWizardEvidencia);
      if (wizardTimeoutExito) clearTimeout(wizardTimeoutExito);
      wizardTimeoutExito = setTimeout(function () {
        if (document.getElementById('evidenciaWizardOverlay')) cerrarWizardEvidencia();
      }, 7000);
      return;
    }
  }

  async function wizardRegistrar() {
    const ev = wizardEv;
    const alumno = wizardAlumno;
    if (!ev || !alumno) return;

    const btn = document.getElementById('evidWizardRegistrar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Registrando…'; }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'registrarEntrega',
          token: token,
          idClase: idGrupo,
          idEvidencia: ev.id,
          nombreEvidencia: ev.nombreEvidencia,
          curpAlumno: alumno.curp,
          calificacion: wizardCalificacion,
          escala: wizardEscala,
          idDocente: idDocente,
          observaciones: ''
        })
      });
      const result = await response.json();

      if (!result.success) {
        SIREI.utils.mostrarToast('❌ ' + (result.message || 'No se pudo registrar'), 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar (docente)'; }
        return;
      }

      if (!entregasExistentes[ev.id]) entregasExistentes[ev.id] = {};
      entregasExistentes[ev.id][alumno.curp] = result.entrega || { curpAlumno: alumno.curp, idEvidencia: ev.id };
      if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }

      if (!document.getElementById('evidenciaWizardOverlay')) return;
      wizardPaso = 5;
      wizardPintar();
    } catch (e) {
      SIREI.utils.mostrarToast('Error de conexión. Avisa al maestro e inténtalo de nuevo.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✅ Registrar (docente)'; }
    }
  }

  // === Iniciar ===
  await renderizar();
};

window.cargarEvidenciasDocente = async function (container) {
  const esc = SIREI.utils.escapeHtml;
  const tokenActual = sessionStorage.getItem('sirei_token');
  if (!tokenActual) {
    container.innerHTML = '<div class="card"><div class="error">Sesión no válida. Vuelve a iniciar sesión.</div></div>';
    return;
  }
  container.innerHTML = '<div class="card" style="text-align:center; padding:32px;"><div class="loader-moderno"><div class="spinner"></div><p>Cargando evidencias…</p></div></div>';

  try {
    let idDocenteActual = window._sireiIdDocente;
    if (!idDocenteActual) {
      const nombreDocente = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');
      const respuestaId = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerIdDocentePorNombre',
          token: tokenActual,
          nombre: nombreDocente
        })
      });
      const datosId = await respuestaId.json();
      if (!datosId.success || !datosId.idDocente) {
        throw new Error('No se encontró tu perfil de docente. Contacta al administrador.');
      }
      idDocenteActual = datosId.idDocente;
      window._sireiIdDocente = idDocenteActual;
    }

    const resultados = await Promise.all([
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ accion: 'obtenerAsignacionesDocente', token: tokenActual, idDocente: idDocenteActual })
      }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ accion: 'obtenerGrupos', token: tokenActual })
      }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ accion: 'obtenerAsignaturas', token: tokenActual })
      }).then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]);

    const asignaciones = (resultados[0] && resultados[0].asignaciones) || [];
    const grupos = (resultados[1] && resultados[1].grupos) || [];
    const materias = (resultados[2] && resultados[2].asignaturas) || [];

    if (!asignaciones.length) {
      container.innerHTML = '<div class="card"><h2 class="card-title">Evidencias de aprendizaje</h2><p>No tienes asignaciones activas. Contacta al coordinador.</p></div>';
      return;
    }

    function nombreGrupo(id) {
      const g = grupos.find(function (x) { return String(x.id) === String(id); });
      return g ? g.nombre : ('Grupo ' + id);
    }
    function nombreMateria(id) {
      const m = materias.find(function (x) { return String(x.id) === String(id); });
      return m ? m.nombre : ('Asignatura ' + id);
    }

    const opciones = asignaciones.map(function (a, i) {
      const etiqueta = nombreGrupo(a.idGrupo) + ' · ' + nombreMateria(a.idAsignatura) +
        (a.tipo === 'subgrupo' && a.nombreSubgrupo ? ' (' + a.nombreSubgrupo + ')' : '');
      return '<option value="' + i + '">' + esc(etiqueta) + '</option>';
    }).join('');

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">📚 Evidencias de aprendizaje</h2>
        <p style="color:#4b5563; margin:0 0 10px 0;">Elige el grupo y la asignatura. Puedes crear evidencias aunque no tengas una clase iniciada.</p>
        <label for="evidCtxAsignacion" style="display:block; font-weight:700; color:#374151; margin-bottom:6px;">Grupo y asignatura</label>
        <select id="evidCtxAsignacion" style="width:100%; min-height:48px; padding:10px; border-radius:10px; border:1px solid #d1d5db; font-size:1rem; margin-bottom:14px;">
          ${opciones}
        </select>
        <div id="evidCtxModulo"></div>
      </div>`;

    const select = document.getElementById('evidCtxAsignacion');
    const modulo = document.getElementById('evidCtxModulo');

    // Si hay clase activa, se preselecciona su grupo/asignatura
    let indiceInicial = 0;
    const claseActiva = window._sireiClaseActiva;
    if (claseActiva) {
      const idx = asignaciones.findIndex(function (a) {
        return String(a.idGrupo) === String(claseActiva.idGrupo) &&
               String(a.idAsignatura) === String(claseActiva.idAsignatura) &&
               String(a.idSubgrupo || '') === String(claseActiva.idSubgrupo || '');
      });
      if (idx >= 0) indiceInicial = idx;
    }
    select.value = String(indiceInicial);

    function montarModulo() {
      const a = asignaciones[parseInt(select.value, 10)];
      if (!a || !modulo) return;
      modulo.innerHTML = '';
      window.cargarAcademicoDocente(
        modulo,
        idDocenteActual,
        a.idGrupo,
        a.idAsignatura,
        a.periodo || '',
        tokenActual,
        a.idSubgrupo || ''
      );
    }

    select.addEventListener('change', montarModulo);
    montarModulo();
  } catch (e) {
    console.error('Error al cargar evidencias:', e);
    container.innerHTML = '<div class="card"><div class="error">No se pudo cargar el módulo de evidencias: ' +
      esc(e && e.message ? e.message : String(e)) + '</div></div>';
  }
};
