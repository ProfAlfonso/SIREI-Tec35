// ============================================================
//  pages/docentes.js - Pestaña "Docentes"
//  Contiene toda la lógica de gestión de docentes.
// ============================================================

// ====== Variables de estado (locales a esta página) ======
let todosLosDocentes = [];
let ordenColumna = 'nombre';
let ordenDireccion = 'asc';
let docenteSeleccionadoId = null;

// ====== Función principal ======
window.cargarDocentes = async function(container) {
  // Delegamos la renderización a la función que maneja la lista
  await renderizarLista(container);
};

// ====== Renderiza la lista de docentes ======
async function renderizarLista(container) {
  if (!container) return;

  try {
    // Recuperar el término de búsqueda actual antes de reemplazar el DOM
    const currentSearchInput = document.getElementById('searchDocentes');
    const currentSearchTerm = currentSearchInput ? currentSearchInput.value : '';

    let result = SIREI.cache.get('docentes');
    if (!result) {
      container.innerHTML = SIREI.utils.crearSpinner();
      result = await SIREI.api.obtenerDocentes();
      if (result.success) SIREI.cache.set('docentes', result);
    }
    
    todosLosDocentes = result.success ? result.docentes : [];
    
    // Filtro de búsqueda usando el término guardado
    const searchTerm = currentSearchTerm.toLowerCase();
    let docentesFiltrados = todosLosDocentes.filter(d => (d.nombre || '').toLowerCase().includes(searchTerm));

    docentesFiltrados.sort((a, b) => {
      return ordenDireccion === 'asc'
        ? String(a[ordenColumna] || '').localeCompare(String(b[ordenColumna] || ''))
        : String(b[ordenColumna] || '').localeCompare(String(a[ordenColumna] || ''));
    });

    // Construir HTML
    const html = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <h2 class="card-title" style="margin-bottom:0;">Personal Docente y Administrativo</h2>
          <div style="flex: 1; min-width: 200px; max-width: 300px; margin: 0 10px;">
            <input type="text" id="searchDocentes" placeholder="Buscar por nombre..." style="width: 100%; padding: 8px 12px; border-radius: 20px; border: 1px solid #d1d5db;" value="${SIREI.utils.escapeHtml(currentSearchTerm)}">
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="nuevoDocenteBtn" class="btn-modern btn-primary-modern"><i class="bi bi-plus-circle"></i> Nuevo</button>
            <button id="importarDocentesBtn" class="btn-modern btn-secondary-modern"><i class="bi bi-upload"></i> Importar</button>
            <button id="exportarDocentesBtn" class="btn-modern btn-success-modern"><i class="bi bi-download"></i> Exportar CSV</button>
          </div>
        </div>

        <!-- Barra de acciones -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <button id="verDocenteBtn" class="btn-modern btn-info-modern" disabled><i class="bi bi-eye"></i> Ver</button>
          <button id="editarCarrerasBtn" class="btn-modern btn-warning-modern" disabled><i class="bi bi-book"></i> Carreras</button>
          <button id="eliminarDocenteBtn" class="btn-modern btn-danger-modern" disabled><i class="bi bi-trash"></i> Eliminar</button>
          <button id="imprimirDocenteBtn" class="btn-modern btn-dark-modern" disabled><i class="bi bi-printer"></i> Imprimir</button>
          <span style="margin-left: auto; font-size: 0.85rem; color: #6b7280;" id="seleccionInfoDocente">Ninguno seleccionado</span>
        </div>

        <div style="overflow-x:auto;">
          <table class="docentes-table" style="width:100%; border-collapse: collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:12px; width:40px;">#</th>
                <th data-columna="nombre" style="padding:12px; cursor:pointer;">Nombre <span class="sort-icon">${ordenColumna==='nombre'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="emailPersonal" style="padding:12px; cursor:pointer;">Email <span class="sort-icon">${ordenColumna==='emailPersonal'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="celular" style="padding:12px; cursor:pointer;">Celular <span class="sort-icon">${ordenColumna==='celular'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
              </tr>
            </thead>
            <tbody>
              ${docentesFiltrados.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:#6b7280;">No se encontraron docentes.</td></tr>' : ''}
              ${docentesFiltrados.map(doc => `
                <tr class="fila-docente" data-id="${doc.id}" style="cursor:pointer;">
                  <td style="padding:10px; text-align:center;">
                    <input type="radio" name="seleccionDocente" value="${doc.id}" class="seleccion-docente" ${docenteSeleccionadoId === doc.id ? 'checked' : ''}>
                  </td>
                  <td style="padding:10px;">${SIREI.utils.escapeHtml(doc.nombre)}</td>
                  <td class="email-cell" data-email="${SIREI.utils.escapeHtml(doc.emailPersonal)}" style="padding:10px;"></td>
                  <td style="padding:10px;">${SIREI.utils.escapeHtml(doc.celular)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = html;

    // Mostrar correos como texto plano
    document.querySelectorAll('.email-cell').forEach(cell => {
      const emailOriginal = cell.getAttribute('data-email');
      if (emailOriginal) cell.textContent = emailOriginal;
    });

    // ====== EVENTOS ======

    // Ordenamiento de columnas
    document.querySelectorAll('.docentes-table th[data-columna]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.columna;
        if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
        else { ordenColumna = col; ordenDireccion = 'asc'; }
        renderizarLista(container);
      });
    });

    // Búsqueda
    const searchInputEl = document.getElementById('searchDocentes');
    if (searchInputEl) {
      searchInputEl.focus();
      // Colocar el cursor al final
      const val = searchInputEl.value;
      searchInputEl.value = '';
      searchInputEl.value = val;
      searchInputEl.addEventListener('input', () => {
        renderizarLista(container);
      });
    }

    // Botones globales
    document.getElementById('exportarDocentesBtn')?.addEventListener('click', () => {
      if (typeof exportarDocentesCSV === 'function') {
        exportarDocentesCSV(docentesFiltrados);
      } else {
        SIREI.utils.mostrarToast('Función de exportación no disponible', 'error');
      }
    });
    document.getElementById('nuevoDocenteBtn')?.addEventListener('click', () => mostrarFormularioPersonal(container));
    document.getElementById('importarDocentesBtn')?.addEventListener('click', () => mostrarImportador(container));

    // Selección
    const radioButtons = document.querySelectorAll('.seleccion-docente');
    const verBtn = document.getElementById('verDocenteBtn');
    const editarCarrerasBtn = document.getElementById('editarCarrerasBtn');
    const eliminarBtn = document.getElementById('eliminarDocenteBtn');
    const imprimirBtn = document.getElementById('imprimirDocenteBtn');
    const seleccionInfo = document.getElementById('seleccionInfoDocente');

    function actualizarEstadoBotones(idSeleccionado) {
      const habilitado = idSeleccionado !== null;
      verBtn.disabled = !habilitado;
      editarCarrerasBtn.disabled = !habilitado;
      eliminarBtn.disabled = !habilitado;
      imprimirBtn.disabled = !habilitado;
      if (idSeleccionado) {
        const docente = todosLosDocentes.find(d => d.id == idSeleccionado);
        seleccionInfo.textContent = `Seleccionado: ${docente ? docente.nombre : ''}`;
      } else {
        seleccionInfo.textContent = 'Ninguno seleccionado';
      }
    }

    // Clic en fila selecciona el radio
    document.querySelectorAll('.fila-docente').forEach(fila => {
      fila.addEventListener('click', function(e) {
        if (e.target.type === 'radio') return;
        const radio = this.querySelector('.seleccion-docente');
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      });
    });

    radioButtons.forEach(radio => {
      radio.addEventListener('change', function() {
        if (this.checked) {
          docenteSeleccionadoId = parseInt(this.value);
        } else {
          docenteSeleccionadoId = null;
        }
        actualizarEstadoBotones(docenteSeleccionadoId);
      });
    });

    // Inicializar estado
    const checkedRadio = document.querySelector('.seleccion-docente:checked');
    if (checkedRadio) {
      docenteSeleccionadoId = parseInt(checkedRadio.value);
    } else {
      docenteSeleccionadoId = null;
    }
    actualizarEstadoBotones(docenteSeleccionadoId);

    // Acciones
    verBtn.addEventListener('click', () => {
      if (docenteSeleccionadoId !== null) {
        const docente = todosLosDocentes.find(d => d.id == docenteSeleccionadoId);
        if (docente) mostrarFormularioPersonal(container, docente);
      }
    });

    editarCarrerasBtn.addEventListener('click', () => {
      if (docenteSeleccionadoId !== null) {
        const docente = todosLosDocentes.find(d => d.id == docenteSeleccionadoId);
        if (docente) mostrarFormularioCarreras(container, docente);
      }
    });

    eliminarBtn.addEventListener('click', async () => {
      if (docenteSeleccionadoId !== null) {
        if (SIREI.utils.confirmar('¿Estás seguro de eliminar este docente? Esta acción no se puede deshacer.')) {
          eliminarBtn.disabled = true;
          eliminarBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Eliminando...';
          const res = await SIREI.api.eliminarDocente(docenteSeleccionadoId);
          if (res.success) {
            docenteSeleccionadoId = null;
            SIREI.cache.clear('docentes'); // Invalidar caché
            await renderizarLista(container);
            SIREI.utils.mostrarToast('Docente eliminado correctamente');
          } else {
            SIREI.utils.mostrarToast(res.message || 'Error al eliminar', 'error');
            eliminarBtn.disabled = false;
            eliminarBtn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
          }
        }
      }
    });

    imprimirBtn.addEventListener('click', async () => {
      if (docenteSeleccionadoId !== null) {
        const docente = todosLosDocentes.find(d => d.id == docenteSeleccionadoId);
        if (docente) {
          imprimirBtn.disabled = true;
          imprimirBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';
          try {
            const config = await SIREI.api.obtenerConfiguracion();
            const logoUrl = config.logoUrl || '';
            imprimirDocenteModerno(docente, logoUrl);
          } catch (e) {
            SIREI.utils.mostrarToast('Error al cargar el logo', 'error');
            imprimirDocenteModerno(docente, '');
          } finally {
            setTimeout(() => {
              imprimirBtn.disabled = false;
              imprimirBtn.innerHTML = '<i class="bi bi-printer"></i> Imprimir';
            }, 1000);
          }
        }
      }
    });

  } catch (error) {
    console.error('Error en renderizarLista:', error);
    container.innerHTML = `<div class="error">Error al cargar docentes: ${error.message}</div>`;
  }
}

// ====== FORMULARIO PERSONAL ======
async function mostrarFormularioPersonal(container, docenteExistente = null) {
  const esEdicion = docenteExistente !== null;
  const datos = docenteExistente || { nombre: '', fechaNac: '', domicilio: '', celular: '', whatsapp: '', emailPersonal: '', emailInstitucional: '', fotoUrl: '' };

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">${esEdicion ? 'Editar datos personales' : 'Nuevo docente'}</h2>
      <form id="personalForm" autocomplete="off" class="form-grid">
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="nombre" value="${SIREI.utils.escapeHtml(datos.nombre)}" required></div>
        <div class="form-group"><label>Fecha nacimiento</label><input type="date" id="fechaNac" value="${SIREI.utils.formatearFechaParaInput(datos.fechaNac)}"></div>
        <div class="form-group"><label>Edad</label><input type="text" id="edad" readonly disabled></div>
        <div class="form-group"><label>Domicilio</label><input type="text" id="domicilio" value="${SIREI.utils.escapeHtml(datos.domicilio)}"></div>
        <div class="form-group"><label>Celular (10 dígitos)</label><input type="tel" id="celular" pattern="[0-9]{10}" maxlength="10" value="${SIREI.utils.escapeHtml(datos.celular)}"></div>
        <div class="form-group"><label>Whatsapp (10 dígitos)</label><input type="tel" id="whatsapp" pattern="[0-9]{10}" maxlength="10" value="${SIREI.utils.escapeHtml(datos.whatsapp)}"></div>
        <div class="form-group"><label>Email personal</label><input type="email" id="emailPersonal" value="${SIREI.utils.escapeHtml(datos.emailPersonal)}"></div>
        <div class="form-group"><label>Email institucional</label><input type="email" id="emailInstitucional" value="${SIREI.utils.escapeHtml(datos.emailInstitucional)}"></div>
        <div class="form-group"><label>URL de foto (Drive)</label><input type="url" id="fotoUrl" value="${SIREI.utils.escapeHtml(datos.fotoUrl)}"></div>
        <div id="fotoPreview" style="margin-bottom:16px;"></div>
        <div class="form-buttons">
          <button type="submit" class="btn btn-primary">${esEdicion ? 'Actualizar' : 'Guardar'}</button>
          <button type="button" id="cancelPersonalBtn" class="btn btn-secondary">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  // Previsualización de foto
  const fotoUrlInput = document.getElementById('fotoUrl');
  const fotoPreviewDiv = document.getElementById('fotoPreview');
  const actualizarPreview = () => {
    const url = fotoUrlInput?.value.trim();
    if (!url) {
      if (fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#6b7280;">Sin foto</p>';
      return;
    }
    if (fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#6b7280;">Cargando imagen...</p>';
    const img = new Image();
    img.style.maxWidth = '120px';
    img.style.borderRadius = '8px';
    img.onload = () => {
      if (fotoPreviewDiv) fotoPreviewDiv.innerHTML = '';
      fotoPreviewDiv?.appendChild(img);
    };
    img.onerror = () => {
      if (fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#ef4444;">No se pudo cargar la imagen</p>';
    };
    img.src = SIREI.utils.obtenerUrlImagenDrive(url);
  };
  if (fotoUrlInput) fotoUrlInput.addEventListener('input', actualizarPreview);
  actualizarPreview();

  // Calcular edad automática
  const fechaInput = document.getElementById('fechaNac');
  const edadInput = document.getElementById('edad');
  const calcularEdad = () => {
    if (fechaInput?.value) {
      const nac = new Date(fechaInput.value);
      const hoy = new Date();
      let edad = hoy.getFullYear() - nac.getFullYear();
      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
      if (edadInput) edadInput.value = edad;
    } else if (edadInput) edadInput.value = '';
  };
  fechaInput?.addEventListener('change', calcularEdad);
  calcularEdad();

  // Envío del formulario
  const form = document.getElementById('personalForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    let isValid = true;
    const nombre = document.getElementById('nombre').value.trim();
    if (!nombre) { SIREI.utils.resaltarError('nombre'); isValid = false; }
    const celular = document.getElementById('celular').value.trim();
    if (celular && !/^\d{10}$/.test(celular)) { SIREI.utils.resaltarError('celular'); isValid = false; }
    const whatsapp = document.getElementById('whatsapp').value.trim();
    if (whatsapp && !/^\d{10}$/.test(whatsapp)) { SIREI.utils.resaltarError('whatsapp'); isValid = false; }
    const emailPersonal = document.getElementById('emailPersonal').value.trim();
    if (emailPersonal && !emailPersonal.includes('@')) { SIREI.utils.resaltarError('emailPersonal'); isValid = false; }
    const emailInstitucional = document.getElementById('emailInstitucional').value.trim();
    if (emailInstitucional && !emailInstitucional.includes('@')) { SIREI.utils.resaltarError('emailInstitucional'); isValid = false; }
    if (!isValid) { SIREI.utils.mostrarToast('Corrige los campos resaltados', 'error'); return; }

    const datosDocente = {
      nombre,
      fechaNac: document.getElementById('fechaNac').value,
      domicilio: document.getElementById('domicilio').value,
      celular,
      whatsapp,
      emailPersonal,
      emailInstitucional,
      fotoUrl: document.getElementById('fotoUrl').value,
      carreras: esEdicion ? docenteExistente.carreras : []
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando...';

    try {
      let res;
      if (esEdicion) {
        res = await SIREI.api.actualizarDocente(docenteExistente.id, datosDocente);
      } else {
        res = await SIREI.api.agregarDocente(datosDocente);
      }
      if (res.success) {
        SIREI.utils.mostrarToast(esEdicion ? 'Datos actualizados' : 'Docente agregado');
        SIREI.cache.clear('docentes'); // Invalidar caché
        await renderizarLista(container);
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

  document.getElementById('cancelPersonalBtn')?.addEventListener('click', () => renderizarLista(container));
}

// ====== FORMULARIO DE CARRERAS ======
async function mostrarFormularioCarreras(container, docente) {
  let carreras = [...(docente.carreras || [])];

  const renderCarreras = () => {
    const div = document.getElementById('carrerasContainer');
    div.innerHTML = carreras.map((c, idx) => `
      <div class="carrera-item" data-index="${idx}">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
          <div class="form-group" style="flex:2;">
            <label>Nivel</label>
            <select class="carrera-nivel" data-idx="${idx}">
              <option value="Licenciatura" ${c.nivel === 'Licenciatura' ? 'selected' : ''}>Licenciatura</option>
              <option value="Especialidad" ${c.nivel === 'Especialidad' ? 'selected' : ''}>Especialidad</option>
              <option value="Maestría" ${c.nivel === 'Maestría' ? 'selected' : ''}>Maestría</option>
              <option value="Doctorado" ${c.nivel === 'Doctorado' ? 'selected' : ''}>Doctorado</option>
            </select>
          </div>
          <div class="form-group" style="flex:3;">
            <label>Nombre carrera</label>
            <input type="text" class="carrera-nombre" value="${SIREI.utils.escapeHtml(c.carrera)}" data-idx="${idx}">
          </div>
          <div class="form-group" style="flex:3;">
            <label>Institución</label>
            <input type="text" class="carrera-institucion" value="${SIREI.utils.escapeHtml(c.institucion)}" data-idx="${idx}">
          </div>
          <div class="form-group" style="flex:1;">
            <label>Año término</label>
            <input type="number" class="carrera-anio" value="${c.anioTermino || ''}" data-idx="${idx}">
          </div>
          <div class="form-group" style="flex:2;">
            <label>Estado</label>
            <div style="display:flex; gap:12px;">
              <label><input type="radio" name="estado_${idx}" class="radio-titulado" ${c.titulado ? 'checked' : ''} data-idx="${idx}"> Titulado</label>
              <label><input type="radio" name="estado_${idx}" class="radio-trunco" ${c.trunco ? 'checked' : ''} data-idx="${idx}"> Trunco</label>
            </div>
          </div>
          <button type="button" class="eliminar-carrera-btn btn-danger" data-idx="${idx}">🗑️</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.eliminar-carrera-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        carreras.splice(parseInt(btn.dataset.idx), 1);
        renderCarreras();
      });
    });

    // Sincronizar cambios en inputs
    const sincronizar = () => {
      const items = document.querySelectorAll('.carrera-item');
      carreras = [];
      items.forEach(item => {
        const nivel = item.querySelector('.carrera-nivel').value;
        const nombre = item.querySelector('.carrera-nombre').value;
        if (!nombre.trim()) return;
        carreras.push({
          nivel,
          carrera: nombre,
          institucion: item.querySelector('.carrera-institucion').value,
          anioTermino: item.querySelector('.carrera-anio').value,
          titulado: item.querySelector('.radio-titulado').checked,
          trunco: item.querySelector('.radio-trunco').checked
        });
      });
    };
    document.querySelectorAll('.carrera-nivel, .carrera-nombre, .carrera-institucion, .carrera-anio, .radio-titulado, .radio-trunco')
      .forEach(el => {
        el.addEventListener('change', sincronizar);
        el.addEventListener('input', sincronizar);
      });
  };

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Editar carreras de: ${SIREI.utils.escapeHtml(docente.nombre)}</h2>
      <div id="carrerasContainer"></div>
      <button id="agregarCarreraBtn" class="btn-secondary" style="margin:16px 0;">+ Agregar carrera</button>
      <div class="form-buttons">
        <button id="guardarCarrerasBtn" class="btn btn-primary">Guardar carreras</button>
        <button id="cancelCarrerasBtn" class="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  `;

  renderCarreras();

  document.getElementById('agregarCarreraBtn').addEventListener('click', () => {
    if (carreras.length >= SIREI.MAX_CARRERAS) {
      SIREI.utils.mostrarToast(`Máximo ${SIREI.MAX_CARRERAS} carreras`, 'error');
      return;
    }
    carreras.push({ nivel: 'Licenciatura', carrera: '', institucion: '', anioTermino: '', titulado: false, trunco: false });
    renderCarreras();
  });

  document.getElementById('guardarCarrerasBtn').addEventListener('click', async () => {
    const items = document.querySelectorAll('.carrera-item');
    const nuevas = [];
    for (let item of items) {
      const nombre = item.querySelector('.carrera-nombre').value.trim();
      if (!nombre) continue;
      nuevas.push({
        nivel: item.querySelector('.carrera-nivel').value,
        carrera: nombre,
        institucion: item.querySelector('.carrera-institucion').value,
        anioTermino: item.querySelector('.carrera-anio').value,
        titulado: item.querySelector('.radio-titulado').checked,
        trunco: item.querySelector('.radio-trunco').checked
      });
    }
    if (nuevas.length > SIREI.MAX_CARRERAS) {
      SIREI.utils.mostrarToast(`Solo se guardarán las primeras ${SIREI.MAX_CARRERAS} carreras`, 'error');
    }
    const btn = document.getElementById('guardarCarrerasBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Guardando...';
    try {
      const res = await SIREI.api.actualizarCarreras(docente.id, nuevas.slice(0, SIREI.MAX_CARRERAS));
      if (res.success) {
        SIREI.utils.mostrarToast('Carreras actualizadas');
        SIREI.cache.clear('docentes'); // Invalidar caché
        await renderizarLista(container);
      } else {
        SIREI.utils.mostrarToast(res.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Guardar carreras';
      }
    } catch (err) {
      SIREI.utils.mostrarToast('Error de conexión', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar carreras';
    }
  });

  document.getElementById('cancelCarrerasBtn').addEventListener('click', () => renderizarLista(container));
}

// ====== IMPORTADOR ======
function mostrarImportador(container) {
  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Importar docentes</h2>
      <p>Pega datos separados por tabulador o coma:<br>
      <strong>Nombre, Fecha nac (YYYY-MM-DD), Domicilio, Celular, Whatsapp, Email personal, Email institucional, Foto URL</strong></p>
      <textarea id="importDocentesData" rows="8" style="width:100%; font-family:monospace;"></textarea>
      <button id="importDocentesBtn" class="btn btn-primary" style="margin-top:10px;">Importar docentes</button>
      <div id="importDocentesResult" style="margin-top:10px;"></div>
      <button id="volverListaBtn" class="btn btn-secondary" style="margin-top:10px;">Volver</button>
    </div>
  `;

  const importBtn = document.getElementById('importDocentesBtn');
  const textarea = document.getElementById('importDocentesData');
  const resultDiv = document.getElementById('importDocentesResult');

  importBtn.addEventListener('click', async () => {
    const raw = textarea.value;
    if (!raw.trim()) {
      resultDiv.innerHTML = '<div style="color:#ef4444;">Pega datos primero</div>';
      return;
    }
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    const docentes = [];
    for (let line of lines) {
      let parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length < 1) continue;
      const nombre = parts[0]?.trim();
      if (!nombre) continue;
      docentes.push({
        nombre,
        fechaNac: parts[1]?.trim() || '',
        domicilio: parts[2]?.trim() || '',
        celular: parts[3]?.trim() || '',
        whatsapp: parts[4]?.trim() || '',
        emailPersonal: parts[5]?.trim() || '',
        emailInstitucional: parts[6]?.trim() || '',
        fotoUrl: parts[7]?.trim() || '',
        carreras: []
      });
    }
    if (docentes.length === 0) {
      resultDiv.innerHTML = '<div style="color:#ef4444;">No hay datos válidos</div>';
      return;
    }
    importBtn.disabled = true;
    importBtn.textContent = '⏳ Importando...';
    let importados = 0;
    for (let d of docentes) {
      try {
        const res = await SIREI.api.agregarDocente(d);
        if (res.success) importados++;
      } catch (e) {}
    }
    resultDiv.innerHTML = `<div style="color:#10b981;">Importados ${importados} de ${docentes.length}</div>`;
    importBtn.disabled = false;
    importBtn.textContent = 'Importar docentes';
    textarea.value = '';
    SIREI.cache.clear('docentes'); // Invalidar caché
    setTimeout(() => renderizarLista(container), 1500);
  });

  document.getElementById('volverListaBtn').addEventListener('click', () => renderizarLista(container));
}
