// @desc Central registry types for session ↔ project associations
//
// registry.json lives in .openclaw/ and tracks all projects (games + workspace apps).
// It is the single source of truth for:
//   - Server API endpoints (/projects, /sessions enrichment)
//   - Frontend project listing and session switching
//   - Future network service mapping (game sharing platform)
//
// Projects are keyed by their directory name (which already contains timestamp + random suffix).

export type ProjectType = 'game' | 'app';
export type ProjectStatus = 'active' | 'archived' | 'error';

export interface ProjectEntry {
  type: ProjectType;
  name: string;
  dir: string;
  template?: string;
  engine?: string;
  port?: number;
  vite: boolean;
  createdAt: string;
  sessionId: string;
  status: ProjectStatus;
  description?: string;
}

export interface Registry {
  version: number;
  projects: Record<string, ProjectEntry>;
  activeGameDir?: string;
}
