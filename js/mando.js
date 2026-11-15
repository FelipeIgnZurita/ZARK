import { conectarASala, mensajeDeError } from './canal.js';

const pantallaIngreso = document.getElementById('pantalla-ingreso');
const pantallaEspera = document.getElementById('pantalla-espera');
const controlDiccionario = document.getElementById('control-diccionario');
const controlVotacion = document.getElementById('control-votacion');
const contenedorBotones = document.getElementById('contenedor-botones-voto');

const textoEspera = document.getElementById('texto-espera');
const tituloEspera = document.getElementById('titulo-espera');
const btnDirectorArrancar = document.getElementById('btn-director-arrancar');
const mensajeEsperaVoto = document.getElementById('mensaje-espera-voto');

const inputPin = document.getElementById('input-pin');
const inputNombre = document.getElementById('input-nombre');
const btnUnirse = document.getElementById('btn-unirse');
const mensajeError = document.getElementById('mensaje-error');

const btnMandarChamuyo = document.getElementById('btn-mandar-chamuyo');
const inputDefinicion = document.getElementById('input-definicion');

// Pictionary
const controlDibujo = document.getElementById('control-dibujo');
const controlAdivinar = document.getElementById('control-adivinar');
const palabraObjetivo = document.getElementById('palabra-objetivo');
const quienDibuja = document.getElementById('quien-dibuja');
const inputAdivinar = document.getElementById('input-adivinar');
const btnAdivinar = document.getElementById('btn-adivinar');
const feedbackAdivinar = document.getElementById('feedback-adivinar');
const lienzo = document.getElementById('lienzo-dibujo');
const ctxDibujo = lienzo.getContext('2d');

let canalSala = null;
let nombreActual = "";
let esDirector = false;
let miIdTemp = ""; // ID único temporal para el proceso de validación
let timerMando = null;
let soyJuez = false;
let yaChamuyee = false;
// Pictionary
let soyDibujante = false;
let dibujando = false;
let ultimoPunto = null;
let colorActual = '#111111';
let grosorActual = 0.012;
const COLORES = ['#111111', '#e74c3c', '#2e86de', '#2ecc71', '#f1c40f', '#8e44ad'];

inputPin.addEventListener('input', function() { this.value = this.value.toUpperCase(); });
btnUnirse.addEventListener('click', unirseASala);

async function unirseASala() {
    const pin = inputPin.value.trim();
    nombreActual = inputNombre.value.trim();

    if (pin.length !== 4 || !nombreActual) { mensajeError.innerText = "Llená los datos bien."; return; }

    btnUnirse.innerText = "Conectando...";
    btnUnirse.disabled = true;

    try {
        canalSala = await conectarASala(pin);
    } catch (err) {
        mensajeError.innerText = mensajeDeError(err);
        btnUnirse.innerText = "Entrar a la Sala";
        btnUnirse.disabled = false;
        return;
    }
    
    // Generamos un ID random para que el Host sepa a quién le contesta
    miIdTemp = Math.random().toString(36).substring(2, 9);
    conectarWebSocket(pin, nombreActual);
}

