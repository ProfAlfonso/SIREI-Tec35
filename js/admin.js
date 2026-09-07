// ============================================================
//  SIREI - Panel Administrativo (admin.js)
//  Versión 3.3 - REFACTORIZADO Y OPTIMIZADO
//  - Todas las funciones auxiliares y de API se toman de SIREI
//  - Límites: 5 tutores, 5 historiales
//  - Fecha de ingreso y formateo de fechas funcional
//  - Carga dinámica de páginas (Datos, Asignaturas, Docentes, Alumnos, Áreas)
// ============================================================

// ========== 1. FUNCIONES DE LOGO Y HEADER ==========
function actualizarLogoEnHeader(url) {
  const headerLogo = document.getElementById('headerLogo');
  if (!headerLogo) return;
  headerLogo.innerHTML = '';
  if (!url || url.trim() === '') return;
  
  // Procesar URL si es de Drive
  const urlFinal = SIREI.utils.obtenerUrlImagenDrive(url);
  
  const img = document.createElement('img');
  img.alt = "Logo de la institución";
  img.style.maxHeight = "50px";
  img.style.width = "auto";
  img.style.objectFit = "contain";
  headerLogo.innerHTML = '<div style="font-size:12px; color:#6b7280;">...</div>';
  
  img.onload = () => {
    headerLogo.innerHTML = '';
    headerLogo.appendChild(img);
  };
  img.onerror = () => {
    headerLogo.innerHTML = '<div style="font-size:12px; color:#ef4444;">Error de Logo</div>';
  };
  img.src = urlFinal;
}



// ========== 4. CARGA DE PESTAÑAS (dinámica y persistente) ==========
async function cargarTabla(tab) {
  const mainContainer = document.getElementById('tabContent');
  if (!mainContainer) return;

  // Ocultar todas las pestañas existentes
  Array.from(mainContainer.children).forEach(child => {
    child.style.display = 'none';
  });

  // Buscar si ya existe el contenedor de la pestaña actual
  let tabContainer = document.getElementById('tab-container-' + tab);

  if (!tabContainer) {
    // Si no existe, lo creamos
    tabContainer = document.createElement('div');
    tabContainer.id = 'tab-container-' + tab;
    mainContainer.appendChild(tabContainer);
    
    // Mostramos el spinner solo la primera vez
    tabContainer.innerHTML = SIREI.utils.crearSpinner();

    try {
      switch(tab) {
        case 'datos':
          if (typeof window.cargarDatosEscolares === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/datos.js';
            script.onload = () => window.cargarDatosEscolares(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Datos Escolares.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarDatosEscolares(tabContainer);
          }
          break;

        case 'asignaturas':
          if (typeof window.cargarAsignaturas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/asignaturas.js';
            script.onload = () => window.cargarAsignaturas(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Asignaturas.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarAsignaturas(tabContainer);
          }
          break;

        case 'docentes':
          if (typeof window.cargarDocentes === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/docentes.js';
            script.onload = () => window.cargarDocentes(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Docentes.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarDocentes(tabContainer);
          }
          break;

        case 'alumnos':
          if (typeof window.cargarAlumnos === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/alumnos.js';
            script.onload = () => window.cargarAlumnos(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Alumnos.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarAlumnos(tabContainer);
          }
          break;

        case 'areas':
          if (typeof window.cargarAreas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/areas.js';
            script.onload = () => window.cargarAreas(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Áreas.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarAreas(tabContainer);
          }
          break;

 	case 'actitudinal':
  if (typeof window.cargarActitudinal === 'undefined') {
    const script = document.createElement('script');
    script.src = 'js/pages/actitudinal.js';
    script.onload = () => window.cargarActitudinal(tabContainer);
    script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Actitudinal.</div>';
    document.head.appendChild(script);
  } else {
    window.cargarActitudinal(tabContainer);
  }
  break;

        case 'usuarios':
          if (typeof window.cargarUsuarios === 'undefined') {
            const script = document.createElement('script');
            script.src = 'js/pages/usuarios.js';
            script.onload = () => window.cargarUsuarios(tabContainer);
            script.onerror = () => tabContainer.innerHTML = '<div class="error">Error al cargar Usuarios.</div>';
            document.head.appendChild(script);
          } else {
            window.cargarUsuarios(tabContainer);
          }
          break;

        default:
          tabContainer.innerHTML = '<div class="error">Pestaña no reconocida.</div>';
      }
    } catch (error) {
      console.error("Error al cargar pestaña:", error);
      tabContainer.innerHTML = `<div class="error">Error al cargar: ${error.message}</div>`;
    }
  } else {
    // Si ya existe, simplemente lo mostramos (los datos ya están cargados en el DOM)
    tabContainer.style.display = 'block';
  }
}

