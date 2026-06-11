import { useState } from 'react';
import { X, Camera, Clock, Download, Trash2, RotateCcw, Plus } from 'lucide-react';
import { useGanttStore } from '@/store/ganttStore';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/gantt-utils';

const SnapshotModal = () => {
  const {
    showSnapshotModal, set, currentProject, snapshots,
    createSnapshot, restoreSnapshot, deleteSnapshot,
  } = useGanttStore();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  if (!showSnapshotModal) return null;
  if (!currentProject) return null;

  const handleCreate = async () => {
    if (!name) return;
    await createSnapshot(name, desc);
    setName(''); setDesc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={() => set('showSnapshotModal', false)}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl animate-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-gradient-to-r from-amber-600/10 to-orange-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">版本快照</h2>
              <p className="text-xs text-slate-400">保存当前进度为版本，可随时恢复</p>
            </div>
          </div>
          <button onClick={() => set('showSnapshotModal', false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">创建新快照</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="快照名称，如：V1.0 需求评审后..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
            <input
              type="text"
              placeholder="备注(可选)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
            />
            <button
              onClick={handleCreate}
              disabled={!name}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-1.5',
                name ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20' : 'bg-slate-700 opacity-50 cursor-not-allowed',
              )}
            >
              <Plus size={16} /> 保存
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {snapshots.length === 0 && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <Clock size={28} className="text-slate-500" />
              </div>
              <p className="text-slate-400 font-medium">暂无快照版本</p>
              <p className="text-slate-500 text-sm mt-1">创建快照可随时回溯当前项目状态</p>
            </div>
          )}
          {snapshots.map((s, idx) => (
            <div
              key={s.id}
              className="group flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all hover:bg-slate-800"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/60">
                <span className="text-sm font-bold text-slate-300">#{snapshots.length - idx}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{s.name}</h3>
                  <span className="text-[10px] text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-500/20">版本</span>
                </div>
                {s.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.description}</p>}
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <Clock size={10} />
                  {formatDate(s.createdAt, 'YYYY-MM-DD HH:mm:ss')}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={async () => {
                    if (!confirm(`确定恢复到版本「${s.name}」？当前进度将被覆盖！`)) return;
                    await restoreSnapshot(s.id);
                  }}
                  className="p-2 rounded-lg hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 transition-colors"
                  title="恢复此版本"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors"
                  title="下载快照数据"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify({ id: s.id, name: s.name, desc: s.description, time: s.createdAt }, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `snapshot-${s.name}-${s.createdAt.slice(0, 10)}.json`;
                    a.click();
                  }}
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('确定删除此快照？')) return;
                    await deleteSnapshot(s.id);
                  }}
                  className="p-2 rounded-lg hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title="删除快照"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center px-5 py-3 border-t border-slate-700/60 bg-slate-900/50">
          <p className="text-xs text-slate-500">共 <span className="text-slate-300 font-bold">{snapshots.length}</span> 个快照版本</p>
          <button
            onClick={() => set('showSnapshotModal', false)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnapshotModal;
