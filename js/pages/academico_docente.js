// ============================================================
//  academico_docente.js - Módulo Académico (Docente)
//  Gestión de evidencias y entregas
//  Versión 2.1 - CORREGIDA:
//    - El campo de texto para observaciones ahora ocupa todo el ancho en móviles.
//    - El botón de dictado por voz se ha rediseñado para que no estorbe
//      (se muestra como un botón pequeño al lado del textarea, con icono de micrófono).
//    - El textarea tiene un tamaño mínimo adecuado para ser visible en pantallas pequeñas.
// ============================================================

window.cargarAcademicoDocente = async function(container, idDocente, idGrupo, idAsignatura, periodo, token, idSubgrupo) {
  // === Estado ===
  let evidencias = [];
  let evidenciaSeleccionada = null;
  let alumnosGrupo = [];
  let entregasExistentes = {};

  // === Obtener alumnos del grupo ===
  async function obtenerAlumnosGrupo() {
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
    if (data.success) return data.alumnos || [];
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
    if (data.success) return data.evidencias || [];
    return [];
  }

  // === Obtener entregas de una evidencia ===
  async function obtenerEntregas(idEvidencia) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accion: 'obtenerEntregas',
        token: token,
        idClase: idGrupo,
        idEvidencia: idEvidencia
      })
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
    // Cargar datos
    try {
      alumnosGrupo = await obtenerAlumnosGrupo();
      evidencias = await obtenerEvidencias();
      
      // Mapear entregas existentes por evidencia y alumno
      for (const ev of evidencias) {
        const entregas = await obtenerEntregas(ev.id);
        entregasExistentes[ev.id] = {};
        entregas.forEach(e => {
          entregasExistentes[ev.id][e.curpAlumno] = e;
        });
      }
    } catch (e) {
      console.error('Error al cargar datos:', e);
    }

    container.innerHTML = `
      <div class="academico-docente">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
          <h3 style="margin:0;">Evidencias de Aprendizaje</h3>
          <button id="btnNuevaEvidencia" class="btn btn-primary" style="padding:10px 20px;">
            + Nueva Evidencia
          </button>
        </div>

        <div id="listaEvidencias" style="margin-bottom:20px;">
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
            return `
              <div class="evidencia-item" data-id="${ev.id}" style="background:white; border-radius:10px; padding:12px 16px; margin-bottom:10px; border:1px solid #e5e7eb; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                  <div>
                    <strong style="font-size:1.05rem;">${SIREI.utils.escapeHtml(ev.nombreEvidencia)}</strong>
                    <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">
                      ${ev.calificacionNumerica ? 'Calificaci\u00f3n num\u00e9rica' : ''}
                      ${ev.escalaSuficiencia ? 'Escala de suficiencia' : ''}
                      ${ev.instrumentoEvaluacion ? ` <a href="${ev.instrumentoEvaluacion}" target="_blank" style="color:#3b82f6;">Instrumento</a>` : ''}
                      ${fechaMax ? ` <span style="color:${fechaColor};">${fechaMaxFormateada}</span>` : ''}
                      ${ev.periodo ? ` <span style="color:#6b7280;">[${SIREI.utils.escapeHtml(ev.periodo)}]</span>` : ''}
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:0.8rem; color:#6b7280;">${formatearFechaSi(ev.timestampCreacion)}</span>
                    <button class="btn-eliminar-evidencia btn btn-danger" data-id="${ev.id}" style="padding:4px 10px; font-size:0.75rem;">Eliminar</button>
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
        const ev = evidencias.find(e => e.id === id);
        if (ev) mostrarDetalleEvidencia(ev);
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

    // ---- Lector QR (overlay arriba, alta sensibilidad, modo continuo) ----
    const btnEscanear = document.getElementById('btnEscanearEvidencia');
    if (btnEscanear) {
      btnEscanear.addEventListener('click', function () {
        SIREI.qr.abrir({
          titulo: 'Registrar entrega',
          subtitulo: ev.nombreEvidencia,
          continuo: respuestaRapida,
          onLeido: function (codigo) {
            const curp = String(codigo).trim().toUpperCase();
            const alumno = alumnosGrupo.find(function (a) { return a.curp === curp; });
            if (!alumno) {
              SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
              return;
            }
            const busq = elBusqueda();
            if (busq) busq.value = alumno.nombreCompleto;
            seleccionarAlumno(alumno);
            if (respuestaRapida) {
              guardarEntrega(alumno, true);
            } else {
              SIREI.utils.mostrarToast('Escribe la calificación y pulsa Guardar.', 'warning');
            }
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
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ accion: 'obtenerPeriodos', token: token })
        });
        const data = await res.json();
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

  // === Iniciar ===
  await renderizar();
};
