// ============================================================
//  sirei.js - Espacio de nombres global para SIREI
//  Contiene todas las funciones de API, utilidades y estado.
//  Este archivo se carga antes que admin.js.
// ============================================================

// Creamos el objeto global SIREI si no existe
var SIREI = SIREI || {};

// Constantes globales
SIREI.MAX_CARRERAS = 4;
SIREI.MAX_TUTORES = 2;
SIREI.MAX_HISTORIAL = 10;

// Sistema de caché global (TTL en ms, por defecto 5 minutos)
SIREI.cache = {
  data: {},
  get: function(key) {
    if (this.data[key] && (Date.now() - this.data[key].timestamp < this.data[key].ttl)) {
      return this.data[key].value;
    }
    return null;
  },
  set: function(key, value, ttl = 300000) {
    this.data[key] = { value: value, timestamp: Date.now(), ttl: ttl };
  },
  clear: function(key) {
    if (key) delete this.data[key];
    else this.data = {};
  }
};

// ========== 1. FUNCIONES DE UTILIDAD ==========
SIREI.utils = {

  /**
   * Escapa caracteres especiales HTML para evitar inyección.
   */
  escapeHtml: function(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  },

  /**
   * Convierte una fecha en formato YYYY-MM-DD (o ISO) a DD/MM/YYYY.
   */
  formatearFechaLocal: function(fechaStr) {
    if (!fechaStr) return '';
    var fechaParte = fechaStr.split('T')[0];
    var partes = fechaParte.split('-');
    if (partes.length === 3) {
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
    return fechaStr;
  },

  /**
   * Formatea una fecha para input de tipo date (YYYY-MM-DD).
   */
  formatearFechaParaInput: function(fechaStr) {
    if (!fechaStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return fechaStr;
    var fecha = new Date(fechaStr);
    if (!isNaN(fecha.getTime())) {
      var año = fecha.getFullYear();
      var mes = String(fecha.getMonth() + 1).padStart(2, '0');
      var dia = String(fecha.getDate()).padStart(2, '0');
      return año + '-' + mes + '-' + dia;
    }
    return '';
  },

  /**
   * Devuelve la fecha de hoy en formato YYYY-MM-DD.
   */
  fechaLocalHoy: function() {
    var hoy = new Date();
    var año = hoy.getFullYear();
    var mes = String(hoy.getMonth() + 1).padStart(2, '0');
    var dia = String(hoy.getDate()).padStart(2, '0');
    return año + '-' + mes + '-' + dia;
  },

  /**
   * Convierte una URL de Google Drive a una URL de thumbnail.
   */
  obtenerUrlImagenDrive: function(urlOriginal) {
    if (!urlOriginal) return '';
    if (urlOriginal.includes('thumbnail?id=')) return urlOriginal;
    
    // Buscar ID en formato ?id=ID o &id=ID
    var matchId = urlOriginal.match(/[?&]id=([^&]+)/);
    if (matchId && matchId[1]) {
      return 'https://drive.google.com/thumbnail?id=' + matchId[1] + '&sz=w500';
    }
    
    // Buscar ID en formato /file/d/ID/view
    var matchFileD = urlOriginal.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD && matchFileD[1]) {
      return 'https://drive.google.com/thumbnail?id=' + matchFileD[1] + '&sz=w500';
    }
    
    return urlOriginal;
  },

  /**
   * Muestra un toast (notificación) en la esquina inferior derecha.
   */
  mostrarToast: function(mensaje, tipo) {
    tipo = tipo || 'success';
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = mensaje;
    if (tipo === 'error') {
      toast.style.background = '#ef4444';
    } else if (tipo === 'warning') {
      toast.style.background = '#f59e0b';
    } else {
      toast.style.background = '#10b981';
    }
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', function() { toast.remove(); });
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
  },

  /**
   * Resalta un campo de formulario con borde rojo.
   */
  resaltarError: function(idCampo) {
    var campo = document.getElementById(idCampo);
    if (campo) campo.classList.add('input-error');
  },

  /**
   * Devuelve HTML para un spinner moderno.
   */
  crearSpinner: function() {
    return '<div class="loader-moderno"><div class="spinner"></div><p>Cargando información...</p></div>';
  },

  /**
   * Diálogo de confirmación (puede evolucionar a un modal custom, por ahora usa window.confirm)
   */
  confirmar: function(mensaje) {
    return window.confirm(mensaje);
  }
};

// ========== 2. FUNCIONES DE API (Comunicación con el backend) ==========
SIREI.api = {

  /**
   * Función base para hacer peticiones al backend con token de sesión
   */
  peticionAPI: function(accion, data) {
    data = data || {};
    var token = sessionStorage.getItem('sirei_token');
    
    // Si la acción no es 'logout', verificamos el token
    if (accion !== 'logout' && !token) {
      window.location.href = 'index.html';
      return Promise.reject('No hay sesión activa');
    }

    var params = new URLSearchParams();
    params.append('accion', accion);
    if (token) params.append('token', token);
    
    for (var key in data) {
      if (data.hasOwnProperty(key) && data[key] !== undefined && data[key] !== null) {
        if (typeof data[key] === 'object') {
          params.append(key, JSON.stringify(data[key]));
        } else {
          params.append(key, data[key]);
        }
      }
    }
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    .then(function(response) {
      if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
      return response.json();
    })
    .then(function(json) {
      return json;
    });
  },

  // Configuración
  obtenerConfiguracion: function() {
    return this.peticionAPI('obtenerConfiguracion')
      .then(function(res) {
        if (!res.success) throw new Error(res.message || 'Error al obtener configuración');
        return res.datos;
      });
  },
  guardarConfiguracion: function(datos) {
    return this.peticionAPI('guardarConfiguracion', datos);
  },

  // Asignaturas
  obtenerAsignaturas: function() {
    return this.peticionAPI('obtenerAsignaturas');
  },
  agregarAsignatura: function(nombre, abreviatura, grado) {
    return this.peticionAPI('agregarAsignatura', { nombre: nombre, abreviatura: abreviatura, grado: grado });
  },
  eliminarAsignatura: function(id) {
    return this.peticionAPI('eliminarAsignatura', { id: id });
  },
  importarAsignaturas: function(asignaturas) {
    return this.peticionAPI('importarAsignaturas', { asignaturas: asignaturas });
  },

  // Docentes
  obtenerDocentes: function() {
    return this.peticionAPI('obtenerDocentes');
  },
  agregarDocente: function(datos) {
    return this.peticionAPI('agregarDocente', datos);
  },
  eliminarDocente: function(id) {
    return this.peticionAPI('eliminarDocente', { id: id });
  },
  actualizarDocente: function(id, datos) {
    return this.peticionAPI('actualizarDocente', { id: id, ...datos });
  },
  actualizarCarreras: function(id, carreras) {
    return this.peticionAPI('actualizarCarreras', { id: id, carreras: carreras });
  },

  // Alumnos
  obtenerAlumnos: function() {
    return this.peticionAPI('obtenerAlumnos');
  },
  agregarAlumno: function(datos) {
    return this.peticionAPI('agregarAlumno', datos);
  },
  eliminarAlumno: function(id) {
    return this.peticionAPI('eliminarAlumno', { id: id });
  },
  actualizarAlumno: function(id, datos) {
    return this.peticionAPI('actualizarAlumno', { id: id, ...datos });
  },
  actualizarTutores: function(id, tutores) {
    return this.peticionAPI('actualizarTutores', { id: id, tutores: tutores });
  },
  actualizarHistorial: function(id, historial) {
    return this.peticionAPI('actualizarHistorial', { id: id, historial: historial });
  },

  // ====== ACTITUDES ======
  obtenerActitudes: function() {
    return this.peticionAPI('obtenerActitudes');
  },
  agregarActitud: function(datos) {
    return this.peticionAPI('agregarActitud', datos);
  },
  actualizarActitud: function(id, datos) {
    return this.peticionAPI('actualizarActitud', { id: id, ...datos });
  },
  eliminarActitud: function(id) {
    return this.peticionAPI('eliminarActitud', { id: id });
  }
}; // <--- CIERRE CORRECTO DEL OBJETO SIREI.api

// ========== 3. ESTADO GLOBAL (Store) ==========
SIREI.store = {
  user: { name: '', role: 'Administrador' },
  config: null,
  asignaturas: [],
  docentes: [],
  alumnos: [],
  selectedDocenteId: null,
  selectedAlumnoId: null
};