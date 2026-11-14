// ==========================================
// BATALLA NAVAL (1v1) - módulo compartido
// ==========================================
// Lo usan hostind.js (jugador anfitrión) y mandoind.js (jugador invitado).
// Cada celular tiene su propio tablero; los disparos viajan por el canal P2P.
// El anfitrión coordina el arranque (decide quién tira primero).

const N = 8;               // tablero 8x8
const BARCOS = [5, 4, 3, 2]; // tamaños de los barcos

let estilosPuestos = false;
function inyectarEstilos() {
    if (estilosPuestos) return;
    estilosPuestos = true;
    const s = document.createElement('style');
    s.textContent = `
    .bn-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; }
    .bn-titulo { margin: 0; color: #00ffcc; font-size: 1.4rem; text-align: center; }
    .bn-sub { margin: 0; color: #aaa; text-align: center; }
    .bn-sub b { color: #fff; }

    /* ---- Tablero de colocación (con barcos arrastrables) ---- */
    .bn-board { position: relative; width: 100%; max-width: 320px; aspect-ratio: 1 / 1; background: #0d2b3a; border-radius: 10px; touch-action: none; box-shadow: inset 0 0 12px rgba(0,0,0,0.6); }
    .bn-grid-fondo { position: absolute; inset: 0; display: grid; }
    .bn-grid-fondo div { border: 1px solid #16455c; box-sizing: border-box; }
    .bn-ship { position: absolute; box-sizing: border-box; border-radius: 7px; background: linear-gradient(135deg, #8793a2, #5a6472); border: 2px solid #39414d; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: grab; touch-action: none; }
    .bn-ship.invalido { background: #9a3a3a; border-color: #c0392b; }
    .bn-ship.arrastrando { opacity: 0.85; cursor: grabbing; z-index: 10; }

    /* ---- Grillas de batalla ---- */
    .bn-grid { display: grid; gap: 3px; width: 100%; max-width: 340px; background: #0d2b3a; padding: 6px; border-radius: 10px; box-shadow: inset 0 0 12px rgba(0,0,0,0.6); }
    .bn-cell { aspect-ratio: 1 / 1; background: #114257; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; line-height: 1; color: #fff; transition: background .15s; }
    .bn-cell.barco { background: #5a6472; }
    .bn-cell.agua { background: #0a1f2b; }
    .bn-cell.agua::after { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #3a7da8; }
    .bn-cell.tocado { background: #8a2222; }
    .bn-cell.hundido { background: #3a0f0f; opacity: 0.85; filter: saturate(0.6) brightness(0.85); }
    .bn-cell.clickable { cursor: pointer; background: #14506b; }
    .bn-cell.clickable:hover { background: #1c6f94; }

    .bn-banner { padding: 12px; border-radius: 10px; background: #111; border: 1px solid #333; font-weight: bold; text-align: center; width: 100%; max-width: 340px; color: #aaa; box-sizing: border-box; }
    .bn-banner.activo { background: #063329; border-color: #00ffcc; color: #00ffcc; }
    .bn-label { margin: 2px 0 0 0; color: #7fb3c8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; align-self: flex-start; }
    .bn-controles { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    .bn-btn { background: #222; color: #fff; border: 2px solid #444; border-radius: 10px; padding: 9px 13px; font-weight: bold; cursor: pointer; font-size: 0.9rem; }
    .bn-btn:active { transform: scale(0.95); }
    .bn-btn-grande { width: 100%; max-width: 340px; background: #00ffcc; color: #002; border: none; border-radius: 12px; padding: 14px; font-weight: 900; font-size: 1.1rem; cursor: pointer; }
    .bn-btn-grande.desactivado { opacity: 0.4; pointer-events: none; }
    .bn-fin { gap: 18px; padding: 20px 0; }
    .bn-fin h1 { margin: 0; font-size: 2.6rem; text-align: center; }
    .bn-fin h1.gano { color: #00ffcc; }
    .bn-fin h1.perdio { color: #e74c3c; }
    `;
    document.head.appendChild(s);
}

class Batalla {
    constructor(canal, yo, rival, anfitrion, cont) {
        this.canal = canal;
        this.yo = yo;
        this.rival = rival;
        this.anfitrion = anfitrion;
        this.cont = cont;
        this.gane = false;
        this.drag = null;
        this.resetear(false);
        this.registrar();
        this.cont.addEventListener('click', (e) => this.onClick(e));
        this.cont.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.cont.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.cont.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.cont.addEventListener('pointercancel', (e) => this.onPointerUp(e));
    }

