import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText, Fingerprint, CreditCard, Hash, Globe, RotateCcw, Filter } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useRealtime } from '../lib/useRealtime.js';
import { METHODS, fmtDateTime, daysAgo, today } from '../lib/format.js';
import { PageHeader, Loading, Empty, Pagination, ResultBadge, Avatar, Spinner, SearchInput, useDebounced } from '../components/ui.jsx';

const METHOD_ICON = { fingerprint: Fingerprint, card: CreditCard, pin: Hash, web: Globe };
const INIT = { from: daysAgo(7), to: today(), person_id: '', door_id: '', method: '', result: '' };

export default function Logs() {
  const [filters, setFilters] = useState(INIT);
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [doors, setDoors] = useState([]);
  const [exporting, setExporting] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [newIds, setNewIds] = useState([]);

  const params = { ...filters, q: dq };
  const load = () => api.get(`/logs${qs({ ...params, page, pageSize: 25 })}`).then(setData).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [filters, dq, page]); // eslint-disable-line
  useEffect(() => { setPage(1); }, [filters, dq]);
  useEffect(() => {
    api.get('/people/options').then(setPeople).catch(() => {});
    api.get('/doors').then(setDoors).catch(() => {});
  }, []);

  // agrega en vivo los eventos nuevos si estamos en la primera página sin filtros restrictivos
  useRealtime((m) => {
    if (m.type !== 'access' || page !== 1) return;
    const e = m.data;
    const match = (!filters.person_id || Number(filters.person_id) === e.person_id) && (!filters.door_id || Number(filters.door_id) === e.door_id)
      && (!filters.method || filters.method === e.method) && (!filters.result || filters.result === e.result) && (!filters.to || filters.to >= e.ts.slice(0, 10)) && !dq;
    if (!match) return;
    setNewIds((ids) => [e.id, ...ids].slice(0, 20));
    setData((d) => d && { ...d, total: d.total + 1, data: [e, ...d.data].slice(0, d.pageSize) });
  });

  const exportFile = async (format) => {
    setExporting(format);
    try { await api.download(`/logs/export${qs({ ...params, format })}`, `accesos.${format}`); toast.success('Archivo generado'); } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Registro de accesos" subtitle="Historial de intentos de acceso en todas las puertas"
        actions={<>
          <button className="btn-secondary" onClick={() => exportFile('xlsx')} disabled={!!exporting}>{exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet size={16} className="text-emerald-600" />} Excel</button>
          <button className="btn-secondary" onClick={() => exportFile('pdf')} disabled={!!exporting}>{exporting === 'pdf' ? <Spinner /> : <FileText size={16} className="text-red-600" />} PDF</button>
        </>} />

      <div className="card">
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Buscar persona, motivo o credencial…" className="flex-1" />
            <button className="btn-secondary lg:hidden" onClick={() => setShowFilters(!showFilters)}><Filter size={16} /></button>
            <button className="btn-ghost" onClick={() => { setFilters(INIT); setQ(''); }} title="Limpiar filtros"><RotateCcw size={16} /></button>
          </div>
          <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 ${showFilters ? '' : 'hidden lg:grid'}`}>
            <label><span className="label">Desde</span><input type="date" className="input" value={filters.from} onChange={set('from')} /></label>
            <label><span className="label">Hasta</span><input type="date" className="input" value={filters.to} onChange={set('to')} /></label>
            <label><span className="label">Persona</span>
              <select className="input" value={filters.person_id} onChange={set('person_id')}><option value="">Todas</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
            <label><span className="label">Puerta</span>
              <select className="input" value={filters.door_id} onChange={set('door_id')}><option value="">Todas</option>{doors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </label>
            <label><span className="label">Método</span>
              <select className="input" value={filters.method} onChange={set('method')}><option value="">Todos</option>{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label><span className="label">Resultado</span>
              <select className="input" value={filters.result} onChange={set('result')}><option value="">Todos</option><option value="granted">Permitido</option><option value="denied">Denegado</option></select>
            </label>
          </div>
        </div>

        {!data ? <Loading /> : data.data.length === 0 ? <Empty text="No hay registros para los filtros seleccionados" /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr><th className="th">Fecha / hora</th><th className="th">Persona</th><th className="th">Puerta</th><th className="th">Método</th><th className="th">Resultado</th><th className="th">Motivo</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.data.map((l) => {
                    const Icon = METHOD_ICON[l.method];
                    return (
                      <tr key={l.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${newIds.includes(l.id) ? 'flash' : ''}`}>
                        <td className="td whitespace-nowrap tabular-nums">{fmtDateTime(l.ts, true)}</td>
                        <td className="td"><div className="flex items-center gap-2"><Avatar name={l.person_name || '?'} photo={l.photo} size={28} /><span className={l.person_name ? '' : 'text-slate-400'}>{l.person_name || 'Desconocido'}</span></div></td>
                        <td className="td">{l.door_name || '—'}</td>
                        <td className="td"><span className="inline-flex items-center gap-1.5">{Icon && <Icon size={14} className="text-slate-400" />}{METHODS[l.method]}</span>{l.credential && <div className="font-mono text-[11px] text-slate-400">{l.credential}</div>}</td>
                        <td className="td"><ResultBadge result={l.result} /></td>
                        <td className="td text-slate-600 dark:text-slate-400">{l.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {data.data.map((l) => (
                <li key={l.id} className={`flex items-start gap-3 p-4 ${newIds.includes(l.id) ? 'flash' : ''}`}>
                  <Avatar name={l.person_name || '?'} photo={l.photo} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{l.person_name || 'Desconocido'}</span><ResultBadge result={l.result} /></div>
                    <div className="text-xs text-slate-500">{l.door_name} · {METHODS[l.method]}</div>
                    <div className="text-xs text-slate-400">{fmtDateTime(l.ts, true)} · {l.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
