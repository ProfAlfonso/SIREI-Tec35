// ============================================================
//  pages/calificaciones_finales.js - "Calificaciones Finales" del Coordinador
//  Muestra (y permite registrar la evaluación ordinaria/extraordinaria
//  cuando hay periodos abiertos) la estructura:
//  Períodos P1..Pn | Calificación final | Estado | Evaluación | Definitiva
// ============================================================

window.cargarCalificacionesFinalesCoordinador = async function(container) {
  console.log('[calificaciones_finales.js v1]');
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

  function redondearCalif(num) {
    const f = Math.pow(10, decimales);
    const corregido = Number(num) * f;
    const epsilon = 1e-9 * Math.max(1, Math.abs(corregido));
    return Math.round(corregido + epsilon) / f;
  }
  function estadoDe(final) {
    if (final === '') return '';
    if (final < minimaAprobatoria) return 'Extraordinario';
    if (final >= 9) return 'Exento';
    return 'Ordinario';
  }

  let decimales = 1;
  let minimaAprobatoria = 6;

  container.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando calificaciones finales...</p></div>';

  try {
    const [resConfig, resPeriodos, resGrupos, resAsignaturas] = await Promise.all([
      post('obtenerConfiguracion'),
      post('obtenerPeriodos'),
      post('obtenerGrupos'),
      post('obtenerAsignaturas')
    ]);

    const config = (resConfig.success && resConfig.datos) || {};
    const dec = parseInt(config.decimalesCalificacion || config.decimales_calificacion, 10);
    if (!isNaN(dec) && dec >= 0 && dec <= 5) decimales = dec;
    const m = parseFloat(config.calificacionMinimaAprobatoria || config.calificacion_minima_aprobatoria);
    if (!isNaN(m) && m >= 0 && m <= 10) minimaAprobatoria = m;
    const paso = Math.pow(10, -decimales).toFixed(Math.max(decimales, 1));

    const periodos = (resPeriodos.success && resPeriodos.periodos) || [];
    const grupos = (resGrupos.success && resGrupos.grupos) || [];
    const asignaturas = (resAsignaturas.success && resAsignaturas.asignaturas) || [];

    let grupoSeleccionado = null;
    let asignaturaSeleccionada = null;

    const editable = periodos.some(p => p.evaluacionAbierta);

    function badgeEstado(estado) {
      if (estado === 'Extraordinario') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#fee2e2; color:#b91c1c; font-size:0.75rem; font-weight:700;">Extraordinario</span>';
      if (estado === 'Ordinario') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#fef3c7; color:#92400e; font-size:0.75rem; font-weight:700;">Ordinario</span>';
      if (estado === 'Exento') return '<span style="display:inline-block; padding:3px 10px; border-radius:20px; background:#dcfce7; color:#15803d; font-size:0.75rem; font-weight:700;">Exento</span>';
      return '';
    }

    function renderBase() {
      const opcionesGrupo = grupos.map(g =>
        `<option value="${escapeAttr(g.id)}" ${String(g.id) === String(grupoSeleccionado) ? 'selected' : ''}>${escapeAttr(g.nombre)}</option>`
      ).join('');

      let opcionesAsignatura = '<option value="">-- Primero elige un grupo --</option>';
      let asignaturaDisabled = true;
      if (grupoSeleccionado) {
        const asigs = asignaturas;
        opcionesAsignatura = '<option value="">-- Elige una asignatura --</option>' +
          asigs.map(a =>
            `<option value="${escapeAttr(a.id)}" ${String(a.id) === String(asignaturaSeleccionada) ? 'selected' : ''}>${escapeAttr(a.nombre)}</option>`
          ).join('');
        asignaturaDisabled = asigs.length === 0;
      }

      container.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header">
            <h2 class="card-title" style="margin-bottom:0;">🎯 Calificaciones Finales</h2>
          </div>
          <div class="card-body">
            <p style="margin:0 0 4px 0;"><strong>${ escapeAttr(config.nombreInstitucion || '') }</strong></p>
            <p style="margin:0; color:#6b7280; font-size:0.85rem;">
              Calificación mínima aprobatoria: <strong>${ minimaAprobatoria }</strong> · ${ decimales } decimal${ decimales === 1 ? '' : 'es' }.
              ${ editable ? '' : ' No hay periodos con evaluación abierta; solo lectura.' }
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:14px;">
              <div>
                <label style="font-weight:500;">Grupo:</label>
                <select id="selectGrupoCF" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;">
                  <option value="">-- Elige un grupo --</option>
                  ${opcionesGrupo}
                </select>
              </div>
              <div>
                <label style="font-weight:500;">Asignatura:</label>
                <select id="selectAsignaturaCF" style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db; margin-top:4px;" ${asignaturaDisabled ? 'disabled' : ''}>
                  ${opcionesAsignatura}
                </select>
              </div>
            </div>

            <div id="tablaCFContainer"></div>
          </div>
        </div>
      `;

      document.getElementById('selectGrupoCF').addEventListener('change', async (e) => {
        grupoSeleccionado = e.target.value ? String(e.target.value) : null;
        asignaturaSeleccionada = null;
        const selA = document.getElementById('selectAsignaturaCF');
        selA.innerHTML = '<option value="">-- Elige una asignatura --</option>' +
          asignaturas.map(a => `<option value="${escapeAttr(a.id)}">${escapeAttr(a.nombre)}</option>`).join('');
        selA.disabled = asignaturas.length === 0;
        document.getElementById('tablaCFContainer').innerHTML = '<p style="color:#6b7280;">Selecciona una asignatura para continuar.</p>';
      });

      document.getElementById('selectAsignaturaCF').addEventListener('change', async (e) => {
        asignaturaSeleccionada = e.target.value ? String(e.target.value) : null;
        await cargarTabla();
      });

      // Preseleccionar el primer grupo si solo hay uno
      if (grupos.length === 1) {
        grupoSeleccionado = String(grupos[0].id);
        const gSel = document.getElementById('selectGrupoCF');
        if (gSel) gSel.value = grupoSeleccionado;
        renderBase();
        const selA = document.getElementById('selectAsignaturaCF');
        selA.innerHTML = '<option value="">-- Elige una asignatura --</option>' +
          asignaturas.map(a => `<option value="${escapeAttr(a.id)}">${escapeAttr(a.nombre)}</option>`).join('');
        selA.disabled = asignaturas.length === 0;
      }
    }

    async function cargarTabla() {
      const tablaDiv = document.getElementById('tablaCFContainer');
      if (!tablaDiv) return;
      if (!grupoSeleccionado || !asignaturaSeleccionada) {
        tablaDiv.innerHTML = '<p style="color:#6b7280;">Selecciona grupo y asignatura para continuar.</p>';
        return;
      }
      tablaDiv.innerHTML = '<div class="loader-moderno"><div class="spinner"></div><p>Cargando...</p></div>';

      const res = await post('obtenerCalificacionesFinales', {
        idGrupo: grupoSeleccionado,
        idAsignatura: asignaturaSeleccionada
      });
      const lista = (res.success && res.calificaciones) || [];

      if (lista.length === 0) {
        tablaDiv.innerHTML = '<p style="color:#6b7280;">Aún no hay calificaciones finales calculadas para este grupo/asignatura (se requiere calificar todos los periodos).</p>';
        return;
      }

      const periodosMostrados = (res.periodos || periodos);

      const botonGuardar = editable ? '<button id="btnGuardarCF" class="btn btn-primary">Guardar evaluaciones</button>' : '';

      const filas = lista.map(c => {
        const periodosMap = c.periodos || {};
        const celdasPeriodo = periodosMostrados.map(p => {
          const v = periodosMap[String(p.id)];
          const valor = (v !== undefined && v !== '') ? v : '';
          return `<td style="padding:8px 10px; text-align:center;">${valor !== '' ? '<span style="font-weight:600; color:#1f2937;">' + escapeAttr(valor) + '</span>' : '<span style="color:#9ca3af;">—</span>'}</td>`;
        }).join('');

        const final = c.calificacionFinal !== '' && c.calificacionFinal != null ? c.calificacionFinal : '';
        const estado = c.estado || estadoDe(final);
        const evaluacion = c.evaluacion !== '' && c.evaluacion != null ? c.evaluacion : '';
        const definitiva = c.calificacionDefinitiva !== '' && c.calificacionDefinitiva != null ? c.calificacionDefinitiva : '';

        const celdaFinal = final !== ''
          ? `<td style="padding:8px 10px; text-align:center;"><strong style="color:${final < minimaAprobatoria ? '#dc2626' : '#1e3a8a'}; font-size:1.05rem;">${escapeAttr(final)}</strong></td>`
          : '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';

        const celdaEstado = estado ? `<td style="padding:8px 10px; text-align:center;">${badgeEstado(estado)}</td>` : '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';

        let celdaEval = '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';
        if (estado === 'Ordinario' || estado === 'Extraordinario') {
          if (editable) {
            celdaEval = `<td style="padding:8px 10px; text-align:center;"><input type="number" class="input-evaluacion-cf" data-curp="${escapeAttr(c.curp)}" min="0" max="10" step="${paso}" placeholder="0-10" value="${evaluacion !== '' ? escapeAttr(evaluacion) : ''}" style="width:64px; padding:6px 8px; border-radius:6px; border:1px solid #d1d5db; text-align:center;"></td>`;
          } else {
            celdaEval = `<td style="padding:8px 10px; text-align:center;">${evaluacion !== '' ? '<strong>'+escapeAttr(evaluacion)+'</strong>' : '<span style="color:#9ca3af;">—</span>'}</td>`;
          }
        }

        const celdaDef = definitiva !== ''
          ? `<td style="padding:8px 10px; text-align:center;"><strong style="color:${definitiva < minimaAprobatoria ? '#dc2626' : '#1e3a8a'}; font-weight:700;">${escapeAttr(definitiva)}</strong></td>`
          : '<td style="padding:8px 10px; text-align:center;"><span style="color:#9ca3af;">—</span></td>';

        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:8px 10px;">${escapeAttr(c.nombreAlumno)}</td>
          ${celdasPeriodo}
          ${celdaFinal}
          ${celdaEstado}
          ${celdaEval}
          ${celdaDef}
        </tr>`;
      }).join('');

      const headersPeriodo = periodosMostrados.map(p =>
        `<th style="padding:10px; text-align:center; min-width:80px; white-space:nowrap;">${escapeAttr(p.nombre)}</th>`
      ).join('');

      tablaDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <p style="margin:0; color:#4b5563;"><strong>${lista.length}</strong> alumnos · Asignatura · Calificaciones de 0 a 10 (${decimales} decimal${decimales === 1 ? '' : 'es'}).</p>
          ${botonGuardar}
        </div>
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
      `;

      if (editable) {
        document.getElementById('btnGuardarCF').addEventListener('click', guardarEvaluaciones);
      }
    }

    async function guardarEvaluaciones() {
      const evaluaciones = [];
      const inputs = document.querySelectorAll('.input-evaluacion-cf');
      for (const input of inputs) {
        const curp = input.dataset.curp;
        const valor = input.value.trim();
        if (valor === '') continue;
        const num = parseFloat(valor);
        if (isNaN(num) || num < 0 || num > 10) {
          SIREI.utils.mostrarToast('Evaluación inválida. Debe ser 0-10.', 'error');
          return;
        }
        evaluaciones.push({ curp: curp, calificacion: num });
      }
      if (evaluaciones.length === 0) {
        SIREI.utils.mostrarToast('Ingresa al menos una evaluación.', 'warning');
        return;
      }
      const btn = document.getElementById('btnGuardarCF');
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      try {
        const res = await post('guardarEvaluacionesComplementarias', {
          idGrupo: grupoSeleccionado,
          idAsignatura: asignaturaSeleccionada,
          evaluaciones: evaluaciones
        });
        if (res.success) {
          SIREI.utils.mostrarToast(res.message || 'Evaluaciones guardadas.');
        } else {
          SIREI.utils.mostrarToast(res.message || 'Error al guardar evaluaciones', 'error');
        }
      } catch (e) {
        SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar evaluaciones';
        await cargarTabla();
      }
    }

    renderBase();
  } catch (e) {
    console.error('Error en Calificaciones Finales:', e);
    container.innerHTML = '<div class="error">Error: ' + escapeAttr(e.message) + '</div>';
  }
};