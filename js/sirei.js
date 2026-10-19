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

  disponible: function () {
    return typeof Html5Qrcode !== 'undefined';
  },

  // Tres configuraciones de cámara, de la más completa a la más compatible.
  _configuraciones: function () {
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

    function base(extra) {
      var cfg = { fps: 15, qrbox: qrbox, aspectRatio: 1.0, disableFlip: false };
      if (formatos) cfg.formatsToSupport = formatos;
      if (extra) {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) cfg[k] = extra[k];
        }
      }
      return cfg;
    }

    return [
      {
        camara: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          advanced: [{ focusMode: 'continuous' }]
        },
        config: base({ experimentalFeatures: { useBarCodeDetectorIfSupported: true } })
      },
      {
        camara: { facingMode: { ideal: 'environment' } },
        config: base({ fps: 10 })
      },
      {
        camara: { facingMode: 'user' },
        config: base({ fps: 10 })
      }
    ];
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
          <button type="button" id="sireiQrLinterna" title="Linterna" style="display:none; background:#374151; color:#fff; border:none; border-radius:8px; padding:8px 12px; font-size:0.9rem; font-weight:600;">🔦</button>
          <button type="button" id="sireiQrCerrar" style="background:#374151; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-size:0.9rem; font-weight:600;">✕ Cerrar</button>
        </div>
      </div>
      <div style="flex:0 0 auto;"><div id="sireiQrLector"></div></div>
      <div style="flex:0 0 auto; padding:10px 14px 4px 14px; background:#0b1220;">
        <div id="sireiQrEstado" style="color:#e5e7eb; font-size:0.95rem;">Iniciando cámara…</div>
        <div id="sireiQrProgreso" style="display:none; color:#93c5fd; font-size:0.85rem; font-weight:700; margin-top:3px;"></div>
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
    var configs = this._configuraciones();
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
      if (!self._activo) return;
      self._estado('Buscando el siguiente código…', '#3b82f6');
      self._actualizarProgreso();
      self._iniciarCamara(self._intentos || 0);
    }, 700);
  },

  // Muestra el botón de linterna solo si el dispositivo lo soporta.
  _prepararLinterna: function (overlay) {
    try {
      var video = overlay.querySelector('#sireiQrLector video');
      if (!video || !video.srcObject) return;
      var pista = video.srcObject.getVideoTracks()[0];
      if (!pista || typeof pista.getCapabilities !== 'function') return;
      var caps = pista.getCapabilities();
      if (!caps || !caps.torch) return;
      var btn = overlay.querySelector('#sireiQrLinterna');
      if (!btn) return;
      btn.style.display = 'block';
      btn.addEventListener('click', function () {
        var encendida = btn.dataset.encendida === 'true';
        pista.applyConstraints({ advanced: [{ torch: !encendida }] }).then(function () {
          btn.dataset.encendida = String(!encendida);
          btn.style.background = !encendida ? '#f59e0b' : '#374151';
        }).catch(function () {});
      });
    } catch (e) {}
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
