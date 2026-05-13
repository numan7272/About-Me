/**
 * EventEmitter — Mini-Pubsub für Core-Module.
 *
 *   const ee = new EventEmitter()
 *   ee.on("tick", (delta) => console.log(delta))
 *   ee.trigger("tick", [0.016])
 *   ee.off("tick", cb)
 */

export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(name, cb) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(cb);
    return this;
  }

  off(name, cb) {
    const set = this.listeners.get(name);
    if (set) set.delete(cb);
    return this;
  }

  trigger(name, args = []) {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(...args);
      } catch (e) {
        console.error(`[EventEmitter] error in "${name}" listener:`, e);
      }
    }
  }
}
