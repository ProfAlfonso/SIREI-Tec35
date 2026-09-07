window.cargarPeriodos = async function(container) {
  let todosLosPeriodos = [];
  console.log('[periodos.js v5]');

  function formatearFecha(fechaStr) {
    return SIREI.utils.formatearFechaLocal(fechaStr);
  }

  function fechaADia(str) {
    if (!str) return null;
    const s = String(str);
    const p = s.split('-');
    if (p.length === 3 && !isNaN(Number(p[0])) && !isNaN(Number(p[1])) && !isNaN(Number(p[2]))) {
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return null;
  }

  // Calcula el estado de un periodo a partir de sus fechas (independiente del backend).
  function estadoPeriodo(p) {
    const hoy = new Date();
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dIni = fechaADia(p.fechaInicio);
    const dFin = fechaADia(p.fechaFin);
    const dEval = fechaADia(p.fechaInicioEvaluacion);
    const evaluacionIniciada = !!dEval && hoyMid >= dEval;
    const enVentana = !!dEval && !!dFin && hoyMid >= dEval && hoyMid <= dFin;
    const ventanaFinalizada = !!dFin && hoyMid > dFin;
    const activo = !!dIni && !!dFin && hoyMid >= dIni && hoyMid <= dFin;
    let evaluacionAbierta = p.evaluacionAbierta;
    if (typeof evaluacionAbierta !== 'boolean') {
      if (String(p.evaluacionAbierta).toUpperCase() === 'TRUE' || String(p.evaluacionAbierta) === '1' || String(p.evaluacionAbierta).toUpperCase() === 'ON') {
        evaluacionAbierta = true;
      } else if (String(p.evaluacionAbierta).toUpperCase() === 'FALSE' || String(p.evaluacionAbierta) === '0' || String(p.evaluacionAbierta).toUpperCase() === 'OFF') {
        evaluacionAbierta = false;
      } else {
        evaluacionAbierta = evaluacionIniciada;
      }
    }
    return { evaluacionIniciada: evaluacionIniciada, enVentana: enVentana, ventanaFinalizada: ventanaFinalizada, activo: activo, evaluacionAbierta: evaluacionAbierta };
  }

  function ventanaBadge(p) {
    if (!p.evaluacionIniciada) {
      return '<span style="padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600; background:#f3f4f6; color:#6b7280;">No iniciada</span>';
    }
    if (p.enVentana) {
      return '<span style="padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600; background:#dbeafe; color:#1e40af;">En curso</span>';
    }
    return '<span style="padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600; background:#fef3c7; color:#92400e;">Concluida</span>';
  }

  function interruptorHtml(p, est) {
    const deshabilitado = !est.evaluacionIniciada;
    const titulo = deshabilitado
      ? 'Este interruptor se activará cuando inicie la ventana de evaluación (' + formatearFecha(p.fechaInicioEvaluacion) + ')'
      : 'Abrir la evaluación de este periodo para que los docentes puedan calificarlo';
    const checked = est.evaluacionAbierta ? ' checked' : '';
    const disabled = deshabilitado ? ' disabled' : '';
    const opacity = deshabilitado ? '; opacity:0.4' : '';
    return `
      <label title="${titulo}" style="position:relative; display:inline-block; width:40px; height:22px; cursor:${deshabilitado ? 'not-allowed' : 'pointer'}; vertical-align:middle;${opacity}">
        <input type="checkbox" class="chk-apertura-evaluacion" data-id="${p.id}"${checked}${disabled} style="opacity:0; width:0; height:0;">
        <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:${est.evaluacionAbierta ? '#10b981' : '#d1d5db'}; transition:0.3s; border-radius:22px;"></span>
        <span style="position:absolute; height:18px; width:18px; left:${est.evaluacionAbierta ? '20px' : '2px'}; top:2px; background:white; transition:0.3s; border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>
      </label>`;
  }

  async function renderizar() {
    try {
      const result = await SIREI.api.peticionAPI('obtenerPeriodos');
      if (!result.success) throw new Error(result.message || 'Error al obtener periodos');
      todosLosPeriodos = result.periodos || [];
      window.__sireiSheetId = result.sheetId;
      window.__sireiPeriodosVersion = result.backendPeriodosVersion;
      console.log('[periodos.js v5] obtenerPeriodos:', todosLosPeriodos);
      const cfg = await SIREI.api.peticionAPI('obtenerConfiguracionPeriodos');
      console.log('[periodos.js v5] obtenerConfiguracionPeriodos:', cfg);
      window.__sireiBackendVersion = cfg && cfg.datos ? cfg.datos.backendVersion : (cfg ? cfg.backendVersion : undefined);
    } catch (e) {
      console.error('Error en periodos:', e);
      container.innerHTML = `<div class="error">Error al cargar periodos: ${e.message}</div>`;
      return;
    }

    const filas = todosLosPeriodos.map(p => {
      const est = estadoPeriodo(p);
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px;">${SIREI.utils.escapeHtml(p.nombre)}</td>
          <td style="padding:10px;">${formatearFecha(p.fechaInicio)}</td>
          <td style="padding:10px;">${formatearFecha(p.fechaFin)}</td>
          <td style="padding:10px;">${p.fechaInicioEvaluacion ? formatearFecha(p.fechaInicioEvaluacion) : '<span style="color:#9ca3af;">No definida</span>'}</td>
          <td style="padding:10px; text-align:center;">
            <span style="padding:4px 10px; border-radius:20px; font-size:0.8rem; font-weight:600; ${est.activo ? 'background:#dcfce7; color:#166534;' : 'background:#f3f4f6; color:#6b7280;'}">${est.activo ? 'Activo' : 'Inactivo'}</span>
          </td>
          <td style="padding:10px; text-align:center;">${ventanaBadge(est)}</td>
          <td style="padding:10px; text-align:center;">
            ${interruptorHtml(p, est)}
          </td>
          <td style="padding:10px; text-align:center; white-space:nowrap;">
            <button class="btn-editar-periodo btn btn-secondary" data-id="${p.id}" style="padding:4px 10px; font-size:0.8rem;">Editar</button>
            <button class="btn-eliminar-periodo btn btn-danger" data-id="${p.id}" style="padding:4px 10px; font-size:0.8rem;">Eliminar</button>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <h2 class="card-title" style="margin-bottom:0;">Periodos de Evaluación</h2>
          <div style="display:flex; gap:8px;">
            <button id="btnAgregarPeriodo" class="btn btn-primary">+ Agregar Periodo</button>
          </div>
        </div>
        <div class="card-body">
          <p style="margin:0 0 16px 0; color:#6b7280; font-size:0.9rem;">
            El estado del periodo se calcula con sus fechas (no pueden solaparse dos periodos). El interruptor de cada periodo se desbloquea cuando inicia su ventana de evaluación y, al activarlo, los docentes pueden calificar ese periodo.
          </p>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px; text-align:left;">Nombre</th>
                <th style="padding:10px; text-align:left;">Inicio</th>
                <th style="padding:10px; text-align:left;">Fin</th>
                <th style="padding:10px; text-align:left;">Inicio Evaluación</th>
                <th style="padding:10px; text-align:center;">Estado</th>
                <th style="padding:10px; text-align:center;">Ventana Evaluación</th>
                <th style="padding:10px; text-align:center;">Abrir evaluación</th>
                <th style="padding:10px; text-align:center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${todosLosPeriodos.length === 0 ? '<tr><td colspan="8" style="padding:20px; text-align:center; color:#6b7280;">No hay periodos registrados.</td></tr>' : filas}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('btnAgregarPeriodo').addEventListener('click', () => mostrarFormulario(null));
    document.querySelectorAll('.btn-editar-periodo').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = todosLosPeriodos.find(x => String(x.id) === String(btn.dataset.id));
        if (p) mostrarFormulario(p);
      });
    });
    document.querySelectorAll('.btn-eliminar-periodo').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!SIREI.utils.confirmar('Eliminar este periodo? Las calificaciones guardadas en CalificacionesParciales se conservarán.')) return;
        const res = await SIREI.api.peticionAPI('eliminarPeriodo', { id: btn.dataset.id });
        if (res.success) {
          SIREI.utils.mostrarToast('Periodo eliminado.');
          renderizar();
        } else {
          SIREI.utils.mostrarToast(res.message || 'Error al eliminar', 'error');
        }
      });
    });
    document.querySelectorAll('.chk-apertura-evaluacion').forEach(chk => {
      chk.addEventListener('change', async () => {
        if (chk.disabled) return;
        chk.disabled = true;
        const res = await SIREI.api.peticionAPI('cambiarEstadoEvaluacionPeriodo', { id: chk.dataset.id, abierta: chk.checked });
        chk.disabled = false;
        console.log('[periodos.js v5] cambiarEstadoEvaluacionPeriodo:', res, 'enviado abierta=', chk.checked);
        if (res.success) {
          if (typeof res.evaluacionAbierta === 'boolean') {
            const p = todosLosPeriodos.find(x => String(x.id) === String(chk.dataset.id));
            if (p) p.evaluacionAbierta = res.evaluacionAbierta;
          }
          SIREI.utils.mostrarToast(res.message || 'Estado actualizado.');
        } else {
          SIREI.utils.mostrarToast(res.message || 'Error al actualizar', 'error');
        }
        await renderizar();
      });
    });
  }

  function mostrarFormulario(periodo) {
    const esEdicion = !!periodo;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:1000;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:white; padding:24px; border-radius:16px; max-width:480px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    modal.innerHTML = `
      <h3 style="margin-top:0;">${esEdicion ? 'Editar Periodo' : 'Nuevo Periodo'}</h3>
      <form id="formPeriodo">
        <div class="form-group">
          <label>Nombre del periodo *</label>
          <input type="text" id="periodoNombre" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;" placeholder="Ej: Trimestre 1, Primer Bimestre" value="${esEdicion ? SIREI.utils.escapeHtml(periodo.nombre || '') : ''}">
        </div>
        <div class="form-group">
          <label>Fecha de inicio *</label>
          <input type="date" id="periodoInicio" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;" value="${esEdicion ? (periodo.fechaInicio || '') : ''}">
        </div>
        <div class="form-group">
          <label>Fecha de fin *</label>
          <input type="date" id="periodoFin" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;" value="${esEdicion ? (periodo.fechaFin || '') : ''}">
        </div>
        <div class="form-group">
          <label>Fecha de inicio del periodo de evaluación *</label>
          <input type="date" id="periodoInicioEvaluacion" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;" value="${esEdicion ? (periodo.fechaInicioEvaluacion || '') : ''}">
          <small style="color:#6b7280;">Ventana en la que los docentes pueden registrar calificaciones (desde este día hasta la fecha de fin). El interruptor se activará automáticamente al iniciar la ventana.</small>
        </div>
        <div style="display:flex; gap:10px; margin-top:16px;">
          <button type="submit" class="btn btn-primary" style="flex:1;">${esEdicion ? 'Guardar cambios' : 'Guardar'}</button>
          <button type="button" id="btnCancelarPeriodo" class="btn btn-secondary" style="flex:1;">Cancelar</button>
        </div>
      </form>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('btnCancelarPeriodo').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('formPeriodo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('periodoNombre').value.trim();
      const fechaInicio = document.getElementById('periodoInicio').value;
      const fechaFin = document.getElementById('periodoFin').value;
      const fechaInicioEvaluacion = document.getElementById('periodoInicioEvaluacion').value;
      if (!nombre || !fechaInicio || !fechaFin || !fechaInicioEvaluacion) {
        SIREI.utils.mostrarToast('Todos los campos son obligatorios.', 'error');
        return;
      }
      if (fechaInicio > fechaFin) {
        SIREI.utils.mostrarToast('La fecha de fin debe ser posterior a la de inicio.', 'error');
        return;
      }
      if (fechaInicioEvaluacion < fechaInicio || fechaInicioEvaluacion > fechaFin) {
        SIREI.utils.mostrarToast('La fecha de inicio de evaluación debe estar entre el inicio y el fin.', 'error');
        return;
      }
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Guardando...';
      const accion = esEdicion ? 'actualizarPeriodo' : 'agregarPeriodo';
      const payload = { nombre, fechaInicio, fechaFin, fechaInicioEvaluacion };
      if (esEdicion) payload.id = periodo.id;
      const res = await SIREI.api.peticionAPI(accion, payload);
      if (res.success) {
        SIREI.utils.mostrarToast(esEdicion ? 'Periodo actualizado.' : 'Periodo creado.');
        overlay.remove();
        renderizar();
      } else {
        SIREI.utils.mostrarToast(res.message || 'Error al guardar', 'error');
        btn.disabled = false;
        btn.textContent = esEdicion ? 'Guardar cambios' : 'Guardar';
      }
    });
  }

  await renderizar();
};
