// ============================================================
//  actitudes_docente.js - Asignación de actitudes (Docente)
//  Versión 2.0 - CON DEPURACIÓN Y CORRECCIÓN DE CARGA
// ============================================================

window.cargarActitudesDocente = async function(container, idDocente, idGrupo, idAsignatura, periodo, token, idSubgrupo) {
  // === Estado ===
  let actitudesDisponibles = [];
  let alumnosGrupo = [];
  let asignacionesRecientes = [];

  // === Obtener actitudes desde el coordinador (backend) ===
  async function obtenerActitudes() {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerActitudesCoordinador',
          token: token
        })
      });
      const data = await response.json();
      if (data.success) {
        return data.actitudes || [];
      } else {
        console.error("Error en la respuesta:", data.message);
        return [];
      }
    } catch (error) {
      console.error("Error al obtener actitudes:", error);
      return [];
    }
  }

  // === Obtener alumnos del grupo (desde la clase activa) ===
  async function obtenerAlumnosGrupo() {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerAlumnosPorGrupo',
          token: token,
          idGrupo: idGrupo,
          idSubgrupo: idSubgrupo || ''
        })
      });
      const data = await response.json();
      if (data.success) return data.alumnos || [];
      return [];
    } catch (error) {
      console.error("❌ Error al obtener alumnos:", error);
      return [];
    }
  }

  // === Obtener asignaciones recientes ===
  async function obtenerAsignacionesRecientes() {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          accion: 'obtenerAsignacionesActitudes',
          token: token,
          idClase: idGrupo
        })
      });
      const data = await response.json();
      if (data.success) return data.asignaciones || [];
      return [];
    } catch (error) {
      console.error("❌ Error al obtener asignaciones:", error);
      return [];
    }
  }

  // === Renderizar la interfaz ===
  async function renderizar() {
    container.innerHTML = `
      <div class="actitudes-docente">
        <!-- Selector de actitud -->
        <div style="background:white; border-radius:8px; padding:16px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin-top:0;">Selecciona una actitud</h3>
          <select id="selectActitud" style="width:100%; padding:12px; border-radius:8px; border:1px solid #d1d5db; font-size:1rem;">
            <option value="">-- Elige una actitud --</option>
          </select>
          <div id="resumenActitud" style="display:none; margin-top:12px; padding:12px; border-radius:8px; background:#f9fafb;"></div>
          <div id="containerOtraActitud" style="display:none; margin-top:8px;">
            <input type="text" id="inputOtraActitud" placeholder="Escribe el nombre de la actitud..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
          </div>
        </div>

        <!-- Observaciones y asignación -->
        <div style="background:white; border-radius:8px; padding:16px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div style="margin-bottom:12px;">
            <label style="font-weight:600;">Observaciones (opcional)</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <textarea id="observacionesInput" rows="2" style="flex:1; padding:10px; border-radius:8px; border:1px solid #d1d5db; resize:vertical;"></textarea>
              <button id="btnDictar" class="btn btn-secondary" style="padding:10px 14px;">🎤 Dictar</button>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-weight:600;">Alumno</label>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <input type="text" id="inputAlumno" list="alumnosList" placeholder="Nombre o CURP..." style="flex:3; min-width:200px; padding:10px; border-radius:8px; border:1px solid #d1d5db;">
              <datalist id="alumnosList"></datalist>
              <button id="btnEscanearQR" class="btn btn-primary" style="flex:1; padding:10px 14px;">📷 QR</button>
              <button id="btnAsignar" class="btn btn-success" style="flex:1; padding:10px 14px;">✅ Asignar</button>
            </div>
            <div id="qr-reader-actitud" style="width:100%; max-width:300px; margin:10px auto; display:none;"></div>
          </div>
        </div>

        <!-- Historial de asignaciones -->
        <div style="background:white; border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <h3 style="margin-top:0;">Asignaciones recientes</h3>
          <div id="historialAsignaciones" style="max-height:300px; overflow-y:auto;">
            <p style="color:#6b7280;">Cargando...</p>
          </div>
        </div>
      </div>
    `;

    // === Cargar datos ===
    try {
      // 1. Obtener actitudes
      actitudesDisponibles = await obtenerActitudes();

      // 2. Obtener alumnos
      alumnosGrupo = await obtenerAlumnosGrupo();

      // 3. Obtener asignaciones recientes
      asignacionesRecientes = await obtenerAsignacionesRecientes();

      // === LLENAR SELECT DE ACTITUDES ===
      const select = document.getElementById('selectActitud');
      // Limpiar opciones existentes (excepto la primera)
      select.innerHTML = '<option value="">-- Elige una actitud --</option>';

      if (actitudesDisponibles.length === 0) {
        console.warn("⚠️ No hay actitudes disponibles en el frontend.");
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '-- No hay actitudes para alumnos --';
        select.appendChild(option);
        select.disabled = true;
        // Mostrar mensaje de advertencia
        const resumenDiv = document.getElementById('resumenActitud');
        resumenDiv.style.display = 'block';
        resumenDiv.innerHTML = `
          <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:8px; padding:12px; color:#92400e;">
            ⚠️ No hay actitudes configuradas para alumnos. El administrador debe crearlas en el panel de administración.
          </div>
        `;
      } else {
        actitudesDisponibles.forEach(act => {
          const option = document.createElement('option');
          option.value = act.id;
          option.textContent = `${act.insignia || '🔲'} ${act.nombre} (${act.clasificacion})`;
          select.appendChild(option);
        });
        const opcionOtra = document.createElement('option');
        opcionOtra.value = '__otra__';
        opcionOtra.textContent = '✏️ Otra...';
        select.appendChild(opcionOtra);
        select.disabled = false;
        const resumenDiv = document.getElementById('resumenActitud');
        resumenDiv.style.display = 'none';
        resumenDiv.innerHTML = '';
      }

      // === LLENAR DATALIST DE ALUMNOS ===
      const datalist = document.getElementById('alumnosList');
      alumnosGrupo.forEach(alumno => {
        const option = document.createElement('option');
        option.value = alumno.nombreCompleto;
        option.dataset.curp = alumno.curp;
        datalist.appendChild(option);
      });

      // === MOSTRAR HISTORIAL ===
      mostrarHistorial(asignacionesRecientes);

      // === EVENTOS ===
      // Selección de actitud -> mostrar resumen
      select.addEventListener('change', () => {
        const id = select.value;
        const act = actitudesDisponibles.find(a => a.id == id);
        const resumenDiv = document.getElementById('resumenActitud');
        const containerOtra = document.getElementById('containerOtraActitud');
        if (id === '__otra__') {
          resumenDiv.style.display = 'none';
          containerOtra.style.display = 'block';
        } else if (act) {
          containerOtra.style.display = 'none';
          const color = act.clasificacion === 'positiva' ? '#10b981' : act.clasificacion === 'negativa' ? '#ef4444' : '#3b82f6';
          resumenDiv.style.display = 'block';
          resumenDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:2rem;">${act.insignia || '🔲'}</span>
              <div>
                <strong style="font-size:1.1rem;">${SIREI.utils.escapeHtml(act.nombre)}</strong>
                <span style="display:inline-block; padding:2px 10px; border-radius:12px; background:${color}20; color:${color}; font-weight:600; font-size:0.8rem; margin-left:8px;">
                  ${SIREI.utils.escapeHtml(act.clasificacion)}
                </span>
                ${act.descripcion ? `<div><a href="${act.descripcion}" target="_blank" style="font-size:0.85rem;">📄 Ver descripción</a></div>` : ''}
              </div>
            </div>
          `;
        } else {
          containerOtra.style.display = 'none';
          resumenDiv.style.display = 'none';
        }
      });

      // Botón Asignar
      document.getElementById('btnAsignar').addEventListener('click', asignarActitud);

      // Enter en inputAlumno
      document.getElementById('inputAlumno').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') asignarActitud();
      });

      // Botón QR
      let qrReader = null;
      document.getElementById('btnEscanearQR').addEventListener('click', () => {
        const readerContainer = document.getElementById('qr-reader-actitud');
        if (qrReader) {
          qrReader.stop().catch(() => {});
          qrReader = null;
          readerContainer.style.display = 'none';
          return;
        }
        readerContainer.style.display = 'block';
        readerContainer.innerHTML = '';
        qrReader = new Html5Qrcode("qr-reader-actitud");
        const config = { fps: 10, qrbox: { width: 200, height: 200 } };
        qrReader.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            const curp = decodedText.trim().toUpperCase();
            const alumno = alumnosGrupo.find(a => a.curp === curp);
            if (!alumno) {
              SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
              return;
            }
            document.getElementById('inputAlumno').value = alumno.nombreCompleto;
            await asignarActitudPorCURP(curp);
            qrReader.stop().catch(() => {});
            qrReader = null;
            readerContainer.style.display = 'none';
          },
          (err) => {}
        );
      });

      // Botón dictar (Speech Recognition)
      document.getElementById('btnDictar').addEventListener('click', () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          SIREI.utils.mostrarToast('Tu navegador no soporta dictado por voz.', 'error');
          return;
        }
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'es-ES';
        recognition.start();
        recognition.onresult = (event) => {
          const texto = event.results[0][0].transcript;
          const textarea = document.getElementById('observacionesInput');
          textarea.value += (textarea.value ? ' ' : '') + texto;
        };
        recognition.onerror = () => {
          SIREI.utils.mostrarToast('Error al reconocer voz, intenta de nuevo.', 'error');
        };
      });

    } catch (error) {
      console.error('❌ Error en renderizar:', error);
      container.innerHTML = `<div class="error">Error al cargar: ${error.message}</div>`;
    }
  }

  // === Función para asignar actitud ===
  async function asignarActitud() {
    const select = document.getElementById('selectActitud');
    const idActitud = select.value;
    if (!idActitud) {
      SIREI.utils.mostrarToast('Selecciona una actitud primero.', 'error');
      return;
    }
    const inputAlumno = document.getElementById('inputAlumno');
    const nombreAlumno = inputAlumno.value.trim();
    if (!nombreAlumno) {
      SIREI.utils.mostrarToast('Ingresa el nombre del alumno.', 'error');
      return;
    }
    const alumno = alumnosGrupo.find(a => a.nombreCompleto.toLowerCase() === nombreAlumno.toLowerCase());
    if (!alumno) {
      SIREI.utils.mostrarToast('Alumno no encontrado en este grupo.', 'error');
      return;
    }
    await asignarActitudPorCURP(alumno.curp);
  }

  async function asignarActitudPorCURP(curp) {
    const select = document.getElementById('selectActitud');
    const idActitud = select.value;
    if (!idActitud) {
      SIREI.utils.mostrarToast('Selecciona una actitud primero.', 'error');
      return;
    }
    const observaciones = document.getElementById('observacionesInput').value.trim();

    let nombreActitudPersonalizada = '';
    if (idActitud === '__otra__') {
      nombreActitudPersonalizada = document.getElementById('inputOtraActitud').value.trim();
      if (!nombreActitudPersonalizada) {
        SIREI.utils.mostrarToast('Escribe el nombre de la actitud personalizada.', 'error');
        return;
      }
    }

    const btnAsignar = document.getElementById('btnAsignar');
    btnAsignar.disabled = true;
    btnAsignar.textContent = '⏳ Asignando...';

    const params = {
      accion: 'asignarActitud',
      token: token,
      idClase: idGrupo,
      idGrupo: idGrupo,
      idAsignatura: idAsignatura || '',
      periodo: periodo || '',
      idDocente: idDocente,
      curpAlumno: curp,
      idActitud: idActitud,
      notas: observaciones
    };
    if (nombreActitudPersonalizada) {
      params.nombreActitudPersonalizada = nombreActitudPersonalizada;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params)
      });
      const result = await response.json();
      if (result.success) {
        SIREI.utils.mostrarToast('✅ Actitud asignada correctamente');
        const nuevaAsignacion = result.asignacion;
        asignacionesRecientes.unshift({
          ...nuevaAsignacion,
          curpAlumno: curp
        });
        mostrarHistorial(asignacionesRecientes);
        document.getElementById('inputAlumno').value = '';
        document.getElementById('observacionesInput').value = '';
        if (navigator.vibrate) navigator.vibrate(50);
      } else {
        SIREI.utils.mostrarToast(result.message || 'Error al asignar', 'error');
      }
    } catch (e) {
      console.error("❌ Error en asignación:", e);
      SIREI.utils.mostrarToast('Error de conexión: ' + e.message, 'error');
    } finally {
      btnAsignar.disabled = false;
      btnAsignar.textContent = '✅ Asignar';
    }
  }

  // === Mostrar historial ===
  function mostrarHistorial(asignaciones) {
    const containerHistorial = document.getElementById('historialAsignaciones');
    if (!containerHistorial) return;
    if (asignaciones.length === 0) {
      containerHistorial.innerHTML = '<p style="color:#6b7280;">No hay asignaciones recientes.</p>';
      return;
    }
    containerHistorial.innerHTML = asignaciones.slice(0, 20).map(a => {
      const color = a.clasificacion === 'positiva' ? '#10b981' : a.clasificacion === 'negativa' ? '#ef4444' : '#3b82f6';
      const fecha = new Date(a.fechaAsignacion);
      const fechaStr = fecha.toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      return `
        <div style="display:flex; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid #f3f4f6;">
          <span style="font-size:1.5rem;">${a.insignia || '🔲'}</span>
          <div style="flex:1;">
            <div style="font-weight:600;">${SIREI.utils.escapeHtml(a.nombreAlumno)}</div>
            <div style="font-size:0.85rem; color:#4b5563;">
              ${SIREI.utils.escapeHtml(a.nombreActitud)}
              <span style="display:inline-block; padding:0 8px; border-radius:10px; background:${color}20; color:${color}; font-size:0.75rem;">${a.clasificacion}</span>
            </div>
            ${a.notas ? `<div style="font-size:0.8rem; color:#6b7280;">📝 ${SIREI.utils.escapeHtml(a.notas)}</div>` : ''}
          </div>
          <div style="font-size:0.75rem; color:#6b7280;">${fechaStr}</div>
        </div>
      `;
    }).join('');
  }

  // === Iniciar ===
  await renderizar();
};