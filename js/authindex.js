document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const mensajeError = document.getElementById('mensajeError');
  const btnIngresar = document.getElementById('btnIngresar');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.querySelector('.btn-text');
  
  // Toggle password
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  togglePassword.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Cambiar icono
    if (type === 'text') {
      togglePassword.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"></path></svg>';
    } else {
      togglePassword.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
  });

  // Math Captcha
  let captchaNum1, captchaNum2, captchaResult;
  const captchaQuestion = document.getElementById('captchaQuestion');
  const captchaInput = document.getElementById('captchaInput');

  function generateCaptcha() {
    captchaNum1 = Math.floor(Math.random() * 10) + 1;
    captchaNum2 = Math.floor(Math.random() * 10) + 1;
    captchaResult = captchaNum1 + captchaNum2;
    captchaQuestion.textContent = `${captchaNum1} + ${captchaNum2}`;
    captchaInput.value = '';
  }

  generateCaptcha(); // Initialize

  // Lógica de intentos
  let intentosFallidos = 0;
  let bloqueadoHasta = 0;

  // Función de hashing SHA-256
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const ahora = Date.now();
    if (ahora < bloqueadoHasta) {
      const segundosRestantes = Math.ceil((bloqueadoHasta - ahora) / 1000);
      mostrarError(`Demasiados intentos. Intenta de nuevo en ${segundosRestantes} segundos.`);
      return;
    }

    const usuario = document.getElementById('usuario').value.trim();
    const password = passwordInput.value;
    const captchaVal = parseInt(captchaInput.value, 10);

    if (captchaVal !== captchaResult) {
      mostrarError('El resultado de la suma de seguridad es incorrecto.');
      generateCaptcha();
      return;
    }

    if (!usuario || !password) {
      mostrarError('Por favor, completa todos los campos.');
      return;
    }

    // Set UI to loading state
    btnIngresar.disabled = true;
    btnText.textContent = 'Verificando...';
    btnSpinner.style.display = 'block';
    ocultarError();

    try {
      const hashedPass = await hashPassword(password);

      const response = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          accion: 'login',
          usuario: usuario,
          password: hashedPass // Enviamos el hash
        })
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

      const data = await response.json();
      
      if (data.success === true) {
    sessionStorage.setItem('sirei_token', data.token);
    sessionStorage.setItem('sirei_user', usuario);
    sessionStorage.setItem('sirei_rol', data.rol || '');
    sessionStorage.setItem('sirei_nombre', data.nombreCompleto || '');
    
    // Redirigir según rol
    const rol = (data.rol || '').toLowerCase();
    if (rol === 'coordinador') {
        window.location.href = 'coordinador.html';
    } else if (rol === 'docente') {
        window.location.href = 'docente.html';
    } else {
        // admin o cualquier otro
        window.location.href = 'admin.html';
    }
} else {
        manejarIntentoFallido(data.message || 'Usuario o contraseña incorrectos.');
      }
    } catch (error) {
      console.error(error);
      mostrarError('Error de conexión con el servidor. Inténtalo de nuevo más tarde.');
    } finally {
      if(Date.now() >= bloqueadoHasta) {
        btnIngresar.disabled = false;
        btnText.textContent = 'Ingresar al Sistema';
      }
      btnSpinner.style.display = 'none';
      generateCaptcha();
    }
  });

  function manejarIntentoFallido(mensaje) {
    intentosFallidos++;
    passwordInput.value = '';
    
    if (intentosFallidos >= 3) {
      bloqueadoHasta = Date.now() + 30000; // 30 segundos de bloqueo
      mostrarError('Has fallado 3 veces. Tu acceso ha sido bloqueado por 30 segundos.');
      btnIngresar.disabled = true;
      btnText.textContent = 'Bloqueado';
      
      const intervalo = setInterval(() => {
        const restante = Math.ceil((bloqueadoHasta - Date.now()) / 1000);
        if (restante <= 0) {
          clearInterval(intervalo);
          btnIngresar.disabled = false;
          btnText.textContent = 'Ingresar al Sistema';
          intentosFallidos = 0;
          ocultarError();
        } else {
          btnText.textContent = `Bloqueado (${restante}s)`;
        }
      }, 1000);

    } else {
      mostrarError(`${mensaje} (Intento ${intentosFallidos}/3)`);
    }
  }

  function mostrarError(mensaje) {
    mensajeError.textContent = mensaje;
    mensajeError.style.display = 'block';
  }

  function ocultarError() {
    mensajeError.style.display = 'none';
    mensajeError.textContent = '';
  }
});