    // ---------- estado ----------
    crearTablero() { return Array.from({ length: N }, () => Array.from({ length: N }, () => ({ barco: null, disparado: false }))); }
    crearEnemigo() { return Array.from({ length: N }, () => Array.from({ length: N }, () => ({ estado: 'none', hundido: false }))); }

    resetear(render = true) {
        this.miTablero = this.crearTablero();
        this.enemigo = this.crearEnemigo();
        this.barcos = [];
        this.flota = [];
        this.flotaInicial();     // barcos en fila arriba para arrastrarlos de a uno
        this.fase = 'colocar';
        this.listo = false;
        this.rivalListo = false;
        this.miTurno = false;
        this.esperando = false;
        this.drag = null;
        if (render) this.render();
    }

    registrar() {
        this.canal
            .on('broadcast', { event: 'bn_listo' }, () => { this.rivalListo = true; this.chequearArranque(); })
            .on('broadcast', { event: 'bn_empezar' }, (m) => this.empezar(m.payload.primerTurno))
            .on('broadcast', { event: 'bn_disparo' }, (m) => this.recibirDisparo(m.payload))
            .on('broadcast', { event: 'bn_resultado' }, (m) => this.recibirResultado(m.payload))
            .on('broadcast', { event: 'bn_reiniciar' }, () => this.resetear());
    }

    // ---------- geometría ----------
    celdasDe(r, c, size, orient) {
        const celdas = [];
        for (let i = 0; i < size; i++) celdas.push(orient === 'h' ? { r, c: c + i } : { r: r + i, c });
        return celdas;
    }

    // ¿Entra el barco `id` en (r,c) con esa orientación sin salirse ni pisar a otro?
    puedeColocar(id, r, c, orient) {
        const size = this.flota.find(s => s.id === id).size;
        const celdas = this.celdasDe(r, c, size, orient);
        const ocupadas = new Set();
        this.flota.forEach(s => {
            if (s.id === id) return;
            this.celdasDe(s.r, s.c, s.size, s.orient).forEach(p => ocupadas.add(p.r + ',' + p.c));
        });
        return celdas.every(p => p.r >= 0 && p.r < N && p.c >= 0 && p.c < N && !ocupadas.has(p.r + ',' + p.c));
    }

    // Arranque: todos los barcos alineados arriba (cada uno en su fila) para arrastrarlos de a uno
    flotaInicial() {
        this.flota = BARCOS.map((size, id) => ({ id, size, r: id, c: 0, orient: 'h' }));
    }

    azarFlota() {
        this.flota = [];
        BARCOS.forEach((size, id) => {
            this.flota.push({ id, size, r: 0, c: 0, orient: 'h' });
            let puesto = false, intentos = 0;
            while (!puesto && intentos < 800) {
                intentos++;
                const orient = Math.random() < 0.5 ? 'h' : 'v';
                const r = Math.floor(Math.random() * N);
                const c = Math.floor(Math.random() * N);
                if (this.puedeColocar(id, r, c, orient)) {
                    Object.assign(this.flota[id], { r, c, orient });
                    puesto = true;
                }
            }
        });
    }

    // ---------- arranque ----------
    confirmarListo() {
        if (this.listo) return;
        this.listo = true;
        this.canal.send({ type: 'broadcast', event: 'bn_listo', payload: { de: this.yo } });
        this.render();
        this.chequearArranque();
    }
    chequearArranque() {
        if (this.anfitrion && this.listo && this.rivalListo && this.fase === 'colocar') {
            const primerTurno = Math.random() < 0.5 ? this.yo : this.rival;
            this.canal.send({ type: 'broadcast', event: 'bn_empezar', payload: { primerTurno } });
            this.empezar(primerTurno);
        }
    }
    empezar(primerTurno) {
        if (this.fase === 'batalla') return;
        // Congelamos la flota en el tablero para la batalla
        this.miTablero = this.crearTablero();
        this.barcos = this.flota.map(s => {
            const celdas = this.celdasDe(s.r, s.c, s.size, s.orient);
            celdas.forEach(({ r, c }) => { this.miTablero[r][c].barco = s.id; });
            return { id: s.id, size: s.size, celdas, hits: 0 };
        });
        this.fase = 'batalla';
        this.miTurno = (this.yo === primerTurno);
        this.esperando = false;
        this.render();
    }