function conectarWebSocket(pin, nombre) {
    canalSala.onDesconexion(() => {
        alert("Se perdió la conexión con la pantalla principal.");
        location.reload();
    });

    canalSala
        .on('broadcast', { event: 'rechazo_unirse' }, (mensaje) => {
            // Si el host rebota nuestra ID temporal, mostramos error
            if (mensaje.payload.id_temp === miIdTemp) {
                mensajeError.innerText = "Ese nombre ya está en uso. Elegí otro.";
                btnUnirse.innerText = "Entrar a la Sala";
                btnUnirse.disabled = false;
                canalSala.cerrar(); // Cortamos la conexión
            }
        })
        .on('broadcast', { event: 'aceptacion_unirse' }, (mensaje) => {
            // Si el host nos da luz verde
            if (mensaje.payload.id_temp === miIdTemp) {
                pantallaIngreso.classList.add('oculto');
                pantallaEspera.classList.remove('oculto');
                const badge = document.getElementById('codigo-sala');
                if (badge) { badge.innerHTML = `<small>SALA</small>${pin}`; badge.classList.remove('oculto'); }
            }
        })
        .on('broadcast', { event: 'asignar_director' }, (mensaje) => {
            if (nombre === mensaje.payload.director) {
                esDirector = true;
                btnDirectorArrancar.classList.remove('oculto');
                if (tituloEspera) tituloEspera.innerText = "¡Sos el host!";
                textoEspera.innerText = "Arrancá cuando estén todos.";
            }
        })
        .on('broadcast', { event: 'iniciar_diccionario' }, (mensaje) => {
            const { palabra, juez, duracion } = mensaje.payload;
            soyJuez = (nombre === juez);
            yaChamuyee = false;

            pantallaEspera.classList.add('oculto');
            controlVotacion.classList.add('oculto');
            controlDiccionario.classList.remove('oculto');

            document.getElementById('dic-palabra').innerText = palabra;

            if (nombre === juez) {
                controlDiccionario.classList.remove('modo-vandalo');
                controlDiccionario.classList.add('modo-juez');
                document.getElementById('dic-instruccion').innerText = "Sos el Comelibros. Esperá a que los demás inventen su chamuyo.";
                document.getElementById('dic-input-container').classList.add('oculto');
            } else {
                controlDiccionario.classList.remove('modo-juez');
                controlDiccionario.classList.add('modo-vandalo');
                document.getElementById('dic-instruccion').innerText = "Inventá una definición trucha, que parezca de diccionario: en minúscula, con comas y sin punto final.";
                document.getElementById('dic-input-container').classList.remove('oculto');
                inputDefinicion.value = "";
            }

            arrancarTimerMando(duracion || 90);
        })
        .on('broadcast', { event: 'tiempo_agotado' }, () => {
            clearInterval(timerMando);
            const cont = document.getElementById('dic-input-container');
            // El mentiroso que no envió: mandamos lo que tenga escrito (si hay algo)
            if (!soyJuez && !yaChamuyee) {
                const borrador = inputDefinicion.value.trim();
                if (borrador) {
                    canalSala.send({ type: 'broadcast', event: 'respuesta_enviada', payload: { jugador: nombreActual, definicion: borrador } });
                }
                yaChamuyee = true;
            }
            if (cont) cont.classList.add('oculto');
            if (!soyJuez) document.getElementById('dic-instruccion').innerText = "¡Se acabó el tiempo!";
        })
        .on('broadcast', { event: 'fase_votacion' }, (mensaje) => {
            const { opciones, juez } = mensaje.payload;
            clearInterval(timerMando);
            controlDiccionario.classList.add('oculto');
            controlVotacion.classList.remove('oculto');
            
            contenedorBotones.style.display = 'grid';
            contenedorBotones.style.gridTemplateColumns = 'repeat(2, 1fr)';
            contenedorBotones.style.gap = '15px';
            contenedorBotones.innerHTML = ''; 

            if (nombre === juez) {
                mensajeEsperaVoto.classList.add('oculto');
                const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                
                opciones.forEach((opcion, index) => {
                    const btn = document.createElement('button');
                    btn.innerText = letras[index];
                    
                    btn.style.cssText = `
                        background-color: #e67e22; color: #fff; font-weight: 900; font-size: 3.5rem; border-radius: 15px; border: none; cursor: pointer; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 15px rgba(0,0,0,0.3); transition: transform 0.1s;
                    `;
                    
                    btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.95)');
                    btn.addEventListener('mouseup', () => btn.style.transform = 'scale(1)');
                    
                    btn.addEventListener('click', () => {
                        canalSala.send({ type: 'broadcast', event: 'voto_emitido', payload: opcion });
                        contenedorBotones.innerHTML = '';
                        contenedorBotones.style.display = 'block'; 
                        mensajeEsperaVoto.innerText = "Voto enviado, mirá la pantalla.";
                        mensajeEsperaVoto.classList.remove('oculto');
                    });
                    contenedorBotones.appendChild(btn);
                });
            } else {
                contenedorBotones.style.display = 'block';
                mensajeEsperaVoto.innerText = "Esperando que el Comelibros decida...";
                mensajeEsperaVoto.classList.remove('oculto');
            }
        })
        .on('broadcast', { event: 'pict_ronda' }, (m) => arrancarRondaPict(m.payload))
        .on('broadcast', { event: 'pict_fallo' }, (m) => {
            if (m.payload.jugador === nombreActual) {
                feedbackAdivinar.style.color = '#e74c3c';
                feedbackAdivinar.innerText = "¡No! Seguí intentando.";
            }
        })
        .on('broadcast', { event: 'pict_acierto' }, (m) => {
            const { ganador, palabra } = m.payload;
            feedbackAdivinar.style.color = '#2ecc71';
            feedbackAdivinar.innerText = ganador === nombreActual ? `¡La sacaste! Era "${palabra}".` : `${ganador} la adivinó: "${palabra}".`;
        })
        .on('broadcast', { event: 'fin_de_ronda' }, () => {
            clearInterval(timerMando);
            dibujando = false;
            controlDiccionario.classList.add('oculto');
            controlVotacion.classList.add('oculto');
            controlDibujo.classList.add('oculto');
            controlAdivinar.classList.add('oculto');
            pantallaEspera.classList.remove('oculto');

            if (esDirector) {
                btnDirectorArrancar.innerText = "Siguiente Ronda";
                btnDirectorArrancar.classList.remove('oculto');
                if (tituloEspera) tituloEspera.innerText = "¡Sos el host!";
                textoEspera.innerText = "Cuando estén listos, mandale a la siguiente.";
            } else {
                if (tituloEspera) tituloEspera.innerText = "Esperando al host...";
                textoEspera.innerText = "Mirá los resultados en la pantalla...";
                btnDirectorArrancar.classList.add('oculto');
            }
        })
        .subscribe((estado) => {
            if (estado === 'SUBSCRIBED') {
                // En vez de entrar automáticamente, pedimos permiso al Host
                canalSala.send({ 
                    type: 'broadcast', 
                    event: 'solicitar_unirse', 
                    payload: { nombre: nombre, id_temp: miIdTemp } 
                });
            }
        });
}

