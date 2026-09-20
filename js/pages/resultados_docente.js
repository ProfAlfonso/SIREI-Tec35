// ============================================================
//  pages/resultados_docente.js - Menú "Resultados" del docente
//  Permite consultar (y, cuando la evaluación está abierta,
//  editar) todo lo que el docente ha asignado a sus alumnos:
//  asistencias, actitudinal, académico y calificaciones finales
//  por periodo.
// ============================================================

window.cargarResultadosDocente = async function(container) {
  console.log('[resultados_docente.js v1]');
  const token = sessionStorage.getItem('sirei_token');
  const nombreDocente = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');

  function post(accion, data) {
    data = data || {};
    const body = new URLSearchParams({ accion: accion, token: token });
    for (const k in data) {
      if (data[k] === undefined || data[k] === null) continue;
      if (typeof data[k] === 'object') body.append(k, JSON.stringify(data[k]));
      else body.append(k, data[k]);
    }
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    }).then(r => r.json());
  }

  function escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    if (typeof SIREI !== 'undefined' && SIREI.utils && SIREI.utils.formatearFechaLocal) {
      const f = SIREI.utils.formatearFechaLocal(fechaStr);
      if (f && f !== fechaStr) return f;
    }
    try {
      const d = new Date(fechaStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}
    return fechaStr;
  }

  function parseFechaHora(fechaStr) {
    if (!fechaStr) return null;
    try {
      const s = String(fechaStr);
      if (s.indexOf('T') >= 0) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      }
      let partes, hora;
      if (s.indexOf('/') >= 0) {
        const sp = s.split(' ');
        partes = sp[0].split('/');
        hora = (sp[1] || '00:00:00').split(':');
        if (partes.length !== 3) return null;
        const d = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), Number(hora[0] || 0), Number(hora[1] || 0), Number(hora[2] || 0));
        return isNaN(d.getTime()) ? null : d;
      }
      if (s.indexOf('-') >= 0) {
        const sp = s.split(' ');
        partes = sp[0].split('-');
        hora = (sp[1] || '00:00:00').split(':');
        if (partes.length !== 3) return null;
        const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), Number(hora[0] || 0), Number(hora[1] || 0), Number(hora[2] || 0));
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function claveFecha(fechaStr) {
    const d = parseFechaHora(fechaStr);
    if (!d) return String(fechaStr == null ? '' : fechaStr);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatearFechaCorta(fechaStr) {
    const d = parseFechaHora(fechaStr);
    if (!d) return fechaStr == null ? '' : String(fechaStr);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(-2);
  }

  function formatearFechaHora(fechaStr) {
    const d = parseFechaHora(fechaStr);
    if (!d) return fechaStr == null ? '' : String(fechaStr);
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function redondearCalif(num) {
    const f = Math.pow(10, decimales);
    const corregido = Number(num) * f;
    const epsilon = 1e-9 * Math.max(1, Math.abs(corregido));
    return Math.round(corregido + epsilon) / f;
  }

  let decimales = 1;
  let minimaAprobatoria = 6;

  container.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando resultados...</p></div>';

  try {
    // ---- Identidad del docente ----
    let idDocente = window._sireiIdDocente || null;
    if (!idDocente) {
      const resId = await post('obtenerIdDocentePorNombre', { nombre: nombreDocente });
      if (resId.success && resId.idDocente) {
        idDocente = resId.idDocente;
        window._sireiIdDocente = idDocente;
      } else {
        container.innerHTML = '<div class="card"><div class="error">No se encontró tu perfil de docente.</div></div>';
        return;
      }
    }

    // ---- Datos base en paralelo ----
    const [resPeriodos, resAsignaciones, resGrupos, resAsignaturas, resConfig] = await Promise.all([
      post('obtenerPeriodos'),
      post('obtenerAsignacionesDocente', { idDocente: idDocente }),
      post('obtenerGrupos'),
      post('obtenerAsignaturas'),
      post('obtenerConfiguracion')
    ]);

    const periodos = (resPeriodos.success && resPeriodos.periodos) || [];
    const asignaciones = (resAsignaciones.success && resAsignaciones.asignaciones) || [];
    const activas = asignaciones.filter(a => String(a.estado || '').toLowerCase() === 'activo');

    if (activas.length === 0) {
      container.innerHTML = '<div class="card"><p>No tienes asignaciones activas. Contacta al coordinador.</p></div>';
      return;
    }

    const grupos = (resGrupos.success && resGrupos.grupos) || [];
    const asignaturas = (resAsignaturas.success && resAsignaturas.asignaturas) || [];

    decimales = 1;
    if (resConfig.success && resConfig.datos) {
      const dec = parseInt(resConfig.datos.decimales_calificacion || resConfig.datos.decimalesCalificacion, 10);
      if (!isNaN(dec) && dec >= 0 && dec <= 5) decimales = dec;
    }
    const paso = Math.pow(10, -decimales).toFixed(Math.max(decimales, 1));

    minimaAprobatoria = 6;
    if (resConfig.success && resConfig.datos) {
      const m = parseFloat(resConfig.datos.calificacionMinimaAprobatoria || resConfig.datos.calificacion_minima_aprobatoria);
      if (!isNaN(m) && m >= 0 && m <= 10) minimaAprobatoria = m;
    }
    function estadoDe(final) {
      if (final === '') return '';
      if (final < minimaAprobatoria) return 'Extraordinario';
      if (final >= 9) return 'Exento';
      return 'Ordinario';
    }

    // ---- Mapa de asignaciones únicas (grupo|asignatura) ----
    const mapaAsignaciones = {};
    activas.forEach(a => {
      const clave = String(a.idGrupo) + '|' + String(a.idAsignatura);
      if (!mapaAsignaciones[clave]) mapaAsignaciones[clave] = a;
    });
    const asignacionesUnicas = Object.values(mapaAsignaciones);

    function gruposAsignados() {
      const mapa = {};
      const lista = [];
      asignacionesUnicas.forEach(a => {
        if (!mapa[String(a.idGrupo)]) {
          const g = grupos.find(x => String(x.id) === String(a.idGrupo));
          if (g) {
            mapa[String(a.idGrupo)] = true;
            lista.push({ idGrupo: a.idGrupo, nombre: g.nombre });
          }
        }
      });
      return lista;
    }

    function asignaturasDeGrupo(idGrupo) {
      return asignacionesUnicas
        .filter(a => String(a.idGrupo) === String(idGrupo))
        .map(a => {
          const asig = asignaturas.find(s => String(s.id) === String(a.idAsignatura));
          return { idAsignatura: a.idAsignatura, nombre: asig ? asig.nombre : a.idAsignatura };
        });
    }

    // ---- Estado de la vista ----
    function periodoPorDefecto() {
      if (periodos.length === 0) return null;
      const ahora = new Date();
      const parse = function(s) {
        try {
          const p = String(s).split('-');
          if (p.length === 3 && !isNaN(Number(p[0]))) return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        } catch (e) {}
        return null;
      };
      const activo = periodos.find(p => {
        const ini = parse(p.fechaInicio), fin = parse(p.fechaFin);
        return ini && fin && ahora >= ini && ahora <= fin;
      });
      if (activo) return activo;
      const abierto = periodos.find(p => p.evaluacionAbierta);
      if (abierto) return abierto;
      return periodos[0];
    }

    let periodoSeleccionado = periodoPorDefecto();
    let grupoSeleccionado = null;
    let asignaturaSeleccionada = null;
    let aspectoSeleccionado = 'asistencias';
    let datos = null;
    let alumnoSeleccionado = null;

    const resultadosContainerId = 'resultadosContenido';

    // ---- HTML base ----
    function renderBase() {
      const listaGrupos = gruposAsignados();
      const configDatos = (resConfig.success && resConfig.datos) || {};

      const opcionesPeriodo = periodos.map(p =>
        `<option value="${escapeAttr(p.id)}" ${periodoSeleccionado && String(p.id) === String(periodoSeleccionado.id) ? 'selected' : ''}>${escapeAttr(p.nombre)}</option>`
      ).join('');

      const opcionesGrupo = listaGrupos.map(g =>
        `<option value="${escapeAttr(g.idGrupo)}" ${String(g.idGrupo) === String(grupoSeleccionado) ? 'selected' : ''}>${escapeAttr(g.nombre)}</option>`
      ).join('');

      let opcionesAsignatura = '<option value="">-- Primero elige un grupo --</option>';
      let asignaturaDisabled = true;
      if (grupoSeleccionado) {
        const asigs = asignaturasDeGrupo(grupoSeleccionado);
        opcionesAsignatura = '<option value="">-- Elige una asignatura --</option>' +
          asigs.map(a =>
            `<option value="${escapeAttr(a.idAsignatura)}" ${String(a.idAsignatura) === String(asignaturaSeleccionada) ? 'selected' : ''}>${escapeAttr(a.nombre)}</option>`
          ).join('');
        asignaturaDisabled = asigs.length === 0;
      }

      const aspectos = [
        { id: 'asistencias', icono: '📋', nombre: 'Asistencias' },
        { id: 'actitudinal', icono: '😊', nombre: 'Actitudinal' },
        { id: 'academico', icono: '📚', nombre: 'Académico' },
        { id: 'calificaciones', icono: '🎯', nombre: 'Calificaciones finales' },
        { id: 'tops', icono: '🏆', nombre: 'Tops / Podium' }
      ];
      const botonesAspecto = aspectos.map(a =>
        `<button type="button" class="btn-aspecto ${a.id === aspectoSeleccionado ? 'activo' : ''}" data-aspecto="${a.id}">${a.icono} ${a.nombre}</button>`
      ).join('');

      container.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <h2 class="card-title" style="margin-bottom:0;">📊 Resultados</h2>
          </div>
          <div class="card-body">
            <p style="margin:0 0 4px 0;"><strong>Profesor:</strong> ${escapeAttr(nombreDocente)}</p>
            ${configDatos.nombreInstitucion ? `<p style="margin:0 0 4px 0; color:#4b5563; font-size:0.92rem;">${escapeAttr(configDatos.nombreInstitucion)}</p>` : ''}
            <p style="margin:0; color:#6b7280; font-size:0.85rem;">Aquí puedes consultar todo lo que has asignado a tus alumnos. Solo ves la información que tú mismo registraste.</p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:14px;">
              <div>
                <label style="font-weight:500;">Periodo:</label>
                <select id="selectPeriodoResult" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
                  ${opcionesPeriodo}
                </select>
              </div>
              <div>
                <label style="font-weight:500;">Grupo:</label>
                <select id="selectGrupoResult" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
                  <option value="">-- Elige un grupo --</option>
                  ${opcionesGrupo}
                </select>
              </div>
              <div>
                <label style="font-weight:500;">Asignatura:</label>
                <select id="selectAsignaturaResult" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;" ${asignaturaDisabled ? 'disabled' : ''}>
                  ${opcionesAsignatura}
                </select>
              </div>
              <div>
                <label style="font-weight:500;">Alumno:</label>
                <select id="selectAlumnoResult" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
                  <option value="">Todos los alumnos</option>
                </select>
              </div>
            </div>

            <div id="aspectosButtons" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              ${botonesAspecto}
            </div>

            <div id="${resultadosContainerId}"></div>
          </div>
        </div>
      `;

      document.getElementById('selectPeriodoResult').addEventListener('change', async (e) => {
        const nuevo = periodos.find(p => String(p.id) === String(e.target.value));
        if (nuevo) {
          periodoSeleccionado = nuevo;
          await cargarDatos(true);
        }
      });

      const selectGrupo = document.getElementById('selectGrupoResult');
      const selectAsignatura = document.getElementById('selectAsignaturaResult');

      selectGrupo.addEventListener('change', async () => {
        grupoSeleccionado = selectGrupo.value ? String(selectGrupo.value) : null;
        asignaturaSeleccionada = null;
        if (!grupoSeleccionado) {
          selectAsignatura.innerHTML = '<option value="">-- Primero elige un grupo --</option>';
          selectAsignatura.disabled = true;
          document.getElementById(resultadosContainerId).innerHTML = '<p style="color:#6b7280;">Selecciona un grupo para ver sus resultados.</p>';
          return;
        }
        const asigs = asignaturasDeGrupo(grupoSeleccionado);
        selectAsignatura.innerHTML = '<option value="">-- Elige una asignatura --</option>' +
          asigs.map(a => `<option value="${escapeAttr(a.idAsignatura)}">${escapeAttr(a.nombre)}</option>`).join('');
        selectAsignatura.disabled = asigs.length === 0;
        document.getElementById(resultadosContainerId).innerHTML = '<p style="color:#6b7280;">Selecciona una asignatura para continuar.</p>';
      });

      selectAsignatura.addEventListener('change', async () => {
        asignaturaSeleccionada = selectAsignatura.value ? String(selectAsignatura.value) : null;
        await cargarDatos(true);
      });

      // Selector de alumno individual
      document.getElementById('selectAlumnoResult').addEventListener('change', async () => {
        const val = document.getElementById('selectAlumnoResult').value;
        alumnoSeleccionado = val ? val : null;
        await renderAspecto();
      });

      document.querySelectorAll('.btn-aspecto').forEach(btn => {
        btn.addEventListener('click', async () => {
          aspectoSeleccionado = btn.dataset.aspecto;
          document.querySelectorAll('.btn-aspecto').forEach(b => b.classList.toggle('activo', b === btn));
          if (aspectoSeleccionado === 'tops') {
            await renderTops();
          } else {
            await renderAspecto();
          }
        });
      });

      // Preseleccionar si el docente tiene un solo grupo/asignatura
      const gruposUnicos = gruposAsignados();
      if (gruposUnicos.length === 1 && asignacionesUnicas.length === 1) {
        grupoSeleccionado = String(asignacionesUnicas[0].idGrupo);
        asignaturaSeleccionada = String(asignacionesUnicas[0].idAsignatura);
        const gSel = document.getElementById('selectGrupoResult');
        const aSel = document.getElementById('selectAsignaturaResult');
        if (gSel) gSel.value = grupoSeleccionado;
        const asigs = asignaturasDeGrupo(grupoSeleccionado);
        if (aSel) {
          aSel.innerHTML = '<option value="">-- Elige una asignatura --</option>' +
            asigs.map(a => `<option value="${escapeAttr(a.idAsignatura)}" selected>${escapeAttr(a.nombre)}</option>`).join('');
          aSel.disabled = false;
        }
        cargarDatos(true);
      } else {
        document.getElementById(resultadosContainerId).innerHTML = '<p style="color:#6b7280;">Selecciona grupo, asignatura y aspecto para ver los resultados.</p>';
      }
    }

    // ---- Llena el selector de alumno con los alumnos del grupo cargado ----
    function poblarSelectorAlumnos() {
      const sel = document.getElementById('selectAlumnoResult');
      if (!sel) return;
      const alumnos = (datos && datos.alumnos) || [];
      sel.innerHTML = '<option value="">Todos los alumnos</option>' +
        alumnos.map(a => `<option value="${escapeAttr(a.curp)}" ${alumnoSeleccionado === a.curp ? 'selected' : ''}>${escapeAttr(a.nombreCompleto)}</option>`).join('');
    }

    // ---- Cargar datos consolidados ----
    async function cargarDatos(forzar) {
      const tablaDiv = document.getElementById(resultadosContainerId);
      if (!tablaDiv) return;
      if (!grupoSeleccionado || !asignaturaSeleccionada || !periodoSeleccionado) {
        tablaDiv.innerHTML = '<p style="color:#6b7280;">Selecciona grupo y asignatura para continuar.</p>';
        return;
      }
      if (forzar) {
        alumnoSeleccionado = null;
      }
      if (datos && !forzar) {
        await renderAspecto();
        return;
      }

      tablaDiv.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando resultados...</p></div>';

      try {
        const res = await post('obtenerResultadosDocente', {
          idDocente: idDocente,
          idGrupo: grupoSeleccionado,
          idAsignatura: asignaturaSeleccionada,
          idPeriodo: periodoSeleccionado.id
        });
        if (res.success) {
          datos = res;
          poblarSelectorAlumnos();
          await renderAspecto();
        } else {
          tablaDiv.innerHTML = '<div class="error">' + escapeAttr(res.message || 'Error al obtener resultados.') + '</div>';
        }
      } catch (e) {
        console.error(e);
        tablaDiv.innerHTML = '<div class="error">Error de conexión: ' + escapeAttr(e.message) + '</div>';
      }
    }

    // ---- Render del aspecto seleccionado ----
    async function renderAspecto() {
      const tablaDiv = document.getElementById(resultadosContainerId);
      if (!tablaDiv) return;
      if (!datos) { tablaDiv.innerHTML = '<p style="color:#6b7280;">Cargando...</p>'; return; }

      // Si hay un alumno seleccionado, mostrar su vista individual
      const aspectosButtons = document.getElementById('aspectosButtons');
      if (alumnoSeleccionado) {
        if (aspectosButtons) aspectosButtons.style.display = 'none';
        return renderAlumnoIndividual(alumnoSeleccionado);
      }
      if (aspectosButtons) aspectosButtons.style.display = 'flex';

      if (aspectoSeleccionado === 'asistencias') return renderAsistencias();
      if (aspectoSeleccionado === 'actitudinal') return renderActitudinal();
      if (aspectoSeleccionado === 'academico') return renderAcademico();
      if (aspectoSeleccionado === 'calificaciones') return renderCalificaciones();
      tablaDiv.innerHTML = '';
    }

    function infoPeriodoBanner() {
      const p = datos.periodoInfo;
      if (!p) return '';
      let badge = '';
      let texto = '';
      if (p.evaluacionAbierta) {
        if (p.enVentanaEvaluacion) {
          badge = '<span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:#dbeafe; color:#1e40af;">En ventana de evaluación</span>';
          texto = 'La evaluación de este periodo está en curso; las calificaciones finales pueden editarse.';
        } else {
          badge = '<span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:#fef3c7; color:#92400e;">Abierta por el coordinador</span>';
          texto = 'El coordinador abrió la evaluación de este periodo; las calificaciones finales pueden editarse.';
        }
      } else {
        badge = '<span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:#e5e7eb; color:#4b5563;">Concluido</span>';
        texto = 'La evaluación de este periodo está cerrada; las calificaciones finales solo pueden verse (solo lectura).';
      }
      return `
        <div style="background:#f0f7ff; border:1px solid #bcd8f5; border-radius:8px; padding:12px; margin-bottom:16px;">
          <p style="margin:0; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
            <strong>Periodo:</strong> ${escapeAttr(p.nombre || datos.nombres.periodo)} ${badge}
          </p>
          <p style="margin:6px 0 0 0; color:#1e40af; font-size:0.9rem;">${texto}</p>
        </div>
      `;
    }

    // ==================== ASISTENCIAS ====================
    function renderAsistencias() {
      const alumnos = (datos.alumnos || []);
      const asistencias = (datos.asistencias || []);

      // Fechas únicas en que se pasó lista (orden cronológico)
      const fechasSet = {};
      asistencias.forEach(a => {
        const clave = claveFecha(a.timestamp);
        if (clave) fechasSet[clave] = a.timestamp;
      });
      const fechas = Object.keys(fechasSet).sort();

      // Mapa por curp+fecha -> estado (toma el registro más reciente del día)
      const mapa = {};
      asistencias.forEach(a => {
        const clave = claveFecha(a.timestamp);
        if (!clave) return;
        const k = String(a.curp) + '|' + clave;
        const prev = mapa[k];
        if (!prev || String(a.timestamp) > String(prev.timestamp)) {
          mapa[k] = a;
        }
      });

      const simbolo = function(estado) {
        if (estado === 'Presente') return '<span style="color:#10b981; font-weight:700;">✔</span>';
        if (estado === 'Retardo') return '<span style="color:#f59e0b; font-weight:700;">⏰</span>';
        if (estado === 'Ausente') return '<span style="color:#ef4444; font-weight:700;">✘</span>';
        if (estado === 'Justificado') return '<span style="color:#3b82f6; font-weight:700;">J</span>';
        if (estado === 'Escape') return '<span style="color:#dc2626; font-weight:700;">Esc</span>';
        return '<span style="color:#9ca3af;">—</span>';
      };

      const celda = function(al, f) {
        const r = mapa[String(al.curp) + '|' + f];
        const estadoActual = r ? r.estado : '';
        const curp = escapeAttr(al.curp);
        const fecha = escapeAttr(f);
        const simboloActual = r ? simbolo(r.estado) : '<span style="color:#e5e7eb;">·</span>';
        return `<td style="padding:4px 6px; text-align:center; font-size:1.05rem;">
          <span class="celda-asistencia" data-curp="${curp}" data-fecha="${fecha}" data-estado="${escapeAttr(estadoActual)}" style="cursor:pointer; display:inline-block; min-width:26px; padding:2px 4px; border-radius:4px;" title="Clic para editar">${simboloActual}</span>
          <select class="select-editar-asistencia" data-curp="${curp}" data-fecha="${fecha}" style="display:none; font-size:0.9rem;">
            <option value="Presente" ${estadoActual === 'Presente' ? 'selected' : ''}>✔ Presente</option>
            <option value="Retardo" ${estadoActual === 'Retardo' ? 'selected' : ''}>⏰ Retardo</option>
            <option value="Ausente" ${estadoActual === 'Ausente' ? 'selected' : ''}>✘ Ausente</option>
            <option value="Justificado" ${estadoActual === 'Justificado' ? 'selected' : ''}>J Justificado</option>
            <option value="Escape" ${estadoActual === 'Escape' ? 'selected' : ''}>Esc Escape</option>
          </select>
        </td>`;
      };

      const filas = alumnos.map(al => {
        const celdasFechas = fechas.map(f => celda(al, f)).join('');

        let contP = 0, contR = 0, contA = 0;
        fechas.forEach(f => {
          const r = mapa[String(al.curp) + '|' + f];
          if (!r) return;
          if (r.estado === 'Presente') contP++;
          else if (r.estado === 'Retardo') contR++;
          else if (r.estado === 'Ausente') contA++;
        });

        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 10px; position:sticky; left:0; background:#fff;">${escapeAttr(al.nombreCompleto)}</td>
          ${celdasFechas}
          <td style="padding:8px 10px; text-align:center; color:#10b981; font-weight:600;">${contP}</td>
          <td style="padding:8px 10px; text-align:center; color:#f59e0b; font-weight:600;">${contR}</td>
          <td style="padding:8px 10px; text-align:center; color:#ef4444; font-weight:600;">${contA}</td>
        </tr>`;
      }).join('');

      const headersFechas = fechas.map(f =>
        `<th style="padding:10px; text-align:center; min-width:52px; font-size:0.8rem; white-space:nowrap;">${escapeAttr(formatearFechaCorta(fechasSet[f]))}</th>`
      ).join('');

      tablaHtml(`
        <p style="margin:0 0 10px 0; color:#4b5563;"><strong>${alumnos.length}</strong> alumnos · ${escapeAttr(datos.nombres.asignatura)} · ${escapeAttr(datos.nombres.periodo)} · ${fechas.length} fecha(s) de lista · <em>Haz clic en un estatus para editarlo</em></p>
        <div style="max-height:60vh; overflow-x:auto; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb; position:sticky; top:0;">
                <th style="padding:10px; text-align:left; position:sticky; left:0; background:#f9fafb;">Alumno</th>
                ${headersFechas}
                <th style="padding:10px; text-align:center; color:#10b981;">Asist.</th>
                <th style="padding:10px; text-align:center; color:#f59e0b;">Retardos</th>
                <th style="padding:10px; text-align:center; color:#ef4444;">Ausencias</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      `);

      bindEdicionAsistencias();
    }

    // Enlaza los eventos de edición de estatus de asistencia
    function bindEdicionAsistencias() {
      const cont = document.getElementById(resultadosContainerId);
      if (!cont) return;

      cont.querySelectorAll('.celda-asistencia').forEach(span => {
        span.addEventListener('click', function() {
          const td = this.parentElement;
          const select = td ? td.querySelector('.select-editar-asistencia') : null;
          this.style.display = 'none';
          if (select) {
            select.style.display = 'inline-block';
            select.focus();
          }
        });
      });

      cont.querySelectorAll('.select-editar-asistencia').forEach(select => {
        select.addEventListener('change', async function() {
          const curp = this.dataset.curp;
          const fecha = this.dataset.fecha;
          const nuevoEstado = this.value;
          this.disabled = true;
          try {
            const res = await post('actualizarAsistencia', {
              idDocente: idDocente,
              curp: curp,
              fecha: fecha,
              idGrupo: grupoSeleccionado,
              idAsignatura: asignaturaSeleccionada,
              idPeriodo: periodoSeleccionado.id,
              estado: nuevoEstado
            });
            if (res.success) {
              SIREI.utils.mostrarToast('✅ Asistencia actualizada');
              if (navigator.vibrate) navigator.vibrate(30);
              actualizarAsistenciaLocal(curp, fecha, nuevoEstado);
            } else {
              SIREI.utils.mostrarToast(res.message || 'Error al actualizar', 'error');
              renderAsistencias();
            }
          } catch (e) {
            SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
            renderAsistencias();
          }
        });
      });
    }

    // Actualiza el estado en los datos locales y re-renderiza la tabla
    function actualizarAsistenciaLocal(curp, fechaClave, nuevoEstado) {
      let mejor = null;
      (datos.asistencias || []).forEach(a => {
        if (a.curp === curp && claveFecha(a.timestamp) === fechaClave) {
          if (!mejor || String(a.timestamp) > String(mejor.timestamp)) mejor = a;
        }
      });
      if (mejor) {
        mejor.estado = nuevoEstado;
      } else {
        // Agregar un registro sintético para mostrarlo de inmediato
        datos.asistencias.push({ curp: curp, nombreAlumno: '', estado: nuevoEstado, timestamp: fechaClave + ' 12:00:00', tipo: 'Manual' });
      }
      renderAsistencias();
    }

    // ==================== ACTITUDINAL ====================
    function renderActitudinal() {
      const actitudes = (datos.actitudes || []);
      const estadoOrden = { campo: 'alumno', dir: 'asc' };

      const norm = function(v) { return String(v == null ? '' : v).toLowerCase(); };

      function copiaOrdenada() {
        const arr = actitudes.slice();
        const dir = estadoOrden.dir === 'asc' ? 1 : -1;
        arr.sort(function(a, b) {
          let x, y;
          if (estadoOrden.campo === 'alumno') { x = norm(a.nombreAlumno); y = norm(b.nombreAlumno); }
          else if (estadoOrden.campo === 'actitud') { x = norm(a.nombreActitud); y = norm(b.nombreActitud); }
          else if (estadoOrden.campo === 'fecha') { x = claveFecha(a.fechaAsignacion) + ' ' + String(a.fechaAsignacion || ''); y = claveFecha(b.fechaAsignacion) + ' ' + String(b.fechaAsignacion || ''); }
          else { x = norm(a.notas); y = norm(b.notas); }
          if (x < y) return -1 * dir;
          if (x > y) return 1 * dir;
          return 0;
        });
        return arr;
      }

      function filasActitudes(lista) {
        return lista.map(r => {
          const color = r.clasificacion === 'positiva' ? '#10b981' : r.clasificacion === 'negativa' ? '#ef4444' : '#3b82f6';
          return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 10px;">${escapeAttr(r.nombreAlumno)}</td>
            <td style="padding:8px 10px;">${escapeAttr(r.insignia || '🔲')} ${escapeAttr(r.nombreActitud)}
              <span style="display:inline-block; margin-left:6px; padding:0 8px; border-radius:10px; background:${color}20; color:${color}; font-size:0.72rem; font-weight:600;">${escapeAttr(r.clasificacion)}</span>
            </td>
            <td style="padding:8px 10px; font-size:0.82rem; color:#4b5563; white-space:nowrap;">${escapeAttr(formatearFechaHora(r.fechaAsignacion))}</td>
            <td style="padding:8px 10px; font-size:0.82rem; color:#6b7280;">${r.notas ? escapeAttr(r.notas) : '—'}</td>
          </tr>`;
        }).join('');
      }

      function pintarCuerpo() {
        const cuerpo = document.getElementById('tbodyActitudinal');
        if (!cuerpo) return;
        cuerpo.innerHTML = filasActitudes(copiaOrdenada());
      }

      function ordenarPor(campo) {
        if (estadoOrden.campo === campo) {
          estadoOrden.dir = estadoOrden.dir === 'asc' ? 'desc' : 'asc';
        } else {
          estadoOrden.campo = campo;
          estadoOrden.dir = 'asc';
        }
        pintarCuerpo();
        actualizarFlechas();
      }

      function actualizarFlechas() {
        document.querySelectorAll('#tablaActitudinal thead th[data-campo]').forEach(t => {
          t.textContent = t.textContent.replace(/\s*[▲▼]$/, '');
          if (t.dataset.campo === estadoOrden.campo) {
            t.textContent += estadoOrden.dir === 'asc' ? ' ▲' : ' ▼';
          }
        });
      }

      if (actitudes.length === 0) {
        tablaHtml(`<p style="color:#6b7280;">No hay actitudes asignadas para este grupo/asignatura/periodo.</p>`);
        return;
      }

      tablaHtml(`
        <p style="margin:0 0 10px 0; color:#4b5563;"><strong>${actitudes.length}</strong> asignaciones de actitud · ${escapeAttr(datos.nombres.asignatura)} · ${escapeAttr(datos.nombres.periodo)}</p>
        <p style="margin:0 0 10px 0; color:#6b7280; font-size:0.8rem;">Haz clic en un encabezado para ordenar.</p>
        <div style="max-height:60vh; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px;">
          <table id="tablaActitudinal" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb; position:sticky; top:0;">
                <th data-campo="alumno" style="padding:10px; text-align:left; cursor:pointer; user-select:none; white-space:nowrap;">Alumno ▲</th>
                <th data-campo="actitud" style="padding:10px; text-align:left; cursor:pointer; user-select:none; white-space:nowrap;">Actitud</th>
                <th data-campo="fecha" style="padding:10px; text-align:left; cursor:pointer; user-select:none; white-space:nowrap;">Fecha</th>
                <th data-campo="notas" style="padding:10px; text-align:left; cursor:pointer; user-select:none; white-space:nowrap;">Notas</th>
              </tr>
            </thead>
            <tbody id="tbodyActitudinal"></tbody>
          </table>
        </div>
      `);

      document.querySelectorAll('#tablaActitudinal thead th[data-campo]').forEach(t => {
        t.addEventListener('click', function() { ordenarPor(this.dataset.campo); });
      });
      pintarCuerpo();
    }

    // ==================== ACADÉMICO ====================
    function renderAcademico() {
      const alumnos = (datos.alumnos || []);
      const evidencias = (datos.evidencias || []);
      const entregas = (datos.entregas || []);

      const entregasPorEv = {};
      entregas.forEach(e => {
        if (!entregasPorEv[e.idEvidencia]) entregasPorEv[e.idEvidencia] = {};
        entregasPorEv[e.idEvidencia][e.curpAlumno] = e;
      });

      if (evidencias.length === 0) {
        tablaHtml(`<p style="color:#6b7280;">No hay evidencias registradas para este grupo/asignatura/periodo.</p>`);
        return;
      }

      const tarjetas = evidencias.map(ev => {
        const entregasEv = entregasPorEv[ev.id] || {};
        const tipoBadges = [];
        if (ev.calificacionNumerica) tipoBadges.push('<span style="padding:2px 8px; border-radius:10px; background:#dbeafe; color:#1e40af; font-size:0.72rem; font-weight:600;">Numérica</span>');
        if (ev.escalaSuficiencia) tipoBadges.push('<span style="padding:2px 8px; border-radius:10px; background:#fef3c7; color:#92400e; font-size:0.72rem; font-weight:600;">Escala</span>');

        const conCal = !!ev.calificacionNumerica;
        const conEsc = !!ev.escalaSuficiencia;

        const filas = alumnos.map(al => {
          const en = entregasEv[al.curp];
          if (!en) {
            return `<tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:6px 10px;">${escapeAttr(al.nombreCompleto)}</td>
              <td style="padding:6px 10px; text-align:center;"><span style="color:#ef4444; font-size:0.82rem;">Pendiente</span></td>
              ${conCal ? '<td style="padding:6px 10px; text-align:center;">—</td>' : ''}
              ${conEsc ? '<td style="padding:6px 10px; text-align:center;">—</td>' : ''}
            </tr>`;
          }
          const calif = en.calificacion ? escapeAttr(en.calificacion) : '—';
          const escala = en.escala ? escapeAttr(en.escala) : '—';
          return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:6px 10px;">${escapeAttr(al.nombreCompleto)}</td>
            <td style="padding:6px 10px; text-align:center;"><span style="color:#10b981; font-size:0.82rem;">Entregado</span></td>
            ${conCal ? `<td style="padding:6px 10px; text-align:center;">${calif}</td>` : ''}
            ${conEsc ? `<td style="padding:6px 10px; text-align:center;">${escala}</td>` : ''}
          </tr>`;
        }).join('');

        return `
          <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:12px 16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <strong style="font-size:1rem;">${escapeAttr(ev.nombreEvidencia)}</strong>
                <div style="font-size:0.8rem; color:#6b7280; margin-top:4px;">
                  ${tipoBadges.join(' ')}
                  ${ev.instrumentoEvaluacion ? ` <a href="${escapeAttr(ev.instrumentoEvaluacion)}" target="_blank" style="color:#3b82f6;">Instrumento</a>` : ''}
                  ${ev.fechaMaximaEntrega ? ` · Límite: ${formatearFecha(ev.fechaMaximaEntrega)}` : ''}
                </div>
              </div>
              <span style="font-size:0.78rem; color:#6b7280;">Creada: ${formatearFecha(ev.timestampCreacion)}</span>
            </div>
            <div style="max-height:280px; overflow-y:auto; margin-top:10px; border:1px solid #f3f4f6; border-radius:8px;">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb; position:sticky; top:0;">
                    <th style="padding:6px 10px; text-align:left;">Alumno</th>
                    <th style="padding:6px 10px; text-align:center;">Estado</th>
                    ${conCal ? '<th style="padding:6px 10px; text-align:center;">Calificación</th>' : ''}
                    ${conEsc ? '<th style="padding:6px 10px; text-align:center;">Escala</th>' : ''}
                  </tr>
                </thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');

      tablaHtml(`
        <p style="margin:0 0 10px 0; color:#4b5563;"><strong>${evidencias.length}</strong> evidencia(s) · ${escapeAttr(datos.nombres.asignatura)} · ${escapeAttr(datos.nombres.periodo)}</p>
        ${tarjetas}
      `);
    }

    // ==================== CALIFICACIONES FINALES ====================
    function renderCalificaciones() {
      const alumnos = (datos.alumnos || []);
      const calificaciones = (datos.calificaciones || []);
      const finales = (datos.calificacionesFinales || []);
      const periodosConfig = periodos;

      // mapa curp -> { idPeriodo: calificacion }
      const mapa = {};
      calificaciones.forEach(c => {
        if (!c.curp || c.calificacion === '' || c.calificacion == null) return;
        if (!mapa[c.curp]) mapa[c.curp] = {};
        mapa[c.curp][String(c.idPeriodo)] = c.calificacion;
      });
      // mapa curp -> registro de calificaciones finales (backend)
      const mapaFinales = {};
      finales.forEach(f => { if (f.curp) mapaFinales[f.curp] = f; });

      window._nombresAlumnosCalif = {};
      alumnos.forEach(a => { window._nombresAlumnosCalif[a.curp] = a.nombreCompleto; });

      const editable = periodosConfig.some(p => p.evaluacionAbierta);

      const botonGuardar = editable
        ? '<button id="btnGuardarResultadosCalif" class="btn btn-primary">Guardar calificaciones</button>'
        : '';

      function badgeEstado(estado) {
        if (estado === 'Extraordinario') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:700;">Extraordinario</span>';
        if (estado === 'Ordinario') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#fef3c7; color:#92400e; font-size:0.75rem; font-weight:700;">Ordinario</span>';
        if (estado === 'Exento') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:700;">Exento</span>';
        return '';
      }

      const filas = alumnos.map(al => {
        const prev = mapa[al.curp] || {};
        const celdasPeriodo = periodosConfig.map(p => {
          const idP = String(p.id);
          const salValor = prev[idP];
          const valor = (salValor !== undefined && salValor !== '') ? salValor : '';
          if (p.evaluacionAbierta) {
            return `<td style="padding:8px 10px; text-align:center;">
              <input type="number" class="input-resultado-calif" data-curp="${escapeAttr(al.curp)}" data-periodo="${escapeAttr(p.id)}" min="0" max="10" step="${paso}" placeholder="0-10" value="${valor !== '' ? escapeAttr(valor) : ''}" style="width:64px; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db; text-align:center;">
            </td>`;
          }
          return `<td style="padding:8px 10px; text-align:center;">${valor !== '' ? '<span style="font-weight:600; color:#1f2937;">' + escapeAttr(valor) + '</span>' : '<span style="color:#9ca3af;">—</span>'}</td>`;
        }).join('');

        const tieneTodos = periodosConfig.length > 0 && periodosConfig.every(p => {
          const v = prev[String(p.id)];
          return v !== undefined && v !== '';
        });
        let final = '';
        if (tieneTodos) {
          let suma = 0;
          periodosConfig.forEach(p => { suma += Number(prev[String(p.id)]); });
          final = redondearCalif(suma / periodosConfig.length);
        }

        const reg = mapaFinales[al.curp];
        const evaluacion = (reg && reg.evaluacion !== '' && reg.evaluacion != null) ? reg.evaluacion : '';
        const estado = estadoDe(final);
        let definitiva = '';
        if (final !== '') {
          if (estado === 'Exento') definitiva = final;
          else if (evaluacion !== '') definitiva = redondearCalif((final + Number(evaluacion)) / 2);
        }

        // Calificación final
        let celdaFinal = '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';
        if (final !== '') {
          const color = final < minimaAprobatoria ? '#dc2626' : '#1e3a8a';
          celdaFinal = `<td style="padding:8px 10px; text-align:center;"><strong style="color:${color}; font-size:1.05rem;">${escapeAttr(final)}</strong></td>`;
        }

        // Estado (en rojo si Extraordinario)
        let celdaEstado = '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';
        if (estado) {
          celdaEstado = `<td style="padding:8px 10px; text-align:center;">${badgeEstado(estado)}</td>`;
        }

        // Evaluación (solo para Ordinario/Extraordinario)
        let celdaEval = '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';
        if (estado === 'Ordinario' || estado === 'Extraordinario') {
          if (editable) {
            celdaEval = `<td style="padding:8px 10px; text-align:center;">
              <input type="number" class="input-evaluacion" data-curp="${escapeAttr(al.curp)}" min="0" max="10" step="${paso}" placeholder="0-10" value="${evaluacion !== '' ? escapeAttr(evaluacion) : ''}" style="width:64px; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db; text-align:center;">
            </td>`;
          } else {
            celdaEval = `<td style="padding:8px 10px; text-align:center;">${evaluacion !== '' ? '<strong style="color:#1f2937;">' + escapeAttr(evaluacion) + '</strong>' : '<span style="color:#9ca3af;">—</span>'}</td>`;
          }
        }

        // Calificación definitiva
        let celdaDef = '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';
        if (definitiva !== '') {
          const colorDef = definitiva < minimaAprobatoria ? '#dc2626' : '#1e3a8a';
          celdaDef = `<td style="padding:8px 10px; text-align:center;"><strong style="color:${colorDef}; font-weight:700;">${escapeAttr(definitiva)}</strong></td>`;
        }

        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 10px;">${escapeAttr(al.nombreCompleto)}</td>
          ${celdasPeriodo}
          ${celdaFinal}
          ${celdaEstado}
          ${celdaEval}
          ${celdaDef}
        </tr>`;
      }).join('');

      const headersPeriodo = periodosConfig.map(p =>
        `<th style="padding:10px; text-align:center; min-width:80px; white-space:nowrap;">${escapeAttr(p.nombre)}</th>`
      ).join('');

      const avisoSoloLectura = editable ? '' : `
        <div style="background:#f3f4f6; border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; margin-bottom:12px; color:#4b5563; font-size:0.9rem;">
          🔒 No hay periodos con evaluación abierta. Las calificaciones solo pueden verse; no son editables.
        </div>
      `;

      const leyenda = `
        <p style="margin:0 0 8px 0; color:#6b7280; font-size:0.82rem;">
          Calificación mínima aprobatoria: <strong>${minimaAprobatoria}</strong> · Exento: ${minimaAprobatoria} a 10 (final igual a definitiva) · Ordinario: evaluación requerida · Extraordinario: evaluación requerida (final &lt; mínima).
        </p>
      `;

      tablaHtml(`
        ${infoPeriodoBanner()}
        ${avisoSoloLectura}
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <p style="margin:0; color:#4b5563;"><strong>${alumnos.length}</strong> alumnos · ${escapeAttr(datos.nombres.asignatura)} · Calificaciones de 0 a 10 (${decimales} decimal${decimales === 1 ? '' : 'es'}).</p>
          ${botonGuardar}
        </div>
        ${leyenda}
        <div style="max-height:60vh; overflow-x:auto; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb; position:sticky; top:0;">
                <th style="padding:10px; text-align:left; position:sticky; left:0; background:#f9fafb;">Alumno</th>
                ${headersPeriodo}
                <th style="padding:10px; text-align:center; color:#1e3a8a;">Final</th>
                <th style="padding:10px; text-align:center;">Estado</th>
                <th style="padding:10px; text-align:center;">Evaluación</th>
                <th style="padding:10px; text-align:center; color:#1e3a8a;">Definitiva</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      `);

      if (editable) {
        document.getElementById('btnGuardarResultadosCalif').addEventListener('click', guardarCalificaciones);
      }
    }

    async function guardarCalificaciones() {
      const inputs = document.querySelectorAll('.input-resultado-calif');
      const porPeriodo = {};
      for (const input of inputs) {
        const curp = input.dataset.curp;
        const idPeriodo = input.dataset.periodo;
        const nombre = window._nombresAlumnosCalif && window._nombresAlumnosCalif[curp] ? window._nombresAlumnosCalif[curp] : curp;
        const valor = input.value.trim();
        if (valor === '') continue;
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0 || num > 10) {
          SIREI.utils.mostrarToast('Calificación inválida para ' + nombre + '. Debe ser 0-10.', 'error');
          return;
        }
        if (!porPeriodo[idPeriodo]) porPeriodo[idPeriodo] = [];
        porPeriodo[idPeriodo].push({ curp: curp, nombreAlumno: nombre, calificacion: num });
      }

      // Evaluaciones complementarias (Ordinario/Extraordinario)
      const evaluaciones = [];
      const evalInputs = document.querySelectorAll('.input-evaluacion');
      for (const input of evalInputs) {
        const curp = input.dataset.curp;
        const valor = input.value.trim();
        const nombre = window._nombresAlumnosCalif && window._nombresAlumnosCalif[curp] ? window._nombresAlumnosCalif[curp] : curp;
        if (valor === '') continue;
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0 || num > 10) {
          SIREI.utils.mostrarToast('Evaluación inválida para ' + nombre + '. Debe ser 0-10.', 'error');
          return;
        }
        evaluaciones.push({ curp: curp, calificacion: num });
      }

      if (Object.keys(porPeriodo).length === 0 && evaluaciones.length === 0) {
        SIREI.utils.mostrarToast('Ingresa al menos una calificación o evaluación.', 'warning');
        return;
      }

      const btn = document.getElementById('btnGuardarResultadosCalif');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      let guardadoOK = true;
      try {
        for (const idPeriodo of Object.keys(porPeriodo)) {
          const res = await post('guardarCalificacionesParciales', {
            idDocente: idDocente,
            idPeriodo: idPeriodo,
            idGrupo: grupoSeleccionado,
            idAsignatura: asignaturaSeleccionada,
            calificaciones: porPeriodo[idPeriodo]
          });
          if (!res.success) {
            guardadoOK = false;
            SIREI.utils.mostrarToast(res.message || 'Error al guardar', 'error');
            break;
          }
        }
        if (guardadoOK && evaluaciones.length > 0) {
          const resEval = await post('guardarEvaluacionesComplementarias', {
            idDocente: idDocente,
            idGrupo: grupoSeleccionado,
            idAsignatura: asignaturaSeleccionada,
            evaluaciones: evaluaciones
          });
          if (!resEval.success) {
            guardadoOK = false;
            SIREI.utils.mostrarToast(resEval.message || 'Error al guardar evaluaciones', 'error');
          }
        }
        if (guardadoOK) {
          SIREI.utils.mostrarToast('Calificaciones guardadas.');
        }
      } catch (e) {
        guardadoOK = false;
        SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar calificaciones';
        if (guardadoOK) cargarDatos(true);
      }
    }

    // ==================== VISTA INDIVIDUAL DE ALUMNO ====================
    function renderAlumnoIndividual(curp) {
      const alumnos = (datos.alumnos || []);
      const alumno = alumnos.find(a => a.curp === curp);
      if (!alumno) {
        tablaHtml('<p style="color:#6b7280;">Alumno no encontrado.</p>');
        return;
      }

      const asistencias = (datos.asistencias || []).filter(a => a.curp === curp);
      const actitudes = (datos.actitudes || []).filter(a => a.curpAlumno === curp);
      const entregas = (datos.entregas || []).filter(e => e.curpAlumno === curp);
      const evidencias = (datos.evidencias || []);
      const calificaciones = (datos.calificaciones || []).filter(c => c.curp === curp);
      const finales = (datos.calificacionesFinales || []).filter(f => f.curp === curp);

      // --- Asistencias por fecha ---
      const fechasMap = {};
      asistencias.forEach(a => {
        const c = claveFecha(a.timestamp);
        if (!c) return;
        const prev = fechasMap[c];
        if (!prev || String(a.timestamp) > String(prev.timestamp)) fechasMap[c] = a;
      });
      const fechas = Object.keys(fechasMap).sort();
      let presentes = 0, retardos = 0, ausentes = 0, justificados = 0;
      const filasAsist = fechas.map(f => {
        const r = fechasMap[f];
        const est = r.estado;
        let color = '#6b7280';
        if (est === 'Presente') { color = '#10b981'; presentes++; }
        else if (est === 'Retardo') { color = '#f59e0b'; retardos++; }
        else if (est === 'Ausente') { color = '#ef4444'; ausentes++; }
        else if (est === 'Justificado') { color = '#3b82f6'; justificados++; }
        else if (est === 'Escape') { color = '#dc2626'; }
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 10px;">${escapeAttr(formatearFechaCorta(r.timestamp))}</td>
          <td style="padding:6px 10px; color:${color}; font-weight:600;">${escapeAttr(est || '—')}</td>
        </tr>`;
      }).join('');
      const totalFechas = fechas.length;
      const pct = totalFechas > 0 ? Math.round(((presentes + retardos + justificados) / totalFechas) * 100) : 0;

      // --- Actitudes ---
      const filasAct = actitudes.map(r => {
        const color = r.clasificacion === 'positiva' ? '#10b981' : r.clasificacion === 'negativa' ? '#ef4444' : '#3b82f6';
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 10px;">${escapeAttr(r.insignia || '🔲')} ${escapeAttr(r.nombreActitud)}</td>
          <td style="padding:6px 10px;"><span style="display:inline-block; padding:0 8px; border-radius:10px; background:${color}20; color:${color}; font-size:0.75rem; font-weight:600;">${escapeAttr(r.clasificacion)}</span></td>
          <td style="padding:6px 10px; font-size:0.85rem;">${escapeAttr(formatearFechaHora(r.fechaAsignacion))}</td>
          <td style="padding:6px 10px; font-size:0.85rem;">${r.notas ? escapeAttr(r.notas) : '—'}</td>
        </tr>`;
      }).join('');

      // --- Evidencias y entregas ---
      const filasEv = evidencias.map(ev => {
        const en = entregas.find(e => String(e.idEvidencia) === String(ev.id));
        let estado = '<span style="color:#ef4444;">Pendiente</span>';
        let calif = '—', escala = '—', obs = '—';
        if (en) {
          estado = '<span style="color:#10b981;">Entregado</span>';
          if (ev.calificacionNumerica) calif = en.calificacion ? escapeAttr(en.calificacion) : '—';
          if (ev.escalaSuficiencia) escala = en.escala ? escapeAttr(en.escala) : '—';
          obs = en.observaciones ? escapeAttr(en.observaciones) : '—';
        }
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 10px;">${escapeAttr(ev.nombreEvidencia)}</td>
          <td style="padding:6px 10px;">${estado}</td>
          <td style="padding:6px 10px;">${calif}</td>
          <td style="padding:6px 10px;">${escala}</td>
          <td style="padding:6px 10px; font-size:0.85rem;">${obs}</td>
        </tr>`;
      }).join('');

      // --- Calificaciones por periodo ---
      const mapaCal = {};
      calificaciones.forEach(c => { mapaCal[String(c.idPeriodo)] = c.calificacion; });
      const filasCal = periodos.map(p => {
        const v = mapaCal[String(p.id)];
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:6px 10px;">${escapeAttr(p.nombre)}</td>
          <td style="padding:6px 10px; font-weight:600;">${v !== undefined && v !== '' ? escapeAttr(v) : '—'}</td>
        </tr>`;
      }).join('');

      const regFinal = finales[0];
      let finalProm = '';
      {
        let suma = 0, n = 0;
        periodos.forEach(p => {
          const v = mapaCal[String(p.id)];
          if (v !== undefined && v !== '') { suma += Number(v); n++; }
        });
        if (n === periodos.length && n > 0) finalProm = redondearCalif(suma / n);
      }

      let htmlFinal = `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:6px 10px;">Final</td><td style="padding:6px 10px; font-weight:700;">${finalProm !== '' ? escapeAttr(finalProm) : '—'}</td></tr>`;
      if (regFinal) {
        htmlFinal += `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:6px 10px;">Evaluación</td><td style="padding:6px 10px;">${regFinal.evaluacion != null && regFinal.evaluacion !== '' ? escapeAttr(regFinal.evaluacion) : '—'}</td></tr>`;
        htmlFinal += `<tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:6px 10px;">Definitiva</td><td style="padding:6px 10px; font-weight:700;">${regFinal.definitiva != null && regFinal.definitiva !== '' ? escapeAttr(regFinal.definitiva) : '—'}</td></tr>`;
      }

      tablaHtml(`
        <div style="background:#f0f7ff; border:1px solid #bcd8f5; border-radius:8px; padding:12px; margin-bottom:14px;">
          <p style="margin:0; font-size:1.05rem;"><strong>👤 ${escapeAttr(alumno.nombreCompleto)}</strong></p>
          <p style="margin:4px 0 0 0; color:#4b5563;">${escapeAttr(datos.nombres.asignatura)} · ${escapeAttr(datos.nombres.periodo)}</p>
        </div>

        <h4 style="margin:14px 0 6px 0;">📋 Asistencias <span style="font-size:0.85rem; color:#6b7280;">(${pct}% de asistencia · ${presentes} presentes, ${retardos} retardos, ${justificados} justificados, ${ausentes} ausencias)</span></h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f9fafb;"><th style="padding:6px 10px; text-align:left;">Fecha</th><th style="padding:6px 10px; text-align:left;">Estatus</th></tr></thead>
            <tbody>${filasAsist || '<tr><td colspan="2" style="padding:6px 10px; color:#6b7280;">Sin registros</td></tr>'}</tbody>
          </table>
        </div>

        <h4 style="margin:14px 0 6px 0;">😊 Actitudes asignadas</h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f9fafb;"><th style="padding:6px 10px; text-align:left;">Actitud</th><th style="padding:6px 10px; text-align:left;">Clasificación</th><th style="padding:6px 10px; text-align:left;">Fecha</th><th style="padding:6px 10px; text-align:left;">Notas</th></tr></thead>
            <tbody>${filasAct || '<tr><td colspan="4" style="padding:6px 10px; color:#6b7280;">Sin actitudes asignadas</td></tr>'}</tbody>
          </table>
        </div>

        <h4 style="margin:14px 0 6px 0;">📚 Evidencias y entregas</h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f9fafb;"><th style="padding:6px 10px; text-align:left;">Evidencia</th><th style="padding:6px 10px; text-align:left;">Estado</th><th style="padding:6px 10px; text-align:left;">Calif.</th><th style="padding:6px 10px; text-align:left;">Escala</th><th style="padding:6px 10px; text-align:left;">Observaciones</th></tr></thead>
            <tbody>${filasEv || '<tr><td colspan="5" style="padding:6px 10px; color:#6b7280;">Sin evidencias</td></tr>'}</tbody>
          </table>
        </div>

        <h4 style="margin:14px 0 6px 0;">🎯 Calificaciones por periodo</h4>
        <div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="background:#f9fafb;"><th style="padding:6px 10px; text-align:left;">Periodo</th><th style="padding:6px 10px; text-align:left;">Calificación</th></tr></thead>
            <tbody>${filasCal}${htmlFinal}</tbody>
          </table>
        </div>
      `);
    }

    // ==================== TOPS / PODIUM ====================
    async function renderTops() {
      const tablaDiv = document.getElementById(resultadosContainerId);
      if (!tablaDiv) return;
      const grupos = gruposAsignados();

      tablaDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:14px;">
          <div>
            <label style="font-weight:500;">Periodo:</label>
            <select id="selectTopPeriodo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
              <option value="">Todos los periodos</option>
              ${periodos.map(p => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.nombre)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-weight:500;">Grupo:</label>
            <select id="selectTopGrupo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
              <option value="">Todos mis grupos</option>
              ${grupos.map(g => `<option value="${escapeAttr(g.idGrupo)}">${escapeAttr(g.nombre)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-weight:500;">Mostrar:</label>
            <select id="selectTopN" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
              <option value="3">Top 3</option>
              <option value="5" selected>Top 5</option>
              <option value="10">Top 10</option>
              <option value="100000">Todos</option>
            </select>
          </div>
          <div>
            <label style="font-weight:500;">Tipo de actitud (top 7):</label>
            <select id="selectTopTipoActitud" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
              <option value="todas">Todas</option>
              <option value="positiva">Positiva</option>
              <option value="negativa">Negativa</option>
              <option value="neutra">Neutra</option>
              <option value="personalizada">Personalizada</option>
            </select>
          </div>
        </div>
        <div id="topContenido"><div class="loader-moderno"><div class="spinner"></div><p>Cargando tops...</p></div></div>
      `;

      async function cargarTops() {
        const idPeriodo = document.getElementById('selectTopPeriodo').value;
        const idGrupo = document.getElementById('selectTopGrupo').value;
        const topN = parseInt(document.getElementById('selectTopN').value, 10) || 5;
        const tipoActitud = document.getElementById('selectTopTipoActitud').value;

        const cont = document.getElementById('topContenido');
        cont.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando tops...</p></div>';

        try {
          const res = await post('obtenerTopsDocente', {
            idDocente: idDocente,
            idPeriodo: idPeriodo,
            idGrupo: idGrupo,
            tipoActitud: tipoActitud
          });
          if (!res.success) {
            cont.innerHTML = '<div class="error">' + escapeAttr(res.message || 'Error al obtener tops.') + '</div>';
            return;
          }

          const alumnos = res.alumnos || [];
          const tops = [
            { titulo: '🥇 Más asistencias (solo presentes)', key: 'asistencia_presente' },
            { titulo: '⏰ Más asistencias (presentes + retardos)', key: 'asistencia_presente_retardo' },
            { titulo: '📄 Más asistencias (presentes + justificadas)', key: 'asistencia_presente_justificado' },
            { titulo: '✅ Más asistencias (presentes + retardos + justificadas)', key: 'asistencia_presente_retardo_justificado' },
            { titulo: '⏳ Más retardos', key: 'retardos' },
            { titulo: '❌ Más ausencias', key: 'ausencias' },
            { titulo: '😊 Más asignaciones actitudinales (' + tipoActitud + ')', key: 'actitudes_total' },
            { titulo: '📚 Mejores resultados académicos (más entregas)', key: 'entregas' }
          ];

          function ordinal(i) {
            if (i === 1) return '1°';
            if (i === 2) return '2°';
            if (i === 3) return '3°';
            return i + '°';
          }

          function tarjeta(top) {
            const lista = alumnos.slice().sort((a, b) => (b[top.key] || 0) - (a[top.key] || 0)).slice(0, topN);
            const filas = lista.map((a, i) => `
              <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid #f3f4f6;">
                <span style="font-weight:800; color:#1E3A8A; min-width:34px;">${ordinal(i + 1)}</span>
                <div style="flex:1;">
                  <div style="font-weight:600;">${escapeAttr(a.nombre)}</div>
                  <div style="font-size:0.75rem; color:#6b7280;">${escapeAttr(a.grupo)}</div>
                </div>
                <span style="font-weight:700; color:#10b981;">${a[top.key] || 0}</span>
              </div>`).join('');
            return `
              <div style="background:white; border:1px solid #e5e7eb; border-radius:10px; padding:10px 14px; margin-bottom:12px;">
                <h4 style="margin:0 0 6px 0; font-size:0.98rem;">${top.titulo}</h4>
                ${lista.length === 0 ? '<p style="color:#6b7280; font-size:0.85rem;">Sin datos para este filtro.</p>' : filas}
              </div>`;
          }

          cont.innerHTML = tops.map(tarjeta).join('');
        } catch (e) {
          cont.innerHTML = '<div class="error">Error de conexión: ' + escapeAttr(e.message) + '</div>';
        }
      }

      document.getElementById('selectTopPeriodo').addEventListener('change', cargarTops);
      document.getElementById('selectTopGrupo').addEventListener('change', cargarTops);
      document.getElementById('selectTopN').addEventListener('change', cargarTops);
      document.getElementById('selectTopTipoActitud').addEventListener('change', cargarTops);

      await cargarTops();
    }

    // ---- Helper para pintar en el contenedor de resultados ----
    function tablaHtml(html) {
      const tablaDiv = document.getElementById(resultadosContainerId);
      if (tablaDiv) tablaDiv.innerHTML = html;
    }

    // ---- Render inicial ----
    renderBase();
  } catch (e) {
    console.error('Error en Resultados:', e);
    container.innerHTML = '<div class="error">Error: ' + escapeAttr(e.message) + '</div>';
  }
};
