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
// configuración de alta sensibilidad y modo continuo para escanear varios QR seguidos.
SIREI.qr = {
  _reader: null,
  _overlay: null,
  _onCerrar: null,
  _cerrado: false,

  disponible: function () {
    return typeof Html5Qrcode !== 'undefined';
  },

  _config: function () {
    const cfg = {
      fps: 15,
      qrbox: function (ancho, alto) {
        const menor = Math.min(ancho, alto);
        const lado = Math.max(180, Math.floor(menor * 0.75));
        return { width: lado, height: lado };
      },
      aspectRatio: 1.0,
      disableFlip: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      videoConstraints: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: 'continuous' }]
      }
    };
    try {
      if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
        cfg.formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
      }
    } catch (e) {}
    return cfg;
  },

  _estado: function (texto, color) {
    const el = document.getElementById('sireiQrEstado');
    if (!el) return;
    el.innerHTML = '<span class="sirei-qr-pulse" style="width:10px;height:10px;border-radius:50%;background:' +
      (color || '#3b82f6') + ';display:inline-block;margin-right:6px;"></span>' +
      SIREI.utils.escapeHtml(texto);
  },

  /**
   * Abre el lector. Opciones:
   *   titulo, subtitulo, onLeido(codigo), onCerrar(), continuo (por defecto true)
   */
  abrir: function (opciones) {
    opciones = opciones || {};
    const self = this;

    if (!this.disponible()) {
      SIREI.utils.mostrarToast('El lector QR no está disponible. Revisa tu conexión.', 'error');
      return;
    }

    this.cerrar(true);

    this._cerrado = false;
    this._onCerrar = typeof opciones.onCerrar === 'function' ? opciones.onCerrar : null;

    const overlay = document.createElement('div');
    overlay.id = 'sireiQrOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:#0b1220; z-index:2147483000; display:flex; flex-direction:column;';
    overlay.innerHTML = `
      <style>
        #sireiQrLector { width:100%; max-width:560px; margin:0 auto; background:#000; }
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
      <div id="sireiQrEstado" style="flex:0 0 auto; padding:12px 14px; color:#e5e7eb; font-size:0.92rem; background:#0b1220;">Iniciando cámara…</div>
      <div id="sireiQrHistorial" style="flex:1 1 auto; overflow-y:auto; padding:0 14px 16px 14px; background:#0b1220; color:#e5e7eb; font-size:0.9rem;"></div>
    `;
    document.body.appendChild(overlay);
    this._overlay = overlay;

    overlay.querySelector('#sireiQrCerrar').addEventListener('click', function () {
      self.cerrar();
    });

    const lector = new Html5Qrcode('sireiQrLector');
    this._reader = lector;
    let procesando = false;

    async function alLeer(texto) {
      if (procesando || self._cerrado) return;
      procesando = true;

      // Detener la cámara de inmediato: evita lecturas repetidas del mismo código
      try { await lector.stop(); } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(60);

      self._estado('✔ Leído: ' + texto, '#10b981');

      const hist = document.getElementById('sireiQrHistorial');
      if (hist) {
        const fila = document.createElement('div');
        fila.style.cssText = 'padding:6px 0; border-bottom:1px solid #1f2937;';
        fila.textContent = '✔ ' + texto;
        hist.insertBefore(fila, hist.firstChild);
      }

      try {
        if (typeof opciones.onLeido === 'function') {
          await opciones.onLeido(String(texto).trim());
        }
      } catch (e) {
        console.error('Error al procesar el código QR:', e);
      }

      if (self._cerrado) return;

      if (opciones.continuo === false) {
        self.cerrar();
        return;
      }

      // Modo continuo: reanudar la cámara para el siguiente alumno
      setTimeout(function () {
        if (self._cerrado || !self._overlay) return;
        procesando = false;
        self._estado('Buscando el siguiente código…', '#3b82f6');
        lector.start(self._config().videoConstraints, self._config(), alLeer, function () {}).catch(function () {});
      }, 600);
    }

    lector.start(this._config().videoConstraints, this._config(), alLeer, function () {})
      .then(function () {
        self._estado('Buscando un código…', '#3b82f6');
        self._prepararLinterna(overlay);
      })
      .catch(function (err) {
        const msg = err && err.message ? err.message : String(err);
        self._estado('No se pudo abrir la cámara: ' + msg, '#ef4444');
        SIREI.utils.mostrarToast('No se pudo abrir la cámara. Revisa los permisos del navegador.', 'error');
      });
  },

  // Muestra el botón de linterna solo si el dispositivo lo soporta (ayuda en cámaras débiles)
  _prepararLinterna: function (overlay) {
    try {
      const video = overlay.querySelector('#sireiQrLector video');
      if (!video || !video.srcObject) return;
      const pista = video.srcObject.getVideoTracks()[0];
      if (!pista || typeof pista.getCapabilities !== 'function') return;
      const caps = pista.getCapabilities();
      if (!caps || !caps.torch) return;
      const btn = overlay.querySelector('#sireiQrLinterna');
      if (!btn) return;
      btn.style.display = 'block';
      btn.addEventListener('click', function () {
        const encendida = btn.dataset.encendida === 'true';
        pista.applyConstraints({ advanced: [{ torch: !encendida }] }).then(function () {
          btn.dataset.encendida = String(!encendida);
          btn.style.background = !encendida ? '#f59e0b' : '#374151';
        }).catch(function () {});
      });
    } catch (e) {}
  },

  cerrar: function (silencioso) {
    this._cerrado = true;
    const reader = this._reader;
    const overlay = this._overlay;
    this._reader = null;
    this._overlay = null;

    if (reader) {
      try {
        reader.stop().then(function () {
          try { reader.clear(); } catch (e) {}
        }).catch(function () {});
      } catch (e) {}
    }

    if (overlay) {
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }

    const cb = this._onCerrar;
    this._onCerrar = null;
    if (!silencioso && typeof cb === 'function') {
      try { cb(); } catch (e) {}
    }
  }
};

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
