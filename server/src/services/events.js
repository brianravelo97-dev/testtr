import { EventEmitter } from 'node:events';

/** Bus de eventos interno: el servidor WebSocket se suscribe y reenvía a los clientes */
export const bus = new EventEmitter();
bus.setMaxListeners(50);
