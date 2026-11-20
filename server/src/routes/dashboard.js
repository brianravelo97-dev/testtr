import { Router } from 'express';
import { db } from '../db.js';
import { dateOnly } from '../utils/time.js';

const r = Router();

r.get('/', (_req, res) => {
  const today = dateOnly();
  const d = db();
  const one = (sql, ...p) => d.prepare(sql).get(...p);
  const stats = {
    accessToday: one("SELECT COUNT(*) c FROM access_logs WHERE ts >= ? AND result = 'granted'", `${today} 00:00:00`).c,
    deniedToday: one("SELECT COUNT(*) c FROM access_logs WHERE ts >= ? AND result = 'denied'", `${today} 00:00:00`).c,
    devicesOnline: one("SELECT COUNT(*) c FROM devices WHERE status = 'online'").c,
    devicesOffline: one("SELECT COUNT(*) c FROM devices WHERE status = 'offline'").c,
    peopleActive: one("SELECT COUNT(*) c FROM people WHERE status = 'active' AND (valid_to IS NULL OR valid_to >= ?)", today).c,
    peopleTotal: one('SELECT COUNT(*) c FROM people').c,
    doors: one('SELECT COUNT(*) c FROM doors').c,
  };

  const hourlyRows = d.prepare(`SELECT CAST(substr(ts, 12, 2) AS INTEGER) h,
      SUM(result = 'granted') granted, SUM(result = 'denied') denied
    FROM access_logs WHERE ts >= ? GROUP BY h`).all(`${today} 00:00:00`);
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const row = hourlyRows.find((x) => x.h === h);
    return { hour: `${String(h).padStart(2, '0')}:00`, granted: row?.granted || 0, denied: row?.denied || 0 };
  });

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    days.push(dateOnly(dt));
  }
  const dailyRows = d.prepare(`SELECT substr(ts, 1, 10) day, SUM(result = 'granted') granted, SUM(result = 'denied') denied
    FROM access_logs WHERE ts >= ? GROUP BY day`).all(`${days[0]} 00:00:00`);
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const daily = days.map((day) => {
    const row = dailyRows.find((x) => x.day === day);
    const dt = new Date(`${day}T12:00:00`);
    return { day, label: `${dayNames[dt.getDay()]} ${day.slice(8, 10)}-${day.slice(5, 7)}`, granted: row?.granted || 0, denied: row?.denied || 0 };
  });

  const recent = d.prepare(`SELECT l.*, p.photo FROM access_logs l LEFT JOIN people p ON p.id = l.person_id ORDER BY l.ts DESC, l.id DESC LIMIT 10`).all();
  const devices = d.prepare('SELECT id, name, status, last_seen, driver FROM devices ORDER BY name').all();
  const topDenied = d.prepare(`SELECT reason, COUNT(*) c FROM access_logs WHERE result = 'denied' AND ts >= ? GROUP BY reason ORDER BY c DESC LIMIT 5`).all(`${days[0]} 00:00:00`);

  res.json({ stats, hourly, daily, recent, devices, topDenied });
});

export default r;