function arrancarTimerMando(seg) {
    clearInterval(timerMando);
    let restante = seg;
    const el = document.getElementById('dic-timer');
    const pintar = () => {
        if (!el) return;
        const m = Math.floor(Math.max(0, restante) / 60);
        const s = (Math.max(0, restante) % 60).toString().padStart(2, '0');
        el.innerText = `${m}:${s}`;
        el.classList.toggle('poco', restante <= 10);
    };
    pintar();
    timerMando = setInterval(() => {
        restante--;
        pintar();
        if (restante <= 0) {
            clearInterval(timerMando);
            // El host avisa con 'tiempo_agotado' y ahí recién mandamos el borrador y trabamos
        }
    }, 1000);
}

btnDirectorArrancar.addEventListener('click', () => {
    canalSala.send({ type: 'broadcast', event: 'orden_arrancar' });
    btnDirectorArrancar.classList.add('oculto');
    textoEspera.innerText = "Mirá la pantalla principal...";
});

btnMandarChamuyo.addEventListener('click', () => {
    const definicionInventada = inputDefinicion.value.trim();
    if (!definicionInventada) return;

    canalSala.send({
        type: 'broadcast',
        event: 'respuesta_enviada',
        payload: { jugador: nombreActual, definicion: definicionInventada }
    });

    yaChamuyee = true;
    document.getElementById('dic-input-container').classList.add('oculto');
    document.getElementById('dic-instruccion').innerText = "¡Enviado! Esperando a que terminen los demás...";
});