    // ---------- disparos ----------
    disparar(r, c) {
        if (this.fase !== 'batalla' || !this.miTurno || this.esperando) return;
        if (this.enemigo[r][c].estado !== 'none') return;
        this.esperando = true;
        this.miTurno = false;
        this.canal.send({ type: 'broadcast', event: 'bn_disparo', payload: { de: this.yo, r, c } });
        this.render();
    }

    recibirDisparo({ r, c }) {
        if (this.fase !== 'batalla') return;
        const cell = this.miTablero[r][c];
        if (cell.disparado) return;
        cell.disparado = true;

        let resultado = 'agua', hundido = false, celdas = null, perdio = false;
        if (cell.barco !== null) {
            const b = this.barcos.find(x => x.id === cell.barco);
            b.hits++;
            resultado = 'tocado';
            if (b.hits >= b.size) { hundido = true; celdas = b.celdas; }
            perdio = this.barcos.every(x => x.hits >= x.size);
        }

        this.canal.send({ type: 'broadcast', event: 'bn_resultado', payload: { r, c, resultado, hundido, celdas, perdio } });

        if (perdio) { this.fase = 'fin'; this.gane = false; }
        else { this.miTurno = true; }
        this.render();
    }

    recibirResultado({ r, c, resultado, hundido, celdas, perdio }) {
        this.enemigo[r][c].estado = resultado;
        if (hundido && celdas) {
            celdas.forEach((p) => { this.enemigo[p.r][p.c].estado = 'tocado'; this.enemigo[p.r][p.c].hundido = true; });
        }
        this.esperando = false;
        if (perdio) { this.fase = 'fin'; this.gane = true; }
        this.render();
    }

    volverAJugar() {
        this.canal.send({ type: 'broadcast', event: 'bn_reiniciar', payload: {} });
        this.resetear();
    }

    // ---------- arrastre de barcos (colocación) ----------
    celdaDesdePx(left, top, board) {
        const cell = board.clientWidth / N;
        let c = Math.round(left / cell), r = Math.round(top / cell);
        r = Math.max(0, Math.min(N - 1, r));
        c = Math.max(0, Math.min(N - 1, c));
        return { r, c };
    }

    posicionarFlota() {
        const board = this.cont.querySelector('#bn-board');
        if (!board) return;
        const cell = board.clientWidth / N;
        this.flota.forEach(s => {
            const el = this.cont.querySelector(`[data-ship="${s.id}"]`);
            if (!el) return;
            el.style.left = (s.c * cell) + 'px';
            el.style.top = (s.r * cell) + 'px';
            el.style.width = ((s.orient === 'h' ? s.size : 1) * cell) + 'px';
            el.style.height = ((s.orient === 'v' ? s.size : 1) * cell) + 'px';
        });
    }

    onPointerDown(e) {
        if (this.fase !== 'colocar' || this.listo) return;
        const el = e.target.closest('.bn-ship');
        if (!el) return;
        e.preventDefault();
        const board = this.cont.querySelector('#bn-board');
        this.drag = {
            id: +el.dataset.ship, el, board,
            startX: e.clientX, startY: e.clientY,
            origLeft: parseFloat(el.style.left) || 0, origTop: parseFloat(el.style.top) || 0,
            moved: false
        };
        el.classList.add('arrastrando');
        if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    }

    onPointerMove(e) {
        if (!this.drag) return;
        const dx = e.clientX - this.drag.startX, dy = e.clientY - this.drag.startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.drag.moved = true;
        const nl = this.drag.origLeft + dx, nt = this.drag.origTop + dy;
        this.drag.el.style.left = nl + 'px';
        this.drag.el.style.top = nt + 'px';
        const s = this.flota.find(x => x.id === this.drag.id);
        const { r, c } = this.celdaDesdePx(nl, nt, this.drag.board);
        this.drag.el.classList.toggle('invalido', !this.puedeColocar(s.id, r, c, s.orient));
    }

    onPointerUp() {
        if (!this.drag) return;
        const { el, id, moved, board } = this.drag;
        const s = this.flota.find(x => x.id === id);
        el.classList.remove('arrastrando', 'invalido');
        if (!moved) {
            // Tap: girar el barco (horizontal <-> vertical), corriéndolo hacia el lado libre si toca un borde
            const otra = s.orient === 'h' ? 'v' : 'h';
            let nr = s.r, nc = s.c;
            if (otra === 'h' && nc + s.size > N) nc = N - s.size;
            if (otra === 'v' && nr + s.size > N) nr = N - s.size;
            if (this.puedeColocar(id, nr, nc, otra)) { s.orient = otra; s.r = nr; s.c = nc; }
        } else {
            const { r, c } = this.celdaDesdePx(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0, board);
            if (this.puedeColocar(id, r, c, s.orient)) { s.r = r; s.c = c; }
        }
        this.drag = null;
        this.posicionarFlota();
    }

