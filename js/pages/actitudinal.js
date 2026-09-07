// ============================================================
//  pages/actitudinal.js - Pestaña "Actitudinal" (Administrador)
//  Gestión de actitudes (positivas, neutras, negativas)
// ============================================================

window.cargarActitudinal = async function(container) {
  // === Variables de estado ===
  let todasLasActitudes = [];
  let ordenColumna = 'nombre';
  let ordenDireccion = 'asc';
  let actitudSeleccionadaId = null;

  // === Obtener lista de insignias (opciones) ===
  const insigniasDisponibles = [
    { valor: '🌟', label: 'Estrella' },
    { valor: '💪', label: 'Fuerza' },
    { valor: '🤝', label: 'Colaboración' },
    { valor: '🧠', label: 'Inteligencia' },
    { valor: '💡', label: 'Idea' },
    { valor: '⚡', label: 'Energía' },
    { valor: '🏆', label: 'Trofeo' },
    { valor: '🎯', label: 'Objetivo' },
    { valor: '❤️', label: 'Corazón' },
    { valor: '🌟', label: 'Estrella' },
    { valor: '🌱', label: 'Crecimiento' },
    { valor: '📚', label: 'Libro' }
  ];

  // === Función principal: renderizar lista ===
  const renderizarLista = async () => {
    try {
      // Obtener datos
      let result = SIREI.cache.get('actitudes');
      if (!result) {
        container.innerHTML = SIREI.utils.crearSpinner();
        result = await SIREI.api.peticionAPI('obtenerActitudes');
        if (result.success) SIREI.cache.set('actitudes', result);
      }
      todasLasActitudes = result.success ? result.actitudes : [];

      // Ordenar
      todasLasActitudes.sort((a, b) => {
        const valA = String(a[ordenColumna] || '').toLowerCase();
        const valB = String(b[ordenColumna] || '').toLowerCase();
        return ordenDireccion === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });

      // Construir HTML
      const html = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h2 class="card-title" style="margin-bottom:0;">Gestión de Actitudes</h2>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="nuevaActitudBtn" class="btn-modern btn-primary-modern"><i class="bi bi-plus-circle"></i> Nueva Actitud</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <button id="editarActitudBtn" class="btn-modern btn-warning-modern" disabled><i class="bi bi-pencil"></i> Editar</button>
            <button id="eliminarActitudBtn" class="btn-modern btn-danger-modern" disabled><i class="bi bi-trash"></i> Eliminar</button>
            <span style="margin-left: auto; font-size: 0.85rem; color: #6b7280;" id="seleccionInfoActitud">Ninguna seleccionada</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="actitudes-table" style="width:100%; border-collapse: collapse;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:12px; width:40px;">#</th>
                <th data-columna="nombre" style="padding:12px; cursor:pointer;">Nombre <span class="sort-icon">${ordenColumna==='nombre'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="clasificacion" style="padding:12px; cursor:pointer;">Clasificación <span class="sort-icon">${ordenColumna==='clasificacion'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th style="padding:12px;">Insignia</th>
                <th data-columna="dirigido_a" style="padding:12px; cursor:pointer;">Dirigido a <span class="sort-icon">${ordenColumna==='dirigido_a'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th style="padding:12px;">Descripción</th>
              </tr></thead>
              <tbody>
                ${todasLasActitudes.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding:20px; color:#6b7280;">No hay actitudes registradas.</td></tr>' : ''}
                ${todasLasActitudes.map(act => `
                  <tr class="fila-actitud" data-id="${act.id}" style="cursor:pointer;">
                    <td style="padding:10px; text-align:center;">
                      <input type="radio" name="seleccionActitud" value="${act.id}" class="seleccion-actitud" ${actitudSeleccionadaId === act.id ? 'checked' : ''}>
                    </td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(act.nombre)}</td>
                    <td style="padding:10px;">
                      <span style="padding:4px 10px; border-radius:12px; background:${act.clasificacion === 'positiva' ? '#d1fae5' : act.clasificacion === 'negativa' ? '#fee2e2' : '#fef3c7'}; color:${act.clasificacion === 'positiva' ? '#065f46' : act.clasificacion === 'negativa' ? '#991b1b' : '#92400e'};">
                        ${SIREI.utils.escapeHtml(act.clasificacion)}
                      </span>
                    </td>
                    <td style="padding:10px; font-size:1.5rem; text-align:center;">${act.insignia || '🔲'}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(act.dirigido_a)}</td>
                    <td style="padding:10px;">
                      ${act.descripcion ? `<a href="${act.descripcion}" target="_blank" title="Ver descripción"><i class="bi bi-link-45deg"></i></a>` : '-'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      container.innerHTML = html;

      // === EVENTOS ===
      // Ordenamiento
      document.querySelectorAll('.actitudes-table th[data-columna]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.columna;
          if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
          else { ordenColumna = col; ordenDireccion = 'asc'; }
          renderizarLista();
        });
      });

      // Selección
      const radioButtons = document.querySelectorAll('.seleccion-actitud');
      const editarBtn = document.getElementById('editarActitudBtn');
      const eliminarBtn = document.getElementById('eliminarActitudBtn');
      const seleccionInfo = document.getElementById('seleccionInfoActitud');

      function actualizarEstadoBotones(id) {
        const habilitado = id !== null;
        editarBtn.disabled = !habilitado;
        eliminarBtn.disabled = !habilitado;
        if (id !== null) {
          const act = todasLasActitudes.find(a => a.id == id);
          seleccionInfo.textContent = `Seleccionada: ${act ? act.nombre : ''}`;
        } else {
          seleccionInfo.textContent = 'Ninguna seleccionada';
        }
      }

      document.querySelectorAll('.fila-actitud').forEach(fila => {
        fila.addEventListener('click', function(e) {
          if (e.target.type === 'radio') return;
          const radio = this.querySelector('.seleccion-actitud');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });

      radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
          if (this.checked) {
            actitudSeleccionadaId = parseInt(this.value);
          } else {
            actitudSeleccionadaId = null;
          }
          actualizarEstadoBotones(actitudSeleccionadaId);
        });
      });

      const checkedRadio = document.querySelector('.seleccion-actitud:checked');
      if (checkedRadio) {
        actitudSeleccionadaId = parseInt(checkedRadio.value);
      } else {
        actitudSeleccionadaId = null;
      }
      actualizarEstadoBotones(actitudSeleccionadaId);

      // Botones de acción
      document.getElementById('nuevaActitudBtn').addEventListener('click', () => mostrarFormularioActitud(container));
      editarBtn.addEventListener('click', () => {
        if (actitudSeleccionadaId !== null) {
          const act = todasLasActitudes.find(a => a.id == actitudSeleccionadaId);
          if (act) mostrarFormularioActitud(container, act);
        }
      });
      eliminarBtn.addEventListener('click', async () => {
        if (actitudSeleccionadaId !== null) {
          if (SIREI.utils.confirmar('¿Eliminar esta actitud?')) {
            eliminarBtn.disabled = true;
            eliminarBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
            const res = await SIREI.api.peticionAPI('eliminarActitud', { id: actitudSeleccionadaId });
            if (res.success) {
              SIREI.cache.clear('actitudes');
              actitudSeleccionadaId = null;
              await renderizarLista();
              SIREI.utils.mostrarToast('Actitud eliminada');
            } else {
              SIREI.utils.mostrarToast(res.message, 'error');
              eliminarBtn.disabled = false;
              eliminarBtn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
            }
          }
        }
      });

    } catch (error) {
      console.error('Error en renderizarLista (Actitudes):', error);
      container.innerHTML = `<div class="error">Error al cargar actitudes: ${error.message}</div>`;
    }
  };

  // === Formulario para crear/editar actitud ===
  const mostrarFormularioActitud = (container, actitudExistente = null) => {
    const esEdicion = actitudExistente !== null;
    const datos = actitudExistente || { nombre: '', clasificacion: '', descripcion: '', insignia: '🌟', dirigido_a: '' };

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">${esEdicion ? 'Editar' : 'Nueva'} Actitud</h2>
        <form id="formActitud" class="form-grid">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" id="nombreActitud" value="${SIREI.utils.escapeHtml(datos.nombre)}" required>
          </div>
          <div class="form-group">
            <label>Clasificación *</label>
            <select id="clasificacionActitud" required>
              <option value="">Seleccionar...</option>
              <option value="positiva" ${datos.clasificacion === 'positiva' ? 'selected' : ''}>Positiva</option>
              <option value="neutra" ${datos.clasificacion === 'neutra' ? 'selected' : ''}>Neutra</option>
              <option value="negativa" ${datos.clasificacion === 'negativa' ? 'selected' : ''}>Negativa</option>
            </select>
          </div>
          <div class="form-group">
            <label>Insignia (simbólica)</label>
            <select id="insigniaActitud">
              ${insigniasDisponibles.map(ins => `
                <option value="${ins.valor}" ${datos.insignia === ins.valor ? 'selected' : ''}>${ins.valor} ${ins.label}</option>
              `).join('')}
            </select>
            <div style="margin-top:8px; font-size:1.8rem;">Vista previa: <span id="previewInsignia">${datos.insignia || '🌟'}</span></div>
          </div>
          <div class="form-group">
            <label>Dirigido a *</label>
            <select id="dirigidoActitud" required>
              <option value="">Seleccionar...</option>
              <option value="alumnos" ${datos.dirigido_a === 'alumnos' ? 'selected' : ''}>Alumnos</option>
              <option value="maestros" ${datos.dirigido_a === 'maestros' ? 'selected' : ''}>Maestros</option>
              <option value="personal_administrativo" ${datos.dirigido_a === 'personal_administrativo' ? 'selected' : ''}>Personal Administrativo</option>
            </select>
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>Link de descripción (Drive)</label>
            <input type="url" id="descripcionActitud" value="${SIREI.utils.escapeHtml(datos.descripcion)}" placeholder="https://drive.google.com/...">
            <p style="font-size:0.8rem; color:#6b7280;">Pega el enlace de un documento de Google Drive que explique la actitud.</p>
          </div>
          <div class="form-buttons" style="grid-column: 1 / -1;">
            <button type="submit" class="btn btn-primary">${esEdicion ? 'Actualizar' : 'Guardar'}</button>
            <button type="button" id="cancelarActitudBtn" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    // Previsualización de insignia
    const selectInsignia = document.getElementById('insigniaActitud');
    const previewSpan = document.getElementById('previewInsignia');
    selectInsignia.addEventListener('change', () => {
      previewSpan.textContent = selectInsignia.value;
    });

    // Envío del formulario
    const form = document.getElementById('formActitud');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('nombreActitud').value.trim();
      const clasificacion = document.getElementById('clasificacionActitud').value;
      const insignia = document.getElementById('insigniaActitud').value;
      const dirigido_a = document.getElementById('dirigidoActitud').value;
      const descripcion = document.getElementById('descripcionActitud').value.trim();

      if (!nombre) {
        SIREI.utils.mostrarToast('El nombre es obligatorio.', 'error');
        return;
      }
      if (!clasificacion) {
        SIREI.utils.mostrarToast('Selecciona una clasificación.', 'error');
        return;
      }
      if (!dirigido_a) {
        SIREI.utils.mostrarToast('Selecciona a quién va dirigido.', 'error');
        return;
      }

      const datosActitud = { nombre, clasificacion, insignia, dirigido_a, descripcion };
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Guardando...';

      try {
        let res;
        if (esEdicion) {
          res = await SIREI.api.peticionAPI('actualizarActitud', { id: actitudExistente.id, ...datosActitud });
        } else {
          res = await SIREI.api.peticionAPI('agregarActitud', datosActitud);
        }
        if (res.success) {
          SIREI.utils.mostrarToast(esEdicion ? 'Actitud actualizada' : 'Actitud creada');
          SIREI.cache.clear('actitudes');
          await renderizarLista();
        } else {
          SIREI.utils.mostrarToast(res.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = esEdicion ? 'Actualizar' : 'Guardar';
        }
      } catch (err) {
        SIREI.utils.mostrarToast('Error de conexión: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = esEdicion ? 'Actualizar' : 'Guardar';
      }
    });

    document.getElementById('cancelarActitudBtn').addEventListener('click', renderizarLista);
  };

  // === Iniciar ===
  await renderizarLista();
};