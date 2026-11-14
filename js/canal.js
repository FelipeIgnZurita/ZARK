// ==========================================
// CANAL P2P (reemplazo de Supabase Realtime)
// ==========================================
// Conecta los navegadores directo entre sí con WebRTC usando PeerJS.
// El servidor público de PeerJS solo se usa para "presentar" a los peers;
// después los mensajes viajan directo entre el host y cada mando.
//
// Imita la interfaz de los canales de Supabase que ya usaba el proyecto:
//   canal.on('broadcast', { event: 'x' }, (mensaje) => mensaje.payload)
//   canal.send({ type: 'broadcast', event: 'x', payload: {...} })
//   canal.subscribe((estado) => { if (estado === 'SUBSCRIBED') ... })
//
// Topología en estrella: el host le reenvía todo a todos los mandos y cada
// mando le habla solo al host (los juegos ya funcionaban así).

import { Peer } from 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm';

// El servidor de PeerJS es compartido por todo el mundo: el prefijo evita
// chocar con IDs de otras apps que también usen PINs cortos.
const PREFIJO_ID = 'zark-fiz-sala-';
const idDeSala = (pin) => PREFIJO_ID + pin.toUpperCase();

const TIMEOUT_CONEXION_MS = 10000;

class CanalP2P {
    constructor(rol) {
        this.rol = rol;            // 'host' | 'invitado'
        this.peer = null;
        this.conexiones = [];      // host: una por mando | invitado: solo la del host
        this.handlers = {};        // evento -> [callbacks]
        this.abierto = false;
        this.alDesconectar = null; // callback opcional
    }

    on(tipo, filtro, callback) {
        const evento = filtro && filtro.event;
        if (!evento) return this;
        (this.handlers[evento] ||= []).push(callback);
        return this;
    }

    // Igual que Supabase: el canal ya se abrió antes (crearSalaHost / conectarASala),
    // así que subscribe solo avisa que está listo.
    subscribe(callback) {
        if (callback) queueMicrotask(() => callback(this.abierto ? 'SUBSCRIBED' : 'CLOSED'));
        return this;
    }

    send({ event, payload }) {
        const mensaje = { type: 'broadcast', event, payload };
        this.conexiones.forEach(conn => {
            if (conn.open) {
                try { conn.send(mensaje); } catch (e) { console.warn('[canal] no se pudo enviar', e); }
            }
        });
        return Promise.resolve('ok');
    }

    // Callback que se llama cuando se cae la conexión con el host (solo invitado)
    onDesconexion(callback) {
        this.alDesconectar = callback;
        return this;
    }

    cerrar() {
        this.abierto = false;
        this.conexiones.forEach(c => { try { c.close(); } catch (_) {} });
        this.conexiones = [];
        if (this.peer && !this.peer.destroyed) this.peer.destroy();
    }

    _despachar(mensaje) {
        if (!mensaje || mensaje.type !== 'broadcast') return;
        (this.handlers[mensaje.event] || []).forEach(cb => {
            try { cb(mensaje); } catch (e) { console.error(`[canal] error en handler "${mensaje.event}"`, e); }
        });
    }

    _registrarConexion(conn) {
        this.conexiones.push(conn);
        conn.on('data', (data) => this._despachar(data));
        const quitar = () => {
            this.conexiones = this.conexiones.filter(c => c !== conn);
            if (this.rol === 'invitado' && this.abierto) {
                this.abierto = false;
                if (this.alDesconectar) this.alDesconectar();
            }
        };
        conn.on('close', quitar);
        conn.on('error', quitar);
    }
}

// HOST: abre la sala. Si el PIN ya está ocupado en el servidor, prueba con otro.
// Devuelve { pin, canal } con el canal ya listo para recibir mandos.
export function crearSalaHost(generarPIN, intentos = 5) {
    return new Promise((resolve, reject) => {
        const probar = (restantes) => {
            const pin = generarPIN();
            const canal = new CanalP2P('host');
            const peer = new Peer(idDeSala(pin), { debug: 1 });
            canal.peer = peer;

            peer.on('open', () => {
                canal.abierto = true;
                resolve({ pin, canal });
            });

            peer.on('connection', (conn) => {
                conn.on('open', () => canal._registrarConexion(conn));
            });

            peer.on('error', (err) => {
                if (err.type === 'unavailable-id' && restantes > 1) {
                    peer.destroy();
                    probar(restantes - 1);
                } else if (!canal.abierto) {
                    peer.destroy();
                    reject(err);
                } else {
                    console.warn('[canal] error del host', err);
                }
            });

            // Si se corta el servidor de señalización, los mandos ya conectados
            // siguen andando; intentamos reconectar para que puedan entrar nuevos.
            peer.on('disconnected', () => {
                if (canal.abierto && !peer.destroyed) peer.reconnect();
            });
        };
        probar(intentos);
    });
}

// INVITADO: se conecta a la sala del PIN.
// Resuelve con el canal abierto, o rechaza con Error('SALA_NO_EXISTE' | 'SIN_CONEXION').
export function conectarASala(pin) {
    return new Promise((resolve, reject) => {
        const canal = new CanalP2P('invitado');
        const peer = new Peer({ debug: 1 });
        canal.peer = peer;
        let terminado = false;

        const fallar = (motivo) => {
            if (terminado) return;
            terminado = true;
            clearTimeout(timer);
            canal.cerrar();
            reject(new Error(motivo));
        };

        const timer = setTimeout(() => fallar('SIN_CONEXION'), TIMEOUT_CONEXION_MS);

        peer.on('open', () => {
            const conn = peer.connect(idDeSala(pin), { reliable: true, serialization: 'json' });
            conn.on('open', () => {
                if (terminado) return;
                terminado = true;
                clearTimeout(timer);
                canal._registrarConexion(conn);
                canal.abierto = true;
                resolve(canal);
            });
        });

        peer.on('error', (err) => {
            if (err.type === 'peer-unavailable') fallar('SALA_NO_EXISTE');
            else if (!canal.abierto) fallar('SIN_CONEXION');
            else console.warn('[canal] error del invitado', err);
        });
    });
}

export const mensajeDeError = (err) =>
    err && err.message === 'SALA_NO_EXISTE'
        ? 'La sala no existe.'
        : 'No se pudo conectar. Revisá tu conexión.';
