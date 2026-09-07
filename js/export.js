// ========== 2. FUNCIONES DE EXPORTACIÓN E IMPRESIÓN ==========
// (Se mantienen aquí porque son grandes y se usan desde varias páginas)

function exportarDocentesCSV(docentes) {
  if (!docentes || docentes.length === 0) {
    SIREI.utils.mostrarToast('No hay docentes para exportar', 'error');
    return;
  }

  const cabecerasBase = [
    'ID', 'Nombre completo', 'Fecha nacimiento', 'Edad', 'Domicilio',
    'Celular', 'Whatsapp', 'Email personal', 'Email institucional', 'Foto URL'
  ];
  const maxCarreras = SIREI.MAX_CARRERAS;
  const cabecerasCarreras = [];
  for (let i = 1; i <= maxCarreras; i++) {
    cabecerasCarreras.push(
      `Carrera ${i} - Nivel`,
      `Carrera ${i} - Nombre`,
      `Carrera ${i} - Institución`,
      `Carrera ${i} - Año término`,
      `Carrera ${i} - Estado (Titulado/Trunco)`
    );
  }
  const cabeceras = [...cabecerasBase, ...cabecerasCarreras];

  const filas = [];
  for (const docente of docentes) {
    let edad = '';
    if (docente.fechaNac) {
      const nac = new Date(docente.fechaNac);
      if (!isNaN(nac.getTime())) {
        const hoy = new Date();
        let e = hoy.getFullYear() - nac.getFullYear();
        const m = hoy.getMonth() - nac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
        edad = e.toString();
      }
    }
    const filaBase = [
      docente.id,
      docente.nombre,
      docente.fechaNac || '',
      edad,
      docente.domicilio || '',
      docente.celular || '',
      docente.whatsapp || '',
      docente.emailPersonal || '',
      docente.emailInstitucional || '',
      docente.fotoUrl || ''
    ];
    const carreras = docente.carreras || [];
    const filaCarreras = [];
    for (let i = 0; i < maxCarreras; i++) {
      if (i < carreras.length) {
        const c = carreras[i];
        filaCarreras.push(
          c.nivel || '',
          c.carrera || '',
          c.institucion || '',
          c.anioTermino || '',
          c.titulado ? 'Titulado' : (c.trunco ? 'Trunco' : '')
        );
      } else {
        filaCarreras.push('', '', '', '', '');
      }
    }
    filas.push([...filaBase, ...filaCarreras]);
  }

  const escaparTexto = (texto) => {
    if (texto === undefined || texto === null) return '';
    const str = String(texto);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const filasCSV = [
    cabeceras.map(escaparTexto).join(','),
    ...filas.map(fila => fila.map(escaparTexto).join(','))
  ];
  const contenidoCSV = filasCSV.join('\n');
  const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(blob);
  enlace.href = url;
  enlace.setAttribute('download', 'docentes_sirei.csv');
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
  SIREI.utils.mostrarToast(`Exportados ${docentes.length} docentes`);
}

function imprimirDocente(docente) {
  let fechaNacFormateada = '';
  let edadTexto = '';
  if (docente.fechaNac) {
    const fecha = new Date(docente.fechaNac);
    if (!isNaN(fecha.getTime())) {
      fechaNacFormateada = fecha.toLocaleDateString('es-ES');
      const hoy = new Date();
      let edad = hoy.getFullYear() - fecha.getFullYear();
      const mes = hoy.getMonth() - fecha.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad--;
      edadTexto = ` (${edad} años)`;
    } else {
      fechaNacFormateada = docente.fechaNac;
    }
  }

  const contenido = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ficha del docente - ${SIREI.utils.escapeHtml(docente.nombre)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Segoe UI', sans-serif;
          margin: 30px;
          line-height: 1.4;
          color: #1f2937;
          background: white;
        }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 24px; color: #1E3A8A; border-bottom: 2px solid #1E3A8A; padding-bottom: 8px; margin-bottom: 20px; }
        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #374151; border-left: 4px solid #1E3A8A; padding-left: 12px; }
        .foto { text-align: center; margin-bottom: 20px; }
        .foto img { max-width: 120px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .datos-personales {
          background: #f9fafb;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px 24px;
        }
        .campo {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
        }
        .campo strong {
          font-weight: 600;
          min-width: 140px;
          flex-shrink: 0;
          color: #1f2937;
        }
        .campo span {
          word-break: break-word;
          flex: 1;
          unicode-bidi: plaintext;
          direction: ltr;
        }
        .carrera-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          background: white;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
        }
        .carrera-nivel {
          font-weight: bold;
          color: #1E3A8A;
          grid-column: span 2;
        }
        .footer {
          margin-top: 40px;
          font-size: 11px;
          text-align: center;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
        }
        @media print {
          body { margin: 0.5in; }
          .carrera-item { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Ficha del docente</h1>
        ${docente.fotoUrl ? `<div class="foto"><img src="${SIREI.utils.obtenerUrlImagenDrive(docente.fotoUrl)}" alt="Foto"></div>` : ''}
        <div class="datos-personales">
          <div class="campo"><strong>Nombre completo:</strong> <span>${SIREI.utils.escapeHtml(docente.nombre)}</span></div>
          <div class="campo"><strong>Fecha de nacimiento:</strong> <span>${SIREI.utils.escapeHtml(fechaNacFormateada)}${edadTexto}</span></div>
          <div class="campo"><strong>Domicilio:</strong> <span>${SIREI.utils.escapeHtml(docente.domicilio) || 'No especificado'}</span></div>
          <div class="campo"><strong>Celular:</strong> <span>${SIREI.utils.escapeHtml(docente.celular) || 'No especificado'}</span></div>
          <div class="campo"><strong>Whatsapp:</strong> <span>${SIREI.utils.escapeHtml(docente.whatsapp) || 'No especificado'}</span></div>
          <div class="campo"><strong>Email personal:</strong> <span>${SIREI.utils.escapeHtml(docente.emailPersonal) || 'No especificado'}</span></div>
          <div class="campo"><strong>Email institucional:</strong> <span>${SIREI.utils.escapeHtml(docente.emailInstitucional) || 'No especificado'}</span></div>
        </div>
        <h2>📘 Carreras registradas</h2>
        ${docente.carreras && docente.carreras.length > 0 ? docente.carreras.map(c => `
          <div class="carrera-item">
            <div class="carrera-nivel">${SIREI.utils.escapeHtml(c.nivel || 'Nivel no especificado')}</div>
            <div><strong>Carrera:</strong> ${SIREI.utils.escapeHtml(c.carrera)}</div>
            <div><strong>Institución:</strong> ${SIREI.utils.escapeHtml(c.institucion) || 'No especificada'}</div>
            <div><strong>Año de término:</strong> ${SIREI.utils.escapeHtml(c.anioTermino) || 'No especificado'}</div>
            <div><strong>Estado:</strong> ${c.titulado ? '✅ Titulado' : (c.trunco ? '⚠️ Trunco' : 'No especificado')}</div>
          </div>
        `).join('') : '<p>No hay carreras registradas.</p>'}
        <div class="footer">Documento generado por SIREI - Sistema de Retroalimentación Educativa Inmediata</div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `;
  const ventana = window.open('', '_blank');
  ventana.document.write(contenido);
  ventana.document.close();
}

// ========== 3. FUNCIONES DE EXPORTACIÓN E IMPRESIÓN PARA ALUMNOS ==========

function exportarAlumnosCSV(alumnos) {
  if (!alumnos || alumnos.length === 0) {
    SIREI.utils.mostrarToast('No hay alumnos para exportar', 'error');
    return;
  }
  const cabecerasBase = [
    'ID', 'Fecha Ingreso', 'Apellido Paterno', 'Apellido Materno', 'Nombre(s)', 'CURP',
    'Fecha Nacimiento', 'Lugar Nacimiento', 'Matrícula', 'Suscripción', 'Grupo',
    'Calle', 'Número Exterior', 'Número Interior', 'Colonia', 'Población', 'Municipio',
    'Teléfono Casa', 'Celular', 'Whatsapp', 'Correo Personal', 'Correo Institucional',
    'Foto URL', 'Carpeta Documentos'
  ];
  const maxTutores = SIREI.MAX_TUTORES;
  const cabecerasTutores = [];
  for (let i = 1; i <= maxTutores; i++) {
    cabecerasTutores.push(
      `T${i}_Parentesco`, `T${i}_ApellidoPaterno`, `T${i}_ApellidoMaterno`, `T${i}_Nombre`,
      `T${i}_FechaNac`, `T${i}_EstadoCivil`, `T${i}_Celular`, `T${i}_Whatsapp`,
      `T${i}_Correo`, `T${i}_NivelEstudios`, `T${i}_TrabajaEn`, `T${i}_DomicilioEmpresa`, `T${i}_NombreEmpresa`
    );
  }
  const maxHistorial = SIREI.MAX_HISTORIAL;
  const cabecerasHistorial = [];
  for (let i = 1; i <= maxHistorial; i++) {
    cabecerasHistorial.push(`H${i}_Nivel`, `H${i}_Institucion`, `H${i}_AnioTermino`, `H${i}_Promedio`);
  }
  const cabeceras = [...cabecerasBase, ...cabecerasTutores, ...cabecerasHistorial];

  const filas = [];
  for (const alumno of alumnos) {
    const filaBase = [
      alumno.id, alumno.fechaIngreso || '', alumno.apellidoPaterno, alumno.apellidoMaterno,
      alumno.nombres, alumno.curp, alumno.fechaNacimiento, alumno.lugarNacimiento,
      alumno.matricula || '', alumno.suscripcion || '', alumno.grupo || '',
      alumno.calle, alumno.numeroExterior, alumno.numeroInterior || '', alumno.colonia,
      alumno.poblacion, alumno.municipio, alumno.telefonoCasa || '', alumno.celular || '',
      alumno.whatsapp || '', alumno.correoPersonal || '', alumno.correoInstitucional || '',
      alumno.fotoUrl || '', alumno.carpetaDocumentos || ''
    ];
    const tutores = alumno.tutores || [];
    const filaTutores = [];
    for (let i = 0; i < maxTutores; i++) {
      if (i < tutores.length) {
        const t = tutores[i];
        filaTutores.push(
          t.parentesco || '', t.apellidoPaterno || '', t.apellidoMaterno || '', t.nombre || '',
          t.fechaNacimiento || '', t.estadoCivil || '', t.celular || '', t.whatsapp || '',
          t.correo || '', t.nivelEstudios || '', t.trabajaEn || '', t.domicilioEmpresa || '', t.nombreEmpresa || ''
        );
      } else {
        filaTutores.push('','','','','','','','','','','','','');
      }
    }
    const historial = alumno.historial || [];
    const filaHistorial = [];
    for (let i = 0; i < maxHistorial; i++) {
      if (i < historial.length) {
        const h = historial[i];
        filaHistorial.push(h.nivel || '', h.institucion || '', h.anioTermino || '', h.promedio || '');
      } else {
        filaHistorial.push('','','','');
      }
    }
    filas.push([...filaBase, ...filaTutores, ...filaHistorial]);
  }

  const escaparTexto = (texto) => {
    if (texto === undefined || texto === null) return '';
    const str = String(texto);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const filasCSV = [
    cabeceras.map(escaparTexto).join(','),
    ...filas.map(fila => fila.map(escaparTexto).join(','))
  ];
  const contenidoCSV = filasCSV.join('\n');
  const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(blob);
  enlace.href = url;
  enlace.setAttribute('download', 'alumnos_sirei.csv');
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
  SIREI.utils.mostrarToast(`Exportados ${alumnos.length} alumnos`);
}

function imprimirAlumno(alumno, logoUrl = '') {
  const fechaNacFormateada = SIREI.utils.formatearFechaLocal(alumno.fechaNacimiento);
  const fechaIngresoFormateada = SIREI.utils.formatearFechaLocal(alumno.fechaIngreso);
  let edad = '';
  if (alumno.fechaNacimiento) {
    const nac = new Date(alumno.fechaNacimiento);
    const hoy = new Date();
    let e = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
    edad = ` (${e} años)`;
  }

  const contenido = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ficha del alumno - ${SIREI.utils.escapeHtml(alumno.nombres)}</title>
      <style>
        @page {
          margin: 1.5cm 1.5cm 2cm 1.5cm;
          @bottom-right {
            content: "Página " counter(page) " de " counter(pages);
            font-size: 10px;
            color: #6b7280;
            font-family: 'Inter', 'Segoe UI', sans-serif;
          }
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Segoe UI', sans-serif;
          margin: 0;
          padding: 0;
          line-height: 1.5;
          color: #1f2937;
          background: white;
        }
        .container { max-width: 1000px; margin: 0 auto; padding: 0 10px; }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1E3A8A;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header .logo { max-height: 70px; width: auto; object-fit: contain; }
        .header .titulo {
          font-size: 20px;
          font-weight: 700;
          color: #1E3A8A;
          text-align: right;
        }
        .header .titulo small {
          font-size: 12px;
          font-weight: 400;
          color: #4b5563;
          display: block;
        }
        h1 { font-size: 22px; color: #1E3A8A; margin: 0 0 16px 0; }
        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #374151; border-left: 4px solid #1E3A8A; padding-left: 12px; page-break-after: avoid; }
        .foto { text-align: center; margin-bottom: 20px; }
        .foto img { max-width: 120px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .datos-personales {
          background: #f9fafb;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .campo { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .campo strong { font-weight: 600; min-width: 140px; flex-shrink: 0; color: #1e293b; }
        .campo span { word-break: break-word; flex: 1; }
        .tutor-item, .historial-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          background: white;
          page-break-inside: avoid;
        }
        .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
        .grid-2col .full { grid-column: span 2; }
        .firma-section {
          margin-top: 70px;
          padding-top: 27px;
          text-align: center;
          border-top: none;
        }
        .firma-section .linea-firma {
          display: inline-block;
          width: 300px;
          border-bottom: 1px solid #1f2937;
          margin-bottom: 6px;
        }
        .firma-section p { margin: 4px 0; }
        .firma-section .fecha { font-size: 12px; color: #4b5563; margin-top: 8px; }
        .footer {
          margin-top: 30px;
          font-size: 10px;
          text-align: center;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
        }
        @media print { body { margin: 0; } .no-print { display: none; } .tutor-item, .historial-item { break-inside: avoid; } .datos-personales { background: #f9fafb; } }
        @media screen { .datos-personales { background: #f9fafb; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo de la institución" class="logo">` : '<div></div>'}
          <div class="titulo">
            SIREI
            <small>Sistema de Retroalimentación Educativa Inmediata</small>
          </div>
        </div>

        <h1>Ficha del alumno</h1>
        ${alumno.fotoUrl ? `<div class="foto"><img src="${SIREI.utils.obtenerUrlImagenDrive(alumno.fotoUrl)}" alt="Foto"></div>` : ''}
        
        <div class="datos-personales">
          <div class="campo"><strong>Nombre:</strong> <span>${SIREI.utils.escapeHtml(alumno.apellidoPaterno)} ${SIREI.utils.escapeHtml(alumno.apellidoMaterno)} ${SIREI.utils.escapeHtml(alumno.nombres)}</span></div>
          <div class="campo"><strong>CURP:</strong> <span>${SIREI.utils.escapeHtml(alumno.curp)}</span></div>
          <div class="campo"><strong>Fecha nac.:</strong> <span>${SIREI.utils.escapeHtml(fechaNacFormateada)}${edad}</span></div>
          <div class="campo"><strong>Lugar nac.:</strong> <span>${SIREI.utils.escapeHtml(alumno.lugarNacimiento)}</span></div>
          <div class="campo"><strong>Matrícula:</strong> <span>${SIREI.utils.escapeHtml(alumno.matricula)}</span></div>
          <div class="campo"><strong>Grupo:</strong> <span>${SIREI.utils.escapeHtml(alumno.grupo)}</span></div>
          <div class="campo"><strong>Fecha ingreso:</strong> <span>${SIREI.utils.escapeHtml(fechaIngresoFormateada)}</span></div>
          <div class="campo"><strong>Domicilio:</strong> <span>${SIREI.utils.escapeHtml(alumno.calle)} ${SIREI.utils.escapeHtml(alumno.numeroExterior)} ${SIREI.utils.escapeHtml(alumno.numeroInterior ? 'Int. '+alumno.numeroInterior : '')}, ${SIREI.utils.escapeHtml(alumno.colonia)}, ${SIREI.utils.escapeHtml(alumno.poblacion)}, ${SIREI.utils.escapeHtml(alumno.municipio)}</span></div>
          <div class="campo"><strong>Teléfono casa:</strong> <span>${SIREI.utils.escapeHtml(alumno.telefonoCasa)}</span></div>
          <div class="campo"><strong>Celular:</strong> <span>${SIREI.utils.escapeHtml(alumno.celular)}</span></div>
          <div class="campo"><strong>Whatsapp:</strong> <span>${SIREI.utils.escapeHtml(alumno.whatsapp)}</span></div>
          <div class="campo"><strong>Correo personal:</strong> <span>${SIREI.utils.escapeHtml(alumno.correoPersonal)}</span></div>
          <div class="campo"><strong>Correo institucional:</strong> <span>${SIREI.utils.escapeHtml(alumno.correoInstitucional)}</span></div>
        </div>

        <h2>👨‍👩‍👧 Tutores</h2>
        ${alumno.tutores && alumno.tutores.length > 0 ? alumno.tutores.map(t => `
          <div class="tutor-item">
            <div class="grid-2col">
              <div><strong>Parentesco:</strong> ${SIREI.utils.escapeHtml(t.parentesco)}</div>
              <div><strong>Nombre:</strong> ${SIREI.utils.escapeHtml(t.apellidoPaterno)} ${SIREI.utils.escapeHtml(t.apellidoMaterno)} ${SIREI.utils.escapeHtml(t.nombre)}</div>
              <div><strong>Fecha nac.:</strong> ${SIREI.utils.escapeHtml(SIREI.utils.formatearFechaLocal(t.fechaNacimiento))}</div>
              <div><strong>Estado civil:</strong> ${SIREI.utils.escapeHtml(t.estadoCivil)}</div>
              <div><strong>Celular:</strong> ${SIREI.utils.escapeHtml(t.celular)}</div>
              <div><strong>Whatsapp:</strong> ${SIREI.utils.escapeHtml(t.whatsapp)}</div>
              <div><strong>Correo:</strong> ${SIREI.utils.escapeHtml(t.correo)}</div>
              <div><strong>Nivel estudios:</strong> ${SIREI.utils.escapeHtml(t.nivelEstudios)}</div>
              <div><strong>Trabaja en:</strong> ${SIREI.utils.escapeHtml(t.trabajaEn)}</div>
              <div><strong>Empresa:</strong> ${SIREI.utils.escapeHtml(t.nombreEmpresa)}</div>
              <div class="full"><strong>Domicilio empresa:</strong> ${SIREI.utils.escapeHtml(t.domicilioEmpresa)}</div>
            </div>
          </div>
        `).join('') : '<p>No hay tutores registrados.</p>'}"

        <h2>📚 Historial académico</h2>
        ${alumno.historial && alumno.historial.length > 0 ? alumno.historial.map(h => `
          <div class="historial-item">
            <div class="grid-2col">
              <div><strong>Nivel:</strong> ${SIREI.utils.escapeHtml(h.nivel)}</div>
              <div><strong>Institución:</strong> ${SIREI.utils.escapeHtml(h.institucion)}</div>
              <div><strong>Año término:</strong> ${SIREI.utils.escapeHtml(h.anioTermino)}</div>
              <div><strong>Promedio:</strong> ${SIREI.utils.escapeHtml(h.promedio)}</div>
            </div>
          </div>
        `).join('') : '<p>No hay historial registrado.</p>'}"

        <div class="firma-section">
          <div style="display: flex; justify-content: center; gap: 60px; flex-wrap: wrap;">
            <div>
              <div class="linea-firma"></div>
              <p><strong>Nombre y firma del tutor o responsable</strong></p>
              <p class="fecha">Fecha: ___________________</p>
            </div>
          </div>
          <p style="font-size: 11px; color: #6b7280; margin-top: 6px;">(Conformidad con los datos)</p>
        </div>

        <div class="footer">Documento generado por SIREI - Sistema de Retroalimentación Educativa Inmediata</div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank');
  ventana.document.write(contenido);
  ventana.document.close();
}

function imprimirDocenteModerno(docente, logoUrl = '') {
  let fechaNacFormateada = '';
  let edadTexto = '';
  if (docente.fechaNac) {
    const fecha = new Date(docente.fechaNac);
    if (!isNaN(fecha.getTime())) {
      fechaNacFormateada = fecha.toLocaleDateString('es-ES');
      const hoy = new Date();
      let edad = hoy.getFullYear() - fecha.getFullYear();
      const mes = hoy.getMonth() - fecha.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad--;
      edadTexto = ` (${edad} años)`;
    } else {
      fechaNacFormateada = docente.fechaNac;
    }
  }

  const contenido = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ficha del docente - ${SIREI.utils.escapeHtml(docente.nombre)}</title>
      <style>
        @page {
          margin: 1.5cm 1.5cm 2cm 1.5cm;
          @bottom-right {
            content: "Página " counter(page) " de " counter(pages);
            font-size: 10px;
            color: #6b7280;
            font-family: 'Inter', 'Segoe UI', sans-serif;
          }
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Segoe UI', sans-serif;
          margin: 0;
          padding: 0;
          line-height: 1.4;
          color: #1f2937;
          background: white;
        }
        .container { max-width: 1000px; margin: 0 auto; padding: 0 10px; }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1E3A8A;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header .logo { max-height: 70px; width: auto; object-fit: contain; }
        .header .titulo {
          font-size: 20px;
          font-weight: 700;
          color: #1E3A8A;
          text-align: right;
        }
        .header .titulo small {
          font-size: 12px;
          font-weight: 400;
          color: #4b5563;
          display: block;
        }
        h1 { font-size: 22px; color: #1E3A8A; margin: 0 0 16px 0; }
        h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #374151; border-left: 4px solid #1E3A8A; padding-left: 12px; }
        .foto { text-align: center; margin-bottom: 20px; }
        .foto img { max-width: 120px; border-radius: 12px; border: 1px solid #e5e7eb; }
        .datos-personales {
          background: #f9fafb;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
        }
        .campo { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .campo strong { font-weight: 600; min-width: 140px; flex-shrink: 0; color: #1e293b; }
        .carrera-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 12px;
          background: white;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
        }
        .carrera-nivel { font-weight: bold; color: #1E3A8A; grid-column: span 2; }
        .firma-section {
          margin-top: 80px;
          border-top: 1px solid transparent;
          padding-top: 24px;
          text-align: center;
        }
        .firma-section .linea-firma {
          display: inline-block;
          width: 300px;
          border-bottom: 1px solid #1f2937;
          margin-bottom: 6px;
        }
        .firma-section p { margin: 4px 0; }
        .firma-section .fecha { font-size: 12px; color: #4b5563; margin-top: 8px; }
        .footer {
          margin-top: 30px;
          font-size: 10px;
          text-align: center;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
        }
        @media print { body { margin: 0; } .carrera-item { break-inside: avoid; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo de la institución" class="logo">` : '<div></div>'}
          <div class="titulo">
            SIREI
            <small>Sistema de Retroalimentación Educativa Inmediata</small>
          </div>
        </div>

        <h1>Ficha del docente</h1>
        ${docente.fotoUrl ? `<div class="foto"><img src="${SIREI.utils.obtenerUrlImagenDrive(docente.fotoUrl)}" alt="Foto"></div>` : ''}
        
        <div class="datos-personales">
          <div class="campo"><strong>Nombre completo:</strong> <span>${SIREI.utils.escapeHtml(docente.nombre)}</span></div>
          <div class="campo"><strong>Fecha de nacimiento:</strong> <span>${SIREI.utils.escapeHtml(fechaNacFormateada)}${edadTexto}</span></div>
          <div class="campo"><strong>Domicilio:</strong> <span>${SIREI.utils.escapeHtml(docente.domicilio) || 'No especificado'}</span></div>
          <div class="campo"><strong>Celular:</strong> <span>${SIREI.utils.escapeHtml(docente.celular) || 'No especificado'}</span></div>
          <div class="campo"><strong>Whatsapp:</strong> <span>${SIREI.utils.escapeHtml(docente.whatsapp) || 'No especificado'}</span></div>
          <div class="campo"><strong>Email personal:</strong> <span>${SIREI.utils.escapeHtml(docente.emailPersonal) || 'No especificado'}</span></div>
          <div class="campo"><strong>Email institucional:</strong> <span>${SIREI.utils.escapeHtml(docente.emailInstitucional) || 'No especificado'}</span></div>
        </div>

        <h2>📘 Carreras registradas</h2>
        ${docente.carreras && docente.carreras.length > 0 ? docente.carreras.map(c => `
          <div class="carrera-item">
            <div class="carrera-nivel">${SIREI.utils.escapeHtml(c.nivel || 'Nivel no especificado')}</div>
            <div><strong>Carrera:</strong> ${SIREI.utils.escapeHtml(c.carrera)}</div>
            <div><strong>Institución:</strong> ${SIREI.utils.escapeHtml(c.institucion) || 'No especificada'}</div>
            <div><strong>Año de término:</strong> ${SIREI.utils.escapeHtml(c.anioTermino) || 'No especificado'}</div>
            <div><strong>Estado:</strong> ${c.titulado ? '✅ Titulado' : (c.trunco ? '⚠️ Trunco' : 'No especificado')}</div>
          </div>
        `).join('') : '<p>No hay carreras registradas.</p>'}

        <div class="firma-section">
          <div style="display: flex; justify-content: center; gap: 60px; flex-wrap: wrap;">
            <div>
              <div class="linea-firma"></div>
              <p><strong>Nombre y firma del docente</strong></p>
              <p class="fecha">Fecha: ___________________</p>
            </div>
          </div>
          <p style="font-size: 11px; color: #6b7280; margin-top: 6px;">(Conformidad con los datos)</p>
        </div>

        <div class="footer">Documento generado por SIREI - Sistema de Retroalimentación Educativa Inmediata</div>
      </div>
      <script>
        window.onload = function() { window.print(); };
      <\/script>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank');
  ventana.document.write(contenido);
  ventana.document.close();
}