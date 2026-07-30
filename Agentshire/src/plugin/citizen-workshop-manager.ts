import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface WorkshopUserConfig {
  name: string;
  avatarUrl?: string;
  avatarId: string;
  modelSource: "builtin" | "library" | "custom";
}

export interface WorkshopStewardConfig {
  name: string;
  avatarUrl?: string;
  avatarId: string;
  modelSource: "builtin" | "library" | "custom";
  bio: string;
  persona: string;
  boundAgentId?: string;
}

export interface WorkshopCitizenConfig {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarId: string;
  modelSource: "builtin" | "library" | "custom";
  bio: string;
  industry: string;
  specialty: string;
  persona: string;
  homeId: string;
  boundAgentId?: string;
  boundSubAgentId?: string;
}

export interface CitizenWorkshopConfig {
  version: 1;
  user: WorkshopUserConfig;
  steward: WorkshopStewardConfig;
  citizens: WorkshopCitizenConfig[];
}

export class CitizenWorkshopManager {
  private configPath: string;
  private soulsDir: string;

  constructor(pluginDir: string) {
    const townDataDir = join(pluginDir, "town-data");
    this.configPath = join(townDataDir, "citizen-config.json");
    this.soulsDir = join(townDataDir, "souls");
    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!existsSync(this.soulsDir)) mkdirSync(this.soulsDir, { recursive: true });
  }

  loadConfig(): CitizenWorkshopConfig | null {
    if (!existsSync(this.configPath)) return null;
    try {
      return JSON.parse(readFileSync(this.configPath, "utf-8"));
    } catch {
      return null;
    }
  }

  saveConfig(config: CitizenWorkshopConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  saveSoul(name: string, content: string): void {
    const fileName = `${name.toUpperCase()}.md`;
    writeFileSync(join(this.soulsDir, fileName), content, "utf-8");
  }

  loadSoul(name: string): string | null {
    const fileName = `${name.toUpperCase()}.md`;
    const filePath = join(this.soulsDir, fileName);
    if (!existsSync(filePath)) return null;
    try {
      return readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  listSouls(): string[] {
    try {
      return readdirSync(this.soulsDir)
        .filter((f: string) => f.endsWith(".md"))
        .map((f: string) => f.replace(/\.md$/i, ""));
    } catch {
      return [];
    }
  }
}
