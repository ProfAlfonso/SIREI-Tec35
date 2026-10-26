// ============================================================
//  SIREI - Panel del Prefecto
//  Vista en vivo, alumnos, perfil 360, grupos, docentes,
//  casos/observaciones/reconocimientos y reportes para padres.
// ============================================================

(function () {
  'use strict';

  const S = {
    rol: '',
    tab: 'ahora',
    panel: null,
    grupos: [],
    periodos: [],
    periodoId: '',
    config: {},
    ultimaCargaPanel: 0,
    cargandoPanel: false,
    cargandoAlumnos: false,
    cargandoGrupos: false,
    cargandoGrupo: false,
    cargandoCasos: false,
    alumnos: [],
    alumnosCargados: false,
    alumnosError: false,
    alumnosTodos: [],
    cargandoAlumnosTodos: false,
    gruposData: [],
    gruposCargados: false,
    gruposError: false,
    casos: [],
    casosCargados: false,
    casosError: false,
    filtrosAlumnos: { idGrupo: '', idPeriodo: '', busqueda: '', semaforo: '', soloReconocimiento: false },
    filtroNowGrupo: '',
    grupoActual: null,
    filtrosCasos: { tipo: '', estado: '', busqueda: '' },
    docentes: null,
    perfil: null,
    perfilTab: 'resumen',
    perfilCurp: '',
    reporte: null,
    timer: null,
    modal: null
  };

  const esc = function (valor) {
    return SIREI.utils.escapeHtml(valor === undefined || valor === null ? '' : String(valor));
  };
  const attr = function (valor) {
    return esc(valor).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  const toast = function (mensaje, tipo) {
    try { SIREI.utils.mostrarToast(mensaje, tipo || 'success'); } catch (e) {}
  };
  const confirmar = function (mensaje) {
    try { return SIREI.utils.confirmar(mensaje); } catch (e) { return window.confirm(mensaje); }
  };
  const hoy = function () {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  };
  const horaDe = function (valor) {
    const texto = String(valor || '');
    const partes = texto.split(' ');
    return partes.length > 1 ? partes[1].substring(0, 5) : texto;
  };
  const minutosTxt = function (min) {
    if (min === null || min === undefined) return '—';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ' h ' + m + ' min';
  };
  const iniciales = function (nombre) {
    const partes = String(nombre || '').trim().split(/\s+/);
    return ((partes[0] || '?').charAt(0) + (partes[1] || '').charAt(0)).toUpperCase();
  };
  const parseFecha = function (valor) {
    if (!valor) return null;
    const texto = String(valor).trim();
    if (!texto) return null;
    if (texto.indexOf('T') >= 0) {
      const d = new Date(texto);
      return isNaN(d.getTime()) ? null : d;
    }
    const partes = texto.split(' ');
    const f = (partes[0] || '').split('/');
    if (f.length === 3) {
      const h = (partes[1] || '00:00:00').split(':');
      const d = new Date(Number(f[2]), Number(f[1]) - 1, Number(f[0]), Number(h[0] || 0), Number(h[1] || 0), Number(h[2] || 0));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(texto);
    return isNaN(d.getTime()) ? null : d;
  };
  const ordenarPorFechaDesc = function (lista, campo) {
    return lista.sort(function (a, b) {
      const fa = parseFecha(a[campo]);
      const fb = parseFecha(b[campo]);
      return (fb ? fb.getTime() : 0) - (fa ? fa.getTime() : 0);
    });
  };
  const chip = function (texto, color, fondo) {
    return '<span style="display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.75rem; font-weight:700; color:' +
      color + '; background:' + fondo + '; white-space:nowrap;">' + texto + '</span>';
  };
  const badgeSemaforo = function (semaforo, reconocimiento) {
    if (reconocimiento) return chip('🌟 Reconocimiento', '#92400e', '#fef3c7');
    if (semaforo === 'rojo') return chip('🔴 Atención', '#991b1b', '#fee2e2');
    if (semaforo === 'amarillo') return chip('🟡 Seguimiento', '#92400e', '#fef3c7');
    return chip('🟢 Sin novedad', '#166534', '#dcfce7');
  };
  const badgeEstado = function (estado) {
    const e = String(estado || '').toLowerCase();
    if (e === 'presente') return chip('Presente', '#166534', '#dcfce7');
    if (e === 'retardo') return chip('Retardo', '#92400e', '#fef3c7');
    if (e === 'ausente') return chip('Ausente', '#991b1b', '#fee2e2');
    if (e === 'justificado') return chip('Justificado', '#1e40af', '#dbeafe');
    if (e === 'escape') return chip('Escape', '#6b21a8', '#f3e8ff');
    if (e === 'pendiente') return chip('Pendiente', '#4b5563', '#f3f4f6');
    return chip(esc(estado || '—'), '#4b5563', '#f3f4f6');
  };
  const badgeTipoRegistro = function (tipo) {
    if (tipo === 'caso') return chip('📌 Caso', '#991b1b', '#fee2e2');
    if (tipo === 'reconocimiento') return chip('🌟 Reconocimiento', '#92400e', '#fef3c7');
    return chip('📝 Observación', '#1e40af', '#dbeafe');
  };
  const spinnerHTML = function (texto) {
    return '<div class="card" style="text-align:center; padding:36px;"><div class="loader-moderno"><div class="spinner"></div><p>' +
      esc(texto || 'Cargando...') + '</p></div></div>';
  };
  const errorHTML = function (texto) {
    return '<div class="card"><div class="error" style="padding:12px;">' + esc(texto || 'Ocurrió un error.') + '</div></div>';
  };
  const cardWrap = function (contenido) {
    return '<div class="card" style="padding:16px; margin-bottom:14px;">' + contenido + '</div>';
  };
  const opcionesSelect = function (lista, valor, etiqueta) {
    return (lista || []).map(function (item) {
      const id = item.id !== undefined ? item.id : item;
      const nombre = etiqueta ? etiqueta(item) : (item.nombre || item.id);
      return '<option value="' + attr(id) + '"' + (String(id) === String(valor) ? ' selected' : '') + '>' + esc(nombre) + '</option>';
    }).join('');
  };

  const recordarFoco = function () {
    const activo = document.activeElement;
    if (!activo || !activo.id) return null;
    return { id: activo.id, inicio: activo.selectionStart, fin: activo.selectionEnd };
  };

  const restaurarFoco = function (foco) {
    if (!foco) return;
    const el = document.getElementById(foco.id);
    if (!el) return;
    try { el.focus(); } catch (e) {}
    if (foco.inicio !== undefined && foco.inicio !== null && el.setSelectionRange) {
      try { el.setSelectionRange(foco.inicio, foco.fin); } catch (e) {}
    }
  };

  // ------------------------------------------------------------
  // Inicialización
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () { init(); });

  async function init() {
    const token = sessionStorage.getItem('sirei_token');
    const rol = (sessionStorage.getItem('sirei_rol') || '').toLowerCase();
    if (!token || ['prefecto', 'coordinador', 'admin', 'administrador'].indexOf(rol) === -1) {
      window.location.replace('index.html');
      return;
    }
    S.rol = rol;
    const nombre = sessionStorage.getItem('sirei_nombre') || sessionStorage.getItem('sirei_user') || 'Prefecto';
    const userName = document.getElementById('userName');
    if (userName) userName.textContent = nombre;
    const userRole = document.getElementById('userRole');
    if (userRole) userRole.textContent = rol === 'prefecto' ? 'Prefecto' : (rol === 'coordinador' ? 'Coordinador' : 'Administrador');

    configurarMenu();
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
        item.classList.add('active');
        mostrarTab(item.dataset.tab);
        cerrarMenuMovil();
      });
    });
    const logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.addEventListener('click', function () {
        try { SIREI.cacheLocal.limpiar(); } catch (e) {}
        sessionStorage.clear();
        window.location.replace('index.html');
      });
    }

    document.getElementById('tabContent').innerHTML = spinnerHTML('Cargando panel del prefecto…');
    await cargarPanel(true);
    actualizarHeaderLogo();
    if (!S.panel) {
      document.getElementById('tabContent').innerHTML = errorHTML('No se pudo cargar el panel. Revisa que el backend esté actualizado y que tu sesión siga activa.');
      return;
    }
    mostrarTab('ahora');
    iniciarAutoRefresco();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && S.tab === 'ahora') {
        cargarPanel(true).then(function () { if (S.tab === 'ahora') renderAhora(); });
      }
    });
  }

  function configurarMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!menuToggle || !sidebar || !overlay) return;
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', cerrarMenuMovil);
  }

  function actualizarHeaderLogo() {
    const el = document.getElementById('headerLogo');
    if (!el) return;
    const cfg = S.config || {};
    if (cfg.logoUrl) {
      el.innerHTML = '<img src="' + attr(cfg.logoUrl) + '" alt="Logo" style="max-height:42px; max-width:180px; object-fit:contain;">';
    } else {
      el.innerHTML = '<span style="font-weight:800; color:#1E3A8A; font-size:0.95rem;">' + esc(cfg.nombreInstitucion || 'SIREI') + '</span>';
    }
  }

  function cerrarMenuMovil() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  }

  function iniciarAutoRefresco() {
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(function () {
      if (S.tab !== 'ahora') return;
      if (document.visibilityState !== 'visible') return;
      cargarPanel(true).then(function () { if (S.tab === 'ahora') renderAhora(); });
    }, 45000);
  }

  // ------------------------------------------------------------
  // API / carga de datos
  // ------------------------------------------------------------
  async function cargarPanel(force) {
    if (S.cargandoPanel) return;
    if (!force && S.panel && (Date.now() - S.ultimaCargaPanel) < 15000) return;
    S.cargandoPanel = true;
    try {
      const data = await SIREI.api.panelPrefecto();
      if (data && data.success) {
        S.panel = data;
        S.grupos = data.grupos || [];
        S.periodos = data.periodos || [];
        S.config = data.config || {};
        const actual = S.periodos.find(function (p) { return p.activo; }) || S.periodos[0];
        if (!S.periodoId && actual) S.periodoId = String(actual.id);
        if (S.periodoId && !S.periodos.some(function (p) { return String(p.id) === String(S.periodoId); })) {
          S.periodoId = actual ? String(actual.id) : '';
        }
        S.ultimaCargaPanel = Date.now();
        actualizarHeaderLogo();
      } else {
        toast((data && data.message) || 'No se pudo actualizar el panel.', 'error');
      }
    } catch (e) {
      console.error('Error al cargar panel prefecto:', e);
      toast('Error de conexión al cargar el panel.', 'error');
    } finally {
      S.cargandoPanel = false;
    }
  }

  async function cargarAlumnos(force) {
    if (S.cargandoAlumnos) return;
    if (!force && S.alumnosCargados) return;
    S.cargandoAlumnos = true;
    S.alumnosError = false;
    const f = S.filtrosAlumnos;
    try {
      const data = await SIREI.api.alumnosPrefecto({
        idGrupo: f.idGrupo || '',
        idPeriodo: f.idPeriodo || S.periodoId || '',
        busqueda: f.busqueda || '',
        semaforo: f.semaforo || '',
        soloReconocimiento: f.soloReconocimiento ? 'true' : 'false'
      });
      if (data && data.success) {
        S.alumnos = data.alumnos || [];
        S.alumnosCargados = true;
        if (data.periodoSeleccionado && !S.filtrosAlumnos.idPeriodo) {
          S.filtrosAlumnos.idPeriodo = String(data.periodoSeleccionado.id);
        }
        if (data.grupos && !S.grupos.length) S.grupos = data.grupos;
        if (data.periodos && !S.periodos.length) S.periodos = data.periodos;
      } else {
        S.alumnosError = true;
        toast((data && data.message) || 'No se pudieron cargar los alumnos.', 'error');
      }
    } catch (e) {
      console.error('Error al cargar alumnos:', e);
      S.alumnosError = true;
      toast('Error de conexión al cargar alumnos.', 'error');
    } finally {
      S.cargandoAlumnos = false;
      if (S.tab === 'alumnos') renderAlumnosTab();
      if (S.tab === 'reportes') renderReportesTab();
    }
  }

  async function cargarGrupos(force) {
    if (S.cargandoGrupos) return;
    if (!force && S.gruposCargados) return;
    S.cargandoGrupos = true;
    S.gruposError = false;
    try {
      const data = await SIREI.api.gruposPrefecto(S.periodoId || '');
      if (data && data.success) {
        S.gruposData = data.grupos || [];
        S.gruposCargados = true;
        if (data.periodos && !S.periodos.length) S.periodos = data.periodos;
      } else {
        S.gruposError = true;
        toast((data && data.message) || 'No se pudieron cargar los grupos.', 'error');
      }
    } catch (e) {
      console.error('Error al cargar grupos:', e);
      S.gruposError = true;
      toast('Error de conexión al cargar grupos.', 'error');
    } finally {
      S.cargandoGrupos = false;
      if (S.tab === 'grupos') renderGruposTab();
    }
  }

  async function cargarTodosAlumnos(force) {
    if (S.cargandoAlumnosTodos) return;
    if (!force && S.alumnosTodos.length) return;
    S.cargandoAlumnosTodos = true;
    try {
      const data = await SIREI.api.alumnosPrefecto({ idPeriodo: S.periodoId || '' });
      if (data && data.success) {
        S.alumnosTodos = data.alumnos || [];
        if (data.grupos && !S.grupos.length) S.grupos = data.grupos;
        if (data.periodos && !S.periodos.length) S.periodos = data.periodos;
      }
    } catch (e) {
      console.error('Error al cargar el catálogo de alumnos:', e);
    } finally {
      S.cargandoAlumnosTodos = false;
      if (S.tab === 'reportes') renderReportesTab();
    }
  }

  async function abrirGrupo(idGrupo) {
    if (S.cargandoGrupo) return;
    S.cargandoGrupo = true;
    S.grupoActual = idGrupo;
    const cont = document.getElementById('tabContent');
    cont.innerHTML = spinnerHTML('Cargando grupo…');
    try {
      const data = await SIREI.api.grupoPrefecto(idGrupo, S.periodoId || '');
      if (data && data.success) {
        renderGrupoDetalle(data);
      } else {
        cont.innerHTML = errorHTML((data && data.message) || 'No se pudo cargar el grupo.');
      }
    } catch (e) {
      console.error('Error al cargar grupo:', e);
      cont.innerHTML = errorHTML('Error de conexión al cargar el grupo.');
    } finally {
      S.cargandoGrupo = false;
    }
  }

  async function cargarCasos(force) {
    if (S.cargandoCasos) return;
    if (!force && S.casosCargados) return;
    S.cargandoCasos = true;
    S.casosError = false;
    try {
      const data = await SIREI.api.registrosPrefecto({
        tipo: S.filtrosCasos.tipo || '',
        estado: S.filtrosCasos.estado || '',
        busqueda: S.filtrosCasos.busqueda || '',
        idPeriodo: S.periodoId || ''
      });
      if (data && data.success) {
        S.casos = data.registros || [];
        S.casosCargados = true;
      } else {
        S.casosError = true;
        toast((data && data.message) || 'No se pudieron cargar los registros.', 'error');
      }
    } catch (e) {
      console.error('Error al cargar casos:', e);
      S.casosError = true;
      toast('Error de conexión al cargar casos.', 'error');
    } finally {
      S.cargandoCasos = false;
      if (S.tab === 'casos') renderCasosTab();
    }
  }

  async function cargarDocentes(force) {
    if (!S.panel || force) await cargarPanel(true);
    if (S.tab === 'docentes') renderDocentes();
  }

  // ------------------------------------------------------------
  // Ahora
  // ------------------------------------------------------------
  function renderAhora() {
    const cont = document.getElementById('tabContent');
    const panel = S.panel;
    if (!panel) { cont.innerHTML = errorHTML('Panel no disponible.'); return; }
    const r = panel.resumen || {};
    const clases = (panel.clases || []).filter(function (c) {
      return !S.filtroNowGrupo || String(c.idGrupo) === String(S.filtroNowGrupo);
    });
    const alertas = (panel.alertas || []).filter(function (a) {
      return !S.filtroNowGrupo || String(a.grupo) === String(S.filtroNowGrupo) || String(a.idClase) === String(S.filtroNowGrupo);
    });

    const tarjetas = [
      { t: 'Clases activas', v: r.clasesActivas || 0, c: '#1E3A8A', b: '#dbeafe' },
      { t: 'Alumnos en clase', v: r.alumnosEnClase || 0, c: '#0f766e', b: '#ccfbf1' },
      { t: 'Presentes', v: r.presentes || 0, c: '#166534', b: '#dcfce7' },
      { t: 'Fuera', v: r.fuera || 0, c: '#92400e', b: '#fef3c7' },
      { t: 'Baños', v: r.bano || 0, c: '#1e40af', b: '#dbeafe' },
      { t: 'Escapes', v: r.escapes || 0, c: '#6b21a8', b: '#f3e8ff' },
      { t: 'Pendientes', v: r.pendientes || 0, c: '#4b5563', b: '#f3f4f6' },
      { t: 'Alertas', v: r.alertas || 0, c: '#991b1b', b: '#fee2e2' }
    ].map(function (x) {
      return '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; min-width:120px; flex:1 1 120px;">' +
        '<div style="font-size:0.72rem; color:#6b7280; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">' + x.t + '</div>' +
        '<div style="font-size:1.5rem; font-weight:800; color:' + x.c + ';">' + x.v + '</div></div>';
    }).join('');

    const filtroGrupos = '<option value="">Todos los grupos</option>' + opcionesSelect(S.grupos, S.filtroNowGrupo);
    const claseCards = clases.length ? clases.map(function (c) {
      const alertaClase = alertas.some(function (a) { return String(a.idClase) === String(c.idClase); });
      const fuera = (c.fuera || []).map(function (f) {
        return '<div style="font-size:0.82rem; color:#92400e; margin-top:3px;">🚪 ' + esc(f.nombre) + ' · ' +
          esc(f.motivo || 'Sin motivo') + ' · ' + minutosTxt(f.minutos) + (f.regresa ? '' : ' · sin regreso') + '</div>';
      }).join('');
      const bano = c.bano && c.bano.ocupado
        ? '<div style="font-size:0.82rem; color:#1e40af; margin-top:3px;">🚻 Baño: ' + esc(c.bano.nombre) + ' (' + minutosTxt(c.bano.minutos) + ')</div>'
        : '<div style="font-size:0.82rem; color:#166534; margin-top:3px;">🚻 Baño libre</div>';
      return '<div style="background:#fff; border:1px solid ' + (alertaClase ? '#fca5a5' : '#e5e7eb') +
        '; border-left:6px solid ' + (alertaClase ? '#dc2626' : '#10b981') + '; border-radius:14px; padding:14px; margin-bottom:12px;">' +
        '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:flex-start;">' +
        '<div><div style="font-size:1.05rem; font-weight:800; color:#111827;">' + esc(c.grupo) + ' · ' + esc(c.asignatura) + '</div>' +
        '<div style="font-size:0.82rem; color:#6b7280;">👩‍🏫 ' + esc(c.docente) + ' · inicio ' + esc(horaDe(c.inicio)) +
        ' · ' + minutosTxt(c.transcurridosMin) + ' · ' + esc(c.periodo || '') + '</div></div>' +
        '<div>' + (c.sinPaseLista ? chip('⚠ Sin pase de lista', '#991b1b', '#fee2e2') : chip('Activa', '#166534', '#dcfce7')) + '</div></div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">' +
        chip('✅ ' + c.conteos.presente, '#166534', '#dcfce7') +
        chip('⏰ ' + c.conteos.retardo, '#92400e', '#fef3c7') +
        chip('❌ ' + c.conteos.ausente, '#991b1b', '#fee2e2') +
        chip('⏳ ' + c.conteos.pendiente, '#4b5563', '#f3f4f6') +
        chip('👥 ' + c.conteos.total, '#1e40af', '#dbeafe') +
        '</div>' + fuera + bano +
        (c.escapes ? '<div style="font-size:0.82rem; color:#6b21a8; margin-top:3px;">🏃 Escapes: ' + c.escapes + '</div>' : '') +
        '<div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-primary" data-ver-clase="' + attr(c.idClase) + '" style="padding:7px 12px; font-size:0.8rem;">Ver lista</button>' +
        (c.bano && c.bano.ocupado ? '<span style="font-size:0.78rem; color:#1e40af; align-self:center;">Baño ocupado por ' + esc(c.bano.nombre) + '</span>' : '') +
        '</div></div>';
    }).join('') : '<div style="color:#6b7280; padding:16px;">No hay clases activas en este momento.</div>';

    const alertasHTML = alertas.length ? alertas.map(function (a) {
      const color = a.severidad === 'alta' ? '#dc2626' : (a.severidad === 'media' ? '#d97706' : '#2563eb');
      const fondo = a.severidad === 'alta' ? '#fef2f2' : (a.severidad === 'media' ? '#fffbeb' : '#eff6ff');
      return '<div data-alerta-curp="' + attr(a.curp || '') + '" style="cursor:' + (a.curp ? 'pointer' : 'default') + '; background:' + fondo +
        '; border-left:4px solid ' + color + '; border-radius:10px; padding:9px 12px; margin-bottom:8px; font-size:0.86rem;">' +
        '<strong style="color:' + color + ';">' + (a.severidad === 'alta' ? '⚠ ' : '• ') + '</strong>' + esc(a.mensaje) + '</div>';
    }).join('') : '<div style="color:#166534; font-size:0.88rem; padding:8px 0;">✅ Sin alertas activas.</div>';

    cont.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <div>
          <h2 style="margin:0; font-size:1.35rem; color:#111827;">Ahora</h2>
          <p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">${esc(S.config.nombreInstitucion || 'SIREI')} · ${esc(panel.generado || '')}</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <select id="selGrupoAhora" style="padding:8px 10px; border-radius:10px; border:1px solid #d1d5db; background:#fff;">${filtroGrupos}</select>
          <button type="button" id="btnRefrescarAhora" class="btn btn-secondary" style="padding:8px 14px;">⟳ Actualizar</button>
        </div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">${tarjetas}</div>
      <div style="display:grid; grid-template-columns:minmax(0,2fr) minmax(260px,1fr); gap:14px; align-items:start;" class="pref-grid">
        <div>
          <h3 style="margin:0 0 8px 0; font-size:1.05rem; color:#111827;">Clases activas</h3>
          ${claseCards}
        </div>
        <div>
          <h3 style="margin:0 0 8px 0; font-size:1.05rem; color:#111827;">Alertas</h3>
          <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px;">${alertasHTML}</div>
        </div>
      </div>
      <style>
        @media (max-width: 900px) { .pref-grid { grid-template-columns: 1fr !important; } }
      </style>`;

    const sel = document.getElementById('selGrupoAhora');
    if (sel) sel.addEventListener('change', function () { S.filtroNowGrupo = sel.value; renderAhora(); });
    const btn = document.getElementById('btnRefrescarAhora');
    if (btn) btn.addEventListener('click', function () { cargarPanel(true).then(function () { renderAhora(); }); });
    cont.querySelectorAll('[data-ver-clase]').forEach(function (b) {
      b.addEventListener('click', function () { abrirDetalleClase(b.dataset.verClase); });
    });
    cont.querySelectorAll('[data-alerta-curp]').forEach(function (b) {
      if (!b.dataset.alertaCurp) return;
      b.addEventListener('click', function () { abrirPerfil(b.dataset.alertaCurp); });
    });
  }

  function abrirDetalleClase(idClase) {
    const clase = (S.panel.clases || []).find(function (c) { return String(c.idClase) === String(idClase); });
    if (!clase) return;
    const filas = (clase.alumnos || []).map(function (a) {
      return '<tr><td style="padding:8px; border-bottom:1px solid #f3f4f6;">' + esc(a.nombre) + '</td>' +
        '<td style="padding:8px; border-bottom:1px solid #f3f4f6;">' + badgeEstado(a.estado) + '</td>' +
        '<td style="padding:8px; border-bottom:1px solid #f3f4f6; font-size:0.8rem; color:#6b7280;">' +
        (a.fuera ? (esc(a.motivo || 'Fuera') + ' · ' + minutosTxt(a.minutos)) : '—') + '</td></tr>';
    }).join('');
    abrirModal('Clase · ' + clase.grupo + ' · ' + clase.asignatura,
      '<div style="margin-bottom:10px; color:#6b7280; font-size:0.85rem;">' + esc(clase.docente) + ' · inicio ' + esc(horaDe(clase.inicio)) +
      ' · ' + minutosTxt(clase.transcurridosMin) + '</div>' +
      '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:0.88rem;">' +
      '<thead><tr style="background:#f9fafb; text-align:left;"><th style="padding:8px;">Alumno</th><th style="padding:8px;">Asistencia</th><th style="padding:8px;">Salida</th></tr></thead>' +
      '<tbody>' + (filas || '<tr><td colspan="3" style="padding:10px; color:#6b7280;">Sin alumnos.</td></tr>') + '</tbody></table></div>');
  }

  // ------------------------------------------------------------
  // Alumnos
  // ------------------------------------------------------------
  function renderAlumnosTab() {
    const cont = document.getElementById('tabContent');
    const focoPrevio = recordarFoco();
    if (!S.panel) {
      cont.innerHTML = spinnerHTML('Cargando…');
      if (!S.cargandoPanel) {
        cargarPanel(true).then(function () {
          if (S.panel) renderAlumnosTab();
          else cont.innerHTML = errorHTML('No se pudo cargar el panel.');
        });
      }
      return;
    }
    if (!S.alumnosCargados) {
      if (S.alumnosError) {
        cont.innerHTML = '<div class="card" style="padding:20px; text-align:center;"><div class="error" style="margin-bottom:10px;">No se pudieron cargar los alumnos.</div>' +
          '<button type="button" class="btn btn-primary" id="btnReintentarAlumnos">Reintentar</button></div>';
        const b = document.getElementById('btnReintentarAlumnos');
        if (b) b.addEventListener('click', function () { cargarAlumnos(true); });
        return;
      }
      if (!S.cargandoAlumnos) cargarAlumnos(true);
      cont.innerHTML = spinnerHTML('Cargando alumnos…');
      return;
    }
    const f = S.filtrosAlumnos;
    const gruposOpt = '<option value="">Todos los grupos</option>' + opcionesSelect(S.grupos, f.idGrupo);
    const periodosOpt = opcionesSelect(S.periodos, f.idPeriodo || S.periodoId, function (p) { return p.nombre + (p.activo ? ' (actual)' : ''); });
    const filas = (S.alumnos || []).map(function (a) {
      return '<tr data-curp="' + attr(a.curp) + '" style="cursor:pointer; border-bottom:1px solid #f3f4f6;">' +
        '<td style="padding:9px 8px;"><strong>' + esc(a.nombreCompleto) + '</strong><div style="font-size:0.72rem; color:#9ca3af;">' + esc(a.curp) + '</div></td>' +
        '<td style="padding:9px 8px;">' + esc(a.grupo) + '</td>' +
        '<td style="padding:9px 8px;">' + (a.asistencia.porcentaje === null ? '—' : a.asistencia.porcentaje + '%') + '</td>' +
        '<td style="padding:9px 8px;">' + a.asistencia.ausente + '</td>' +
        '<td style="padding:9px 8px;">' + a.asistencia.retardo + '</td>' +
        '<td style="padding:9px 8px;"><span style="color:#166534; font-weight:700;">+' + a.actitudes.positivas + '</span> / <span style="color:#991b1b; font-weight:700;">-' + a.actitudes.negativas + '</span></td>' +
        '<td style="padding:9px 8px;">' + (a.academicos.promedio === null ? '—' : a.academicos.promedio) + '</td>' +
        '<td style="padding:9px 8px;">' + badgeSemaforo(a.semaforo, a.reconocimiento) + '</td></tr>';
    }).join('');

    cont.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        <div><h2 style="margin:0; font-size:1.35rem; color:#111827;">Alumnos</h2>
        <p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">Resultados por alumno y periodo. Toca un alumno para ver su perfil 360.</p></div>
        <button type="button" id="btnRefrescarAlumnos" class="btn btn-secondary" style="padding:8px 14px;">⟳ Actualizar</button>
      </div>
      <div class="card" style="padding:12px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <select id="filtroGrupoAlumnos" style="padding:8px 10px; border-radius:10px; border:1px solid #d1d5db; background:#fff;">${gruposOpt}</select>
        <select id="filtroPeriodoAlumnos" style="padding:8px 10px; border-radius:10px; border:1px solid #d1d5db; background:#fff;">${periodosOpt}</select>
        <select id="filtroSemaforoAlumnos" style="padding:8px 10px; border-radius:10px; border:1px solid #d1d5db; background:#fff;">
          <option value="">Todos los estados</option>
          <option value="rojo"${f.semaforo === 'rojo' ? ' selected' : ''}>🔴 Atención</option>
          <option value="amarillo"${f.semaforo === 'amarillo' ? ' selected' : ''}>🟡 Seguimiento</option>
          <option value="verde"${f.semaforo === 'verde' ? ' selected' : ''}>🟢 Sin novedad</option>
        </select>
        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:#374151;"><input type="checkbox" id="filtroReconocimiento"${f.soloReconocimiento ? ' checked' : ''}> Solo reconocimientos</label>
        <input type="search" id="filtroBusquedaAlumnos" placeholder="Buscar nombre, CURP o matrícula…" value="${attr(f.busqueda)}" style="flex:1 1 220px; min-width:180px; padding:8px 10px; border-radius:10px; border:1px solid #d1d5db;">
      </div>
      <div class="card" style="padding:0; overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.86rem;">
          <thead><tr style="background:#f9fafb; text-align:left; color:#6b7280; font-size:0.75rem; text-transform:uppercase;">
            <th style="padding:10px 8px;">Alumno</th><th style="padding:10px 8px;">Grupo</th><th style="padding:10px 8px;">Asist.</th>
            <th style="padding:10px 8px;">Faltas</th><th style="padding:10px 8px;">Retardos</th><th style="padding:10px 8px;">Actitudes</th>
            <th style="padding:10px 8px;">Prom.</th><th style="padding:10px 8px;">Estado</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="8" style="padding:20px; text-align:center; color:#6b7280;">Sin alumnos con esos filtros.</td></tr>'}</tbody>
        </table>
      </div>`;

    document.getElementById('btnRefrescarAlumnos').addEventListener('click', function () { cargarAlumnos(true); });
    const grupoSel = document.getElementById('filtroGrupoAlumnos');
    grupoSel.addEventListener('change', function () { S.filtrosAlumnos.idGrupo = grupoSel.value; cargarAlumnos(true); });
    const periodoSel = document.getElementById('filtroPeriodoAlumnos');
    periodoSel.addEventListener('change', function () { S.filtrosAlumnos.idPeriodo = periodoSel.value; S.periodoId = periodoSel.value; S.alumnosCargados = false; cargarAlumnos(true); });
    const semaforoSel = document.getElementById('filtroSemaforoAlumnos');
    semaforoSel.addEventListener('change', function () { S.filtrosAlumnos.semaforo = semaforoSel.value; cargarAlumnos(true); });
    const recon = document.getElementById('filtroReconocimiento');
    recon.addEventListener('change', function () { S.filtrosAlumnos.soloReconocimiento = recon.checked; cargarAlumnos(true); });
    const busqueda = document.getElementById('filtroBusquedaAlumnos');
    let debounce = null;
    busqueda.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        S.filtrosAlumnos.busqueda = busqueda.value;
        cargarAlumnos(true);
      }, 350);
    });
    cont.querySelectorAll('tr[data-curp]').forEach(function (tr) {
      tr.addEventListener('click', function () { abrirPerfil(tr.dataset.curp); });
    });
    restaurarFoco(focoPrevio);
  }

  // ------------------------------------------------------------
  // Perfil 360
  // ------------------------------------------------------------
  async function abrirPerfil(curp) {
    cerrarPerfil();
    const overlay = document.createElement('div');
    overlay.id = 'perfilPrefectoOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:#f8fafc; z-index:2147483000; display:flex; flex-direction:column;';
    overlay.innerHTML = '<div style="flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 14px; background:#1E3A8A; color:#fff;">' +
      '<div><div style="font-weight:800;">Perfil del alumno</div><div style="font-size:0.75rem; color:#bfdbfe;">Cargando…</div></div>' +
      '<button type="button" id="perfilCerrar" style="background:#1e40af; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-weight:700; cursor:pointer;">✕ Cerrar</button></div>' +
      '<div id="perfilContenido" style="flex:1 1 auto; overflow-y:auto; padding:16px;">' + spinnerHTML('Cargando perfil…') + '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#perfilCerrar').addEventListener('click', cerrarPerfil);
    document.body.style.overflow = 'hidden';

    try {
      const data = await SIREI.api.perfilAlumnoPrefecto(curp, S.periodoId || '');
      if (!data || !data.success) {
        overlay.querySelector('#perfilContenido').innerHTML = errorHTML((data && data.message) || 'No se pudo cargar el perfil.');
        return;
      }
      S.perfil = data;
      S.perfilCurp = curp;
      S.perfilTab = 'resumen';
      renderPerfil();
    } catch (e) {
      console.error('Error al cargar perfil:', e);
      overlay.querySelector('#perfilContenido').innerHTML = errorHTML('Error de conexión al cargar el perfil.');
    }
  }

  function cerrarPerfil() {
    const overlay = document.getElementById('perfilPrefectoOverlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    S.perfil = null;
    S.perfilCurp = '';
  }

  function renderPerfil() {
    const overlay = document.getElementById('perfilPrefectoOverlay');
    if (!overlay || !S.perfil) return;
    const data = S.perfil;
    const a = data.alumno || {};
    const m = data.metricas || {};
    const cont = overlay.querySelector('#perfilContenido');
    const tutores = (a.tutores || []).map(function (t) {
      return '<div style="font-size:0.8rem; color:#374151;">' + esc(t.parentesco || 'Tutor') + ': <strong>' + esc(t.nombre) + '</strong>' +
        (t.whatsapp || t.celular ? ' · ' + esc(t.whatsapp || t.celular) : '') + '</div>';
    }).join('') || '<div style="font-size:0.8rem; color:#9ca3af;">Sin tutores registrados.</div>';

    const tabs = [
      { id: 'resumen', nombre: 'Resumen' },
      { id: 'asistencia', nombre: 'Asistencia' },
      { id: 'conducta', nombre: 'Conducta' },
      { id: 'academico', nombre: 'Académico' },
      { id: 'salidas', nombre: 'Salidas' },
      { id: 'seguimiento', nombre: 'Seguimiento' }
    ];
    const tabsHTML = tabs.map(function (t) {
      const activo = S.perfilTab === t.id;
      return '<button type="button" data-perfil-tab="' + t.id + '" style="border:none; border-radius:10px; padding:8px 12px; font-weight:700; cursor:pointer; ' +
        (activo ? 'background:#1E3A8A; color:#fff;' : 'background:#e5e7eb; color:#374151;') + '">' + t.nombre + '</button>';
    }).join('');

    const kpis = [
      ['Asistencia', (m.asistencia && m.asistencia.porcentaje !== null) ? m.asistencia.porcentaje + '%' : '—'],
      ['Faltas', m.asistencia ? m.asistencia.ausente : '—'],
      ['Retardos', m.asistencia ? m.asistencia.retardo : '—'],
      ['Actitudes', m.actitudes ? ('+' + m.actitudes.positivas + ' / -' + m.actitudes.negativas) : '—'],
      ['Promedio', m.academicos && m.academicos.promedio !== null ? m.academicos.promedio : '—'],
      ['Entregas', m.academicos ? m.academicos.entregas : '—']
    ].map(function (k) {
      return '<div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; min-width:110px; flex:1 1 110px;">' +
        '<div style="font-size:0.7rem; color:#6b7280; text-transform:uppercase; font-weight:700;">' + k[0] + '</div>' +
        '<div style="font-size:1.15rem; font-weight:800; color:#111827;">' + esc(k[1]) + '</div></div>';
    }).join('');

    const motivos = (m.motivos || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    cont.innerHTML = `
      <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:center; margin-bottom:14px;">
        <div style="width:58px; height:58px; border-radius:50%; background:#1E3A8A; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:800;">${esc(iniciales(a.nombreCompleto))}</div>
        <div style="flex:1 1 240px;">
          <h2 style="margin:0; font-size:1.35rem; color:#111827;">${esc(a.nombreCompleto)}</h2>
          <div style="color:#6b7280; font-size:0.85rem;">${esc(a.grupo)} · Matrícula: ${esc(a.matricula || '—')} · CURP: ${esc(a.curp)}</div>
          <div style="margin-top:5px;">${badgeSemaforo(m.semaforo, m.reconocimiento)}</div>
        </div>
        <div style="flex:1 1 260px;">${tutores}</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">${kpis}</div>
      ${motivos ? '<div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:10px 12px; margin-bottom:12px; font-size:0.85rem; color:#9a3412;"><strong>Motivos de atención:</strong><ul style="margin:4px 0 0 18px;">' + motivos + '</ul></div>' : ''}
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button type="button" class="btn btn-primary" data-accion-registro="observacion" style="padding:8px 12px;">📝 Observación</button>
        <button type="button" class="btn btn-danger" data-accion-registro="caso" style="padding:8px 12px;">📌 Caso</button>
        <button type="button" class="btn btn-secondary" data-accion-registro="reconocimiento" style="padding:8px 12px;">🌟 Reconocimiento</button>
        <button type="button" class="btn btn-secondary" data-reporte-perfil="1" style="padding:8px 12px;">🖨️ Reporte para padres</button>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">${tabsHTML}</div>
      <div id="perfilTabContenido">${renderPerfilTab()}</div>`;

    cont.querySelectorAll('[data-perfil-tab]').forEach(function (b) {
      b.addEventListener('click', function () { S.perfilTab = b.dataset.perfilTab; renderPerfil(); });
    });
    cont.querySelectorAll('[data-accion-registro]').forEach(function (b) {
      b.addEventListener('click', function () { abrirFormularioRegistro(b.dataset.accionRegistro, data.alumno, null); });
    });
    const btnReporte = cont.querySelector('[data-reporte-perfil]');
    if (btnReporte) btnReporte.addEventListener('click', function () { generarReportePerfil(data); });
    cont.querySelectorAll('[data-caso-editar]').forEach(function (b) {
      b.addEventListener('click', function () {
        const reg = (data.registros || []).find(function (r) { return String(r.id) === String(b.dataset.casoEditar); });
        if (reg) abrirFormularioRegistro(reg.tipo, data.alumno, reg);
      });
    });
  }

  function renderPerfilTab() {
    const data = S.perfil;
    if (!data) return '';
    const tab = S.perfilTab;
    if (tab === 'asistencia') {
      const filas = (data.asistencia || []).map(function (r) {
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.fechaTexto || r.fecha) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + badgeEstado(r.estado) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura || '—') + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.docente || '—') + '</td></tr>';
      }).join('');
      return tableHTML('Asistencia', ['Fecha', 'Estado', 'Asignatura', 'Docente'], filas, 'Sin registros de asistencia.');
    }
    if (tab === 'conducta') {
      const filas = (data.actitudes || []).map(function (r) {
        const color = r.clasificacion === 'positiva' ? '#166534' : (r.clasificacion === 'negativa' ? '#991b1b' : '#92400e');
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.fechaTexto || r.fecha) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;"><span style="color:' + color + '; font-weight:700;">' + esc(r.actitud) + '</span></td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.clasificacion) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura || '—') + '<div style="font-size:0.72rem; color:#9ca3af;">' + esc(r.docente || '') + '</div></td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.notas || '') + '</td></tr>';
      }).join('');
      return tableHTML('Conducta', ['Fecha', 'Actitud', 'Clasificación', 'Materia', 'Notas'], filas, 'Sin actitudes registradas.');
    }
    if (tab === 'academico') {
      const parciales = (data.parciales || []).map(function (r) {
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.periodo) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6; font-weight:800;">' + (r.calificacion === null ? '—' : r.calificacion) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.docente || '') + '</td></tr>';
      }).join('');
      const finales = (data.finales || []).map(function (r) {
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + (r.calificacionFinal === null ? '—' : r.calificacionFinal) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + (r.calificacionDefinitiva === null ? '—' : r.calificacionDefinitiva) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.estado || '') + '</td></tr>';
      }).join('');
      const entregas = (data.entregas || []).map(function (r) {
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.evidencia) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura || '') + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.calificacion || r.escala || '—') + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.dentroFecha || '') + '</td></tr>';
      }).join('');
      return tableHTML('Calificaciones parciales', ['Periodo', 'Asignatura', 'Calificación', 'Docente'], parciales, 'Sin calificaciones parciales.') +
        tableHTML('Calificaciones finales', ['Asignatura', 'Final', 'Definitiva', 'Estado'], finales, 'Sin calificaciones finales.') +
        tableHTML('Entregas de evidencias', ['Evidencia', 'Asignatura', 'Calificación', 'En fecha'], entregas, 'Sin entregas registradas.');
    }
    if (tab === 'salidas') {
      const filas = (data.salidas || []).map(function (r) {
        return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.fechaTexto || r.fecha) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.motivo) + (r.motivoOtro ? ' (' + esc(r.motivoOtro) + ')' : '') + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.estado) + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.duracion || '—') + '</td>' +
          '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(r.asignatura || '') + '</td></tr>';
      }).join('');
      return tableHTML('Salidas y entradas', ['Fecha', 'Motivo', 'Estado', 'Duración', 'Materia'], filas, 'Sin salidas registradas.');
    }
    if (tab === 'seguimiento') {
      const regs = (data.registros || []).map(function (r) {
        return '<div style="border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-bottom:10px; background:#fff;">' +
          '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">' +
          '<div>' + badgeTipoRegistro(r.tipo) + ' <strong style="margin-left:6px;">' + esc(r.categoria || r.tipo) + '</strong></div>' +
          '<div style="font-size:0.78rem; color:#6b7280;">' + esc(r.fechaCreacionTexto || r.fechaCreacion) + ' · ' + esc(r.usuario || '') + '</div></div>' +
          '<div style="font-size:0.86rem; color:#111827; margin-top:6px;">' + esc(r.descripcion || '') + '</div>' +
          (r.seguimiento ? '<div style="font-size:0.82rem; color:#4b5563; margin-top:4px;"><strong>Seguimiento:</strong> ' + esc(r.seguimiento) + '</div>' : '') +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; gap:8px; flex-wrap:wrap;">' +
          '<div style="font-size:0.78rem; color:#6b7280;">Estado: <strong>' + esc(r.estado || '') + '</strong>' +
          (r.prioridad ? ' · Prioridad: ' + esc(r.prioridad) : '') +
          (r.proximaRevision ? ' · Próxima revisión: ' + esc(r.proximaRevision) : '') + '</div>' +
          '<button type="button" class="btn btn-secondary" data-caso-editar="' + attr(r.id) + '" style="padding:5px 10px; font-size:0.75rem;">Editar</button></div></div>';
      }).join('');
      return '<h4 style="margin:0 0 8px 0;">Seguimiento</h4>' + (regs || '<p style="color:#6b7280;">Sin casos, observaciones ni reconocimientos.</p>');
    }
    // Resumen
    const eventos = [];
    (data.asistencia || []).forEach(function (r) { eventos.push({ fecha: r.fecha, tipo: 'Asistencia', texto: (r.estado || '') + ' · ' + (r.asignatura || ''), color: '#1e40af' }); });
    (data.actitudes || []).forEach(function (r) { eventos.push({ fecha: r.fecha, tipo: 'Actitud', texto: (r.actitud || '') + ' (' + (r.clasificacion || '') + ')', color: r.clasificacion === 'negativa' ? '#991b1b' : '#166534' }); });
    (data.salidas || []).forEach(function (r) { eventos.push({ fecha: r.fecha, tipo: 'Salida', texto: (r.motivo || '') + ' · ' + (r.estado || ''), color: '#92400e' }); });
    (data.entregas || []).forEach(function (r) { eventos.push({ fecha: r.fecha, tipo: 'Evidencia', texto: (r.evidencia || ''), color: '#6b21a8' }); });
    (data.registros || []).forEach(function (r) { eventos.push({ fecha: r.fechaCreacion, tipo: 'Registro', texto: (r.descripcion || ''), color: '#0f766e' }); });
    ordenarPorFechaDesc(eventos, 'fecha');
    const ultimos = eventos.slice(0, 10).map(function (e) {
      return '<div style="display:flex; gap:10px; border-bottom:1px solid #f3f4f6; padding:7px 0; font-size:0.84rem;">' +
        '<span style="color:#9ca3af; min-width:118px;">' + esc(prefFechaTexto(e.fecha)) + '</span>' +
        '<span style="color:' + e.color + '; font-weight:700; min-width:82px;">' + esc(e.tipo) + '</span>' +
        '<span style="color:#374151;">' + esc(e.texto) + '</span></div>';
    }).join('');
    return '<h4 style="margin:0 0 8px 0;">Últimos movimientos</h4>' + (ultimos || '<p style="color:#6b7280;">Sin movimientos registrados en el periodo.</p>');
  }

  function prefFechaTexto(valor) {
    const d = parseFecha(valor);
    if (!d) return '—';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function tableHTML(titulo, cabeceras, filas, vacio) {
    const th = (cabeceras || []).map(function (c) { return '<th style="padding:7px; text-align:left; background:#f9fafb; font-size:0.72rem; color:#6b7280; text-transform:uppercase;">' + esc(c) + '</th>'; }).join('');
    return '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px; margin-bottom:12px;">' +
      '<h4 style="margin:0 0 8px 0; font-size:0.95rem; color:#111827;">' + esc(titulo) + '</h4>' +
      '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:0.83rem;"><thead><tr>' + th + '</tr></thead>' +
      '<tbody>' + (filas || '<tr><td colspan="' + (cabeceras || []).length + '" style="padding:12px; color:#6b7280;">' + esc(vacio || 'Sin datos.') + '</td></tr>') + '</tbody></table></div></div>';
  }

  // ------------------------------------------------------------
  // Grupos
  // ------------------------------------------------------------
  function renderGruposTab() {
    const cont = document.getElementById('tabContent');
    if (!S.gruposCargados) {
      if (S.gruposError) {
        cont.innerHTML = '<div class="card" style="padding:20px; text-align:center;"><div class="error" style="margin-bottom:10px;">No se pudieron cargar los grupos.</div>' +
          '<button type="button" class="btn btn-primary" id="btnReintentarGrupos">Reintentar</button></div>';
        const b = document.getElementById('btnReintentarGrupos');
        if (b) b.addEventListener('click', function () { cargarGrupos(true); });
        return;
      }
      if (!S.cargandoGrupos) cargarGrupos(true);
      cont.innerHTML = spinnerHTML('Cargando grupos…');
      return;
    }
    const cards = (S.gruposData || []).map(function (g) {
      return '<div data-grupo="' + attr(g.id) + '" style="cursor:pointer; background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:14px; margin-bottom:10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
        '<div style="font-size:1.05rem; font-weight:800; color:#111827;">' + esc(g.nombre) + '</div>' +
        '<div style="font-size:0.82rem; color:#6b7280;">' + g.alumnos + ' alumnos</div></div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">' +
        chip('Asistencia ' + (g.porcentajeAsistencia === null ? '—' : g.porcentajeAsistencia + '%'), '#1e40af', '#dbeafe') +
        chip('Promedio ' + (g.promedio === null ? '—' : g.promedio), '#166534', '#dcfce7') +
        chip('+' + g.positivas + ' / -' + g.negativas, '#92400e', '#fef3c7') +
        chip('🔴 ' + g.rojos, '#991b1b', '#fee2e2') +
        chip('🌟 ' + g.reconocimientos, '#92400e', '#fef3c7') +
        '</div></div>';
    }).join('');
    cont.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">' +
      '<div><h2 style="margin:0; font-size:1.35rem; color:#111827;">Grupos</h2><p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">Panorama por grupo y materia.</p></div>' +
      '<button type="button" id="btnRefrescarGrupos" class="btn btn-secondary" style="padding:8px 14px;">⟳ Actualizar</button></div>' +
      (cards || '<div style="color:#6b7280;">Sin grupos.</div>');
    document.getElementById('btnRefrescarGrupos').addEventListener('click', function () { cargarGrupos(true); });
    cont.querySelectorAll('[data-grupo]').forEach(function (c) {
      c.addEventListener('click', function () { abrirGrupo(c.dataset.grupo); });
    });
  }

  function renderGrupoDetalle(data) {
    const cont = document.getElementById('tabContent');
    const g = data.grupo || {};
    const r = data.resumen || {};
    const alumnos = (data.alumnos || []).map(function (a) {
      return '<tr data-curp="' + attr(a.curp) + '" style="cursor:pointer; border-bottom:1px solid #f3f4f6;">' +
        '<td style="padding:8px;"><strong>' + esc(a.nombreCompleto) + '</strong></td>' +
        '<td style="padding:8px;">' + (a.asistencia.porcentaje === null ? '—' : a.asistencia.porcentaje + '%') + '</td>' +
        '<td style="padding:8px;">' + a.asistencia.ausente + '</td>' +
        '<td style="padding:8px;">' + a.asistencia.retardo + '</td>' +
        '<td style="padding:8px;">' + (a.academicos.promedio === null ? '—' : a.academicos.promedio) + '</td>' +
        '<td style="padding:8px;">' + badgeSemaforo(a.semaforo, a.reconocimiento) + '</td></tr>';
    }).join('');
    const asignaturas = (data.asignaturas || []).map(function (a) {
      return '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-bottom:8px;">' +
        '<div style="font-weight:800; color:#111827;">' + esc(a.nombre) + '</div>' +
        '<div style="font-size:0.8rem; color:#6b7280; margin-bottom:6px;">' + esc(a.docente || '') + '</div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
        chip('Asistencia ' + (a.asistencia.porcentaje === null ? '—' : a.asistencia.porcentaje + '%'), '#1e40af', '#dbeafe') +
        chip('Promedio ' + (a.promedio === null ? '—' : a.promedio), '#166534', '#dcfce7') +
        chip('+' + a.actitudes.positivas + ' / -' + a.actitudes.negativas, '#92400e', '#fef3c7') +
        chip('Reprobadas ' + a.materiasReprobadas, '#991b1b', '#fee2e2') +
        '</div></div>';
    }).join('');
    cont.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">' +
      '<div><button type="button" id="btnVolverGrupos" class="btn btn-secondary" style="padding:7px 12px;">← Grupos</button>' +
      '<h2 style="margin:8px 0 0 0; font-size:1.35rem; color:#111827;">' + esc(g.nombre) + '</h2>' +
      '<p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">' + (data.periodoSeleccionado ? esc(data.periodoSeleccionado.nombre) : '') + '</p></div>' +
      '<div style="font-size:0.82rem; color:#6b7280; text-align:right;">' + (r.alumnos || 0) + ' alumnos · ' +
      (r.porcentajeAsistencia === null ? '—' : r.porcentajeAsistencia + '% asistencia') + ' · promedio ' + (r.promedio === null ? '—' : r.promedio) + '</div></div>' +
      '<div style="display:grid; grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr); gap:14px; align-items:start;" class="pref-grid">' +
      '<div><h3 style="margin:0 0 8px 0; font-size:1rem;">Alumnos</h3><div style="overflow-x:auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px;">' +
      '<table style="width:100%; border-collapse:collapse; font-size:0.84rem;"><thead><tr style="background:#f9fafb; text-align:left; font-size:0.72rem; color:#6b7280;"><th style="padding:8px;">Alumno</th><th style="padding:8px;">Asist.</th><th style="padding:8px;">Faltas</th><th style="padding:8px;">Retardos</th><th style="padding:8px;">Prom.</th><th style="padding:8px;">Estado</th></tr></thead><tbody>' +
      (alumnos || '<tr><td colspan="6" style="padding:16px; color:#6b7280;">Sin alumnos.</td></tr>') + '</tbody></table></div></div>' +
      '<div><h3 style="margin:0 0 8px 0; font-size:1rem;">Por asignatura</h3>' + (asignaturas || '<p style="color:#6b7280;">Sin asignaturas.</p>') + '</div></div>' +
      '<style>@media (max-width: 900px) { .pref-grid { grid-template-columns: 1fr !important; } }</style>';
    document.getElementById('btnVolverGrupos').addEventListener('click', function () { renderGruposTab(); });
    cont.querySelectorAll('tr[data-curp]').forEach(function (tr) {
      tr.addEventListener('click', function () { abrirPerfil(tr.dataset.curp); });
    });
  }

  // ------------------------------------------------------------
  // Docentes / clases
  // ------------------------------------------------------------
  function renderDocentes() {
    const cont = document.getElementById('tabContent');
    const panel = S.panel;
    if (!panel) {
      cont.innerHTML = spinnerHTML('Cargando…');
      if (!S.cargandoPanel) {
        cargarPanel(true).then(function () {
          if (S.panel) renderDocentes();
          else cont.innerHTML = errorHTML('No se pudo cargar el panel.');
        });
      }
      return;
    }
    const activas = panel.clases || [];
    const hoyClases = panel.clasesHoy || [];
    const activasHTML = activas.map(function (c) {
      return '<div style="background:#fff; border:1px solid #e5e7eb; border-left:6px solid #10b981; border-radius:12px; padding:12px; margin-bottom:8px;">' +
        '<div style="font-weight:800; color:#111827;">' + esc(c.docente) + '</div>' +
        '<div style="font-size:0.82rem; color:#6b7280;">' + esc(c.grupo) + ' · ' + esc(c.asignatura) + ' · desde ' + esc(horaDe(c.inicio)) + '</div>' +
        '<div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">' + chip('👥 ' + c.conteos.total, '#1e40af', '#dbeafe') +
        chip('✅ ' + c.conteos.presente, '#166534', '#dcfce7') + chip('🚪 ' + c.fuera.length + ' fuera', '#92400e', '#fef3c7') + '</div>' +
        '<button type="button" class="btn btn-secondary" data-ver-clase-doc="' + attr(c.idClase) + '" style="margin-top:8px; padding:6px 10px; font-size:0.78rem;">Ver lista</button></div>';
    }).join('');
    const hoyHTML = hoyClases.map(function (c) {
      const activa = c.esActiva;
      return '<tr><td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(horaDe(c.inicio)) + '</td>' +
        '<td style="padding:7px; border-bottom:1px solid #f3f4f6;"><strong>' + esc(c.docente) + '</strong></td>' +
        '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(c.grupo) + '</td>' +
        '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + esc(c.asignatura) + '</td>' +
        '<td style="padding:7px; border-bottom:1px solid #f3f4f6;">' + (activa ? chip('Activa', '#166534', '#dcfce7') : chip(esc(c.estado || 'Finalizada'), '#4b5563', '#f3f4f6')) + '</td></tr>';
    }).join('');
    cont.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">' +
      '<div><h2 style="margin:0; font-size:1.35rem; color:#111827;">Docentes y clases</h2>' +
      '<p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">Clases activas y clases de hoy. Vista operativa, no de evaluación.</p></div>' +
      '<button type="button" id="btnRefrescarDocentes" class="btn btn-secondary" style="padding:8px 14px;">⟳ Actualizar</button></div>' +
      '<div style="display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.4fr); gap:14px; align-items:start;" class="pref-grid">' +
      '<div><h3 style="margin:0 0 8px 0; font-size:1rem;">En clase ahora</h3>' + (activasHTML || '<p style="color:#6b7280;">Sin clases activas.</p>') + '</div>' +
      '<div><h3 style="margin:0 0 8px 0; font-size:1rem;">Clases de hoy</h3><div style="overflow-x:auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px;">' +
      '<table style="width:100%; border-collapse:collapse; font-size:0.82rem;"><thead><tr style="background:#f9fafb; text-align:left; font-size:0.72rem; color:#6b7280;"><th style="padding:8px;">Inicio</th><th style="padding:8px;">Docente</th><th style="padding:8px;">Grupo</th><th style="padding:8px;">Materia</th><th style="padding:8px;">Estado</th></tr></thead><tbody>' +
      (hoyHTML || '<tr><td colspan="5" style="padding:16px; color:#6b7280;">Sin clases registradas hoy.</td></tr>') + '</tbody></table></div></div></div>' +
      '<style>@media (max-width: 900px) { .pref-grid { grid-template-columns: 1fr !important; } }</style>';
    document.getElementById('btnRefrescarDocentes').addEventListener('click', function () { cargarPanel(true).then(renderDocentes); });
    cont.querySelectorAll('[data-ver-clase-doc]').forEach(function (b) {
      b.addEventListener('click', function () { abrirDetalleClase(b.dataset.verClaseDoc); });
    });
  }

  // ------------------------------------------------------------
  // Casos / observaciones / reconocimientos
  // ------------------------------------------------------------
  function renderCasosTab() {
    const cont = document.getElementById('tabContent');
    const focoPrevio = recordarFoco();
    if (!S.casosCargados) {
      if (S.casosError) {
        cont.innerHTML = '<div class="card" style="padding:20px; text-align:center;"><div class="error" style="margin-bottom:10px;">No se pudieron cargar los registros.</div>' +
          '<button type="button" class="btn btn-primary" id="btnReintentarCasos">Reintentar</button></div>';
        const b = document.getElementById('btnReintentarCasos');
        if (b) b.addEventListener('click', function () { cargarCasos(true); });
        return;
      }
      if (!S.cargandoCasos) cargarCasos(true);
      cont.innerHTML = spinnerHTML('Cargando registros…');
      return;
    }
    const f = S.filtrosCasos;
    const lista = (S.casos || []).filter(function (r) {
      if (f.tipo && r.tipo !== f.tipo) return false;
      if (f.estado && r.estado !== f.estado) return false;
      const q = String(f.busqueda || '').toLowerCase();
      if (q && (r.nombreAlumno || '').toLowerCase().indexOf(q) === -1 && (r.descripcion || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    const cards = lista.map(function (r) {
      return '<div data-registro="' + attr(r.id) + '" style="cursor:pointer; background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:12px; margin-bottom:10px;">' +
        '<div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:center;">' +
        '<div>' + badgeTipoRegistro(r.tipo) + ' <strong style="margin-left:4px;">' + esc(r.nombreAlumno) + '</strong> <span style="color:#6b7280; font-size:0.8rem;">· ' + esc(r.grupo) + '</span></div>' +
        '<div style="font-size:0.75rem; color:#6b7280;">' + esc(r.fechaCreacionTexto || r.fechaCreacion) + '</div></div>' +
        '<div style="font-size:0.85rem; color:#374151; margin-top:6px;">' + esc(r.descripcion || '') + '</div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">' +
        (r.estado ? chip('Estado: ' + r.estado, '#1e40af', '#dbeafe') : '') +
        (r.prioridad ? chip('Prioridad: ' + r.prioridad, '#92400e', '#fef3c7') : '') +
        (r.proximaRevision ? chip('Revisión: ' + r.proximaRevision, '#4b5563', '#f3f4f6') : '') +
        '</div></div>';
    }).join('');
    cont.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">' +
      '<div><h2 style="margin:0; font-size:1.35rem; color:#111827;">Casos y seguimiento</h2>' +
      '<p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">Casos, observaciones y reconocimientos del prefecto.</p></div>' +
      '<button type="button" id="btnNuevoCaso" class="btn btn-primary" style="padding:8px 14px;">+ Nuevo registro</button></div>' +
      '<div class="card" style="padding:10px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">' +
      '<select id="filtroTipoCaso" style="padding:8px; border-radius:10px; border:1px solid #d1d5db;"><option value="">Todos los tipos</option>' +
      '<option value="caso"' + (f.tipo === 'caso' ? ' selected' : '') + '>Casos</option>' +
      '<option value="observacion"' + (f.tipo === 'observacion' ? ' selected' : '') + '>Observaciones</option>' +
      '<option value="reconocimiento"' + (f.tipo === 'reconocimiento' ? ' selected' : '') + '>Reconocimientos</option></select>' +
      '<select id="filtroEstadoCaso" style="padding:8px; border-radius:10px; border:1px solid #d1d5db;"><option value="">Todos los estados</option>' +
      ['nuevo', 'en_seguimiento', 'atendido', 'cerrado', 'registrado'].map(function (e) { return '<option value="' + e + '"' + (f.estado === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') +
      '</select><input type="search" id="busquedaCasos" placeholder="Buscar alumno o descripción…" value="' + attr(f.busqueda) + '" style="flex:1 1 200px; padding:8px; border-radius:10px; border:1px solid #d1d5db;"></div>' +
      (cards || '<div style="color:#6b7280; padding:16px;">Sin registros con esos filtros.</div>');

    document.getElementById('btnNuevoCaso').addEventListener('click', function () { abrirFormularioRegistro('caso', null, null); });
    document.getElementById('filtroTipoCaso').addEventListener('change', function (e) { S.filtrosCasos.tipo = e.target.value; renderCasosTab(); });
    document.getElementById('filtroEstadoCaso').addEventListener('change', function (e) { S.filtrosCasos.estado = e.target.value; renderCasosTab(); });
    let db = null;
    document.getElementById('busquedaCasos').addEventListener('input', function (e) {
      clearTimeout(db);
      db = setTimeout(function () { S.filtrosCasos.busqueda = e.target.value; renderCasosTab(); }, 300);
    });
    cont.querySelectorAll('[data-registro]').forEach(function (card) {
      card.addEventListener('click', function () {
        const reg = S.casos.find(function (r) { return String(r.id) === String(card.dataset.registro); });
        if (reg) abrirDetalleRegistro(reg);
      });
    });
    restaurarFoco(focoPrevio);
  }

  function abrirDetalleRegistro(registro) {
    const campos = [
      ['Alumno', registro.nombreAlumno + ' · ' + registro.grupo],
      ['Tipo', registro.tipo],
      ['Categoría', registro.categoria || '—'],
      ['Prioridad', registro.prioridad || '—'],
      ['Estado', registro.estado || '—'],
      ['Descripción', registro.descripcion || '—'],
      ['Seguimiento', registro.seguimiento || '—'],
      ['Próxima revisión', registro.proximaRevision || '—'],
      ['Contacto con la familia', registro.contactoFamilia || '—'],
      ['Creado', (registro.fechaCreacionTexto || registro.fechaCreacion) + ' · ' + (registro.usuario || '')]
    ].map(function (c) {
      return '<div style="padding:7px 0; border-bottom:1px solid #f3f4f6;"><div style="font-size:0.72rem; color:#6b7280; text-transform:uppercase; font-weight:700;">' + esc(c[0]) + '</div>' +
        '<div style="font-size:0.88rem; color:#111827; white-space:pre-wrap;">' + esc(c[1]) + '</div></div>';
    }).join('');
    abrirModal('Detalle del registro', campos +
      '<div style="display:flex; gap:8px; margin-top:12px;"><button type="button" id="btnEditarRegistro" class="btn btn-primary" style="flex:1;">Editar</button></div>');
    const btn = document.getElementById('btnEditarRegistro');
    if (btn) btn.addEventListener('click', function () {
      cerrarModal();
      const alumno = registro.alumno || { curp: registro.curp, nombreCompleto: registro.nombreAlumno };
      abrirFormularioRegistro(registro.tipo, alumno, registro);
    });
  }

  async function abrirFormularioRegistro(tipo, alumno, registro) {
    let alumnoSel = alumno || null;
    let listaAlumnos = S.alumnosTodos;
    if (!alumnoSel) {
      await asegurarAlumnosParaFormulario();
      listaAlumnos = S.alumnosTodos;
      if (!listaAlumnos.length) { toast('No hay alumnos disponibles.', 'error'); return; }
    } else if (!listaAlumnos.length && S.alumnos.length) {
      listaAlumnos = S.alumnos;
    }
    const esEdicion = !!registro;
    const titulo = esEdicion ? 'Editar registro' : (tipo === 'caso' ? 'Nuevo caso' : (tipo === 'reconocimiento' ? 'Nuevo reconocimiento' : 'Nueva observación'));
    let alumnoOpciones = listaAlumnos.map(function (a) {
      return '<option value="' + attr(a.curp) + '"' + (alumnoSel && a.curp === alumnoSel.curp ? ' selected' : '') + '>' + esc(a.nombreCompleto) + ' · ' + esc(a.grupo) + '</option>';
    }).join('');
    if (alumnoSel && !listaAlumnos.some(function (a) { return a.curp === alumnoSel.curp; })) {
      alumnoOpciones = '<option value="' + attr(alumnoSel.curp) + '" selected>' + esc(alumnoSel.nombreCompleto || alumnoSel.nombreAlumno || alumnoSel.curp) + '</option>' + alumnoOpciones;
    }
    const categorias = ['absentismo', 'conducta', 'salidas', 'academico', 'otro'];
    const estados = ['nuevo', 'en_seguimiento', 'atendido', 'cerrado', 'registrado'];

    const html = '<form id="formRegistroPrefecto">' +
      '<div style="margin-bottom:10px;"><label style="font-size:0.8rem; font-weight:700; color:#374151;">Alumno</label>' +
      '<select id="regAlumno" required style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;"><option value="">Selecciona un alumno…</option>' + alumnoOpciones + '</select></div>' +
      (tipo === 'caso' ? '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">' +
        '<div><label style="font-size:0.8rem; font-weight:700; color:#374151;">Categoría</label><select id="regCategoria" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;">' +
        categorias.map(function (c) { return '<option value="' + c + '"' + (registro && registro.categoria === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
        '<div><label style="font-size:0.8rem; font-weight:700; color:#374151;">Prioridad</label><select id="regPrioridad" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;">' +
        ['alta', 'media', 'baja'].map(function (p) { return '<option value="' + p + '"' + (registro && registro.prioridad === p ? ' selected' : (!registro && p === 'media' ? ' selected' : '')) + '>' + p + '</option>'; }).join('') + '</select></div>' +
        '</div>' : '') +
      (esEdicion ? '<div style="margin-top:8px;"><label style="font-size:0.8rem; font-weight:700; color:#374151;">Estado</label><select id="regEstado" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;">' +
        estados.map(function (e) { return '<option value="' + e + '"' + (registro.estado === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' : '') +
      '<div style="margin-top:8px;"><label style="font-size:0.8rem; font-weight:700; color:#374151;">Descripción *</label>' +
      '<textarea id="regDescripcion" required rows="4" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db; resize:vertical;">' + esc(registro ? registro.descripcion : '') + '</textarea></div>' +
      (tipo === 'caso' ? '<div style="margin-top:8px;"><label style="font-size:0.8rem; font-weight:700; color:#374151;">Seguimiento</label>' +
        '<textarea id="regSeguimiento" rows="3" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db; resize:vertical;">' + esc(registro ? registro.seguimiento : '') + '</textarea></div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">' +
        '<div><label style="font-size:0.8rem; font-weight:700; color:#374151;">Próxima revisión</label><input type="date" id="regRevision" value="' + attr(registro ? (registro.proximaRevision || '') : '') + '" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;"></div>' +
        '<div><label style="font-size:0.8rem; font-weight:700; color:#374151;">Contacto con la familia</label><input type="text" id="regContacto" placeholder="Ej. llamada, correo, reunión…" value="' + attr(registro ? (registro.contactoFamilia || '') : '') + '" style="width:100%; padding:9px; border-radius:9px; border:1px solid #d1d5db;"></div>' +
        '</div>' : '') +
      '<div style="display:flex; gap:8px; margin-top:14px;">' +
      '<button type="button" id="regCancelar" class="btn btn-secondary" style="flex:1;">Cancelar</button>' +
      '<button type="submit" id="regGuardar" class="btn btn-primary" style="flex:2;">' + (esEdicion ? 'Guardar cambios' : 'Registrar') + '</button></div></form>';
    abrirModal(titulo, html);

    const sel = document.getElementById('regAlumno');
    if (alumnoSel) {
      sel.value = alumnoSel.curp;
      sel.disabled = true;
    }
    document.getElementById('regCancelar').addEventListener('click', cerrarModal);
    const form = document.getElementById('formRegistroPrefecto');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const curp = sel.value;
      const descripcion = document.getElementById('regDescripcion').value.trim();
      if (!curp) { toast('Selecciona un alumno.', 'error'); return; }
      if (!descripcion) { toast('Escribe una descripción.', 'error'); return; }
      const btn = document.getElementById('regGuardar');
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      const datos = {
        id: esEdicion ? registro.id : undefined,
        tipo: esEdicion ? registro.tipo : tipo,
        curp: curp,
        idPeriodo: S.periodoId || '',
        categoria: document.getElementById('regCategoria') ? document.getElementById('regCategoria').value : '',
        prioridad: document.getElementById('regPrioridad') ? document.getElementById('regPrioridad').value : '',
        estado: document.getElementById('regEstado') ? document.getElementById('regEstado').value : '',
        descripcion: descripcion,
        seguimiento: document.getElementById('regSeguimiento') ? document.getElementById('regSeguimiento').value.trim() : '',
        proximaRevision: document.getElementById('regRevision') ? document.getElementById('regRevision').value : '',
        contactoFamilia: document.getElementById('regContacto') ? document.getElementById('regContacto').value.trim() : ''
      };
      try {
        const res = esEdicion ? await SIREI.api.actualizarRegistroPrefecto(datos) : await SIREI.api.guardarRegistroPrefecto(datos);
        if (res && res.success) {
          toast(res.message || 'Guardado.');
          cerrarModal();
          S.casos = [];
          S.casosCargados = false;
          S.casosError = false;
          S.alumnosCargados = false;
          S.alumnosError = false;
          S.alumnosTodos = [];
          if (S.perfil) {
            const actualizado = await SIREI.api.perfilAlumnoPrefecto(S.perfilCurp, S.periodoId || '');
            if (actualizado && actualizado.success) { S.perfil = actualizado; renderPerfil(); }
          }
          if (S.tab === 'casos') cargarCasos(true);
        } else {
          toast((res && res.message) || 'No se pudo guardar.', 'error');
          btn.disabled = false;
          btn.textContent = esEdicion ? 'Guardar cambios' : 'Registrar';
        }
      } catch (error) {
        console.error('Error al guardar registro:', error);
        toast('Error de conexión al guardar.', 'error');
        btn.disabled = false;
        btn.textContent = esEdicion ? 'Guardar cambios' : 'Registrar';
      }
    });
  }

  async function asegurarAlumnosParaFormulario() {
    if (S.alumnosTodos.length) return;
    await cargarTodosAlumnos(true);
  }

  // ------------------------------------------------------------
  // Reportes para padres
  // ------------------------------------------------------------
  function renderReportesTab() {
    const cont = document.getElementById('tabContent');
    const gruposOpt = '<option value="">Selecciona un grupo</option>' + opcionesSelect(S.grupos, '');
    const periodosOpt = opcionesSelect(S.periodos, S.periodoId, function (p) { return p.nombre + (p.activo ? ' (actual)' : ''); });
    const alumnoOpciones = S.alumnosTodos.length
      ? S.alumnosTodos.map(function (a) { return '<option value="' + attr(a.curp) + '">' + esc(a.nombreCompleto) + ' · ' + esc(a.grupo) + '</option>'; }).join('')
      : '<option value="">' + (S.cargandoAlumnosTodos ? 'Cargando alumnos…' : 'Sin alumnos. Pulsa Actualizar.') + '</option>';

    cont.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">' +
      '<div><h2 style="margin:0; font-size:1.35rem; color:#111827;">Reportes para padres</h2>' +
      '<p style="margin:2px 0 0 0; color:#6b7280; font-size:0.85rem;">Retroalimentación por alumno y periodo. Imprime, guarda PDF o envía por WhatsApp.</p></div></div>' +
      '<div class="card" style="padding:12px; margin-bottom:12px; display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">' +
      '<div style="flex:1 1 180px;"><label style="font-size:0.75rem; font-weight:700; color:#374151;">Grupo</label><select id="repGrupo" style="width:100%; padding:8px; border-radius:9px; border:1px solid #d1d5db;">' + gruposOpt + '</select></div>' +
      '<div style="flex:1 1 220px;"><label style="font-size:0.75rem; font-weight:700; color:#374151;">Alumno</label><select id="repAlumno" style="width:100%; padding:8px; border-radius:9px; border:1px solid #d1d5db;">' + alumnoOpciones + '</select></div>' +
      '<div style="flex:1 1 170px;"><label style="font-size:0.75rem; font-weight:700; color:#374151;">Periodo</label><select id="repPeriodo" style="width:100%; padding:8px; border-radius:9px; border:1px solid #d1d5db;">' + periodosOpt + '</select></div>' +
      '<button type="button" id="btnGenerarReporte" class="btn btn-primary" style="padding:9px 16px;">Generar</button></div>' +
      '<div id="reportePreview"></div>';

    const grupoSel = document.getElementById('repGrupo');
    const alumnoSel = document.getElementById('repAlumno');
    const periodoSel = document.getElementById('repPeriodo');
    grupoSel.addEventListener('change', function () {
      const id = grupoSel.value;
      const lista = (S.alumnosTodos || []).filter(function (a) { return !id || String(a.idGrupo) === String(id); });
      alumnoSel.innerHTML = '<option value="">Selecciona un alumno</option>' + lista.map(function (a) {
        return '<option value="' + attr(a.curp) + '">' + esc(a.nombreCompleto) + '</option>';
      }).join('');
    });
    document.getElementById('btnGenerarReporte').addEventListener('click', async function () {
      const curp = alumnoSel.value;
      if (!curp) { toast('Selecciona un alumno.', 'error'); return; }
      const idPeriodo = periodoSel.value;
      const btn = this;
      btn.disabled = true; btn.textContent = 'Generando…';
      try {
        const data = await SIREI.api.perfilAlumnoPrefecto(curp, idPeriodo);
        if (data && data.success) {
          S.reporte = data;
          renderReportePreview(data);
        } else {
          toast((data && data.message) || 'No se pudo generar el reporte.', 'error');
        }
      } catch (e) {
        console.error(e);
        toast('Error de conexión al generar el reporte.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'Generar';
      }
    });
  }

  function generarReportePerfil(data) {
    S.reporte = data;
    abrirModal('Reporte para padres', '<div id="reportePerfilContenido">' + construirReporteHTML(data, '') + '</div>' +
      '<div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">' +
      '<button type="button" id="btnImprimirReporte" class="btn btn-primary" style="flex:1;">🖨️ Imprimir / PDF</button>' +
      '<button type="button" id="btnWhatsappReporte" class="btn btn-secondary" style="flex:1;">💬 WhatsApp</button></div>');
    const imprimir = document.getElementById('btnImprimirReporte');
    if (imprimir) imprimir.addEventListener('click', function () { imprimirReporte(data); });
    const wa = document.getElementById('btnWhatsappReporte');
    if (wa) wa.addEventListener('click', function () { enviarWhatsappReporte(data); });
  }

  function renderReportePreview(data) {
    const cont = document.getElementById('reportePreview');
    cont.innerHTML = '<div class="card" style="padding:16px; margin-bottom:12px;">' +
      '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">' +
      '<button type="button" id="btnImprimirPreview" class="btn btn-primary" style="padding:8px 14px;">🖨️ Imprimir / PDF</button>' +
      '<button type="button" id="btnWhatsappPreview" class="btn btn-secondary" style="padding:8px 14px;">💬 WhatsApp</button></div>' +
      construirReporteHTML(data, '') + '</div>';
    document.getElementById('btnImprimirPreview').addEventListener('click', function () { imprimirReporte(data); });
    document.getElementById('btnWhatsappPreview').addEventListener('click', function () { enviarWhatsappReporte(data); });
  }

  function construirReporteHTML(data, comentario) {
    const a = data.alumno || {};
    const m = data.metricas || {};
    const asis = m.asistencia || {};
    const act = m.actitudes || {};
    const acad = m.academicos || {};
    const finales = (data.finales || []).map(function (r) {
      return '<tr><td style="padding:5px 7px; border-bottom:1px solid #e5e7eb;">' + esc(r.asignatura) + '</td>' +
        '<td style="padding:5px 7px; border-bottom:1px solid #e5e7eb; text-align:center;">' + (r.calificacionDefinitiva === null ? (r.calificacionFinal === null ? '—' : r.calificacionFinal) : r.calificacionDefinitiva) + '</td></tr>';
    }).join('');
    return '<div style="font-family:Inter, Arial, sans-serif; color:#111827;">' +
      '<div style="text-align:center; border-bottom:2px solid #1E3A8A; padding-bottom:8px; margin-bottom:10px;">' +
      '<div style="font-weight:800; font-size:1.1rem;">' + esc(S.config.nombreInstitucion || 'SIREI') + '</div>' +
      '<div style="font-size:0.8rem; color:#6b7280;">Reporte de seguimiento · ' + esc(data.periodoSeleccionado ? data.periodoSeleccionado.nombre : '') + ' · ' + esc(hoy()) + '</div></div>' +
      '<div style="margin-bottom:8px;"><strong style="font-size:1.05rem;">' + esc(a.nombreCompleto) + '</strong>' +
      '<div style="font-size:0.82rem; color:#6b7280;">Grupo: ' + esc(a.grupo) + ' · Matrícula: ' + esc(a.matricula || '—') + '</div></div>' +
      '<table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:10px;">' +
      '<tr><td style="padding:4px 7px; color:#6b7280;">Asistencia</td><td style="padding:4px 7px; font-weight:800;">' + (asis.porcentaje === null ? '—' : asis.porcentaje + '%') + '</td>' +
      '<td style="padding:4px 7px; color:#6b7280;">Faltas</td><td style="padding:4px 7px; font-weight:800;">' + (asis.ausente || 0) + '</td></tr>' +
      '<tr><td style="padding:4px 7px; color:#6b7280;">Retardos</td><td style="padding:4px 7px; font-weight:800;">' + (asis.retardo || 0) + '</td>' +
      '<td style="padding:4px 7px; color:#6b7280;">Promedio</td><td style="padding:4px 7px; font-weight:800;">' + (acad.promedio === null ? '—' : acad.promedio) + '</td></tr>' +
      '<tr><td style="padding:4px 7px; color:#6b7280;">Actitudes positivas</td><td style="padding:4px 7px; font-weight:800; color:#166534;">' + (act.positivas || 0) + '</td>' +
      '<td style="padding:4px 7px; color:#6b7280;">Actitudes negativas</td><td style="padding:4px 7px; font-weight:800; color:#991b1b;">' + (act.negativas || 0) + '</td></tr></table>' +
      '<h4 style="margin:8px 0 4px 0; font-size:0.9rem;">Calificaciones finales</h4>' +
      '<table style="width:100%; border-collapse:collapse; font-size:0.8rem;"><thead><tr style="background:#f3f4f6;"><th style="padding:5px 7px; text-align:left;">Asignatura</th><th style="padding:5px 7px;">Calificación</th></tr></thead>' +
      '<tbody>' + (finales || '<tr><td colspan="2" style="padding:8px; color:#6b7280;">Sin calificaciones finales.</td></tr>') + '</tbody></table>' +
      '<div style="margin-top:10px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:8px;">' +
      '<div style="font-size:0.78rem; color:#6b7280; font-weight:700;">Observaciones del prefecto</div>' +
      '<div style="font-size:0.84rem; white-space:pre-wrap;">' + esc(comentario || 'Sin observaciones adicionales.') + '</div></div>' +
      '<div style="display:flex; justify-content:space-between; margin-top:18px; font-size:0.72rem; color:#6b7280;">' +
      '<div>Firma del prefecto: ______________________</div><div>Firma del tutor: ______________________</div></div></div>';
  }

  function imprimirReporte(data) {
    const comentario = window.prompt('Comentario para los padres (opcional):', '') || '';
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte</title>' +
      '<style>body { margin: 24px; font-family: Arial, sans-serif; } @media print { .no-print { display:none; } }</style></head><body>' +
      construirReporteHTML(data, comentario) +
      '<div class="no-print" style="margin-top:16px;"><button onclick="window.print()">Imprimir</button></div>' +
      '</body></html>';
    const win = window.open('', '_blank');
    if (!win) { toast('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.', 'error'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () { try { win.print(); } catch (e) {} }, 400);
  }

  function enviarWhatsappReporte(data) {
    const a = data.alumno || {};
    const m = data.metricas || {};
    const asis = m.asistencia || {};
    const act = m.actitudes || {};
    const acad = m.academicos || {};
    const tutor = (a.tutores || [])[0];
    const telefono = (tutor && (tutor.whatsapp || tutor.celular) || '').replace(/[^0-9]/g, '');
    const texto = 'Hola, le compartimos el seguimiento de ' + (a.nombreCompleto || '') + ' (' + (a.grupo || '') + '). ' +
      'Asistencia: ' + (asis.porcentaje === null ? 'sin datos' : asis.porcentaje + '%') + '. ' +
      'Faltas: ' + (asis.ausente || 0) + ', retardos: ' + (asis.retardo || 0) + '. ' +
      'Actitudes positivas: ' + (act.positivas || 0) + ', negativas: ' + (act.negativas || 0) + '. ' +
      'Promedio: ' + (acad.promedio === null ? 'sin datos' : acad.promedio) + '. ' +
      'Cualquier duda, estamos a sus órdenes. ' + (S.config.nombreInstitucion || 'SIREI');
    const url = 'https://wa.me/' + (telefono ? '52' + telefono : '') + '?text=' + encodeURIComponent(texto);
    window.open(url, '_blank');
  }

  // ------------------------------------------------------------
  // Modal genérico
  // ------------------------------------------------------------
  function abrirModal(titulo, contenido) {
    cerrarModal();
    const overlay = document.createElement('div');
    overlay.id = 'prefectoModal';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,.65); z-index:2147483200; display:flex; align-items:center; justify-content:center; padding:16px;';
    overlay.innerHTML = '<div style="background:#fff; border-radius:16px; width:min(760px,100%); max-height:88vh; overflow-y:auto; padding:16px; box-shadow:0 20px 60px rgba(0,0,0,.35);">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">' +
      '<h3 style="margin:0; font-size:1.05rem; color:#111827;">' + esc(titulo) + '</h3>' +
      '<button type="button" id="prefectoModalCerrar" style="background:#f3f4f6; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; font-weight:700;">✕</button></div>' +
      '<div id="prefectoModalContenido">' + contenido + '</div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#prefectoModalCerrar').addEventListener('click', cerrarModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrarModal(); });
    S.modal = overlay;
  }

  function cerrarModal() {
    const overlay = document.getElementById('prefectoModal');
    if (overlay) overlay.remove();
    S.modal = null;
  }

  // ------------------------------------------------------------
  // Navegación
  // ------------------------------------------------------------
  function mostrarTab(tab) {
    S.tab = tab;
    cerrarModal();
    const cont = document.getElementById('tabContent');
    if (!cont) return;
    if (tab === 'ahora') {
      if (!S.panel) { cont.innerHTML = spinnerHTML('Cargando panel…'); cargarPanel(true).then(renderAhora); }
      else renderAhora();
      return;
    }
    if (tab === 'alumnos') { renderAlumnosTab(); return; }
    if (tab === 'grupos') { renderGruposTab(); return; }
    if (tab === 'docentes') { renderDocentes(); return; }
    if (tab === 'casos') { renderCasosTab(); return; }
    if (tab === 'reportes') {
      if (!S.alumnosTodos.length) cargarTodosAlumnos(false);
      renderReportesTab();
    }
  }

})();
