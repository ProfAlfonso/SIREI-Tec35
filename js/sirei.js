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

// ========== 2. CACHÉ LOCAL CON VENCIMIENTO ==========
// Guarda catálogos (grupos, asignaturas, alumnos, periodos) en localStorage
// para no volver a pedirlos en cada carga de pantalla.
SIREI.TTL = {
  CATALOGOS: 10 * 60 * 1000,   // grupos y asignaturas: 10 minutos
  ALUMNOS: 5 * 60 * 1000,      // alumnos por grupo: 5 minutos
  PERIODOS: 10 * 60 * 1000      // periodos: 10 minutos
};

SIREI.cacheLocal = {
  PREFIJO: 'sirei_cache_v1_',
  _mem: {},

  _clave: function (clave) { return this.PREFIJO + clave; },

  get: function (clave) {
    var k = this._clave(clave);
    var ahora = Date.now();
    var enMemoria = this._mem[k];
    if (enMemoria && enMemoria.exp > ahora) return enMemoria.valor;
    try {
      var crudo = localStorage.getItem(k);
      if (!crudo) return null;
      var obj = JSON.parse(crudo);
      if (!obj || !obj.exp || obj.exp <= ahora) {
        try { localStorage.removeItem(k); } catch (e) {}
        delete this._mem[k];
        return null;
      }
      this._mem[k] = obj;
      return obj.valor;
    } catch (e) {
      return null;
    }
  },

  set: function (clave, valor, ttlMs) {
    var k = this._clave(clave);
    var obj = { valor: valor, exp: Date.now() + (ttlMs || SIREI.TTL.CATALOGOS) };
    this._mem[k] = obj;
    try { localStorage.setItem(k, JSON.stringify(obj)); } catch (e) {}
  },

  borrar: function (clave) {
    var k = this._clave(clave);
    delete this._mem[k];
    try { localStorage.removeItem(k); } catch (e) {}
  },

  limpiar: function () {
    this._mem = {};
    try {
      var prefijo = this.PREFIJO;
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(prefijo) === 0) localStorage.removeItem(k);
      });
    } catch (e) {}
  }
};

