import { crearSalaHost } from './canal.js';

const pantallaSeleccion = document.getElementById('pantalla-seleccion');
const pantallaLobby = document.getElementById('pantalla-lobby');
const tituloJuego = document.getElementById('titulo-juego');
const pinDisplay = document.getElementById('pin-display');
const contenedorJugadores = document.getElementById('jugadores-conectados');
const botonesJuego = document.querySelectorAll('.btn-juego');

let salaPin = "";
let juegoSeleccionado = "";
let jugadores = [];
let puntajes = {};
let canalSalaGlobal = null;
let timerEscritura = null;
let votacionIniciada = false;
let mazoPalabras = []; // bolsa barajada: salen todas antes de repetir
const TIEMPO_ESCRITURA = 90; // segundos para chamuyar (1:30)

// --- Estado de Pictionary ---
let dibujanteActual = "";
let turnoDibujante = -1;
let palabraPict = "";
let aciertoPict = false;
let mazoPict = [];
let noEsLista = [];
let ctxHostPict = null;
let lienzoHostPict = null;

const palabrasDiccionario = [
    { palabra: "Garlito", tipo: "m.", definicion: "trampa o red para pescar, engaño o celada" },
    { palabra: "Zaragata", tipo: "f.", definicion: "alboroto, ruido o riña" },
    { palabra: "Jipiar", tipo: "intr.", definicion: "cantar con voz semejante a un gemido" },
    { palabra: "Nefelibata", tipo: "adj.", definicion: "persona soñadora que no se apercibe de la realidad" },
    { palabra: "Cachivache", tipo: "m.", definicion: "cosa rota o arrinconada por inútil" },
    { palabra: "Jitanjáfora", tipo: "f.", definicion: "texto sin sentido, creado solo por su sonoridad" },
    { palabra: "Sibarita", tipo: "adj.", definicion: "persona que disfruta de los placeres refinados, en especial de la buena mesa" },
    { palabra: "Oquedad", tipo: "f.", definicion: "espacio hueco en el interior de un cuerpo sólido" },
    { palabra: "Vetusto", tipo: "adj.", definicion: "sumamente viejo, anticuado o deteriorado por el paso del tiempo" },
    { palabra: "Lóbrego", tipo: "adj.", definicion: "oscuro, sombrío y que inspira tristeza" },
    { palabra: "Zahorí", tipo: "m.", definicion: "persona a la que se atribuye la facultad de descubrir agua o cosas ocultas bajo la tierra" },
    { palabra: "Ataraxia", tipo: "f.", definicion: "estado de serenidad y total ausencia de perturbación del ánimo" },
    { palabra: "Nictálope", tipo: "adj.", definicion: "que ve mejor con poca luz o de noche que a plena claridad" },
    { palabra: "Prístino", tipo: "adj.", definicion: "original y primitivo, puro, tal como era en su primer estado" },
    { palabra: "Ubérrimo", tipo: "adj.", definicion: "extraordinariamente abundante y fértil" },
    { palabra: "Inconsútil", tipo: "adj.", definicion: "sin costuras, que no tiene unión ni juntura alguna" },
    { palabra: "Alborada", tipo: "f.", definicion: "momento del amanecer, también la música o el canto propios de esa hora" },
    { palabra: "Sidéreo", tipo: "adj.", definicion: "perteneciente o relativo a las estrellas y los astros" },
    { palabra: "Luctuoso", tipo: "adj.", definicion: "triste y digno de llanto, propio del duelo" },
    { palabra: "Petricor", tipo: "m.", definicion: "olor agradable que produce la lluvia al caer sobre la tierra seca" },
    { palabra: "Núbil", tipo: "adj.", definicion: "dicho de una persona, que ha llegado a la edad de casarse" },
    { palabra: "Melifluo", tipo: "adj.", definicion: "excesivamente dulce, suave o delicado en el sonido o el trato" },
    { palabra: "Uebos", tipo: "m.", definicion: "palabra en desuso que significa necesidad o cosa obligatoria" },
    { palabra: "Serendipia", tipo: "f.", definicion: "hallazgo valioso que se produce de manera casual o inesperada" },
    { palabra: "Acendrado", tipo: "adj.", definicion: "puro y sin mancha, depurado de todo defecto" },
    { palabra: "Resquemor", tipo: "m.", definicion: "resentimiento o inquietud causados por algo" },
    { palabra: "Fragor", tipo: "m.", definicion: "ruido estruendoso y prolongado" },
    { palabra: "Pávido", tipo: "adj.", definicion: "lleno de pavor o espanto, medroso" },
    { palabra: "Sempiterno", tipo: "adj.", definicion: "algo que durará para siempre o que tiene inicio pero no final" },
    { palabra: "Égida", tipo: "f.", definicion: "protección, amparo o defensa que se brinda a alguien" },
    { palabra: "Prosapia", tipo: "f.", definicion: "linaje noble o ascendencia ilustre de una persona" },
    { palabra: "Conspicuo", tipo: "adj.", definicion: "ilustre, sobresaliente o notable por su importancia" },
    { palabra: "Baladí", tipo: "adj.", definicion: "de poca importancia o sustancia" },
    { palabra: "Mendaz", tipo: "adj.", definicion: "que miente o tiene por costumbre mentir" },
    { palabra: "Pusilánime", tipo: "adj.", definicion: "falto de valor y ánimo para afrontar las cosas, cobarde" },
    { palabra: "Veleidoso", tipo: "adj.", definicion: "inconstante, que cambia de opinión o conducta por capricho" },
    { palabra: "Taimado", tipo: "adj.", definicion: "astuto, disimulado y propenso al engaño" },
    { palabra: "Nimio", tipo: "adj.", definicion: "insignificante, de muy poca importancia" },
    { palabra: "Contumaz", tipo: "adj.", definicion: "obstinado y tenaz en mantener un error o una actitud" },
    { palabra: "Procaz", tipo: "adj.", definicion: "atrevido, desvergonzado o descarado" },
    { palabra: "Añagaza", tipo: "f.", definicion: "artificio o engaño para atraer a alguien con disimulo" },
    { palabra: "Mohíno", tipo: "adj.", definicion: "triste, disgustado o malhumorado" },
    { palabra: "Soslayar", tipo: "tr.", definicion: "esquivar o evitar una dificultad pasando de largo" },
    { palabra: "Cariacontecido", tipo: "adj.", definicion: "que muestra en el rostro pena, sobresalto o preocupación" },
    { palabra: "Deleznable", tipo: "adj.", definicion: "despreciable, de poco valor, o que se rompe con facilidad" },
    { palabra: "Sibilino", tipo: "adj.", definicion: "misterioso, oscuro o con un sentido oculto" },
    { palabra: "Pergeñar", tipo: "tr.", definicion: "disponer o idear algo con cierta habilidad" },
    { palabra: "Fehaciente", tipo: "adj.", definicion: "que da fe o prueba algo de manera indudable" },
    { palabra: "Óbice", tipo: "m.", definicion: "obstáculo o impedimento para algo" },
    { palabra: "Perentorio", tipo: "adj.", definicion: "urgente, que no admite demora ni aplazamiento" },
    { palabra: "Zafio", tipo: "adj.", definicion: "grosero, tosco o falto de modales" },
    { palabra: "Acerbo", tipo: "adj.", definicion: "áspero o cruel en el gusto o en el trato" },
    { palabra: "Bisoño", tipo: "adj.", definicion: "nuevo e inexperto en un oficio o actividad" },
    { palabra: "Melindroso", tipo: "adj.", definicion: "que hace remilgos o se muestra exageradamente delicado" }
];

