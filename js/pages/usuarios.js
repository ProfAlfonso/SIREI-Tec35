window.cargarUsuarios = async function(container) {
  let todosLosUsuarios = [];
  let ordenColumna = 'usuario';
  let ordenDireccion = 'asc';
  let usuarioSeleccionadoId = null;

  const renderizarLista = async () => {
    try {
      container.innerHTML = SIREI.utils.crearSpinner();

      const result = await SIREI.api.peticionAPI('obtenerUsuarios');
      if (!result.success) throw new Error(result.message || 'Error al obtener usuarios');

      todosLosUsuarios = result.usuarios || [];

      const searchTerm = (document.getElementById('searchUsuarios')?.value || '').toLowerCase();
      let filtrados = todosLosUsuarios.filter(u =>
        (u.usuario || '').toLowerCase().includes(searchTerm) ||
        (u.nombreCompleto || '').toLowerCase().includes(searchTerm) ||
        (u.rol || '').toLowerCase().includes(searchTerm)
      );

      filtrados.sort((a, b) =>
        ordenDireccion === 'asc'
          ? String(a[ordenColumna] || '').localeCompare(String(b[ordenColumna] || ''))
          : String(b[ordenColumna] || '').localeCompare(String(a[ordenColumna] || ''))
      );

      container.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h2 class="card-title" style="margin-bottom:0;">Gestión de Usuarios</h2>
            <div style="flex: 1; min-width: 200px; max-width: 300px;">
              <input type="text" id="searchUsuarios" placeholder="Buscar usuario..." style="width: 100%; padding: 8px 12px; border-radius: 20px; border: 1px solid #d1d5db;">
            </div>
            <button id="nuevoUsuarioBtn" class="btn-modern btn-primary-modern"><i class="bi bi-plus-circle"></i> Nuevo Usuario</button>
          </div>

          <div style="overflow-x:auto;">
            <table class="usuarios-table" style="width:100%; border-collapse: collapse;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:12px; width:40px;">#</th>
                  <th data-columna="usuario" style="padding:12px; cursor:pointer;">Usuario <span class="sort-icon">${ordenColumna==='usuario'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                  <th data-columna="nombreCompleto" style="padding:12px; cursor:pointer;">Nombre Completo <span class="sort-icon">${ordenColumna==='nombreCompleto'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                  <th data-columna="rol" style="padding:12px; cursor:pointer;">Rol <span class="sort-icon">${ordenColumna==='rol'?(ordenDireccion==='asc'?'▲':'▼'):'↕'}</span></th>
                  <th style="padding:12px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filtrados.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:20px; color:#6b7280;">No hay usuarios registrados.</td></tr>' : ''}
                ${filtrados.map(u => `
                  <tr style="cursor:pointer;">
                    <td style="padding:10px; text-align:center;">
                      <input type="radio" name="seleccionUsuario" value="${SIREI.utils.escapeHtml(u.usuario)}" class="seleccion-usuario">
                    </td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(u.usuario)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(u.nombreCompleto)}</td>
                    <td style="padding:10px;">${SIREI.utils.escapeHtml(u.rol)}</td>
                    <td style="padding:10px;">
                      <button class="btn-editar-usuario btn-modern btn-warning-modern" data-usuario="${SIREI.utils.escapeHtml(u.usuario)}" style="padding:4px 10px;"><i class="bi bi-pencil"></i></button>
                      <button class="btn-eliminar-usuario btn-modern btn-danger-modern" data-usuario="${SIREI.utils.escapeHtml(u.usuario)}" style="padding:4px 10px;"><i class="bi bi-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.querySelectorAll('.usuarios-table th[data-columna]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.columna;
          if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
          else { ordenColumna = col; ordenDireccion = 'asc'; }
          renderizarLista();
        });
      });

      const searchInput = document.getElementById('searchUsuarios');
      if (searchInput) {
        searchInput.value = searchTerm;
        searchInput.addEventListener('input', () => renderizarLista());
      }

      document.getElementById('nuevoUsuarioBtn').addEventListener('click', () => mostrarFormulario(container, null));
      document.querySelectorAll('.btn-editar-usuario').forEach(btn => {
        btn.addEventListener('click', () => {
          const usuario = todosLosUsuarios.find(u => u.usuario === btn.dataset.usuario);
          if (usuario) mostrarFormulario(container, usuario);
        });
      });
      document.querySelectorAll('.btn-eliminar-usuario').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!SIREI.utils.confirmar('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
          const b = btn;
          b.disabled = true;
          b.innerHTML = '<i class="bi bi-hourglass-split"></i>';
          const res = await SIREI.api.peticionAPI('eliminarUsuario', { usuario: btn.dataset.usuario });
          if (res.success) {
            SIREI.utils.mostrarToast('Usuario eliminado.');
            await renderizarLista();
          } else {
            SIREI.utils.mostrarToast(res.message || 'Error al eliminar', 'error');
            b.disabled = false;
            b.innerHTML = '<i class="bi bi-trash"></i>';
          }
        });
      });

      if (searchInput) searchInput.focus();

    } catch (error) {
      console.error('Error en usuarios:', error);
      container.innerHTML = `<div class="error">Error al cargar usuarios: ${error.message}</div>`;
    }
  };

  await renderizarLista();
};

async function mostrarFormulario(container, usuarioExistente) {
  const esEdicion = usuarioExistente !== null;
  const datos = usuarioExistente || { usuario: '', nombreCompleto: '', rol: 'docente' };

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">${esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
      <form id="usuarioForm" autocomplete="off" class="form-grid">
        <div class="form-group"><label>Usuario *</label><input type="text" id="campoUsuario" value="${SIREI.utils.escapeHtml(datos.usuario)}" ${esEdicion ? 'readonly' : 'required'}></div>
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="campoNombre" value="${SIREI.utils.escapeHtml(datos.nombreCompleto)}" required></div>
        <div class="form-group"><label>Contraseña ${esEdicion ? '(dejar vacío para mantener)' : '*'} </label><input type="password" id="campoPassword" ${esEdicion ? '' : 'required'}></div>
        <div class="form-group"><label>Rol *</label>
          <select id="campoRol" required>
            <option value="admin" ${datos.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            <option value="coordinador" ${datos.rol === 'coordinador' ? 'selected' : ''}>Coordinador</option>
            <option value="docente" ${datos.rol === 'docente' ? 'selected' : ''}>Docente</option>
          </select>
        </div>
        <div class="form-buttons">
          <button type="submit" class="btn btn-primary">${esEdicion ? 'Actualizar' : 'Guardar'}</button>
          <button type="button" id="cancelarUsuarioBtn" class="btn btn-secondary">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('usuarioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('campoUsuario').value.trim();
    const nombreCompleto = document.getElementById('campoNombre').value.trim();
    const password = document.getElementById('campoPassword').value;
    const rol = document.getElementById('campoRol').value;

    if (!usuario || !nombreCompleto) {
      SIREI.utils.mostrarToast('Usuario y nombre son obligatorios.', 'error');
      return;
    }
    if (!esEdicion && !password) {
      SIREI.utils.mostrarToast('La contraseña es obligatoria.', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando...';

    try {
      const res = await SIREI.api.peticionAPI(esEdicion ? 'actualizarUsuario' : 'agregarUsuario', {
        usuario,
        nombreCompleto,
        password,
        rol
      });
      if (res.success) {
        SIREI.utils.mostrarToast(esEdicion ? 'Usuario actualizado.' : 'Usuario creado.');
        await window.cargarUsuarios(container);
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

  document.getElementById('cancelarUsuarioBtn').addEventListener('click', () => window.cargarUsuarios(container));
}