// ========== 3. TELEMETRÍA DE PETICIONES ==========
// Mide automáticamente cada fetch (acción, duración y estado).
// - Con ?debug=1 en la URL (o localStorage.sirei_debug = '1') muestra un panel.
// - Sin debug, los datos quedan disponibles en consola:
//     SIREI.telemetria.reporte()
SIREI.telemetria = {
  MAX: 120,
  llamadas: [],
  eventos: [],
  _instalado: false,
  _debug: false,
  _fetchOriginal: null,
  _panel: null,
  _btn: null,

  instalar: function () {
    if (this._instalado) return;
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    this._instalado = true;
    this._debug = this._detectarDebug();
    var self = this;
    this._fetchOriginal = window.fetch.bind(window);
    window.fetch = function (recurso, opciones) {
      var t0 = self._ahora();
      var accion = self._accionDe(opciones);
      var promesa = self._fetchOriginal(recurso, opciones);
      promesa.then(function (respuesta) {
        try { self._registrar(accion, self._ahora() - t0, true, respuesta && respuesta.status); } catch (e) {}
      }, function () {
        try { self._registrar(accion, self._ahora() - t0, false, 0); } catch (e) {}
      });
      return promesa;
    };

    if (this._debug) {
      if (document.body) this._montar();
      else document.addEventListener('DOMContentLoaded', function () { self._montar(); });
      window.addEventListener('load', function () {
        self.evento('carga de página', Math.round(self._ahora()));
        setTimeout(function () { self._actualizarPanel(); }, 1200);
      });
    }
  },

  _detectarDebug: function () {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        try { localStorage.setItem('sirei_debug', '1'); } catch (e) {}
        return true;
      }
      return localStorage.getItem('sirei_debug') === '1';
    } catch (e) { return false; }
  },

  _ahora: function () {
    try { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    catch (e) { return Date.now(); }
  },

  _accionDe: function (opciones) {
    try {
      if (!opciones || !opciones.body) return 'GET';
      var body = opciones.body;
      if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
        return body.get('accion') || 'desconocida';
      }
      if (typeof body === 'string') {
        try { return new URLSearchParams(body).get('accion') || 'desconocida'; } catch (e) {}
      }
      return 'desconocida';
    } catch (e) { return 'desconocida'; }
  },

  _registrar: function (accion, ms, ok, status) {
    var redondeado = Math.max(0, Math.round(ms));
    this.llamadas.push({
      accion: accion,
      ms: redondeado,
      ok: ok,
      status: status || 0,
      hora: new Date().toLocaleTimeString('es-MX')
    });
    if (this.llamadas.length > this.MAX) this.llamadas.shift();
    if (this._debug) this._actualizarPanel();
  },

  evento: function (nombre, ms) {
    this.eventos.push({ nombre: nombre, ms: Math.max(0, Math.round(ms || 0)), hora: new Date().toLocaleTimeString('es-MX') });
    if (this.eventos.length > 40) this.eventos.shift();
    if (this._debug) this._actualizarPanel();
  },

  // Resumen agrupado por acción, ordenado por tiempo total.
  resumen: function () {
    var mapa = {};
    this.llamadas.forEach(function (llamada) {
      var clave = llamada.accion;
      if (!mapa[clave]) mapa[clave] = { accion: clave, llamadas: 0, totalMs: 0, maxMs: 0, errores: 0 };
      mapa[clave].llamadas++;
      mapa[clave].totalMs += llamada.ms;
      mapa[clave].maxMs = Math.max(mapa[clave].maxMs, llamada.ms);
      if (!llamada.ok) mapa[clave].errores++;
    });
    var lista = Object.keys(mapa).map(function (k) {
      var item = mapa[k];
      item.promedioMs = Math.round(item.totalMs / item.llamadas);
      return item;
    });
    lista.sort(function (a, b) { return b.totalMs - a.totalMs; });
    return lista;
  },

  totales: function () {
    var total = 0;
    var tiempo = 0;
    var errores = 0;
    this.llamadas.forEach(function (l) {
      total++;
      tiempo += l.ms;
      if (!l.ok) errores++;
    });
    return { llamadas: total, tiempoMs: Math.round(tiempo), errores: errores };
  },

  reporte: function () {
    var resumen = this.resumen();
    var totales = this.totales();
    console.groupCollapsed('[SIREI] Telemetría: ' + totales.llamadas + ' llamadas · ' + totales.tiempoMs + ' ms');
    console.table(resumen);
    console.table(this.llamadas.slice(-20));
    if (this.eventos.length) console.table(this.eventos);
    console.groupEnd();
    return { totales: totales, resumen: resumen, llamadas: this.llamadas, eventos: this.eventos };
  },

  limpiar: function () {
    this.llamadas = [];
    this.eventos = [];
    this._actualizarPanel();
  },

  _montar: function () {
    if (this._panel || !document.body) return;
    var self = this;
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.id = 'sireiTelemetriaBtn';
    boton.title = 'Ver tiempos de las peticiones';
    boton.textContent = '⏱';
    boton.style.cssText = 'position:fixed; left:12px; bottom:56px; z-index:2147482001; width:44px; height:44px; border-radius:50%; border:none; background:#0f172a; color:#fff; font-size:1.2rem; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.3);';
    boton.addEventListener('click', function () { self._alternarPanel(); });
    document.body.appendChild(boton);
    this._btn = boton;

    var panel = document.createElement('div');
    panel.id = 'sireiTelemetriaPanel';
    panel.style.cssText = 'display:none; position:fixed; left:12px; bottom:108px; z-index:2147482002; width:min(420px, calc(100vw - 24px)); max-height:60vh; overflow:auto; background:#0b1220; color:#e5e7eb; border-radius:12px; padding:12px; box-shadow:0 12px 40px rgba(0,0,0,.45); font-family:Consolas, monospace; font-size:0.78rem;';
    panel.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">' +
      '<strong style="font-size:0.85rem;">⏱ Telemetría SIREI</strong>' +
      '<span style="display:flex; gap:6px;">' +
      '<button type="button" id="sireiTelemetriaCopiar" style="background:#374151; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer;">Copiar</button>' +
      '<button type="button" id="sireiTelemetriaLimpiar" style="background:#374151; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer;">Limpiar</button>' +
      '<button type="button" id="sireiTelemetriaCerrar" style="background:#374151; color:#fff; border:none; border-radius:6px; padding:4px 8px; cursor:pointer;">✕</button>' +
      '</span></div>' +
      '<div id="sireiTelemetriaResumen"></div>' +
      '<div id="sireiTelemetriaDetalle" style="margin-top:8px;"></div>' +
      '<div style="margin-top:8px; color:#9ca3af; font-size:0.7rem;">Abre con ?debug=1. Desactiva con localStorage.removeItem(\'sirei_debug\').</div>';
    document.body.appendChild(panel);
    this._panel = panel;
    panel.querySelector('#sireiTelemetriaCerrar').addEventListener('click', function () { panel.style.display = 'none'; });
    panel.querySelector('#sireiTelemetriaLimpiar').addEventListener('click', function () { self.limpiar(); });
    panel.querySelector('#sireiTelemetriaCopiar').addEventListener('click', function () {
      var texto = JSON.stringify(self.reporte(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          if (SIREI.utils) SIREI.utils.mostrarToast('Telemetría copiada.');
        }).catch(function () { window.prompt('Copia la telemetría:', texto); });
      } else {
        window.prompt('Copia la telemetría:', texto);
      }
    });
    this._actualizarPanel();
  },

  _alternarPanel: function () {
    if (!this._panel) this._montar();
    if (!this._panel) return;
    this._panel.style.display = (this._panel.style.display === 'none' || !this._panel.style.display) ? 'block' : 'none';
    this._actualizarPanel();
  },

  _actualizarPanel: function () {
    if (!this._debug || !this._panel) return;
    var totales = this.totales();
    var resumen = this.resumen().slice(0, 8);
    var filas = resumen.map(function (item) {
      return '<tr><td style="padding:3px 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">' + item.accion + '</td>' +
        '<td style="padding:3px 4px; text-align:right;">' + item.llamadas + '</td>' +
        '<td style="padding:3px 4px; text-align:right;">' + item.promedioMs + ' ms</td>' +
        '<td style="padding:3px 4px; text-align:right; color:' + (item.errores ? '#fca5a5' : '#86efac') + ';">' + item.maxMs + ' ms</td></tr>';
    }).join('');
    var resumenEl = this._panel.querySelector('#sireiTelemetriaResumen');
    if (resumenEl) {
      resumenEl.innerHTML = '<div style="color:#93c5fd;">' + totales.llamadas + ' llamadas · ' + totales.tiempoMs + ' ms · ' + totales.errores + ' error(es)</div>' +
        '<table style="width:100%; border-collapse:collapse; margin-top:6px;"><thead><tr style="color:#9ca3af; font-size:0.7rem;"><th style="text-align:left;">Acción</th><th style="text-align:right;">N</th><th style="text-align:right;">Prom.</th><th style="text-align:right;">Máx.</th></tr></thead><tbody>' +
        (filas || '<tr><td colspan="4" style="padding:6px; color:#9ca3af;">Sin llamadas registradas.</td></tr>') + '</tbody></table>';
    }
    var detalleEl = this._panel.querySelector('#sireiTelemetriaDetalle');
    if (detalleEl) {
      var eventos = this.eventos.slice(-3).map(function (ev) {
        return '<div style="color:#fcd34d;">' + ev.nombre + ': ' + ev.ms + ' ms</div>';
      }).join('');
      var ultimas = this.llamadas.slice(-6).reverse().map(function (l) {
        return '<div style="display:flex; justify-content:space-between; gap:6px; border-top:1px solid #1f2937; padding:2px 0;">' +
          '<span style="color:#9ca3af;">' + l.hora + '</span>' +
          '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + l.accion + '</span>' +
          '<span style="color:' + (l.ok ? '#86efac' : '#fca5a5') + ';">' + l.ms + ' ms</span></div>';
      }).join('');
      detalleEl.innerHTML = eventos + '<div style="margin-top:4px; color:#9ca3af; font-size:0.7rem;">Últimas llamadas</div>' + ultimas;
    }
  }
};

