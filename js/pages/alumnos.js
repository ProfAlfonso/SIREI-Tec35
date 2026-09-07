// ============================================================
//  pages/alumnos.js - Pestaña "Alumnos"
//  Contiene toda la lógica de gestión de alumnos.
//  Nota: Las funciones de exportación e impresión están en admin.js
// ============================================================

window.cargarAlumnos = async function(container) {
  let todosLosAlumnos = [];
  let ordenColumna = 'apellidoPaterno';
  let ordenDireccion = 'asc';
  let alumnoSeleccionadoId = null;

  // ====== FUNCIÓN PRINCIPAL: renderizar lista ======
  const renderizarLista = async () => {
    try {
      // Recuperar el término de búsqueda actual antes de reemplazar el DOM
      const currentSearchInput = document.getElementById('searchAlumnos');
      const currentSearchTerm = currentSearchInput ? currentSearchInput.value : '';

      let result = SIREI.cache.get('alumnos');
      if (!result) {
        container.innerHTML = SIREI.utils.crearSpinner();
        result = await SIREI.api.obtenerAlumnos();
        if (result.success) SIREI.cache.set('alumnos', result);
      }
      
      todosLosAlumnos = result.success ? result.alumnos : [];

      // Filtro de búsqueda usando el término guardado
      const searchTerm = currentSearchTerm.toLowerCase();
      let alumnosFiltrados = todosLosAlumnos.filter(a => {
        const nombreCompleto = `${a.nombres} ${a.apellidoPaterno} ${a.apellidoMaterno}`.toLowerCase();
        const matricula = String(a.matricula || '').toLowerCase();
        const curp = String(a.curp || '').toLowerCase();
        return nombreCompleto.includes(searchTerm) || matricula.includes(searchTerm) || curp.includes(searchTerm);
      });

      alumnosFiltrados.sort((a, b) => ordenDireccion === 'asc' ? String(a[ordenColumna] || '').localeCompare(String(b[ordenColumna] || '')) : String(b[ordenColumna] || '').localeCompare(String(a[ordenColumna] || '')));

      const html = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h2 class="card-title" style="margin-bottom:0;">Alumnos</h2>
            <div style="flex: 1; min-width: 200px; max-width: 300px; margin: 0 10px;">
              <input type="text" id="searchAlumnos" placeholder="Buscar por nombre, CURP o matrícula..." style="width: 100%; padding: 8px 12px; border-radius: 20px; border: 1px solid #d1d5db;" value="${SIREI.utils.escapeHtml(currentSearchTerm)}">
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="nuevoAlumnoBtn" class="btn-modern btn-primary-modern"><i class="bi bi-plus-circle"></i> Nuevo</button>
              <button id="importarAlumnosBtn" class="btn-modern btn-secondary-modern"><i class="bi bi-upload"></i> Importar</button>
              <button id="exportarAlumnosBtn" class="btn-modern btn-success-modern"><i class="bi bi-download"></i> Exportar CSV</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <button id="verAlumnoBtn" class="btn-modern btn-info-modern" disabled><i class="bi bi-eye"></i> Ver</button>
            <button id="editarTutoresBtn" class="btn-modern btn-warning-modern" disabled><i class="bi bi-people"></i> Tutores</button>
            <button id="editarHistorialBtn" class="btn-modern btn-secondary-modern" disabled><i class="bi bi-book"></i> Historial</button>
            <button id="eliminarAlumnoBtn" class="btn-modern btn-danger-modern" disabled><i class="bi bi-trash"></i> Eliminar</button>
            <button id="imprimirAlumnoBtn" class="btn-modern btn-dark-modern" disabled><i class="bi bi-printer"></i> Imprimir</button>
            <span style="margin-left: auto; font-size: 0.85rem; color: #6b7280;" id="seleccionInfo">Ninguno seleccionado</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="alumnos-table" style="width:100%; border-collapse: collapse;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:12px; width:40px;">#</th>
                <th data-columna="apellidoPaterno" style="padding:12px; cursor:pointer;">Apellido Paterno <span class="sort-icon">${ordenColumna==='apellidoPaterno'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="apellidoMaterno" style="padding:12px; cursor:pointer;">Apellido Materno <span class="sort-icon">${ordenColumna==='apellidoMaterno'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="nombres" style="padding:12px; cursor:pointer;">Nombre(s) <span class="sort-icon">${ordenColumna==='nombres'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="curp" style="padding:12px; cursor:pointer;">CURP <span class="sort-icon">${ordenColumna==='curp'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="suscripcion" style="padding:12px; cursor:pointer;">Suscripción <span class="sort-icon">${ordenColumna==='suscripcion'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                <th data-columna="grupo" style="padding:12px; cursor:pointer;">Grupo <span class="sort-icon">${ordenColumna==='grupo'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
              </tr></thead>
              <tbody>
                ${alumnosFiltrados.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:20px; color:#6b7280;">No se encontraron alumnos.</td></tr>' : ''}
                ${alumnosFiltrados.map(alum => `
                  <tr class="fila-alumno" data-id="${alum.id}" style="cursor:pointer;">
                    <td style="padding:10px; text-align:center;">
                      <input type="radio" name="seleccionAlumno" value="${alum.id}" class="seleccion-alumno" ${alumnoSeleccionadoId === alum.id ? 'checked' : ''}>
                    </td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.apellidoPaterno)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.apellidoMaterno)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.nombres)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.curp)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.suscripcion)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(alum.grupo)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      container.innerHTML = html;

      // ====== EVENTOS DE ORDENAMIENTO ======
      document.querySelectorAll('.alumnos-table th[data-columna]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.columna;
          if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
          else { ordenColumna = col; ordenDireccion = 'asc'; }
          renderizarLista();
        });
      });

      // Búsqueda
      const searchInputEl = document.getElementById('searchAlumnos');
      if (searchInputEl) {
        searchInputEl.focus();
        const val = searchInputEl.value;
        searchInputEl.value = '';
        searchInputEl.value = val;
        searchInputEl.addEventListener('input', () => {
          renderizarLista();
        });
      }

      // ====== BOTONES GLOBALES ======
      document.getElementById('exportarAlumnosBtn')?.addEventListener('click', () => {
        if (typeof exportarAlumnosCSV === 'function') {
          exportarAlumnosCSV(alumnosFiltrados);
        } else {
          SIREI.utils.mostrarToast('Función de exportación no disponible', 'error');
        }
      });
      document.getElementById('nuevoAlumnoBtn')?.addEventListener('click', () => mostrarFormularioPersonalAlumno(container));
      document.getElementById('importarAlumnosBtn')?.addEventListener('click', () => mostrarImportadorAlumnos(container));

      // ====== SELECCIÓN ======
      const radioButtons = document.querySelectorAll('.seleccion-alumno');
      const verBtn = document.getElementById('verAlumnoBtn');
      const editarTutoresBtn = document.getElementById('editarTutoresBtn');
      const editarHistorialBtn = document.getElementById('editarHistorialBtn');
      const eliminarBtn = document.getElementById('eliminarAlumnoBtn');
      const imprimirBtn = document.getElementById('imprimirAlumnoBtn');
      const seleccionInfo = document.getElementById('seleccionInfo');

      function actualizarEstadoBotones(idSeleccionado) {
        const habilitado = idSeleccionado !== null;
        verBtn.disabled = !habilitado;
        editarTutoresBtn.disabled = !habilitado;
        editarHistorialBtn.disabled = !habilitado;
        eliminarBtn.disabled = !habilitado;
        imprimirBtn.disabled = !habilitado;
        if (idSeleccionado) {
          const alumno = todosLosAlumnos.find(a => a.id == idSeleccionado);
          seleccionInfo.textContent = `Seleccionado: ${alumno ? alumno.nombres + ' ' + alumno.apellidoPaterno : ''}`;
        } else {
          seleccionInfo.textContent = 'Ninguno seleccionado';
        }
      }

      document.querySelectorAll('.fila-alumno').forEach(fila => {
        fila.addEventListener('click', function(e) {
          if (e.target.type === 'radio') return;
          const radio = this.querySelector('.seleccion-alumno');
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        });
      });

      radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
          if (this.checked) {
            alumnoSeleccionadoId = parseInt(this.value);
          } else {
            alumnoSeleccionadoId = null;
          }
          actualizarEstadoBotones(alumnoSeleccionadoId);
        });
      });

      const checkedRadio = document.querySelector('.seleccion-alumno:checked');
      if (checkedRadio) {
        alumnoSeleccionadoId = parseInt(checkedRadio.value);
      } else {
        alumnoSeleccionadoId = null;
      }
      actualizarEstadoBotones(alumnoSeleccionadoId);

      // ====== ACCIONES ======
      verBtn.addEventListener('click', () => {
        if (alumnoSeleccionadoId !== null) {
          const alumno = todosLosAlumnos.find(a => a.id == alumnoSeleccionadoId);
          if (alumno) mostrarFormularioPersonalAlumno(container, alumno);
        }
      });

      editarTutoresBtn.addEventListener('click', () => {
        if (alumnoSeleccionadoId !== null) {
          const alumno = todosLosAlumnos.find(a => a.id == alumnoSeleccionadoId);
          if (alumno) mostrarFormularioTutores(container, alumno);
        }
      });

      editarHistorialBtn.addEventListener('click', () => {
        if (alumnoSeleccionadoId !== null) {
          const alumno = todosLosAlumnos.find(a => a.id == alumnoSeleccionadoId);
          if (alumno) mostrarFormularioHistorial(container, alumno);
        }
      });

      eliminarBtn.addEventListener('click', async () => {
        if (alumnoSeleccionadoId !== null) {
          if (SIREI.utils.confirmar('¿Estás seguro de eliminar este alumno? Esta acción no se puede deshacer.')) {
            eliminarBtn.disabled = true;
            eliminarBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Eliminando...';
            const res = await SIREI.api.eliminarAlumno(alumnoSeleccionadoId);
            if (res.success) {
              alumnoSeleccionadoId = null;
              SIREI.cache.clear('alumnos');
              await renderizarLista();
              SIREI.utils.mostrarToast('Alumno eliminado correctamente');
            } else {
              SIREI.utils.mostrarToast(res.message || 'Error al eliminar', 'error');
              eliminarBtn.disabled = false;
              eliminarBtn.innerHTML = '<i class="bi bi-trash"></i> Eliminar';
            }
          }
        }
      });

      imprimirBtn.addEventListener('click', async () => {
        if (alumnoSeleccionadoId !== null) {
          const alumno = todosLosAlumnos.find(a => a.id == alumnoSeleccionadoId);
          if (alumno) {
            imprimirBtn.disabled = true;
            imprimirBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';
            try {
              const config = await SIREI.api.obtenerConfiguracion();
              const logoUrl = config.logoUrl || '';
              if (typeof imprimirAlumno === 'function') {
                imprimirAlumno(alumno, logoUrl);
              } else {
                SIREI.utils.mostrarToast('Función de impresión no disponible', 'error');
              }
            } catch (e) {
              SIREI.utils.mostrarToast('Error al cargar el logo', 'error');
              if (typeof imprimirAlumno === 'function') {
                imprimirAlumno(alumno, '');
              }
            } finally {
              setTimeout(() => {
                imprimirBtn.disabled = false;
                imprimirBtn.innerHTML = '<i class="bi bi-printer"></i> Imprimir';
              }, 500);
            }
          }
        }
      });
    } catch (error) {
      console.error('Error en renderizarLista (Alumnos):', error);
      container.innerHTML = `<div class="error">Error al cargar alumnos: ${error.message}</div>`;
    }
  };

  // ====== FORMULARIO DATOS PERSONALES (con fecha de ingreso) ======
  const mostrarFormularioPersonalAlumno = (container, alumnoExistente = null) => {
    const esEdicion = alumnoExistente !== null;
    const datos = alumnoExistente || {
      fechaIngreso: SIREI.utils.fechaLocalHoy(),
      apellidoPaterno:'', apellidoMaterno:'', nombres:'', curp:'', fechaNacimiento:'', lugarNacimiento:'', matricula:'', suscripcion:'', grupo:'',
      calle:'', numeroExterior:'', numeroInterior:'', colonia:'', poblacion:'', municipio:'', telefonoCasa:'', celular:'', whatsapp:'',
      correoPersonal:'', correoInstitucional:'', fotoUrl:'', carpetaDocumentos:''
    };
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">${esEdicion ? 'Editar datos del alumno' : 'Nuevo alumno'}</h2>
        <form id="personalAlumnoForm" autocomplete="off" class="form-grid" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));">
          <div class="form-group"><label>Fecha de ingreso</label><input type="date" id="fechaIngreso" value="${datos.fechaIngreso || ''}"></div>
          <div class="form-group"><label>Apellido Paterno *</label><input type="text" id="apellidoPaterno" value="${SIREI.utils.escapeHtml(datos.apellidoPaterno)}" required></div>
          <div class="form-group"><label>Apellido Materno *</label><input type="text" id="apellidoMaterno" value="${SIREI.utils.escapeHtml(datos.apellidoMaterno)}" required></div>
          <div class="form-group"><label>Nombre(s) *</label><input type="text" id="nombres" value="${SIREI.utils.escapeHtml(datos.nombres)}" required></div>
          <div class="form-group"><label>CURP *</label><input type="text" id="curp" value="${SIREI.utils.escapeHtml(datos.curp)}" required></div>
          <div class="form-group"><label>Fecha de nacimiento *</label><input type="date" id="fechaNacimiento" value="${SIREI.utils.formatearFechaParaInput(datos.fechaNacimiento)}" required></div>
          <div class="form-group"><label>Lugar de nacimiento *</label><input type="text" id="lugarNacimiento" value="${SIREI.utils.escapeHtml(datos.lugarNacimiento)}" required></div>
          <div class="form-group"><label>Matrícula</label><input type="text" id="matricula" value="${SIREI.utils.escapeHtml(datos.matricula)}"></div>
          <div class="form-group"><label>Suscripción</label>
            <select id="suscripcion" style="width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px;">
              <option value="">Seleccionar...</option>
              <option value="Escencial" ${datos.suscripcion === 'Escencial' ? 'selected' : ''}>Escencial</option>
              <option value="Crecimiento" ${datos.suscripcion === 'Crecimiento' ? 'selected' : ''}>Crecimiento</option>
              <option value="Plenitud" ${datos.suscripcion === 'Plenitud' ? 'selected' : ''}>Plenitud</option>
            </select>
          </div>
          <div class="form-group"><label>Grupo</label><input type="text" id="grupo" value="${SIREI.utils.escapeHtml(datos.grupo)}"></div>
          <div style="grid-column: 1 / -1; border-top: 2px solid #e5e7eb; padding-top: 16px; margin-top: 8px;"><h3>Domicilio</h3></div>
          <div class="form-group"><label>Calle *</label><input type="text" id="calle" value="${SIREI.utils.escapeHtml(datos.calle)}" required></div>
          <div class="form-group"><label>Número exterior *</label><input type="text" id="numeroExterior" value="${SIREI.utils.escapeHtml(datos.numeroExterior)}" required></div>
          <div class="form-group"><label>Número interior</label><input type="text" id="numeroInterior" value="${SIREI.utils.escapeHtml(datos.numeroInterior)}"></div>
          <div class="form-group"><label>Colonia o Junta Auxiliar *</label><input type="text" id="colonia" value="${SIREI.utils.escapeHtml(datos.colonia)}" required></div>
          <div class="form-group"><label>Población *</label><input type="text" id="poblacion" value="${SIREI.utils.escapeHtml(datos.poblacion)}" required></div>
          <div class="form-group"><label>Municipio *</label><input type="text" id="municipio" value="${SIREI.utils.escapeHtml(datos.municipio)}" required></div>
          <div class="form-group"><label>Teléfono de casa</label><input type="tel" id="telefonoCasa" value="${SIREI.utils.escapeHtml(datos.telefonoCasa)}"></div>
          <div class="form-group"><label>Celular</label><input type="tel" id="celular" pattern="[0-9]{10}" maxlength="10" value="${SIREI.utils.escapeHtml(datos.celular)}"></div>
          <div class="form-group"><label>Whatsapp</label><input type="tel" id="whatsapp" pattern="[0-9]{10}" maxlength="10" value="${SIREI.utils.escapeHtml(datos.whatsapp)}"></div>
          <div class="form-group"><label>Correo personal</label><input type="email" id="correoPersonal" value="${SIREI.utils.escapeHtml(datos.correoPersonal)}"></div>
          <div class="form-group"><label>Correo institucional</label><input type="email" id="correoInstitucional" value="${SIREI.utils.escapeHtml(datos.correoInstitucional)}"></div>
          <div class="form-group"><label>URL de foto (Drive)</label><input type="url" id="fotoUrl" value="${SIREI.utils.escapeHtml(datos.fotoUrl)}"></div>
          <div class="form-group"><label>URL de carpeta de documentos (Drive)</label><input type="url" id="carpetaDocumentos" value="${SIREI.utils.escapeHtml(datos.carpetaDocumentos)}"></div>
          <div id="fotoPreview" style="margin-bottom:16px; grid-column: 1 / -1;"></div>
          <div class="form-buttons" style="grid-column: 1 / -1;">
            <button type="submit" class="btn btn-primary">${esEdicion ? 'Actualizar' : 'Guardar'}</button>
            <button type="button" id="cancelPersonalAlumnoBtn" class="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    // Previsualización de foto
    const fotoUrlInput = document.getElementById('fotoUrl'), fotoPreviewDiv = document.getElementById('fotoPreview');
    const actualizarPreview = () => {
      const url = fotoUrlInput?.value.trim();
      if (!url) { if(fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#6b7280;">Sin foto</p>'; return; }
      if(fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#6b7280;">Cargando imagen...</p>';
      const img = new Image();
      img.style.maxWidth = '120px'; img.style.borderRadius = '8px';
      img.onload = () => { if(fotoPreviewDiv) fotoPreviewDiv.innerHTML = ''; fotoPreviewDiv?.appendChild(img); };
      img.onerror = () => { if(fotoPreviewDiv) fotoPreviewDiv.innerHTML = '<p style="color:#ef4444;">No se pudo cargar la imagen</p>'; };
      img.src = SIREI.utils.obtenerUrlImagenDrive(url);
    };
    if(fotoUrlInput) fotoUrlInput.addEventListener('input', actualizarPreview);
    actualizarPreview();

    const form = document.getElementById('personalAlumnoForm');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const required = ['apellidoPaterno','apellidoMaterno','nombres','curp','fechaNacimiento','lugarNacimiento','calle','numeroExterior','colonia','poblacion','municipio'];
      let isValid = true;
      for (let id of required) {
        const el = document.getElementById(id);
        if (!el.value.trim()) { el.classList.add('input-error'); isValid = false; }
        else el.classList.remove('input-error');
      }
      if (!isValid) { SIREI.utils.mostrarToast('Completa todos los campos obligatorios (*)', 'error'); return; }

      const datosAlumno = {
        fechaIngreso: document.getElementById('fechaIngreso').value,
        apellidoPaterno: document.getElementById('apellidoPaterno').value.trim(),
        apellidoMaterno: document.getElementById('apellidoMaterno').value.trim(),
        nombres: document.getElementById('nombres').value.trim(),
        curp: document.getElementById('curp').value.trim(),
        fechaNacimiento: document.getElementById('fechaNacimiento').value,
        lugarNacimiento: document.getElementById('lugarNacimiento').value.trim(),
        matricula: document.getElementById('matricula').value.trim(),
        suscripcion: document.getElementById('suscripcion').value.trim(),
        grupo: document.getElementById('grupo').value.trim(),
        calle: document.getElementById('calle').value.trim(),
        numeroExterior: document.getElementById('numeroExterior').value.trim(),
        numeroInterior: document.getElementById('numeroInterior').value.trim(),
        colonia: document.getElementById('colonia').value.trim(),
        poblacion: document.getElementById('poblacion').value.trim(),
        municipio: document.getElementById('municipio').value.trim(),
        telefonoCasa: document.getElementById('telefonoCasa').value.trim(),
        celular: document.getElementById('celular').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        correoPersonal: document.getElementById('correoPersonal').value.trim(),
        correoInstitucional: document.getElementById('correoInstitucional').value.trim(),
        fotoUrl: document.getElementById('fotoUrl').value.trim(),
        carpetaDocumentos: document.getElementById('carpetaDocumentos').value.trim(),
        tutores: esEdicion ? alumnoExistente.tutores : [],
        historial: esEdicion ? alumnoExistente.historial : []
      };
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = '⏳ Guardando...';
      try {
        let res;
        if (esEdicion) res = await SIREI.api.actualizarAlumno(alumnoExistente.id, datosAlumno);
        else res = await SIREI.api.agregarAlumno(datosAlumno);
        if (res.success) { 
          SIREI.utils.mostrarToast(esEdicion ? 'Datos actualizados' : 'Alumno agregado'); 
          SIREI.cache.clear('alumnos');
          await renderizarLista(); 
        }
        else { SIREI.utils.mostrarToast(res.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = esEdicion ? 'Actualizar' : 'Guardar'; }
      } catch(err) { SIREI.utils.mostrarToast('Error de conexión: '+err.message, 'error'); submitBtn.disabled = false; submitBtn.textContent = esEdicion ? 'Actualizar' : 'Guardar'; }
    });
    document.getElementById('cancelPersonalAlumnoBtn')?.addEventListener('click', () => renderizarLista());
  };

  // ====== FORMULARIO TUTORES ======
  const mostrarFormularioTutores = async (container, alumno) => {
    let tutores = [...(alumno.tutores || [])];
    const renderTutores = () => {
      const div = document.getElementById('tutoresContainer');
      div.innerHTML = tutores.map((t, idx) => `
        <div class="tutor-item" data-index="${idx}" style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap:12px;">
            <div class="form-group"><label>Parentesco</label><input type="text" class="tutor-parentesco" value="${SIREI.utils.escapeHtml(t.parentesco)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Apellido Paterno *</label><input type="text" class="tutor-apellidoPaterno" value="${SIREI.utils.escapeHtml(t.apellidoPaterno)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Apellido Materno *</label><input type="text" class="tutor-apellidoMaterno" value="${SIREI.utils.escapeHtml(t.apellidoMaterno)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Nombre *</label><input type="text" class="tutor-nombre" value="${SIREI.utils.escapeHtml(t.nombre)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Fecha de nacimiento</label><input type="date" class="tutor-fechaNacimiento" value="${SIREI.utils.formatearFechaParaInput(t.fechaNacimiento)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Estado Civil</label><input type="text" class="tutor-estadoCivil" value="${SIREI.utils.escapeHtml(t.estadoCivil)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Celular *</label><input type="tel" class="tutor-celular" maxlength="10" value="${SIREI.utils.escapeHtml(t.celular)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Whatsapp *</label><input type="tel" class="tutor-whatsapp" maxlength="10" value="${SIREI.utils.escapeHtml(t.whatsapp)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Correo electrónico</label><input type="email" class="tutor-correo" value="${SIREI.utils.escapeHtml(t.correo)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Nivel de estudios</label><input type="text" class="tutor-nivelEstudios" value="${SIREI.utils.escapeHtml(t.nivelEstudios)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Trabaja en</label><input type="text" class="tutor-trabajaEn" value="${SIREI.utils.escapeHtml(t.trabajaEn)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Domicilio de la empresa</label><input type="text" class="tutor-domicilioEmpresa" value="${SIREI.utils.escapeHtml(t.domicilioEmpresa)}" data-idx="${idx}"></div>
            <div class="form-group"><label>Nombre de la empresa</label><input type="text" class="tutor-nombreEmpresa" value="${SIREI.utils.escapeHtml(t.nombreEmpresa)}" data-idx="${idx}"></div>
            <div style="grid-column: span 2; display: flex; justify-content: flex-end;">
              <button type="button" class="eliminar-tutor-btn btn-danger" data-idx="${idx}">🗑️ Eliminar tutor</button>
            </div>
          </div>
        </div>
      `).join('');
      document.querySelectorAll('.eliminar-tutor-btn').forEach(btn => btn.addEventListener('click', () => { tutores.splice(parseInt(btn.dataset.idx),1); renderTutores(); }));
    };
    container.innerHTML = `<div class="card"><h2 class="card-title">Editar tutores de: ${SIREI.utils.escapeHtml(alumno.nombres)} ${SIREI.utils.escapeHtml(alumno.apellidoPaterno)}</h2><div id="tutoresContainer"></div><button id="agregarTutorBtn" class="btn-secondary" style="margin:16px 0;">+ Agregar tutor</button><div class="form-buttons"><button id="guardarTutoresBtn" class="btn btn-primary">Guardar tutores</button><button id="cancelTutoresBtn" class="btn btn-secondary">Cancelar</button></div></div>`;
    renderTutores();
    document.getElementById('agregarTutorBtn').addEventListener('click', () => {
      if(tutores.length >= SIREI.MAX_TUTORES) { SIREI.utils.mostrarToast(`Máximo ${SIREI.MAX_TUTORES} tutores`, 'error'); return; }
      tutores.push({ parentesco:'', apellidoPaterno:'', apellidoMaterno:'', nombre:'', fechaNacimiento:'', estadoCivil:'', celular:'', whatsapp:'', correo:'', nivelEstudios:'', trabajaEn:'', domicilioEmpresa:'', nombreEmpresa:'' });
      renderTutores();
    });
    document.getElementById('guardarTutoresBtn').addEventListener('click', async () => {
      const items = document.querySelectorAll('.tutor-item');
      const nuevos = [];
      let valido = true;
      for(let item of items){
        const apPaterno = item.querySelector('.tutor-apellidoPaterno').value.trim();
        const apMaterno = item.querySelector('.tutor-apellidoMaterno').value.trim();
        const nombre = item.querySelector('.tutor-nombre').value.trim();
        const celular = item.querySelector('.tutor-celular').value.trim();
        const whatsapp = item.querySelector('.tutor-whatsapp').value.trim();
        if(!apPaterno || !apMaterno || !nombre || !celular || !whatsapp) {
          valido = false;
          SIREI.utils.mostrarToast('Todos los tutores deben tener apellidos, nombre, celular y whatsapp', 'error');
          return;
        }
        nuevos.push({
          parentesco: item.querySelector('.tutor-parentesco').value,
          apellidoPaterno: apPaterno,
          apellidoMaterno: apMaterno,
          nombre: nombre,
          fechaNacimiento: item.querySelector('.tutor-fechaNacimiento').value,
          estadoCivil: item.querySelector('.tutor-estadoCivil').value,
          celular: celular,
          whatsapp: whatsapp,
          correo: item.querySelector('.tutor-correo').value,
          nivelEstudios: item.querySelector('.tutor-nivelEstudios').value,
          trabajaEn: item.querySelector('.tutor-trabajaEn').value,
          domicilioEmpresa: item.querySelector('.tutor-domicilioEmpresa').value,
          nombreEmpresa: item.querySelector('.tutor-nombreEmpresa').value
        });
      }
      if(!valido) return;
      if(nuevos.length > SIREI.MAX_TUTORES) SIREI.utils.mostrarToast(`Solo se guardarán los primeros ${SIREI.MAX_TUTORES}`, 'error');
      const btn = document.getElementById('guardarTutoresBtn');
      btn.disabled = true; btn.textContent = '⏳ Guardando...';
      try {
        const res = await SIREI.api.actualizarTutores(alumno.id, nuevos.slice(0,SIREI.MAX_TUTORES));
        if(res.success) { 
          SIREI.utils.mostrarToast('Tutores actualizados'); 
          SIREI.cache.clear('alumnos');
          await renderizarLista(); 
        }
        else { SIREI.utils.mostrarToast(res.message, 'error'); btn.disabled = false; btn.textContent = 'Guardar tutores'; }
      } catch(err) { SIREI.utils.mostrarToast('Error de conexión', 'error'); btn.disabled = false; btn.textContent = 'Guardar tutores'; }
    });
    document.getElementById('cancelTutoresBtn').addEventListener('click', () => renderizarLista());
  };

  // ====== FORMULARIO HISTORIAL ACADÉMICO ======
  const mostrarFormularioHistorial = async (container, alumno) => {
    let historial = [...(alumno.historial || [])];
    const renderHistorial = () => {
      const div = document.getElementById('historialContainer');
      div.innerHTML = historial.map((h, idx) => `
        <div class="historial-item" data-index="${idx}" style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
          <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap:12px;">
            <div class="form-group"><label>Nivel *</label>
              <select class="historial-nivel" data-idx="${idx}">
                <option value="Preescolar" ${h.nivel==='Preescolar'?'selected':''}>Preescolar</option>
                <option value="Primaria" ${h.nivel==='Primaria'?'selected':''}>Primaria</option>
                <option value="Secundaria" ${h.nivel==='Secundaria'?'selected':''}>Secundaria</option>
                <option value="Preparatoria" ${h.nivel==='Preparatoria'?'selected':''}>Preparatoria</option>
                <option value="Licenciatura" ${h.nivel==='Licenciatura'?'selected':''}>Licenciatura</option>
                <option value="Otro" ${h.nivel==='Otro'?'selected':''}>Otro</option>
              </select>
            </div>
            <div class="form-group"><label>Institución *</label><input type="text" class="historial-institucion" value="${SIREI.utils.escapeHtml(h.institucion)}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Año de término *</label><input type="number" class="historial-anio" value="${h.anioTermino||''}" data-idx="${idx}" required></div>
            <div class="form-group"><label>Promedio</label><input type="text" class="historial-promedio" value="${SIREI.utils.escapeHtml(h.promedio)}" data-idx="${idx}"></div>
            <div style="grid-column: span 2; display: flex; justify-content: flex-end;">
              <button type="button" class="eliminar-historial-btn btn-danger" data-idx="${idx}">🗑️ Eliminar registro</button>
            </div>
          </div>
        </div>
      `).join('');
      document.querySelectorAll('.eliminar-historial-btn').forEach(btn => btn.addEventListener('click', () => { historial.splice(parseInt(btn.dataset.idx),1); renderHistorial(); }));
    };
    container.innerHTML = `<div class="card"><h2 class="card-title">Historial académico de: ${SIREI.utils.escapeHtml(alumno.nombres)} ${SIREI.utils.escapeHtml(alumno.apellidoPaterno)}</h2><div id="historialContainer"></div><button id="agregarHistorialBtn" class="btn-secondary" style="margin:16px 0;">+ Agregar registro</button><div class="form-buttons"><button id="guardarHistorialBtn" class="btn btn-primary">Guardar historial</button><button id="cancelHistorialBtn" class="btn btn-secondary">Cancelar</button></div></div>`;
    renderHistorial();
    document.getElementById('agregarHistorialBtn').addEventListener('click', () => {
      if(historial.length >= SIREI.MAX_HISTORIAL) { SIREI.utils.mostrarToast(`Máximo ${SIREI.MAX_HISTORIAL} registros`, 'error'); return; }
      historial.push({ nivel:'Secundaria', institucion:'', anioTermino:'', promedio:'' });
      renderHistorial();
    });
    document.getElementById('guardarHistorialBtn').addEventListener('click', async () => {
      const items = document.querySelectorAll('.historial-item');
      const nuevos = [];
      for(let item of items){
        const nivel = item.querySelector('.historial-nivel').value;
        const institucion = item.querySelector('.historial-institucion').value.trim();
        const anio = item.querySelector('.historial-anio').value.trim();
        if(!institucion || !anio) {
          SIREI.utils.mostrarToast('Institución y año son obligatorios', 'error');
          return;
        }
        nuevos.push({ nivel, institucion, anioTermino: anio, promedio: item.querySelector('.historial-promedio').value.trim() });
      }
      const btn = document.getElementById('guardarHistorialBtn');
      btn.disabled = true; btn.textContent = '⏳ Guardando...';
      try {
        const res = await SIREI.api.actualizarHistorial(alumno.id, nuevos.slice(0,SIREI.MAX_HISTORIAL));
        if(res.success) { 
          SIREI.utils.mostrarToast('Historial actualizado'); 
          SIREI.cache.clear('alumnos');
          await renderizarLista(); 
        }
        else { SIREI.utils.mostrarToast(res.message, 'error'); btn.disabled = false; btn.textContent = 'Guardar historial'; }
      } catch(err) { SIREI.utils.mostrarToast('Error de conexión', 'error'); btn.disabled = false; btn.textContent = 'Guardar historial'; }
    });
    document.getElementById('cancelHistorialBtn').addEventListener('click', () => renderizarLista());
  };

  // ====== IMPORTADOR DE ALUMNOS ======
  const mostrarImportadorAlumnos = (container) => {
    container.innerHTML = `
      <div class="card"><h2 class="card-title">Importar alumnos</h2><p>Pega datos separados por tabulador o coma con este orden:<br>
      <strong>ApellidoPaterno, ApellidoMaterno, Nombres, CURP, FechaNac (YYYY-MM-DD), LugarNacimiento, Matricula, Grupo, Calle, NumExt, NumInt, Colonia, Poblacion, Municipio, TelefonoCasa, Celular, Whatsapp, CorreoPersonal, CorreoInstitucional, FotoUrl, CarpetaDocumentos</strong></p>
      <textarea id="importAlumnosData" rows="8" style="width:100%; font-family:monospace;"></textarea>
      <button id="importAlumnosBtn" class="btn btn-primary" style="margin-top:10px;">Importar alumnos</button>
      <div id="importAlumnosResult" style="margin-top:10px;"></div>
      <button id="volverListaAlumnosBtn" class="btn btn-secondary" style="margin-top:10px;">Volver</button></div>
    `;
    const importBtn = document.getElementById('importAlumnosBtn'), textarea = document.getElementById('importAlumnosData'), resultDiv = document.getElementById('importAlumnosResult');
    importBtn.addEventListener('click', async () => {
      const raw = textarea.value;
      if(!raw.trim()) { resultDiv.innerHTML = '<div style="color:#ef4444;">Pega datos primero</div>'; return; }
      const lines = raw.split(/\r?\n/).filter(l=>l.trim().length>0);
      const alumnos = [];
      for(let line of lines){
        let parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if(parts.length < 11) continue;
        const apPaterno = parts[0]?.trim() || '';
        const apMaterno = parts[1]?.trim() || '';
        const nombres = parts[2]?.trim() || '';
        const curp = parts[3]?.trim() || '';
        const fechaNac = parts[4]?.trim() || '';
        const lugarNac = parts[5]?.trim() || '';
        const matricula = parts[6]?.trim() || '';
        const grupo = parts[7]?.trim() || '';
        const calle = parts[8]?.trim() || '';
        const numExt = parts[9]?.trim() || '';
        const numInt = parts[10]?.trim() || '';
        const colonia = parts[11]?.trim() || '';
        const poblacion = parts[12]?.trim() || '';
        const municipio = parts[13]?.trim() || '';
        const telefonoCasa = parts[14]?.trim() || '';
        const celular = parts[15]?.trim() || '';
        const whatsapp = parts[16]?.trim() || '';
        const correoPersonal = parts[17]?.trim() || '';
        const correoInstitucional = parts[18]?.trim() || '';
        const fotoUrl = parts[19]?.trim() || '';
        const carpetaDoc = parts[20]?.trim() || '';
        if(!apPaterno || !apMaterno || !nombres || !curp || !fechaNac || !lugarNac || !calle || !numExt || !colonia || !poblacion || !municipio) continue;
        alumnos.push({
          apellidoPaterno: apPaterno, apellidoMaterno: apMaterno, nombres, curp, fechaNacimiento: fechaNac,
          lugarNacimiento: lugarNac, matricula, grupo, calle, numeroExterior: numExt, numeroInterior: numInt,
          colonia, poblacion, municipio, telefonoCasa, celular, whatsapp, correoPersonal, correoInstitucional,
          fotoUrl, carpetaDocumentos: carpetaDoc, tutores: [], historial: []
        });
      }
      if(alumnos.length===0) { resultDiv.innerHTML = '<div style="color:#ef4444;">No hay datos válidos (faltan campos obligatorios)</div>'; return; }
      importBtn.disabled = true; importBtn.textContent = '⏳ Importando...';
      let importados = 0;
      for(let a of alumnos) try { if((await SIREI.api.agregarAlumno(a)).success) importados++; } catch(e){}
      resultDiv.innerHTML = `<div style="color:#10b981;">Importados ${importados} de ${alumnos.length}</div>`;
      importBtn.disabled = false; importBtn.textContent = 'Importar alumnos';
      textarea.value = '';
      SIREI.cache.clear('alumnos');
      setTimeout(() => renderizarLista(), 1500);
    });
    document.getElementById('volverListaAlumnosBtn').addEventListener('click', () => renderizarLista());
  };

  // ====== INICIALIZAR ======
  await renderizarLista();
};