let palabraActual = {};
let juezActual = "";
let respuestasDiccionario = [];

// Palabras concretas y fáciles de dibujar para el Pictionary (nada de adjetivos)
const palabrasPictionary = [
    "espátula", "célula", "casa", "árbol", "sol", "luna", "estrella", "perro", "gato", "pez",
    "pájaro", "serpiente", "elefante", "araña", "flor", "montaña", "nube", "auto", "camión", "avión",
    "barco", "bicicleta", "tren", "cohete", "pizza", "hamburguesa", "helado", "banana", "manzana", "huevo",
    "taza", "botella", "cuchillo", "tenedor", "cuchara", "olla", "silla", "cama", "puerta", "ventana",
    "escalera", "lámpara", "vela", "reloj", "teléfono", "llave", "candado", "martillo", "tijera", "lápiz",
    "libro", "pelota", "guitarra", "tambor", "campana", "sombrero", "zapato", "paraguas", "anteojos", "corazón",
    "ojo", "mano", "diente", "robot", "fantasma", "corona", "ancla", "cactus", "volcán", "faro",
    "puente", "regalo", "globo", "pie", "dado", "gorra", "pala", "hacha", "rueda", "nariz"
];
const normalizarPict = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, '').trim();

botonesJuego.forEach(boton => {
    boton.addEventListener('click', () => {
        juegoSeleccionado = boton.getAttribute('data-juego');
        const nombreJuego = boton.querySelector('.texto').innerText;
        
        pantallaSeleccion.classList.add('oculto');
        pantallaLobby.classList.remove('oculto');
        tituloJuego.innerText = `Sala de: ${nombreJuego}`;
        crearSala();
    });
});