    // ---------- clicks (botones y celdas de batalla) ----------
    onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (btn) {
            const a = btn.dataset.action;
            if (a === 'azar' && !this.listo) { this.azarFlota(); this.render(); }
            else if (a === 'listo') this.confirmarListo();
            else if (a === 'volver') this.volverAJugar();
            return;
        }
        const cel = e.target.closest('[data-cell]');
        if (!cel) return;
        if (this.fase === 'batalla' && cel.dataset.grid === 'enemigo') this.disparar(+cel.dataset.r, +cel.dataset.c);
    }

    // ---------- render ----------
    gridHTML(grid) {
        let cells = '';
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                let cls = 'bn-cell', cont = '';
                if (grid === 'propio') {
                    const cell = this.miTablero[r][c];
                    const barco = cell.barco !== null ? this.barcos.find(b => b.id === cell.barco) : null;
                    const hundido = barco && barco.hits >= barco.size;
                    if (cell.barco !== null) cls += ' barco';
                    if (cell.disparado && cell.barco !== null) { cls += ' tocado'; cont = '💥'; }
                    else if (cell.disparado) cls += ' agua';
                    if (hundido) { cls += ' hundido'; cont = '🔥'; }
                } else {
                    const e = this.enemigo[r][c];
                    if (e.estado === 'agua') cls += ' agua';
                    else if (e.estado === 'tocado') { cls += ' tocado'; cont = e.hundido ? '🔥' : '💥'; }
                    if (e.hundido) cls += ' hundido';
                    if (this.fase === 'batalla' && this.miTurno && !this.esperando && e.estado === 'none') cls += ' clickable';
                }
                cells += `<div class="${cls}" data-cell data-grid="${grid}" data-r="${r}" data-c="${c}">${cont}</div>`;
            }
        }
        return `<div class="bn-grid" style="grid-template-columns: repeat(${N}, 1fr)">${cells}</div>`;
    }

    htmlColocar() {
        let fondo = '';
        for (let i = 0; i < N * N; i++) fondo += '<div></div>';
        const ships = this.flota.map(s => `<div class="bn-ship" data-ship="${s.id}"></div>`).join('');
        return `
        <div class="bn-wrap">
            <h2 class="bn-titulo">Acomodá tu flota</h2>
            <p class="bn-sub">Arrastrá los barcos para moverlos. Tocá uno para girarlo.</p>
            <div class="bn-board" id="bn-board">
                <div class="bn-grid-fondo" style="grid-template-columns: repeat(${N}, 1fr)">${fondo}</div>
                ${ships}
            </div>
            <div class="bn-controles"><button class="bn-btn" data-action="azar">🎲 Reacomodar</button></div>
            <button class="bn-btn-grande" data-action="listo">${this.listo ? 'Esperando al rival...' : '¡Listo!'}</button>
        </div>`;
    }

    htmlBatalla() {
        return `
        <div class="bn-wrap">
            <h3 class="bn-label">Flota enemiga</h3>
            ${this.gridHTML('enemigo')}
            <h3 class="bn-label">Tu flota</h3>
            ${this.gridHTML('propio')}
        </div>`;
    }

    htmlFin() {
        return `
        <div class="bn-wrap bn-fin">
            <h1 class="${this.gane ? 'gano' : 'perdio'}">${this.gane ? '🏆 ¡GANASTE!' : '💀 PERDISTE'}</h1>
            <p class="bn-sub">${this.gane ? 'Hundiste toda la flota enemiga.' : `${this.rival} hundió toda tu flota.`}</p>
            <button class="bn-btn-grande" data-action="volver">Volver a jugar</button>
        </div>`;
    }

    render() {
        if (this.fase === 'colocar') { this.cont.innerHTML = this.htmlColocar(); this.posicionarFlota(); }
        else if (this.fase === 'batalla') this.cont.innerHTML = this.htmlBatalla();
        else this.cont.innerHTML = this.htmlFin();
    }
}

export function iniciarBatalla({ canal, miNombre, rivalNombre, soyAnfitrion, contenedor }) {
    inyectarEstilos();
    const juego = new Batalla(canal, miNombre, rivalNombre || 'Rival', soyAnfitrion, contenedor);
    juego.render();
    return juego;
}
