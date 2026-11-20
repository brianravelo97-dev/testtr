import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { ACTIONS, ENTITIES, fmtDateTime, daysAgo, today } from '../lib/format.js';
import { PageHeader, Loading, Empty, Pagination, Badge, Spinner } from '../components/ui.jsx';

const ACTION_COLOR = { create: 'green', update: 'blue', delete: 'red', login: 'gray', login_failed: 'yellow', open: 'purple', restore: 'red', backup: 'gray' };

function Details({ details }) {
  if (!details) return null;
  const changes = details.cambios;
  return (
    <div className="space-y-2 text-xs">
      {changes && typeof changes === 'object' && Object.keys(changes).length > 0 && (
        <table className="w-full max-w-2xl">
          <thead><tr className="text-left text-slate-500"><th className="py-1 pr-4 font-medium">Campo</th><th className="py-1 pr-4 font-medium">Antes</th><th className="py-1 font-medium">Después</th></tr></thead>
          <tbody>
            {Object.entries(changes).map(([k, v]) => (
              <tr key={k} className="border-t border-slate-200 dark:border-slate-700">
                <td className="py-1 pr-4 font-mono">{k}</td>
                <td className="py-1 pr-4 text-red-600 dark:text-red-400">{typeof v === 'object' && v ? String(v.de ?? '—') : '—'}</td>
                <td className="py-1 text-emerald-600 dark:text-emerald-400">{typeof v === 'object' && v ? String(v.a ?? '—') : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 text-[11px] dark:bg-slate-800">{JSON.stringify(Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'cambios')), null, 2)}</pre>
    </div>
  );
}

const summary = (d) => d?.name || d?.username || d?.puerta || d?.archivo || d?.mensaje || (d?.formato && `Formato ${d.formato}`) || '';

export default function Audit() {
  const [filters, setFilters] = useState({ from: daysAgo(30), to: today(), user: '', action: '', entity: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({ users: [], actions: [], entities: [] });
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(null);

  useEffect(() => { api.get(`/audit${qs({ ...filters, page, pageSize: 25 })}`).then(setData).catch((e) => toast.error(e.message)); }, [filters, page]);
  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { api.get('/audit/meta').then(setMeta).catch(() => {}); }, []);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const exportFile = async (format) => {
    setExporting(format);
    try { await api.download(`/audit/export${qs({ ...filters, format })}`, `auditoria.${format}`); } catch (e) { toast.error(e.message); } finally { setExporting(null); }
  };

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Acciones realizadas por los administradores del sistema"
        actions={<>
          <button className="btn-secondary" onClick={() => exportFile('xlsx')} disabled={!!exporting}>{exporting === 'xlsx' ? <Spinner /> : <FileSpreadsheet size={16} className="text-emerald-600" />} Excel</button>
          <button className="btn-secondary" onClick={() => exportFile('pdf')} disabled={!!exporting}>{exporting === 'pdf' ? <Spinner /> : <FileText size={16} className="text-red-600" />} PDF</button>
        </>} />
      <div className="card">
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3 lg:grid-cols-5">
          <label><span className="label">Desde</span><input type="date" className="input" value={filters.from} onChange={set('from')} /></label>
          <label><span className="label">Hasta</span><input type="date" className="input" value={filters.to} onChange={set('to')} /></label>
          <label><span className="label">Usuario</span><select className="input" value={filters.user} onChange={set('user')}><option value="">Todos</option>{meta.users.map((u) => <option key={u}>{u}</option>)}</select></label>
          <label><span className="label">Acción</span><select className="input" value={filters.action} onChange={set('action')}><option value="">Todas</option>{meta.actions.map((a) => <option key={a} value={a}>{ACTIONS[a] || a}</option>)}</select></label>
          <label><span className="label">Entidad</span><select className="input" value={filters.entity} onChange={set('entity')}><option value="">Todas</option>{meta.entities.map((a) => <option key={a} value={a}>{ENTITIES[a] || a}</option>)}</select></label>
        </div>
        {!data ? <Loading /> : data.data.length === 0 ? <Empty text="Sin registros de auditoría" /> : (
          <>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.data.map((a) => (
                <li key={a.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setOpen(open === a.id ? null : a.id)}>
                    {a.details ? (open === a.id ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />) : <span className="w-4" />}
                    <span className="w-36 shrink-0 text-xs tabular-nums text-slate-500 max-sm:hidden">{fmtDateTime(a.ts, true)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{a.username || 'sistema'}</span>
                        <Badge color={ACTION_COLOR[a.action] || 'gray'}>{ACTIONS[a.action] || a.action}</Badge>
                        <span className="text-slate-500">{ENTITIES[a.entity] || a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</span>
                      </span>
                      <span className="block truncate text-xs text-slate-500">{summary(a.details)}<span className="sm:hidden"> · {fmtDateTime(a.ts)}</span></span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400 max-md:hidden">{a.ip}</span>
                  </button>
                  {open === a.id && a.details && <div className="px-4 pb-4 pl-11"><Details details={a.details} /></div>}
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