function generarPIN() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let resultado = '';
    for (let i = 0; i < 4; i++) resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    return resultado;
}

async function crearSala() {
    pinDisplay.innerText = "....";

    try {
        const sala = await crearSalaHost(generarPIN);
        salaPin = sala.pin;
        canalSalaGlobal = sala.canal;
    } catch (err) {
        console.error(err);
        pinDisplay.innerText = "ERROR";
        return;
    }

    pinDisplay.innerText = salaPin;
    escucharJugadores();
}

function escucharJugadores() {
    canalSalaGlobal
        .on('broadcast', { event: 'solicitar_unirse' }, (mensaje) => {
            const { nombre, id_temp } = mensaje.payload;

            // Validación de nombre duplicado (ignorando mayúsculas/minúsculas)
            const nombreExiste = jugadores.some(j => j.toLowerCase() === nombre.toLowerCase());

            if (nombreExiste) {
                // Si existe, lo rebotamos
                canalSalaGlobal.send({
                    type: 'broadcast',
                    event: 'rechazo_unirse',
                    payload: { id_temp: id_temp }
                });
            } else {
                // Si está libre, lo dejamos pasar y le avisamos que entró
                jugadores.push(nombre);
                puntajes[nombre] = 0;
                actualizarPantallaJugadores(nombre);

                canalSalaGlobal.send({
                    type: 'broadcast',
                    event: 'aceptacion_unirse',
                    payload: { id_temp: id_temp, nombre: nombre }
                });

                // Si es el primero en entrar, le damos el rol de Director
                if (jugadores.length === 1) {
                    canalSalaGlobal.send({
                        type: 'broadcast',
                        event: 'asignar_director',
                        payload: { director: nombre }
                    });
                }
            }
        })
        .on('broadcast', { event: 'orden_arrancar' }, () => {
            if (juegoSeleccionado === 'diccionario') iniciarRondaDiccionario();
            else if (juegoSeleccionado === 'pictionary') iniciarRondaPictionary();
        })
        .on('broadcast', { event: 'respuesta_enviada' }, (mensaje) => {
            respuestasDiccionario.push(mensaje.payload);
            const puntos = document.querySelectorAll('.punto:not(.listo)');
            if(puntos.length > 0) puntos[0].classList.add('listo');

            if(respuestasDiccionario.length >= (jugadores.length - 1)) mostrarFaseVotacion();
        })
        .on('broadcast', { event: 'voto_emitido' }, (mensaje) => {
            mostrarResultadoFinal(mensaje.payload);
        })
        /* --- Pictionary --- */
        .on('broadcast', { event: 'pict_trazo' }, (mensaje) => dibujarTrazoPict(mensaje.payload))
        .on('broadcast', { event: 'pict_limpiar' }, () => limpiarLienzoPict())
        .on('broadcast', { event: 'pict_intento' }, (mensaje) => recibirIntentoPict(mensaje.payload))
        .on('broadcast', { event: 'pict_rendirse' }, () => revelarPict(null))
        .subscribe();
}

function actualizarPantallaJugadores(nombre) {
    const div = document.createElement('div');
    div.classList.add('jugador-chip');
    div.innerText = nombre;
    contenedorJugadores.appendChild(div);
}

