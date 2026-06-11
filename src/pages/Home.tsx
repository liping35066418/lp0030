import { useEffect, useState } from 'react';
import { useGanttStore } from '@/store/ganttStore';
import ProjectList from '@/components/gantt/ProjectList';
import GanttChart from '@/components/gantt/GanttChart';
import ProjectModal from '@/components/gantt/ProjectModal';
import Toast from '@/components/gantt/Toast';

export default function Home() {
  const { currentProject, fetchProjectDetail, fetchProjects } = useGanttStore();
  const [view, setView] = useState<'list' | 'gantt'>('list');

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleOpen = async (id: string) => {
    await fetchProjectDetail(id);
    setView('gantt');
  };

  const handleBack = () => {
    setView('list');
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950">
      {view === 'list' && <ProjectList onOpenProject={handleOpen} />}
      {view === 'gantt' && <GanttChart onBackToList={handleBack} />}
      <ProjectModal />
      <Toast />
    </div>
  );
}