import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useGanttStore } from '@/store/ganttStore';
import { cn } from '@/lib/utils';

const Toast = () => {
  const { toast, set } = useGanttStore();
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-400" />,
    error: <AlertCircle size={18} className="text-rose-400" />,
    info: <Info size={18} className="text-blue-400" />,
  };
  const colors = {
    success: 'from-emerald-600/20 to-emerald-700/10 border-emerald-500/40',
    error: 'from-rose-600/20 to-rose-700/10 border-rose-500/40',
    info: 'from-blue-600/20 to-blue-700/10 border-blue-500/40',
  };

  return (
    <div className="fixed top-20 right-6 z-[100] pointer-events-none animate-in">
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl pointer-events-auto min-w-[280px]',
        'bg-gradient-to-r',
        colors[toast.type],
      )}>
        {icons[toast.type]}
        <p className="text-sm text-white font-medium flex-1">{toast.msg}</p>
        <button
          onClick={() => set('toast', null)}
          className="p-1 rounded hover:bg-white/10 text-slate-300"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
