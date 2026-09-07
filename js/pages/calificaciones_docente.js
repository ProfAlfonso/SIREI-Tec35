// ============================================================
//  pages/calificaciones_docente.js - Panel "Calificaciones" del docente
//  Permite registrar calificaciones de periodo parcial en los
//  periodos abiertos: por ventana de evaluación activa o por
//  apertura manual del coordinador (captura tardía).
// ============================================================

window.cargarCalificacionesDocente = async function(container) {
  console.log('[calificaciones_docente.js v4]');
  const token = sessionStorage.getItem('sirei_token');

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
    return SIREI.utils.formatearFechaLocal(fechaStr);
  }

  container.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando calificaciones...</p></div>';

  try {
    // ---- Obtener id del docente ----
    let idDocente = window._sireiIdDocente || null;
    if (!idDocente) {
      const nombreDocente = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user');
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
    const [resPeriodos, resConfig, resAsignaciones, resGrupos, resAsignaturas] = await Promise.all([
      post('obtenerPeriodos'),
      post('obtenerConfiguracion'),
      post('obtenerAsignacionesDocente', { idDocente: idDocente }),
      post('obtenerGrupos'),
      post('obtenerAsignaturas')
    ]);

    const periodos = (resPeriodos.success && resPeriodos.periodos) || [];
    const listaPeriodos = periodos.filter(p => p.evaluacionAbierta);

    if (listaPeriodos.length === 0) {
      container.innerHTML = '<div class="card"><p>No hay un periodo de evaluación abierto en este momento. El coordinador debe activar el interruptor de algún periodo.</p></div>';
      return;
    }

    const asignaciones = (resAsignaciones.success && resAsignaciones.asignaciones) || [];
    const activas = asignaciones.filter(a => String(a.estado || '').toLowerCase() === 'activo');
    if (activas.length === 0) {
      container.innerHTML = '<div class="card"><p>No tienes asignaciones activas. Contacta al coordinador.</p></div>';
      return;
    }

    const mapaAsignaciones = {};
    activas.forEach(a => {
      const clave = String(a.idGrupo) + '|' + String(a.idAsignatura) + '|' + (a.idSubgrupo || '');
      if (!mapaAsignaciones[clave]) mapaAsignaciones[clave] = a;
    });
    const asignacionesUnicas = Object.values(mapaAsignaciones);

    const grupos = (resGrupos.success && resGrupos.grupos) || [];
    const asignaturas = (resAsignaturas.success && resAsignaturas.asignaturas) || [];

    let decimales = 1;
    if (resConfig.success && resConfig.datos) {
      const dec = parseInt(resConfig.datos.decimales_calificacion || resConfig.datos.decimalesCalificacion, 10);
      if (!isNaN(dec) && dec >= 0 && dec <= 5) decimales = dec;
    }
    const paso = Math.pow(10, -decimales).toFixed(Math.max(decimales, 1));

    // ---- Estado de la vista ----
    let periodoSeleccionado = listaPeriodos[0];
    let grupoSeleccionado = null;
    let asignaturaSeleccionada = null;
    let subgrupoSeleccionado = null;

    function infoPeriodo(p) {
      let badge = '';
      let texto = '';
      if (p.enVentanaEvaluacion) {
        badge = '<span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:#dbeafe; color:#1e40af;">En ventana de evaluación</span>';
        texto = 'Ventana de evaluación: ' + formatearFecha(p.fechaInicioEvaluacion) + ' hasta ' + formatearFecha(p.fechaFin) + '.';
      } else {
        badge = '<span style="padding:3px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; background:#fef3c7; color:#92400e;">Abierta por el coordinador</span>';
        texto = 'El coordinador abrió la evaluación de este periodo (' + formatearFecha(p.fechaInicio) + ' a ' + formatearFecha(p.fechaFin) + ') para registrar calificaciones.';
      }
      return { badge: badge, texto: texto };
    }

    // ---- HTML base ----
    function renderBase() {
      const opcionesPeriodo = listaPeriodos.map(p =>
        `<option value="${p.id}" ${String(p.id) === String(periodoSeleccionado.id) ? 'selected' : ''}>${escapeAttr(p.nombre)}</option>`
      ).join('');

      const mapaGrupos = {};
      const gruposUnicos = [];
      asignacionesUnicas.forEach(a => {
        if (!mapaGrupos[String(a.idGrupo)]) {
          const g = grupos.find(x => String(x.id) === String(a.idGrupo));
          if (g) {
            mapaGrupos[String(a.idGrupo)] = true;
            gruposUnicos.push({ idGrupo: a.idGrupo, nombre: g.nombre });
          }
        }
      });

      const opcionesGrupo = gruposUnicos.map(g =>
        `<option value="${g.idGrupo}" ${String(g.idGrupo) === String(grupoSeleccionado) ? 'selected' : ''}>${escapeAttr(g.nombre)}</option>`
      ).join('');

      const info = infoPeriodo(periodoSeleccionado);

      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h2 class="card-title" style="margin-bottom:0;">Calificaciones del periodo</h2>
          </div>
          <div class="card-body">
            <div style="background:#f0f7ff; border:1px solid #bcd8f5; border-radius:8px; padding:12px; margin-bottom:16px;">
              <p style="margin:0; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                <strong>Periodo:</strong>
                ${listaPeriodos.length > 1
                  ? `<select id="selectPeriodoCalif" style="padding:4px 8px; border-radius:6px; border:1px solid #93c5fd;">${opcionesPeriodo}</select>`
                  : escapeAttr(periodoSeleccionado.nombre)}
                ${info.badge}
              </p>
              <p style="margin:6px 0 0 0; color:#1e40af; font-size:0.9rem;">${info.texto}</p>
              <p style="margin:2px 0 0 0; color:#1e40af; font-size:0.9rem;">Calificaciones de 0 a 10 (${decimales} decimal${decimales === 1 ? '' : 'es'}).</p>
            </div>

            <div style="margin-bottom:12px;">
              <label style="font-weight:500;">Grupo:</label>
              <select id="selectGrupoCalif" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
                <option value="">-- Elige un grupo --</option>
                ${opcionesGrupo}
              </select>
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-weight:500;">Asignatura:</label>
              <select id="selectAsignaturaCalif" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;" disabled>
                <option value="">-- Primero elige un grupo --</option>
              </select>
            </div>

            <div id="tablaCalificaciones"></div>
          </div>
        </div>
      `;
    }

    // ---- Cargar tabla de alumnos ----
    async function cargarTablaAlumnos() {
      const tablaDiv = document.getElementById('tablaCalificaciones');
      if (!tablaDiv) return;
      if (!grupoSeleccionado || !asignaturaSeleccionada) {
        tablaDiv.innerHTML = '';
        return;
      }

      tablaDiv.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando alumnos...</p></div>';

      try {
        const [resAlumnos, resParciales] = await Promise.all([
          post('obtenerAlumnosPorGrupo', { idGrupo: grupoSeleccionado, idSubgrupo: subgrupoSeleccionado || '' }),
          post('obtenerCalificacionesParciales', {
            idDocente: idDocente,
            idPeriodo: periodoSeleccionado.id,
            idGrupo: grupoSeleccionado,
            idAsignatura: asignaturaSeleccionada
          })
        ]);

        const alumnos = (resAlumnos.success && resAlumnos.alumnos) || [];
        const parciales = (resParciales.success && resParciales.calificaciones) || [];
        const mapaParciales = {};
        parciales.forEach(p => { if (p.curp) mapaParciales[p.curp] = p; });

        const nombres = {};
        alumnos.forEach(a => { nombres[a.curp] = a.nombreCompleto; });
        window._nombresAlumnos = nombres;

        const asignatura = asignaturas.find(a => String(a.id) === String(asignaturaSeleccionada));
        const nombreAsignatura = asignatura ? asignatura.nombre : '';

        if (alumnos.length === 0) {
          tablaDiv.innerHTML = '<p>No hay alumnos en este grupo.</p>';
          return;
        }

        const botonGuardar = '<button id="btnGuardarCalificaciones" class="btn btn-primary">Guardar calificaciones</button>';

        tablaDiv.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <p style="margin:0; color:#4b5563;"><strong>${alumnos.length}</strong> alumnos · ${escapeAttr(nombreAsignatura)}</p>
            ${botonGuardar}
          </div>
          <div style="max-height:60vh; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:#f9fafb; position:sticky; top:0;">
                  <th style="padding:10px; text-align:left;">Alumno</th>
                  <th style="padding:10px; text-align:center; width:120px;">Calificación</th>
                  <th style="padding:10px; text-align:left;">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                ${alumnos.map(al => {
                  const prev = mapaParciales[al.curp];
                  return `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:8px 10px;">${escapeAttr(al.nombreCompleto)}</td>
                    <td style="padding:8px 10px; text-align:center;">
                      <input type="number" class="input-calificacion" data-curp="${al.curp}" min="0" max="10" step="${paso}" placeholder="0-10" value="${prev && prev.calificacion !== '' ? prev.calificacion : ''}" style="width:80px; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db; text-align:center;">
                    </td>
                    <td style="padding:8px 10px;">
                      <input type="text" class="input-observaciones" data-curp="${al.curp}" placeholder="Opcional" value="${prev && prev.observaciones ? escapeAttr(prev.observaciones) : ''}" style="width:100%; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db;">
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

        document.getElementById('btnGuardarCalificaciones').addEventListener('click', guardarCalificaciones);
      } catch (e) {
        console.error(e);
        tablaDiv.innerHTML = '<div class="error">Error al cargar alumnos: ' + e.message + '</div>';
      }
    }

    // ---- Guardar ----
    async function guardarCalificaciones() {
      const inputs = document.querySelectorAll('.input-calificacion');
      const calificaciones = [];
      for (const input of inputs) {
        const curp = input.dataset.curp;
        const nombre = window._nombresAlumnos && window._nombresAlumnos[curp] ? window._nombresAlumnos[curp] : curp;
        const valor = input.value.trim();
        if (valor === '') continue;
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0 || num > 10) {
          SIREI.utils.mostrarToast('Calificación inválida para ' + nombre + '. Debe ser 0-10.', 'error');
          return;
        }
        const obsInput = document.querySelector('.input-observaciones[data-curp="' + curp + '"]');
        calificaciones.push({
          curp: curp,
          nombreAlumno: nombre,
          calificacion: num,
          observaciones: obsInput ? obsInput.value.trim() : ''
        });
      }

      if (calificaciones.length === 0) {
        SIREI.utils.mostrarToast('Ingresa al menos una calificación.', 'warning');
        return;
      }

      const btn = document.getElementById('btnGuardarCalificaciones');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        const res = await post('guardarCalificacionesParciales', {
          idDocente: idDocente,
          idPeriodo: periodoSeleccionado.id,
          idGrupo: grupoSeleccionado,
          idAsignatura: asignaturaSeleccionada,
          calificaciones: calificaciones
        });
        if (res.success) {
          SIREI.utils.mostrarToast(res.message || 'Calificaciones guardadas.');
        } else {
          SIREI.utils.mostrarToast(res.message || 'Error al guardar', 'error');
        }
      } catch (e) {
        SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar calificaciones';
        cargarTablaAlumnos();
      }
    }

    // ---- Render inicial y eventos ----
    renderBase();

    const selectPeriodo = document.getElementById('selectPeriodoCalif');
    if (selectPeriodo) {
      selectPeriodo.addEventListener('change', () => {
        const nuevo = listaPeriodos.find(p => String(p.id) === String(selectPeriodo.value));
        if (nuevo) {
          periodoSeleccionado = nuevo;
          grupoSeleccionado = null;
          asignaturaSeleccionada = null;
          renderBase();
        }
      });
    }

    const selectGrupo = document.getElementById('selectGrupoCalif');
    const selectAsignatura = document.getElementById('selectAsignaturaCalif');

    selectGrupo.addEventListener('change', () => {
      grupoSeleccionado = selectGrupo.value ? String(selectGrupo.value) : null;
      asignaturaSeleccionada = null;
      subgrupoSeleccionado = null;
      if (!grupoSeleccionado) {
        selectAsignatura.innerHTML = '<option value="">-- Primero elige un grupo --</option>';
        selectAsignatura.disabled = true;
        document.getElementById('tablaCalificaciones').innerHTML = '';
        return;
      }
      const asigs = asignacionesUnicas.filter(a => String(a.idGrupo) === grupoSeleccionado);
      selectAsignatura.innerHTML = '<option value="">-- Elige una asignatura --</option>' +
        asigs.map(a => {
          const asig = asignaturas.find(s => String(s.id) === String(a.idAsignatura));
          const nombre = asig ? escapeAttr(asig.nombre) : escapeAttr(a.idAsignatura);
          const sub = (a.tipo === 'subgrupo' && a.nombreSubgrupo) ? ' (' + escapeAttr(a.nombreSubgrupo) + ')' : '';
          return '<option value="' + escapeAttr(String(a.idAsignatura) + '|' + (a.idSubgrupo || '')) + '">' + nombre + sub + '</option>';
        }).join('');
      selectAsignatura.disabled = false;
      document.getElementById('tablaCalificaciones').innerHTML = '';
    });

    selectAsignatura.addEventListener('change', () => {
      const valor = selectAsignatura.value || '';
      const partes = valor.split('|');
      asignaturaSeleccionada = partes[0] ? String(partes[0]) : null;
      subgrupoSeleccionado = partes[1] ? String(partes[1]) : null;
      cargarTablaAlumnos();
    });

    // Si el docente tiene un solo grupo y una sola asignatura, preseleccionar
    const gruposUnicosParaAuto = [];
    const mapaG = {};
    asignacionesUnicas.forEach(a => { if (!mapaG[String(a.idGrupo)]) { mapaG[String(a.idGrupo)] = true; gruposUnicosParaAuto.push(a); } });
    if (gruposUnicosParaAuto.length === 1 && asignacionesUnicas.length === 1) {
      grupoSeleccionado = String(asignacionesUnicas[0].idGrupo);
      asignaturaSeleccionada = String(asignacionesUnicas[0].idAsignatura);
      subgrupoSeleccionado = asignacionesUnicas[0].idSubgrupo ? String(asignacionesUnicas[0].idSubgrupo) : null;
      renderBase();
      selectGrupo.value = grupoSeleccionado;
      const asigNombre = asignaturas.find(s => String(s.id) === asignaturaSeleccionada)?.nombre || '';
      selectAsignatura.innerHTML = '<option value="' + escapeAttr(String(asignaturaSeleccionada) + '|' + (asignacionesUnicas[0].idSubgrupo || '')) + '" selected>' + escapeAttr(asigNombre) + '</option>';
      selectAsignatura.disabled = false;
      cargarTablaAlumnos();
    }
  } catch (e) {
    console.error('Error en calificaciones:', e);
    container.innerHTML = '<div class="error">Error: ' + e.message + '</div>';
  }
};