function formatearTiempo(seg) {
    const m = Math.floor(seg / 60);
    const s = (seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function arrancarTimerEscritura() {
    clearInterval(timerEscritura);
    let restante = TIEMPO_ESCRITURA;
    timerEscritura = setInterval(() => {
        restante--;
        const t = document.getElementById('dic-timer-host');
        if (t) {
            t.innerText = formatearTiempo(Math.max(0, restante));
            if (restante <= 10) t.classList.add('poco');
        }
        if (restante <= 0) {
            clearInterval(timerEscritura);
            // Avisamos a los mandos que manden lo que tengan escrito...
            canalSalaGlobal.send({ type: 'broadcast', event: 'tiempo_agotado' });
            // ...y damos una pequeña gracia para que lleguen esos borradores antes de votar
            setTimeout(mostrarFaseVotacion, 1800);
        }
    }, 1000);
}

function elegirPalabra() {
    if (mazoPalabras.length === 0) {
        mazoPalabras = [...palabrasDiccionario].sort(() => Math.random() - 0.5);
        // Que la próxima no sea igual a la última que ya salió
        if (palabraActual && mazoPalabras[mazoPalabras.length - 1] === palabraActual && mazoPalabras.length > 1) {
            mazoPalabras.unshift(mazoPalabras.pop());
        }
    }
    return mazoPalabras.pop();
}

function iniciarRondaDiccionario() {
    palabraActual = elegirPalabra();
    juezActual = jugadores[Math.floor(Math.random() * jugadores.length)];
    respuestasDiccionario = [];
    votacionIniciada = false;

    // Durante el juego sacamos el header "CREAR SALA" de la pantalla grande
    const header = document.querySelector('.header-zark');
    if (header) header.classList.add('oculto');

    canalSalaGlobal.send({
        type: 'broadcast',
        event: 'iniciar_diccionario',
        payload: { palabra: palabraActual.palabra, juez: juezActual, duracion: TIEMPO_ESCRITURA }
    });

    let puntosHTML = '';
    for(let i = 0; i < (jugadores.length - 1); i++){ puntosHTML += '<div class="punto"></div>'; }

    pantallaLobby.innerHTML = `
        <h2 class="subtitulo mb-10" style="color: #e67e22; text-align: center;">Chamuyando...</h2>
        <p style="text-align: center; font-size: 1.4rem; color: #ddd; margin: 0 0 22px 0;">El comelibros es <strong style="color: #fff;">${juezActual}</strong></p>

        <div class="caja-ejemplo">
            <p style="margin: 0 0 6px 0; color: #777; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1.5px;">Así se ve una definición</p>
            <p style="margin: 0; font-size: 1.15rem; color: #eee;"><strong style="color: #e67e22;">Gaznápiro</strong> <span style="font-style: italic; color: #bbb;">persona tonta, palurda o que se emboba con cualquier cosa</span></p>
        </div>

        <p class="tip-vandalo">¡Inventá tu mentira! como si saliera del diccionario: en minúscula, con comas y sin punto final, así no te cazan.</p>

        <div style="text-align: center;">
            <div id="dic-timer-host" class="timer-chamuyo">${formatearTiempo(TIEMPO_ESCRITURA)}</div>
            <h3 style="color: #aaa; font-size: 1.2rem; margin: 5px 0 0 0;">Esperando mentiras...</h3>
            <div id="contenedor-puntos" class="puntos-container">${puntosHTML}</div>
        </div>
    `;

    arrancarTimerEscritura();
}

function mostrarFaseVotacion() {
    if (votacionIniciada) return; // evita que el timer y "todos respondieron" la disparen dos veces
    votacionIniciada = true;
    clearInterval(timerEscritura);

    // Si nadie chamuyó (ni borradores), el comelibros gana sin votación
    if (respuestasDiccionario.length === 0) {
        mostrarResultadoFinal({ esLaPosta: true, sinChamuyo: true });
        return;
    }

    respuestasDiccionario.push({ jugador: "El Sistema", definicion: palabraActual.definicion, esLaPosta: true });
    respuestasDiccionario.sort(() => Math.random() - 0.5);

    canalSalaGlobal.send({
        type: 'broadcast',
        event: 'fase_votacion',
        payload: { opciones: respuestasDiccionario, juez: juezActual }
    });

    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let entradasHTML = '';
    respuestasDiccionario.forEach((resp, index) => {
        const def = (resp.definicion || '').trim().replace(/[.\s]+$/, '');
        entradasHTML += `<div class="entrada-dic"><span class="letra">${letras[index]}.</span>${def}.</div>`;
    });

    pantallaLobby.innerHTML = `
        <h2 class="subtitulo" style="color: #e67e22; margin: 0 0 12px 0; text-align: center;">¿Cuál será la posta?</h2>
        <p style="text-align: center; color: #ddd; margin: 0 0 20px 0; font-size: 1.3rem;"><strong style="color: #fff;">${juezActual}</strong> tiene que elegir dentro de estas opciones.</p>
        <div class="pagina-diccionario">${entradasHTML}</div>
    `;
}

function mostrarResultadoFinal(voto) {
    let titulo = "", color = "", subtitulo = "";

    let ganador = "";
    if (voto.esLaPosta) {
        titulo = "EL COMELIBROS SABE"; color = "#2ecc71"; subtitulo = voto.sinChamuyo ? "Nadie se animó a chamuyar, se la regalaron." : "Se nota que sabe."; puntajes[juezActual] += 1; ganador = juezActual;
    } else {
        titulo = "SE COMIÓ EL CHAMUYO"; color = "#e74c3c"; subtitulo = `Picó el anzuelo de <strong>${voto.jugador}</strong>.`; puntajes[voto.jugador] += 1; ganador = voto.jugador;
    }

    let scoreboardHTML = `
        <div style="width: 100%;">
            <p style="margin: 0 0 12px 0; color: #777; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px;">Puntajes</p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                ${Object.entries(puntajes).sort((a, b) => b[1] - a[1]).map(([jug, pts]) => `
                    <div style="display: flex; align-items: center; gap: 8px; background: #222; padding: 10px 18px; border-radius: 12px; border: 2px solid ${jug === ganador ? '#2ecc71' : '#333'};">
                        <span style="font-weight: bold; font-size: 1.1rem;">${jug}</span>
                        <span style="color: #e67e22; font-weight: 900; font-size: 1.15rem;">${pts}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    pantallaLobby.innerHTML = `
        <div style="max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 24px;">
            <div style="text-align: center;">
                <div style="display: inline-block; background: ${color}22; border: 2px solid ${color}; color: ${color}; font-weight: 900; letter-spacing: 1px; padding: 10px 26px; border-radius: 40px; font-size: 1.6rem;">${titulo}</div>
                <p style="color: #ccc; font-size: 1.3rem; margin: 16px 0 0 0;">${subtitulo}</p>
            </div>

            <div style="width: 100%; text-align: center;">
                <p style="margin: 0 0 14px 0; color: #777; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px;">La palabra era</p>
                <div class="recorte-diccionario">
                    <span class="headword">${palabraActual.palabra.toUpperCase()}.</span> <span class="pos">${palabraActual.tipo}</span> ${palabraActual.definicion}.
                </div>
            </div>

            ${scoreboardHTML}
        </div>
    `;

    canalSalaGlobal.send({ type: 'broadcast', event: 'fin_de_ronda' });
}

// ==========================================
// PICTIONARY (host)
// ==========================================
function elegirPalabraPict() {
    if (mazoPict.length === 0) {
        mazoPict = [...palabrasPictionary].sort(() => Math.random() - 0.5);
        if (palabraPict && mazoPict[mazoPict.length - 1] === palabraPict && mazoPict.length > 1) mazoPict.unshift(mazoPict.pop());
    }
    return mazoPict.pop();
}

function iniciarRondaPictionary() {
    if (jugadores.length < 2) return; // hace falta quien dibuje y quien adivine
    aciertoPict = false;
    noEsLista = [];
    turnoDibujante = (turnoDibujante + 1) % jugadores.length;
    dibujanteActual = jugadores[turnoDibujante];
    palabraPict = elegirPalabraPict();

    canalSalaGlobal.send({ type: 'broadcast', event: 'pict_ronda', payload: { dibujante: dibujanteActual, palabra: palabraPict } });

    pantallaLobby.innerHTML = `
        <p style="text-align: center; font-size: 1.6rem; margin: 0 0 15px 0; font-weight: bold;">
            <span class="material-symbols-outlined" style="vertical-align: middle; color: #775adf;">draw</span>
            <strong style="color: #fff;">${dibujanteActual}</strong> está dibujando...
        </p>
        <div class="zona-lienzo">
            <canvas id="lienzo-host" width="800" height="600"></canvas>
            <div class="caja-noes">
                <div class="noes-titulo">No es...</div>
                <div id="noes-lista" class="noes-lista"></div>
            </div>
        </div>
    `;
    lienzoHostPict = document.getElementById('lienzo-host');
    ctxHostPict = lienzoHostPict.getContext('2d');
    limpiarLienzoPict();
}

function limpiarLienzoPict() {
    if (!ctxHostPict) return;
    ctxHostPict.fillStyle = '#ffffff';
    ctxHostPict.fillRect(0, 0, lienzoHostPict.width, lienzoHostPict.height);
}

function dibujarTrazoPict(d) {
    if (!ctxHostPict || !d) return;
    ctxHostPict.strokeStyle = d.color || '#111';
    ctxHostPict.lineWidth = Math.max(1, (d.grosor || 0.012) * lienzoHostPict.width);
    ctxHostPict.lineCap = 'round';
    ctxHostPict.lineJoin = 'round';
    ctxHostPict.beginPath();
    ctxHostPict.moveTo(d.x0 * lienzoHostPict.width, d.y0 * lienzoHostPict.height);
    ctxHostPict.lineTo(d.x1 * lienzoHostPict.width, d.y1 * lienzoHostPict.height);
    ctxHostPict.stroke();
}

function renderNoEs() {
    const cont = document.getElementById('noes-lista');
    if (!cont) return;
    cont.innerHTML = noEsLista.map(t => `<span class="noes-chip">${t}</span>`).join('');
}

function recibirIntentoPict({ jugador, texto }) {
    if (aciertoPict || jugador === dibujanteActual) return;
    if (normalizarPict(texto) === normalizarPict(palabraPict)) {
        aciertoPict = true;
        puntajes[jugador] = (puntajes[jugador] || 0) + 1;
        puntajes[dibujanteActual] = (puntajes[dibujanteActual] || 0) + 1; // premio para el dibujante
        canalSalaGlobal.send({ type: 'broadcast', event: 'pict_acierto', payload: { ganador: jugador, dibujante: dibujanteActual, palabra: palabraPict } });
        revelarPict(jugador);
    } else {
        const t = (texto || '').trim();
        if (t && !noEsLista.some(x => normalizarPict(x) === normalizarPict(t))) {
            noEsLista.push(t);
            renderNoEs();
        }
        canalSalaGlobal.send({ type: 'broadcast', event: 'pict_fallo', payload: { jugador } });
    }
}

function revelarPict(ganador) {
    aciertoPict = true;
    const titulo = ganador ? `¡${ganador} la sacó!` : 'Nadie la adivinó';
    const color = ganador ? '#2ecc71' : '#e74c3c';
    const scoreboardHTML = `
        <div style="width: 100%;">
            <p style="margin: 0 0 12px 0; color: #777; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Puntajes</p>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                ${Object.entries(puntajes).sort((a, b) => b[1] - a[1]).map(([jug, pts]) => `
                    <div style="display: flex; align-items: center; gap: 8px; background: #222; padding: 10px 18px; border-radius: 12px; border: 2px solid ${jug === ganador ? '#2ecc71' : '#333'};">
                        <span style="font-weight: bold; font-size: 1.1rem;">${jug}</span>
                        <span style="color: #775adf; font-weight: 900; font-size: 1.15rem;">${pts}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    pantallaLobby.innerHTML = `
        <div style="max-width: 620px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 24px;">
            <h1 style="font-size: 3rem; margin: 0; color: ${color}; text-align: center;">${titulo}</h1>
            <div style="width: 100%; text-align: center;">
                <p style="margin: 0 0 14px 0; color: #777; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px;">Era</p>
                <div class="recorte-diccionario"><span class="headword">${(palabraPict || '').toUpperCase()}</span></div>
            </div>
            ${scoreboardHTML}
        </div>
    `;
    canalSalaGlobal.send({ type: 'broadcast', event: 'fin_de_ronda' });
}

// Limpieza automática: liberamos el PIN en el servidor de PeerJS
function destruirSala() {
    if (canalSalaGlobal) {
        canalSalaGlobal.cerrar();
        canalSalaGlobal = null;
        salaPin = "";
    }
}
window.addEventListener('beforeunload', destruirSala);
window.addEventListener('pagehide', destruirSala);