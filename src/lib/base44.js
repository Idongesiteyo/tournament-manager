const STORE_PREFIX = "base44_";

class Entity {
  constructor(name) {
    this.name = name;
    this.storeKey = `${STORE_PREFIX}${name}`;
    
    // Listen for changes from other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === this.storeKey) {
        window.dispatchEvent(new CustomEvent(`base44_${this.name}_changed`));
      }
    });
  }

  _read() {
    const data = localStorage.getItem(this.storeKey);
    return data ? JSON.parse(data) : [];
  }

  _write(data) {
    localStorage.setItem(this.storeKey, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(`base44_${this.name}_changed`));
  }

  find() {
    return Promise.resolve(this._read());
  }

  findById(id) {
    const all = this._read();
    return Promise.resolve(all.find((e) => e.id === id) || null);
  }

  insert(record) {
    const all = this._read();
    const newRecord = {
      ...record,
      id: record.id || `${this.name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    };
    all.push(newRecord);
    this._write(all);
    return Promise.resolve(newRecord);
  }

  insertMany(records) {
    const all = this._read();
    const newRecords = records.map((r) => ({
      ...r,
      id: r.id || `${this.name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    }));
    all.push(...newRecords);
    this._write(all);
    return Promise.resolve(newRecords);
  }

  update(id, updates) {
    const all = this._read();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return Promise.reject(new Error("Not found"));
    
    all[idx] = { ...all[idx], ...updates, updated_date: new Date().toISOString() };
    this._write(all);
    return Promise.resolve(all[idx]);
  }

  delete(id) {
    const all = this._read();
    const filtered = all.filter((e) => e.id !== id);
    this._write(filtered);
    return Promise.resolve(true);
  }

  deleteAll() {
    this._write([]);
    return Promise.resolve(true);
  }

  subscribe(callback) {
    const handler = () => callback();
    window.addEventListener(`base44_${this.name}_changed`, handler);
    return () => window.removeEventListener(`base44_${this.name}_changed`, handler);
  }
}

export const Team = new Entity("team");
export const Match = new Entity("match");
export const TournamentSettings = new Entity("tournament_settings");
export const Player = new Entity("player");
