// ============================================================
//  pages/datos.js - Pestaña "Datos Escolares"
//  Contiene toda la lógica de configuración de la escuela.
//  Esta función se asigna a window para ser llamada desde admin.js.
// ============================================================

/**
 * Función principal que renderiza el formulario de configuración.
 * @param {HTMLElement} container - El contenedor donde se dibujará la interfaz.
 */
window.cargarDatosEscolares = async function(container) {
  // ====== 1. Obtener la configuración actual ======
  let config;
  try {
    config = await SIREI.api.obtenerConfiguracion();
    // Asegurar que todos los campos existan
    const camposEsperados = ["nombreInstitucion","pais","ciudad","codigoPostal","direccion","telefono","celular","cicloEscolar","periodo","logoUrl","decimalesCalificacion","calificacionMinimaAprobatoria","decimales_calificacion","calificacion_minima_aprobatoria"];
    camposEsperados.forEach(campo => {
      if (config[campo] === undefined) config[campo] = "";
    });
    // Normalizar claves antiguas (guion bajo) a camelCase
    if (config.calificacionMinimaAprobatoria === "") {
      config.calificacionMinimaAprobatoria = config.calificacion_minima_aprobatoria || "6";
    }
    if (config.decimalesCalificacion === "") {
      config.decimalesCalificacion = config.decimales_calificacion || "";
    }
  } catch (err) {
    container.innerHTML = `<div class="error">No se pudieron cargar los datos: ${err.message}</div>`;
    return;
  }

  // ====== 2. Actualizar el logo en el header ======
  // Usamos la función que ya está en admin.js (no la hemos movido aún)
  if (typeof actualizarLogoEnHeader === 'function') {
    actualizarLogoEnHeader(config.logoUrl);
  }

  // ====== 3. Estado de edición ======
  let modoEdicion = false;

  // ====== 4. Función que renderiza el formulario ======
  const renderizar = () => {
    const campos = [
      { label: "Nombre de la institución", name: "nombreInstitucion", type: "text" },
      { label: "País", name: "pais", type: "text" },
      { label: "Ciudad", name: "ciudad", type: "text" },
      { label: "Código Postal", name: "codigoPostal", type: "text" },
      { label: "Dirección", name: "direccion", type: "text" },
      { label: "Teléfono", name: "telefono", type: "tel" },
      { label: "Número de celular", name: "celular", type: "tel" },
      { label: "Ciclo escolar", name: "cicloEscolar", type: "text" },
      { label: "Periodo escolar", name: "periodo", type: "text" },
      { label: "Decimales en calificaciones (0-5)", name: "decimalesCalificacion", type: "number", min: "0", max: "5" },
      { label: "Calificación mínima aprobatoria (0-10)", name: "calificacionMinimaAprobatoria", type: "number", min: "0", max: "10" }
    ];

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Configuración de la Escuela</h2>
        <div class="config-logo">
          <h3>Logo de la institución</h3>
          <div id="logoPreviewContainer">${config.logoUrl ? `<img src="${config.logoUrl}" width="120" style="border-radius:12px; border:1px solid #ddd;">` : '<p>Sin logo</p>'}</div>
          <div class="form-group">
            <label>URL del logo (enlace directo a imagen PNG o JPG)</label>
            <input type="url" id="logoUrlInput" placeholder="https://ejemplo.com/logo.png" value="${SIREI.utils.escapeHtml(config.logoUrl)}" ${modoEdicion ? '' : 'disabled'} class="${modoEdicion ? '' : 'input-protected'}">
          </div>
        </div>
        <form id="configForm">
          ${campos.map(campo => `<div class="form-group"><label>${campo.label}</label><input type="${campo.type}" name="${campo.name}" value="${SIREI.utils.escapeHtml(config[campo.name])}" ${campo.type === 'number' ? `min="${campo.min}" max="${campo.max}" step="1"` : ''} ${modoEdicion ? '' : 'disabled'} class="${modoEdicion ? '' : 'input-protected'}"></div>`).join('')}
          <div class="form-buttons">
            ${!modoEdicion ? '<button type="button" id="editBtn" class="btn btn-secondary">Editar datos</button>' : ''}
            ${modoEdicion ? '<button type="submit" id="saveBtn" class="btn btn-primary">Guardar cambios</button>' : ''}
            ${modoEdicion ? '<button type="button" id="cancelBtn" class="btn btn-secondary">Cancelar</button>' : ''}
          </div>
        </form>
      </div>
    `;

    // ====== 5. Evento para previsualizar el logo ======
    const logoUrlInput = document.getElementById('logoUrlInput');
    if (logoUrlInput) {
      logoUrlInput.addEventListener('change', (e) => {
        if (modoEdicion) {
          config.logoUrl = e.target.value;
          const previewDiv = document.getElementById('logoPreviewContainer');
          if (previewDiv) {
            previewDiv.innerHTML = config.logoUrl ? `<img src="${config.logoUrl}" width="120" style="border-radius:12px; border:1px solid #ddd;" onerror="this.parentElement.innerHTML='<p>Error al cargar imagen</p>';">` : '<p>Sin logo</p>';
          }
        }
      });
    }

    // ====== 6. Botones de edición ======
    if (!modoEdicion) {
      document.getElementById('editBtn')?.addEventListener('click', () => {
        modoEdicion = true;
        renderizar();
      });
    } else {
      document.getElementById('cancelBtn')?.addEventListener('click', () => {
        modoEdicion = false;
        renderizar();
      });

      // ====== 7. Guardar cambios ======
      const form = document.getElementById('configForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        const formData = new FormData(form);
        const datosActualizados = {};
        for (let [key, value] of formData.entries()) {
          datosActualizados[key] = value;
        }
        datosActualizados.logoUrl = document.getElementById('logoUrlInput').value;

        try {
          await SIREI.api.guardarConfiguracion(datosActualizados);
          config = { ...config, ...datosActualizados };
          SIREI.utils.mostrarToast('Configuración guardada');
          if (typeof actualizarLogoEnHeader === 'function') {
            actualizarLogoEnHeader(datosActualizados.logoUrl);
          }
          modoEdicion = false;
          renderizar();
        } catch (error) {
          SIREI.utils.mostrarToast('Error al guardar: ' + error.message, 'error');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar cambios';
        }
      });
    }
  };

  // ====== 8. Renderizar inicial ======
  renderizar();
};