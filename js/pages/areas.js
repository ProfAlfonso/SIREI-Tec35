// ============================================================
//  pages/areas.js - Pestaña "Áreas"
//  Muestra los accesos a otros módulos del sistema.
// ============================================================

window.cargarAreas = async function(container) {
  // ====== Obtener los grupos (grados) desde el mapa curricular ======
  let grupos = [];
  try {
    const result = await SIREI.api.obtenerAsignaturas();
    if (result.success && result.asignaturas.length > 0) {
      // Extraer grados únicos (campo "grado")
      const gradosSet = new Set();
      result.asignaturas.forEach(asig => {
        if (asig.grado && asig.grado.trim() !== '') {
          gradosSet.add(asig.grado.trim());
        }
      });
      grupos = Array.from(gradosSet).sort();
    }
  } catch (e) {
    console.error('Error al obtener grupos:', e);
  }

  // ====== Generar HTML para los grupos ======
  const gruposHtml = grupos.length > 0 ? grupos.map(g => `
    <a href="#" class="area-card" data-area="coordinacion" data-grupo="${SIREI.utils.escapeHtml(g)}">
      <div class="area-icon"><i class="bi bi-people-fill"></i></div>
      <div class="area-title">Coordinación ${SIREI.utils.escapeHtml(g)}</div>
      <div class="area-desc">Gestión del grupo ${SIREI.utils.escapeHtml(g)}</div>
    </a>
  `).join('') : '<p style="color:#6b7280; grid-column: 1 / -1; text-align:center; padding:20px;">No hay grupos registrados en el mapa curricular.</p>';

  // ====== Renderizar el HTML ======
  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Áreas del Sistema</h2>
      <p style="margin-bottom: 24px; color: #4b5563;">Accede a los diferentes módulos de SIREI haciendo clic en los botones.</p>
      <div class="area-grid">
        <!-- Documentación -->
        <a href="#" class="area-card" data-area="documentacion">
          <div class="area-icon"><i class="bi bi-file-earmark-text"></i></div>
          <div class="area-title">Documentación</div>
          <div class="area-desc">Constancias, cardex, credenciales, historial académico</div>
        </a>
        <!-- Finanzas -->
        <a href="#" class="area-card" data-area="finanzas">
          <div class="area-icon"><i class="bi bi-coin"></i></div>
          <div class="area-title">Finanzas</div>
          <div class="area-desc">Pagos y deudas de los alumnos</div>
        </a>
        <!-- Coordinación de grupos (dinámico) -->
        ${gruposHtml}
        <!-- Área de docencia -->
        <a href="#" class="area-card" data-area="docencia">
          <div class="area-icon"><i class="bi bi-chalkboard"></i></div>
          <div class="area-title">Área de Docencia</div>
          <div class="area-desc">Pasar lista y asignar calificaciones</div>
        </a>
        <!-- Alumnos y padres -->
        <a href="#" class="area-card" data-area="alumnos-padres">
          <div class="area-icon"><i class="bi bi-person-lines-fill"></i></div>
          <div class="area-title">Alumnos y Padres de Familia</div>
          <div class="area-desc">Consulta de resultados y avances</div>
        </a>
      </div>
    </div>
  `;

  // ====== Estilos CSS ======
  const style = document.createElement('style');
  style.textContent = `
    .area-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 10px;
    }
    .area-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background: white;
      border-radius: 16px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
      text-decoration: none;
      color: #1f2937;
      transition: all 0.2s ease;
      text-align: center;
      min-height: 160px;
    }
    .area-card:hover {
      transform: translateY(-4px);
      border-color: #3B82F6;
      box-shadow: 0 12px 20px -8px rgba(59, 130, 246, 0.2);
      background: #f8faff;
    }
    .area-icon {
      font-size: 2.8rem;
      color: #1E3A8A;
      margin-bottom: 12px;
    }
    .area-title {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 4px;
    }
    .area-desc {
      font-size: 0.8rem;
      color: #6b7280;
      line-height: 1.3;
    }
    @media (max-width: 600px) {
      .area-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
      }
      .area-card {
        padding: 16px 12px;
        min-height: 120px;
      }
      .area-icon {
        font-size: 2rem;
      }
    }
  `;
  container.appendChild(style);

  // ====== EVENTOS DE LOS BOTONES ======
  document.querySelectorAll('.area-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const area = card.dataset.area;
      const grupo = card.dataset.grupo || '';
      
      let mensaje = `Accediendo a: ${card.querySelector('.area-title').textContent}`;
      if (grupo) mensaje += ` (Grupo ${grupo})`;
      SIREI.utils.mostrarToast(mensaje, 'success');
      
      if (area === 'coordinacion' && grupo) {
        const navItem = document.querySelector('.nav-item[data-tab="coordinacion"]');
        if (navItem) navItem.click();
      }
    });
  });
};