// ==========================================
// PICTIONARY (mando)
// ==========================================
function arrancarRondaPict({ dibujante, palabra }) {
    soyDibujante = (dibujante === nombreActual);
    pantallaEspera.classList.add('oculto');
    controlDiccionario.classList.add('oculto');
    controlVotacion.classList.add('oculto');
    feedbackAdivinar.innerText = "";

    if (soyDibujante) {
        controlAdivinar.classList.add('oculto');
        controlDibujo.classList.remove('oculto');
        palabraObjetivo.innerText = palabra;
        limpiarLienzoLocal();
    } else {
        controlDibujo.classList.add('oculto');
        controlAdivinar.classList.remove('oculto');
        quienDibuja.innerText = dibujante;
        inputAdivinar.value = "";
    }
}

function posNorm(e) {
    const r = lienzo.getBoundingClientRect();
    return {
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    };
}

function pintarLocal(a, b, color, grosor) {
    ctxDibujo.strokeStyle = color;
    ctxDibujo.lineWidth = Math.max(1, grosor * lienzo.width);
    ctxDibujo.lineCap = 'round';
    ctxDibujo.lineJoin = 'round';
    ctxDibujo.beginPath();
    ctxDibujo.moveTo(a.x * lienzo.width, a.y * lienzo.height);
    ctxDibujo.lineTo(b.x * lienzo.width, b.y * lienzo.height);
    ctxDibujo.stroke();
}

function limpiarLienzoLocal() {
    ctxDibujo.fillStyle = '#ffffff';
    ctxDibujo.fillRect(0, 0, lienzo.width, lienzo.height);
}

lienzo.addEventListener('pointerdown', (e) => {
    if (!soyDibujante) return;
    dibujando = true;
    ultimoPunto = posNorm(e);
    lienzo.setPointerCapture(e.pointerId);
});
lienzo.addEventListener('pointermove', (e) => {
    if (!dibujando || !soyDibujante) return;
    const p = posNorm(e);
    pintarLocal(ultimoPunto, p, colorActual, grosorActual);
    canalSala.send({ type: 'broadcast', event: 'pict_trazo', payload: { x0: ultimoPunto.x, y0: ultimoPunto.y, x1: p.x, y1: p.y, color: colorActual, grosor: grosorActual } });
    ultimoPunto = p;
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => lienzo.addEventListener(ev, () => { dibujando = false; }));

// Paleta de colores
const paleta = document.getElementById('paleta');
COLORES.forEach((c, i) => {
    const b = document.createElement('div');
    b.className = 'color-btn' + (i === 0 ? ' activo' : '');
    b.style.backgroundColor = c;
    b.addEventListener('click', () => {
        colorActual = c;
        grosorActual = 0.012;
        document.querySelectorAll('.color-btn').forEach(x => x.classList.remove('activo'));
        b.classList.add('activo');
    });
    paleta.appendChild(b);
});

document.getElementById('btn-goma').addEventListener('click', () => {
    colorActual = '#ffffff';
    grosorActual = 0.05;
    document.querySelectorAll('.color-btn').forEach(x => x.classList.remove('activo'));
});

document.getElementById('btn-limpiar').addEventListener('click', () => {
    limpiarLienzoLocal();
    canalSala.send({ type: 'broadcast', event: 'pict_limpiar' });
});

document.getElementById('btn-rendirse').addEventListener('click', () => {
    canalSala.send({ type: 'broadcast', event: 'pict_rendirse' });
});

function enviarIntento() {
    const texto = inputAdivinar.value.trim();
    if (!texto) return;
    canalSala.send({ type: 'broadcast', event: 'pict_intento', payload: { jugador: nombreActual, texto } });
    inputAdivinar.value = "";
}
btnAdivinar.addEventListener('click', enviarIntento);
inputAdivinar.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarIntento(); });