// Arranque de la telemetría al cargar este archivo (antes que las páginas).
try { SIREI.telemetria.instalar(); } catch (e) {}


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
  },

  // ====== PANELES COMBINADOS (una sola llamada por pantalla) ======
  // Devuelve idDocente, catálogos, asignaciones y, si hay clase activa,
  // alumnos + asistencias + salidas.
  panelDocente: function(nombreDocente) {
    return this.peticionAPI('obtenerPanelDocente', { nombre: nombreDocente });
  },

  // Devuelve alumnos + evidencias + entregas de un grupo/asignatura.
  panelAcademico: function(idGrupo, idAsignatura, idSubgrupo) {
    return this.peticionAPI('obtenerPanelAcademico', {
      idGrupo: idGrupo,
      idAsignatura: idAsignatura || '',
      idSubgrupo: idSubgrupo || ''
    });
  },

  // ====== PREFECTO ======
  panelPrefecto: function() {
    return this.peticionAPI('obtenerPanelPrefecto', {});
  },
  alumnosPrefecto: function(params) {
    return this.peticionAPI('obtenerAlumnosPrefecto', params || {});
  },
  perfilAlumnoPrefecto: function(curp, idPeriodo) {
    return this.peticionAPI('obtenerPerfilAlumnoPrefecto', { curp: curp, idPeriodo: idPeriodo || '' });
  },
  gruposPrefecto: function(idPeriodo) {
    return this.peticionAPI('obtenerGruposPrefecto', { idPeriodo: idPeriodo || '' });
  },
  grupoPrefecto: function(idGrupo, idPeriodo) {
    return this.peticionAPI('obtenerGrupoPrefecto', { idGrupo: idGrupo, idPeriodo: idPeriodo || '' });
  },
  registrosPrefecto: function(params) {
    return this.peticionAPI('obtenerRegistrosPrefecto', params || {});
  },
  guardarRegistroPrefecto: function(datos) {
    return this.peticionAPI('guardarRegistroPrefecto', datos || {});
  },
  actualizarRegistroPrefecto: function(datos) {
    return this.peticionAPI('actualizarRegistroPrefecto', datos || {});
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

// ========== 4. LECTOR QR UNIFICADO ==========
// Overlay a pantalla completa con la cámara ARRIBA (sin tener que bajar),
// alta sensibilidad y modo continuo opcional.
//
// Opciones de SIREI.qr.abrir():
//   titulo       Texto del encabezado.
//   subtitulo    Texto secundario.
//   continuo     true (por defecto): sigue escaneando; false: cierra al leer.
//   etiqueta     function(codigo) -> nombre a mostrar (null = desconocido).
//   progreso     function() -> texto de progreso opcional.
//   onLeido      function(codigo) -> texto de detalle opcional.
//   onCerrar     function() al cerrar manualmente.
//
// Robustez:
//   - Solo hay una instancia activa: abrir espera a que la cámara anterior
//     se libere por completo (evita "la cámara está en uso" hasta recargar).
//   - Si la primera configuración falla, reintenta con configuraciones simples.
//   - La cámara se libera al cerrar, al cambiar de pestaña y al salir.
//
// Cámara:
//   - Intenta abrir la cámara trasera (la adecuada para leer QR).
//   - Si el equipo abre la delantera, se cambia sola a la trasera cuando
//     el dispositivo reporta más de una cámara.
//   - El botón "🔄 Cámara" permite cambiar manualmente; la elección se
//     recuerda en ese equipo para las próximas veces.
SIREI.qr = {
  _instancia: null,
  _overlay: null,
  _opciones: null,
  _onCerrar: null,
  _activo: false,
  _abriendo: false,
  _iniciando: false,
  _camaraLista: false,
  _procesando: false,
  _pausado: false,
  _intentos: 0,
  _ultimoCodigo: '',
  _ultimoMs: 0,
  _ultimaDetencion: Promise.resolve(),
  _camaras: [],
  _camaraActual: null,
  _camaraPreferidaId: '',
  _preferenciaGuardada: false,
  _autoCambioHecho: false,
  _cambiando: false,

  disponible: function () {
    return typeof Html5Qrcode !== 'undefined';
  },

  // Configuraciones de cámara, de la más completa a la más compatible.
  // Importante: html5-qrcode solo acepta como primer argumento un objeto con
  // UNA sola clave ({ facingMode: { exact: 'environment' } } o { deviceId: ... }).
  // Por eso aquí se usa la opción `videoConstraints`, que sí admite resolución
  // y enfoque continuo, y permite elegir cámara por id.
  _configuraciones: function (dispositivoId) {
    var qrbox = function (ancho, alto) {
      var menor = Math.min(ancho, alto);
      var lado = Math.max(180, Math.floor(menor * 0.75));
      return { width: lado, height: lado };
    };
    var formatos = null;
    try {
      if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
        formatos = [Html5QrcodeSupportedFormats.QR_CODE];
      }
    } catch (e) { formatos = null; }

    function base(constraints, extra) {
      var cfg = { fps: 15, qrbox: qrbox, aspectRatio: 1.0, disableFlip: false };
      if (formatos) cfg.formatsToSupport = formatos;
      if (constraints) cfg.videoConstraints = constraints;
      if (extra) {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) cfg[k] = extra[k];
        }
      }
      return cfg;
    }

    var lista = [];

    // 1) Si el docente ya eligió una cámara, se intenta esa primero.
    if (dispositivoId) {
      lista.push({
        camara: { deviceId: { exact: dispositivoId } },
        config: base({
          deviceId: { exact: dispositivoId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          advanced: [{ focusMode: 'continuous' }]
        }, { experimentalFeatures: { useBarCodeDetectorIfSupported: true } })
      });
      lista.push({
        camara: { deviceId: { exact: dispositivoId } },
        config: base({ deviceId: { exact: dispositivoId } })
      });
    }

    // 2) Cámara trasera forzada (la ideal para leer QR).
    lista.push({
      camara: { facingMode: { exact: 'environment' } },
      config: base({
        facingMode: { exact: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }]
      }, { experimentalFeatures: { useBarCodeDetectorIfSupported: true } })
    });
    lista.push({
      camara: { facingMode: { exact: 'environment' } },
      config: base({ facingMode: { exact: 'environment' } })
    });

    // 3) Cámara trasera "preferida" y, al final, cualquier cámara.
    lista.push({
      camara: { facingMode: 'environment' },
      config: base(null)
    });
    lista.push({
      camara: { facingMode: 'user' },
      config: base(null, { fps: 10 })
    });

    return lista;
  },

  _estado: function (texto, color) {
    var el = document.getElementById('sireiQrEstado');
    if (!el) return;
    el.innerHTML = '<span class="sirei-qr-pulse" style="width:10px;height:10px;border-radius:50%;background:' +
      (color || '#3b82f6') + ';display:inline-block;margin-right:6px;"></span>' +
      SIREI.utils.escapeHtml(texto);
  },

  _actualizarProgreso: function () {
    var el = document.getElementById('sireiQrProgreso');
    if (!el) return;
    var texto = '';
    try {
      if (this._opciones && typeof this._opciones.progreso === 'function') {
        texto = this._opciones.progreso() || '';
      }
    } catch (e) { texto = ''; }
    el.textContent = texto;
    el.style.display = texto ? 'block' : 'none';
  },

  _mensajeError: function (err) {
    var nombre = '';
    var msg = '';
    try {
      nombre = String((err && err.name) || '');
      msg = String((err && err.message) || err || '');
    } catch (e) {}
    var todo = (nombre + ' ' + msg).toLowerCase();
    if (todo.indexOf('notallowed') >= 0 || todo.indexOf('permission') >= 0 || todo.indexOf('denied') >= 0 || todo.indexOf('not allowed') >= 0) {
      return 'Permiso de cámara denegado. Actívalo para este sitio en los ajustes del navegador.';
    }
    if (todo.indexOf('notfound') >= 0 || todo.indexOf('devicesnotfound') >= 0 || todo.indexOf('no camera') >= 0) {
      return 'No se encontró ninguna cámara en este dispositivo.';
    }
    if (todo.indexOf('notreadable') >= 0 || todo.indexOf('trackstart') >= 0 || todo.indexOf('in use') >= 0 || todo.indexOf('en uso') >= 0) {
      return 'La cámara está ocupada por otra aplicación. Ciérrala e inténtalo de nuevo.';
    }
    if (todo.indexOf('overconstrained') >= 0) {
      return 'La cámara no soporta esta configuración. Reintenta.';
    }
    if (todo.indexOf('abort') >= 0) {
      return 'La cámara se interrumpió. Reintenta.';
    }
    return 'No se pudo abrir la cámara. ' + (msg || 'Inténtalo de nuevo.');
  },

  _mostrarError: function (err) {
    this._cambiando = false;
    var texto = this._mensajeError(err);
    this._estado('⚠ ' + texto, '#ef4444');
    var btn = document.getElementById('sireiQrReintentar');
    if (btn) btn.style.display = 'inline-block';
    try { SIREI.utils.mostrarToast(texto, 'error'); } catch (e) {}
  },

  _ocultarError: function () {
    var btn = document.getElementById('sireiQrReintentar');
    if (btn) btn.style.display = 'none';
  },

  _liberarVideo: function (overlay) {
    try {
      var contenedor = overlay || this._overlay;
      if (!contenedor || !contenedor.querySelector) return;
      var video = contenedor.querySelector('#sireiQrLector video');
      if (!video) return;
      var pistas = video.srcObject && video.srcObject.getTracks ? video.srcObject.getTracks() : [];
      for (var i = 0; i < pistas.length; i++) {
        try { pistas[i].stop(); } catch (e) {}
      }
      try { video.srcObject = null; } catch (e) {}
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute('src'); } catch (e) {}
      try { video.load(); } catch (e) {}
    } catch (e) {}
  },

  _pararLector: async function (lector) {
    if (!lector) return;
    try { await lector.stop(); } catch (e) {}
    try { lector.clear(); } catch (e) {}
  },

  _construirOverlay: function () {
    var self = this;
    var opciones = this._opciones || {};
    var overlay = document.createElement('div');
    overlay.id = 'sireiQrOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:#0b1220; z-index:2147483700; display:flex; flex-direction:column;';
    overlay.innerHTML = `
      <style>
        #sireiQrLector { width:100%; max-width:560px; margin:0 auto; background:#000; min-height:160px; }
        #sireiQrLector video { width:100% !important; height:auto !important; max-height:52vh; object-fit:cover; display:block; }
        #sireiQrLector [id$="__dashboard"] { display:none !important; }
        .sirei-qr-pulse { animation: sireiQrPulse 1.2s ease-in-out infinite; }
        @keyframes sireiQrPulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.35;transform:scale(.8);} }
      </style>
      <div style="flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:#111827; color:#fff;">
        <div style="min-width:0;">
          <div style="font-weight:700; font-size:1rem;">${SIREI.utils.escapeHtml(opciones.titulo || 'Escanear código QR')}</div>
          <div style="font-size:0.78rem; color:#9ca3af;">${SIREI.utils.escapeHtml(opciones.subtitulo || 'Apunta la cámara al código')}</div>
        </div>
        <div style="display:flex; gap:8px; flex:0 0 auto;">
          <button type="button" id="sireiQrCambiar" title="Cambiar cámara" aria-label="Cambiar cámara" style="display:none; background:#374151; color:#fff; border:none; border-radius:8px; padding:8px 10px; font-size:0.85rem; font-weight:600;">🔄 Cámara</button>
          <button type="button" id="sireiQrLinterna" title="Linterna" style="display:none; background:#374151; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-size:0.9rem; font-weight:600;">🔦</button>
          <button type="button" id="sireiQrCerrar" style="background:#374151; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-size:0.9rem; font-weight:600;">✕ Cerrar</button>
        </div>
      </div>
      <div style="flex:0 0 auto;"><div id="sireiQrLector"></div></div>
      <div style="flex:0 0 auto; padding:10px 14px 4px 14px; background:#0b1220;">
        <div id="sireiQrEstado" style="color:#e5e7eb; font-size:0.95rem;">Iniciando cámara…</div>
        <div id="sireiQrProgreso" style="display:none; color:#93c5fd; font-size:0.85rem; font-weight:700; margin-top:3px;"></div>
        <div id="sireiQrAyuda" style="display:none; color:#9ca3af; font-size:0.78rem; margin-top:3px;">Si no enfoca bien, cambia de cámara con el botón 🔄.</div>
        <button type="button" id="sireiQrReintentar" style="display:none; margin-top:8px; background:#1e40af; color:#fff; border:none; border-radius:8px; padding:9px 14px; font-size:0.9rem; font-weight:700;">🔄 Reintentar cámara</button>
      </div>
      <div id="sireiQrHistorial" style="flex:1 1 auto; overflow-y:auto; padding:6px 14px 16px 14px; background:#0b1220; color:#e5e7eb; font-size:0.9rem;"></div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._pausado = false;
    this._camaraLista = false;

    overlay.querySelector('#sireiQrCerrar').addEventListener('click', function () {
      self.cerrar();
    });
    overlay.querySelector('#sireiQrReintentar').addEventListener('click', function () {
      self._ocultarError();
      self._camaraLista = false;
      self._iniciarCamara(0);
    });
    var btnCambiarCamara = overlay.querySelector('#sireiQrCambiar');
    if (btnCambiarCamara) {
      btnCambiarCamara.addEventListener('click', function () { self._cambiarCamara(); });
    }
    this._actualizarProgreso();
  },

  _agregarHistorial: function (nombre, detalle, ok) {
    var cont = document.getElementById('sireiQrHistorial');
    if (!cont) return;
    var fila = document.createElement('div');
    fila.style.cssText = 'display:flex; gap:8px; align-items:center; padding:7px 0; border-bottom:1px solid #1f2937;';
    var icono = document.createElement('span');
    icono.textContent = ok ? '✅' : '⚠️';
    var nom = document.createElement('span');
    nom.style.cssText = 'font-weight:700; color:' + (ok ? '#d1fae5' : '#fecaca') + ';';
    nom.textContent = nombre;
    fila.appendChild(icono);
    fila.appendChild(nom);
    if (detalle) {
      var det = document.createElement('span');
      det.style.cssText = 'color:#93c5fd; font-size:0.8rem; font-weight:700; margin-left:auto; text-align:right;';
      det.textContent = detalle;
      fila.appendChild(det);
    }
    cont.insertBefore(fila, cont.firstChild);
  },

  // Inicia (o reintenta) la cámara. indice = configuración a probar.
  _iniciarCamara: async function (indice) {
    if (!this._activo || this._iniciando) return;
    var self = this;
    var configs = this._configuraciones(this._camaraPreferidaId);
    var config = configs[indice];
    var overlay = this._overlay;
    if (!overlay || !config) {
      this._abriendo = false;
      this._mostrarError({ message: 'Cámara no disponible' });
      return;
    }
    var contenedor = overlay.querySelector('#sireiQrLector');
    if (!contenedor) { this._abriendo = false; return; }

    this._iniciando = true;
    contenedor.innerHTML = '';
    this._estado(indice === 0 ? 'Iniciando cámara…' : 'Reintentando cámara…', '#60a5fa');

    var lector = null;
    try {
      lector = new Html5Qrcode('sireiQrLector');
    } catch (e) {
      this._iniciando = false;
      this._abriendo = false;
      this._mostrarError(e);
      return;
    }
    this._instancia = lector;

    try {
      await lector.start(
        config.camara,
        config.config,
        function (texto) { self._alLeer(texto); },
        function () {}
      );
      if (!this._activo) {
        await this._pararLector(lector);
        this._iniciando = false;
        return;
      }
      this._intentos = indice;
      this._iniciando = false;
      this._abriendo = false;
      this._camaraLista = true;
      this._ocultarError();
      this._estado('Buscando un código…', '#3b82f6');
      this._prepararLinterna(overlay);
      this._actualizarProgreso();
      this._detectarCamaras();
    } catch (err) {
      try { await lector.stop(); } catch (e) {}
      try { await lector.clear(); } catch (e) {}
      this._iniciando = false;
      if (this._instancia === lector) this._instancia = null;
      this._liberarVideo(overlay);
      if (!this._activo) { this._abriendo = false; return; }
      if (indice + 1 < configs.length) {
        setTimeout(function () {
          if (self._activo && !self._camaraLista) self._iniciarCamara(indice + 1);
        }, 400);
        return;
      }
      this._abriendo = false;
      this._mostrarError(err);
    }
  },

  _alLeer: async function (texto) {
    if (!this._activo || this._procesando) return;
    var codigo = String(texto == null ? '' : texto).trim();
    if (!codigo) return;
    var ahora = Date.now();
    if (codigo === this._ultimoCodigo && (ahora - this._ultimoMs) < 2500) return;
    this._ultimoCodigo = codigo;
    this._ultimoMs = ahora;
    this._procesando = true;
    this._camaraLista = false;

    var lector = this._instancia;
    this._instancia = null;
    if (lector) {
      try { await lector.stop(); } catch (e) {}
      try { lector.clear(); } catch (e) {}
    }
    if (!this._activo) { this._procesando = false; return; }

    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }

    var opciones = this._opciones || {};
    var etiqueta = null;
    if (typeof opciones.etiqueta === 'function') {
      try { etiqueta = opciones.etiqueta(codigo); } catch (e) { etiqueta = null; }
    }
    var esConocido = !(etiqueta === null || etiqueta === undefined || etiqueta === '');
    var nombre = esConocido ? String(etiqueta) : 'Código no registrado';
    this._estado('✔ ' + nombre, esConocido ? '#10b981' : '#ef4444');

    var detalle = '';
    if (typeof opciones.onLeido === 'function') {
      try {
        var res = await opciones.onLeido(codigo);
        if (res && typeof res === 'object') detalle = res.detalle || '';
        else if (typeof res === 'string') detalle = res;
      } catch (e) {
        console.error('Error al procesar el código QR:', e);
      }
    }
    this._agregarHistorial(nombre, detalle, esConocido);
    this._actualizarProgreso();

    this._procesando = false;
    if (!this._activo) return;

    if (opciones.continuo === false) {
      this.cerrar();
      return;
    }

    var self = this;
    setTimeout(function () {
      if (!self._activo || self._cambiando) return;
      self._estado('Buscando el siguiente código…', '#3b82f6');
      self._actualizarProgreso();
      self._iniciarCamara(0);
    }, 700);
  },

  // Muestra el botón de linterna solo si la cámara actual lo soporta.
  _prepararLinterna: function (overlay) {
    try {
      if (!overlay) return;
      var btn = overlay.querySelector('#sireiQrLinterna');
      if (!btn) return;
      btn.style.display = 'none';
      btn.dataset.encendida = 'false';
      btn.style.background = '#374151';
      var video = overlay.querySelector('#sireiQrLector video');
      if (!video || !video.srcObject) return;
      var pista = video.srcObject.getVideoTracks()[0];
      if (!pista || typeof pista.getCapabilities !== 'function') return;
      var caps = pista.getCapabilities();
      if (!caps || !caps.torch) return;
      btn.style.display = 'block';
      btn.onclick = function () {
        var encendida = btn.dataset.encendida === 'true';
        pista.applyConstraints({ advanced: [{ torch: !encendida }] }).then(function () {
          btn.dataset.encendida = String(!encendida);
          btn.style.background = !encendida ? '#f59e0b' : '#374151';
        }).catch(function () {});
      };
    } catch (e) {}
  },

  // ---------- Selección y cambio de cámara ----------
  _leerCamaraActual: function () {
    try {
      var overlay = this._overlay;
      if (!overlay) return null;
      var video = overlay.querySelector('#sireiQrLector video');
      if (!video || !video.srcObject) return null;
      var pista = video.srcObject.getVideoTracks()[0];
      if (!pista) return null;
      var ajustes = (typeof pista.getSettings === 'function') ? pista.getSettings() : {};
      return {
        id: ajustes.deviceId || '',
        etiqueta: pista.label || '',
        facingMode: ajustes.facingMode || ''
      };
    } catch (e) { return null; }
  },

  _listarCamaras: async function () {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      var dispositivos = await navigator.mediaDevices.enumerateDevices();
      var lista = [];
      for (var i = 0; i < dispositivos.length; i++) {
        if (dispositivos[i].kind === 'videoinput') {
          lista.push({
            id: dispositivos[i].deviceId,
            etiqueta: dispositivos[i].label || ('Cámara ' + (lista.length + 1))
          });
        }
      }
      return lista;
    } catch (e) { return []; }
  },

  _indiceCamaraActual: function () {
    if (!this._camaraActual) return -1;
    for (var i = 0; i < this._camaras.length; i++) {
      if (this._camaras[i].id === this._camaraActual.id) return i;
    }
    return -1;
  },

  _esCamaraFrontal: function (camara, actual) {
    var modo = String((actual && actual.facingMode) || '').toLowerCase();
    if (modo === 'user') return true;
    if (modo === 'environment') return false;
    var texto = String((camara && camara.etiqueta) || '') + ' ' + String((actual && actual.etiqueta) || '');
    texto = texto.toLowerCase();
    if (/front|user|selfie|frontal|delantera/.test(texto)) return true;
    if (/back|rear|environment|trasera|trasero|posterior/.test(texto)) return false;
    return null;
  },

  _buscarCamaraTrasera: function () {
    for (var i = 0; i < this._camaras.length; i++) {
      var texto = String(this._camaras[i].etiqueta || '').toLowerCase();
      if (/back|rear|environment|trasera|trasero|posterior/.test(texto)) return i;
    }
    return -1;
  },

  _actualizarBotonCamara: function () {
    var btn = document.getElementById('sireiQrCambiar');
    var ayuda = document.getElementById('sireiQrAyuda');
    if (!btn) return;
    if (this._camaras.length > 1) {
      btn.style.display = 'inline-block';
      var idx = this._indiceCamaraActual();
      var nombre = (idx >= 0 && this._camaras[idx].etiqueta) ? this._camaras[idx].etiqueta : '';
      btn.title = 'Cambiar cámara' + (nombre ? ': ' + nombre : '');
      if (ayuda) ayuda.style.display = 'block';
    } else {
      btn.style.display = 'none';
      if (ayuda) ayuda.style.display = 'none';
    }
  },

  // Detecta las cámaras disponibles después de abrir la primera.
  _detectarCamaras: async function () {
    if (!this._activo) return;
    this._cambiando = false;
    var actual = this._leerCamaraActual();
    this._camaraActual = actual;
    var lista = await this._listarCamaras();
    if (!this._activo) return;
    this._camaras = lista;

    var idx = this._indiceCamaraActual();
    if (idx < 0 && actual && actual.id) {
      this._camaras.push({ id: actual.id, etiqueta: actual.etiqueta || 'Cámara actual' });
      idx = this._camaras.length - 1;
    }

    // Para los siguientes escaneos se intenta conservar la misma cámara.
    if (actual && actual.id) {
      if (!this._preferenciaGuardada) {
        this._camaraPreferidaId = actual.id;
      } else if (this._camaraPreferidaId && actual.id !== this._camaraPreferidaId) {
        // La cámara guardada ya no está disponible: se actualiza sola.
        this._camaraPreferidaId = actual.id;
        try { localStorage.setItem('sireiCamaraPreferida', actual.id); } catch (e) {}
      }
    }
    this._actualizarBotonCamara();

    // Si abrió la delantera y existe una trasera, se cambia automáticamente.
    // Si no se puede determinar (sin etiquetas), se reintenta en la próxima
    // detección o el docente usa el botón "🔄 Cámara".
    if (!this._autoCambioHecho && !this._preferenciaGuardada) {
      var frontal = this._esCamaraFrontal(this._camaras[idx], actual);
      if (frontal === true) {
        this._autoCambioHecho = true;
        var idxTrasera = this._buscarCamaraTrasera();
        if (idxTrasera >= 0 && idxTrasera !== idx) {
          this._cambiarCamaraA(idxTrasera, true);
        }
      } else if (frontal === false) {
        this._autoCambioHecho = true;
      }
    }
  },

  _cambiarCamara: function () {
    var self = this;
    if (!this._activo || this._cambiando || this._iniciando) return;

    if (this._camaras.length < 2) {
      this._listarCamaras().then(function (lista) {
        self._camaras = lista || [];
        if (self._camaras.length < 2) {
          SIREI.utils.mostrarToast('Este dispositivo no reporta más de una cámara.', 'warning');
          self._actualizarBotonCamara();
          return;
        }
        self._cambiarCamara();
      });
      return;
    }

    var idx = this._indiceCamaraActual();
    var nuevo = (idx + 1) % this._camaras.length;
    this._cambiarCamaraA(nuevo, false);
  },

  _cambiarCamaraA: async function (indice, automatico) {
    if (!this._activo || this._cambiando) return;
    if (indice < 0 || indice >= this._camaras.length) return;

    var camara = this._camaras[indice];
    this._cambiando = true;
    this._procesando = true;
    this._camaraLista = false;
    this._estado('Cambiando cámara…', '#3b82f6');

    var lector = this._instancia;
    this._instancia = null;
    if (lector) {
      try { await lector.stop(); } catch (e) {}
      try { lector.clear(); } catch (e) {}
    }
    this._liberarVideo(this._overlay);

    this._camaraPreferidaId = camara.id || '';
    this._preferenciaGuardada = true;
    try {
      if (camara.id) localStorage.setItem('sireiCamaraPreferida', camara.id);
    } catch (e) {}

    this._procesando = false;
    this._iniciarCamara(0);

    if (!automatico) {
      SIREI.utils.mostrarToast('Cámara: ' + (camara.etiqueta || ('Cámara ' + (indice + 1))), 'warning');
    }
  },

  _pausar: function () {
    if (!this._activo || !this._camaraLista || this._pausado) return;
    var self = this;
    this._pausado = true;
    this._camaraLista = false;
    this._procesando = false;
    var lector = this._instancia;
    this._instancia = null;
    this._estado('Cámara pausada. Vuelve a esta pestaña para continuar.', '#f59e0b');
    if (lector) {
      this._pararLector(lector).then(function () {
        self._liberarVideo(self._overlay);
      });
    } else {
      this._liberarVideo(this._overlay);
    }
  },

  _reanudar: function () {
    if (!this._activo || !this._pausado) return;
    this._pausado = false;
    var contenedor = document.getElementById('sireiQrLector');
    if (contenedor) contenedor.innerHTML = '';
    this._estado('Reanudando cámara…', '#3b82f6');
    this._iniciarCamara(0);
  },

  _detener: function (silencioso) {
    var self = this;
    var anterior = this._ultimaDetencion;
    var promesa = (async function () {
      try { await anterior; } catch (e) {}
      var lector = self._instancia;
      var overlay = self._overlay;
      var cb = self._onCerrar;
      self._instancia = null;
      self._overlay = null;
      self._activo = false;
      self._abriendo = false;
      self._iniciando = false;
      self._camaraLista = false;
      self._procesando = false;
      self._pausado = false;
      self._camaraActual = null;
      self._camaras = [];
      self._cambiando = false;
      self._onCerrar = null;

      if (overlay) overlay.style.display = 'none';
      if (lector) {
        try { await lector.stop(); } catch (e) {}
        try { lector.clear(); } catch (e) {}
      }
      self._liberarVideo(overlay);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!silencioso && typeof cb === 'function') {
        try { cb(); } catch (e) {}
      }
    })();
    this._ultimaDetencion = promesa;
    return promesa;
  },

  cerrar: function (silencioso) {
    return this._detener(silencioso);
  },

  abrir: function (opciones) {
    var self = this;
    opciones = opciones || {};
    if (!this.disponible()) {
      SIREI.utils.mostrarToast('El lector QR no está disponible. Revisa tu conexión.', 'error');
      return;
    }
    if (this._abriendo) return;
    this._abriendo = true;
    this._opciones = opciones;
    var alCerrar = typeof opciones.onCerrar === 'function' ? opciones.onCerrar : null;
    this._onCerrar = null;
    this._procesando = false;
    this._pausado = false;
    this._intentos = 0;
    this._camaraLista = false;
    this._ultimoCodigo = '';
    this._ultimoMs = 0;
    this._camaras = [];
    this._camaraActual = null;
    this._autoCambioHecho = false;
    this._cambiando = false;
    try {
      this._camaraPreferidaId = localStorage.getItem('sireiCamaraPreferida') || '';
    } catch (e) {
      this._camaraPreferidaId = '';
    }
    this._preferenciaGuardada = !!this._camaraPreferidaId;

    this._detener(true).then(function () {
      self._abriendo = true;
      self._onCerrar = alCerrar;
      self._activo = true;
      self._construirOverlay();
      self._iniciarCamara(0);
    }).catch(function () {
      self._abriendo = false;
    });
  }
};

// La cámara se libera cuando la app pasa a segundo plano (evita "cámara en uso").
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    try {
      if (!SIREI.qr || !SIREI.qr._activo) return;
      if (document.visibilityState === 'hidden') SIREI.qr._pausar();
      else SIREI.qr._reanudar();
    } catch (e) {}
  });
  window.addEventListener('pagehide', function () {
    try { if (SIREI.qr) SIREI.qr._pausar(); } catch (e) {}
  });
}


// ========== 5. COLA DE ESCRITURA EN SEGUNDO PLANO ==========
// Guarda los registros localmente y los envía al backend en segundo plano.
// Si no hay conexión, se conservan y se sincronizan cuando vuelva el internet.
SIREI.cola = {
  CLAVE: 'sirei_cola_v1',
  MAX_INTENTOS: 8,
  INTERVALO_MS: 20000,

  _procesando: false,
  _pausada: false,
  _iniciado: false,
  _timer: null,

  _leer: function () {
    try {
      const crudo = localStorage.getItem(this.CLAVE);
      const lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (e) {
      return [];
    }
  },

  _guardar: function (lista) {
    try { localStorage.setItem(this.CLAVE, JSON.stringify(lista)); } catch (e) {}
    this.renderEstado();
  },

  pendientes: function () {
    return this._leer().filter(function (i) { return !i.fallido; });
  },

  contar: function () {
    return this.pendientes().length;
  },

  contarFallidos: function () {
    return this._leer().filter(function (i) { return i.fallido; }).length;
  },

  _firma: function (accion, params) {
    const claves = Object.keys(params || {}).sort();
    return accion + '|' + claves.map(function (k) { return k + '=' + String(params[k]); }).join('&');
  },

  /**
   * Encola una escritura. Si ya hay un envío idéntico pendiente, NO lo duplica
   * (protege contra doble toque / doble disparo del QR).
   */
  agregar: function (accion, params) {
    const lista = this._leer();
    const firma = this._firma(accion, params);

    for (let i = 0; i < lista.length; i++) {
      if (!lista[i].fallido && lista[i].firma === firma) {
        return lista[i].id;
      }
    }

    const item = {
      id: 'q' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      firma: firma,
      accion: accion,
      params: params || {},
      intentos: 0,
      creado: Date.now(),
      ultimoError: '',
      fallido: false
    };
    lista.push(item);
    this._guardar(lista);
    this.procesar();
    return item.id;
  },

  reintentarFallidos: function () {
    const lista = this._leer();
    lista.forEach(function (i) {
      if (i.fallido) { i.fallido = false; i.intentos = 0; i.ultimoError = ''; }
    });
    this._guardar(lista);
    this._pausada = false;
    SIREI.utils.mostrarToast('Reintentando ' + this.pendientes().length + ' registro(s)…');
    this.procesar();
  },

  descartarFallidos: function () {
    this._guardar(this._leer().filter(function (i) { return !i.fallido; }));
    SIREI.utils.mostrarToast('Registros con error descartados.', 'warning');
  },

  procesar: async function () {
    if (this._procesando || this._pausada) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.renderEstado(); return; }
    if (typeof API_URL === 'undefined') return;

    const token = sessionStorage.getItem('sirei_token');
    if (!token) return;

    const pendientes = this.pendientes();
    if (pendientes.length === 0) { this.renderEstado(); return; }

    this._procesando = true;
    this.renderEstado();

    try {
      for (let n = 0; n < pendientes.length; n++) {
        const item = pendientes[n];
        if (this._pausada) break;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;

        const body = new URLSearchParams();
        body.append('accion', item.accion);
        body.append('token', token);
        for (const k in item.params) {
          if (!Object.prototype.hasOwnProperty.call(item.params, k)) continue;
          const v = item.params[k];
          if (v === undefined || v === null) continue;
          body.append(k, (typeof v === 'object') ? JSON.stringify(v) : v);
        }

        let respuesta = null;
        let errorRed = null;
        try {
          const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
          });
          respuesta = await resp.json();
        } catch (e) {
          errorRed = e;
        }

        const lista = this._leer();
        const idx = lista.findIndex(function (x) { return x.id === item.id; });
        if (idx === -1) continue;

        if (respuesta && respuesta.success === true) {
          lista.splice(idx, 1);
          this._guardar(lista);
          continue;
        }

        if (respuesta && respuesta.success === false) {
          const msg = String(respuesta.message || '');
          if (/sesi[oó]n/i.test(msg)) {
            this._pausada = true;
            SIREI.utils.mostrarToast('Tu sesión expiró. Vuelve a iniciar sesión para sincronizar.', 'error');
            break;
          }
          lista[idx].fallido = true;
          lista[idx].ultimoError = msg || 'Error del servidor';
          this._guardar(lista);
          SIREI.utils.mostrarToast('No se pudo guardar: ' + (msg || 'error'), 'error');
          continue;
        }

        // Error de red: se conserva para reintentar más adelante
        lista[idx].intentos = (lista[idx].intentos || 0) + 1;
        lista[idx].ultimoError = errorRed ? String(errorRed.message || errorRed) : 'Sin respuesta del servidor';
        if (lista[idx].intentos >= this.MAX_INTENTOS) lista[idx].fallido = true;
        this._guardar(lista);
        break;
      }
    } finally {
      this._procesando = false;
      this.renderEstado();
    }
  },

  renderEstado: function () {
    if (typeof document === 'undefined' || !document.body) return;

    let el = document.getElementById('sireiColaEstado');
    const total = this.contar();
    const fallidos = this.contarFallidos();

    if (total === 0 && fallidos === 0 && !this._procesando) {
      if (el) el.style.display = 'none';
      return;
    }

    if (!el) {
      el = document.createElement('button');
      el.id = 'sireiColaEstado';
      el.type = 'button';
      el.style.cssText = 'position:fixed; left:12px; bottom:12px; z-index:2147482000; border:none; border-radius:999px; padding:9px 15px; font-size:0.82rem; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,.28); cursor:pointer;';
      el.addEventListener('click', function () {
        if (el.dataset.modo === 'reintentar') {
          SIREI.cola.reintentarFallidos();
        } else {
          SIREI.cola._pausada = false;
          SIREI.utils.mostrarToast('Sincronizando…');
          SIREI.cola.procesar();
        }
      });
      document.body.appendChild(el);
    }

    el.style.display = 'block';
    if (this._procesando) {
      el.textContent = '🔄 Guardando…';
      el.style.background = '#1E3A8A';
      el.style.color = '#ffffff';
      el.dataset.modo = 'sync';
    } else if (total > 0) {
      el.textContent = '⏳ ' + total + ' sin guardar';
      el.style.background = '#f59e0b';
      el.style.color = '#111827';
      el.dataset.modo = 'sync';
    } else {
      el.textContent = '⚠️ ' + fallidos + ' con error · reintentar';
      el.style.background = '#ef4444';
      el.style.color = '#ffffff';
      el.dataset.modo = 'reintentar';
    }
  },

  iniciar: function () {
    if (this._iniciado) return;
    this._iniciado = true;
    const self = this;

    window.addEventListener('online', function () {
      self._pausada = false;
      SIREI.utils.mostrarToast('Conexión restablecida. Sincronizando registros…');
      self.procesar();
    });

    window.addEventListener('offline', function () {
      self.renderEstado();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') self.procesar();
    });

    this._timer = setInterval(function () { self.procesar(); }, this.INTERVALO_MS);
    this.renderEstado();
    this.procesar();
  }
};

// Arranque automático de la cola en cualquier panel autenticado
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    try {
      if (typeof API_URL !== 'undefined' && sessionStorage.getItem('sirei_token')) {
        SIREI.cola.iniciar();
      }
    } catch (e) {}
  });
}
