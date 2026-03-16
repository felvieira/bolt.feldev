import { atom } from 'nanostores';

export interface Project {
  id: string;
  name: string;
  description?: string;
  visibility: 'private' | 'secret' | 'public';
  share_slug?: string;
  chat_id?: string;
  created_at: string;
  updated_at: string;
  hosting_provider?: string;
  deploy_status?: string;
  domain?: string;
  db_provider?: string;
}

export const projectsStore = atom<Project[]>([]);
export const activeProjectStore = atom<Project | null>(null);
export const projectsLoadingStore = atom(false);

export async function fetchProjects() {
  projectsLoadingStore.set(true);

  try {
    const res = await fetch('/api/projects');

    if (res.ok) {
      const data = await res.json();
      projectsStore.set(data);
    }
  } finally {
    projectsLoadingStore.set(false);
  }
}

export async function createProject(name: string, chatId?: string): Promise<Project | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, chatId }),
  });

  if (res.ok) {
    const project = await res.json();
    projectsStore.set([project, ...projectsStore.get()]);
    return project;
  }

  return null;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<boolean> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (res.ok) {
    const updated = await res.json();
    projectsStore.set(projectsStore.get().map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return true;
  }

  return false;
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });

  if (res.ok) {
    projectsStore.set(projectsStore.get().filter((p) => p.id !== id));
    return true;
  }

  return false;
}
