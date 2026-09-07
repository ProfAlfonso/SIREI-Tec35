// ============================================================
//  pages/asignaturas.js - Pestaña "Mapa Curricular"
//  Contiene toda la lógica de gestión de asignaturas.
// ============================================================

/**
 * Función principal que renderiza el gestor de asignaturas.
 */
window.cargarAsignaturas = async function(container) {
  // ====== 0. Helper: grupos separados por coma o tab ======
  const parsearGrupos = (cadena) => {
    if (!cadena) return [];
    return cadena.split(/[,\t\n]/).map(s => s.trim()).filter(s => s.length > 0);
  };
  const gruposDeAsignatura = (s) => (s.grupos && s.grupos.length ? s.grupos : parsearGrupos(s.grado));

  // ====== 1. Variables de estado ======
  let currentFilter = 'todos';
  let ordenColumna = 'nombre';
  let ordenDireccion = 'asc';
  let todasLasAsignaturas = [];

  // ====== 2. Función que carga la lista ======
  const cargarLista = async () => {
    try {
      const tbody = document.getElementById('asignaturasList');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">${SIREI.utils.crearSpinner()}</td></tr>`;

      let result = SIREI.cache.get('asignaturas');
      if (!result) {
        result = await SIREI.api.obtenerAsignaturas();
        if (result.success) SIREI.cache.set('asignaturas', result);
      }
      
      const tbodyElement = document.getElementById('asignaturasList');
      const selectGrado = document.getElementById('gradoFilter');

      if (result.success && result.asignaturas.length > 0) {
        todasLasAsignaturas = result.asignaturas;
        const gruposSet = new Set();
        todasLasAsignaturas.forEach(s => gruposDeAsignatura(s).forEach(g => gruposSet.add(g)));
        const grupos = [...gruposSet].sort();
        if (selectGrado) {
          selectGrado.innerHTML = '<option value="todos">Todos los grupos</option>' + grupos.map(g => `<option value="${SIREI.utils.escapeHtml(g)}">${SIREI.utils.escapeHtml(g)}</option>`).join('');
          selectGrado.value = currentFilter;
        }

        // Aplicar filtro de grupo y filtro de búsqueda de texto
        const searchInput = document.getElementById('searchAsignaturas');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        
        let filtradas = todasLasAsignaturas.filter(s => {
          const gruposAsig = gruposDeAsignatura(s);
          const matchGrupo = currentFilter === 'todos' || gruposAsig.includes(currentFilter);
          const matchText = s.nombre.toLowerCase().includes(searchTerm) || (s.abreviatura || '').toLowerCase().includes(searchTerm);
          return matchGrupo && matchText;
        });

        filtradas.sort((a, b) => ordenDireccion === 'asc' ? String(a[ordenColumna] || '').localeCompare(String(b[ordenColumna] || '')) : String(b[ordenColumna] || '').localeCompare(String(a[ordenColumna] || '')));

        if (tbodyElement) {
          tbodyElement.innerHTML = filtradas.map(subj => `
            <tr>
              <td>${SIREI.utils.escapeHtml(subj.id)}</td>
              <td>${SIREI.utils.escapeHtml(subj.nombre)}</td>
              <td>${SIREI.utils.escapeHtml(subj.abreviatura)}</td>
              <td>${SIREI.utils.escapeHtml(gruposDeAsignatura(subj).join(', '))}</td>
              <td><button class="delete-subject-btn btn-danger" data-id="${subj.id}">Eliminar</button></td>
            </tr>
          `).join('');
        }
      } else {
        if (tbodyElement) tbodyElement.innerHTML = '<tr><td colspan="5" class="loader">No hay asignaturas registradas.</td></tr>';
        if (selectGrado) selectGrado.innerHTML = '<option value="todos">Todos los grados</option>';
      }

      // Eventos de eliminación
      document.querySelectorAll('.delete-subject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          b.textContent = '⏳';
          if (SIREI.utils.confirmar('¿Eliminar esta asignatura?')) {
            const res = await SIREI.api.eliminarAsignatura(btn.dataset.id);
            if (res.success) {
              SIREI.cache.clear('asignaturas');
              await cargarLista();
              SIREI.utils.mostrarToast('Asignatura eliminada');
            } else {
              SIREI.utils.mostrarToast(res.message || 'Error al eliminar', 'error');
              b.disabled = false;
              b.textContent = 'Eliminar';
            }
          } else {
            b.disabled = false;
            b.textContent = 'Eliminar';
          }
        });
      });
    } catch (error) {
      console.error("Error al cargar lista de asignaturas:", error);
      const tbodyElement = document.getElementById('asignaturasList');
      if (tbodyElement) {
        tbodyElement.innerHTML = `<tr><td colspan="5" class="error">Error: ${error.message}</td></tr>`;
      }
    }
  };

  // ====== 3. Función para verificar duplicados ======
  const esDuplicado = (nombre, grado) => {
    return todasLasAsignaturas.some(s => s.nombre === nombre && (s.grado || '') === (grado || ''));
  };

  // ====== 4. Renderizar el HTML ======
  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Mapa curricular – Agregar asignatura</h2>
      <form id="addSubjectForm">
        <div class="form-group"><label>Nombre completo *</label><input type="text" id="nombreAsignatura" required></div>
        <div class="form-group"><label>Abreviación (ej. MAT, FIS)</label><input type="text" id="abreviaturaAsignatura"></div>
        <div class="form-group"><label>Grupos (separados por coma o tab) (ej. Primero A, Primero B)</label><input type="text" id="gradoAsignatura"></div>
        <button type="submit" class="btn btn-primary">Agregar asignatura</button>
      </form>
    </div>

    <div class="card">
      <h2 class="card-title">Importar desde portapapeles</h2>
      <p>Pega datos con formato <strong>Nombre, Abreviatura, Grupos</strong> (separados por coma o tabulación).</p>
      <textarea id="importData" rows="5" placeholder="Ejemplo:&#10;Matemáticas,MAT,Primero A&#10;Física,FIS,Primero A, Primero B" style="width:100%; font-family:monospace;"></textarea>
      <button id="importBtn" class="btn btn-primary" style="margin-top:10px;">Importar asignaturas</button>
      <div id="importResult" style="margin-top:10px;"></div>
    </div>

    <div class="card">
      <h2 class="card-title">Listado de asignaturas</h2>
      <div style="margin-bottom:16px; display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
        <div>
          <label for="gradoFilter">Filtrar por grupo:</label>
          <select id="gradoFilter" style="margin-left:8px; padding:6px 12px; border-radius:8px; border:1px solid #d1d5db;">
            <option value="todos">Todos los grupos</option>
          </select>
        </div>
        <div style="flex:1; min-width:200px;">
          <input type="text" id="searchAsignaturas" placeholder="Buscar asignatura por nombre o abreviatura..." style="width:100%; padding:8px 12px; border-radius:20px; border:1px solid #d1d5db;">
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table class="asignaturas-table" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px; cursor:pointer;" data-columna="id">ID <span class="sort-icon">↕</span></th>
              <th style="padding:10px; cursor:pointer;" data-columna="nombre">Nombre <span class="sort-icon">↕</span></th>
              <th style="padding:10px; cursor:pointer;" data-columna="abreviatura">Abreviatura <span class="sort-icon">↕</span></th>
              <th style="padding:10px; cursor:pointer;" data-columna="grado">Grupos <span class="sort-icon">↕</span></th>
              <th style="padding:10px;">Acción</th>
            </tr>
          </thead>
          <tbody id="asignaturasList"></tbody>
        </table>
      </div>
    </div>
  `;

  // ====== 5. Eventos ======

  // Ordenamiento de columnas
  document.querySelectorAll('.asignaturas-table th[data-columna]').forEach(th => {
    const col = th.dataset.columna;
    th.addEventListener('click', () => {
      if (ordenColumna === col) ordenDireccion = ordenDireccion === 'asc' ? 'desc' : 'asc';
      else { ordenColumna = col; ordenDireccion = 'asc'; }
      cargarLista();
    });
  });

  // Filtro por grado
  document.getElementById('gradoFilter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    cargarLista();
  });

  // Búsqueda por texto
  const searchAsignaturas = document.getElementById('searchAsignaturas');
  if (searchAsignaturas) {
    searchAsignaturas.addEventListener('input', () => {
      cargarLista();
    });
  }

  // Agregar asignatura
  document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreAsignatura').value.trim();
    const abreviatura = document.getElementById('abreviaturaAsignatura').value.trim();
    const grado = document.getElementById('gradoAsignatura').value.trim();

    if (!nombre) {
      SIREI.utils.mostrarToast('El nombre es obligatorio', 'error');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Agregando...';

    if (esDuplicado(nombre, grado)) {
      SIREI.utils.mostrarToast(`Ya existe una asignatura "${nombre}" para los grupos "${grado || 'sin grupos'}"`, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Agregar asignatura';
      return;
    }

    const res = await SIREI.api.agregarAsignatura(nombre, abreviatura, grado);
    if (res.success) {
      document.getElementById('nombreAsignatura').value = '';
      document.getElementById('abreviaturaAsignatura').value = '';
      document.getElementById('gradoAsignatura').value = '';
      SIREI.cache.clear('asignaturas');
      await cargarLista();
      SIREI.utils.mostrarToast('Asignatura agregada');
    } else {
      SIREI.utils.mostrarToast(res.message, 'error');
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Agregar asignatura';
  });

  // Importar asignaturas
  document.getElementById('importBtn').addEventListener('click', async () => {
    const raw = document.getElementById('importData').value;
    const resultDiv = document.getElementById('importResult');

    if (!raw.trim()) {
      resultDiv.innerHTML = '<div style="color:#ef4444;">Pega algunos datos primero.</div>';
      return;
    }

    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parseadas = [];
    for (let line of lines) {
      let parts = line.includes('\t') ? line.split('\t') : (line.includes(',') ? line.split(',') : (line.includes(';') ? line.split(';') : line.trim().split(/\s+/)));
      const nombre = parts[0]?.trim();
      if (!nombre) continue;
      parseadas.push({ nombre, abreviatura: (parts[1] || '').trim(), grado: (parts[2] || '').trim() });
    }

    if (parseadas.length === 0) {
      resultDiv.innerHTML = '<div style="color:#ef4444;">No se encontraron datos válidos.</div>';
      return;
    }

    const nuevas = [], duplicados = [];
    for (let item of parseadas) {
      if (esDuplicado(item.nombre, item.grado)) {
        duplicados.push(`${item.nombre} (grupos: ${item.grado || 'ninguno'})`);
      } else if (nuevas.some(ex => ex.nombre === item.nombre && ex.grado === item.grado)) {
        duplicados.push(`${item.nombre} (grupos: ${item.grado || 'ninguno'}) - duplicado en lote`);
      } else {
        nuevas.push(item);
      }
    }

    if (nuevas.length === 0) {
      resultDiv.innerHTML = `<div style="color:#ef4444;">No se importó ninguna. Duplicados: ${duplicados.join(', ')}</div>`;
      return;
    }

    const btn = document.getElementById('importBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Importando...';
    resultDiv.innerHTML = '<div>Importando...</div>';

    try {
      const res = await SIREI.api.peticionAPI('importarAsignaturas', { asignaturas: nuevas });
      if (res.success) {
        let msg = res.message;
        if (duplicados.length) msg += ` Se omitieron ${duplicados.length} duplicados: ${duplicados.join(', ')}`;
        resultDiv.innerHTML = `<div style="color:#10b981;">${msg}</div>`;
        document.getElementById('importData').value = '';
        SIREI.cache.clear('asignaturas');
        await cargarLista();
        SIREI.utils.mostrarToast(msg, 'success');
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:#ef4444;">Error: ${err.message}</div>`;
      SIREI.utils.mostrarToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // ====== 6. Cargar lista inicial ======
  await cargarLista();
};