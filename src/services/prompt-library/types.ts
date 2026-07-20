// PromptLibrary port. Every service that needs a prompt asks the library
// for it — never inlines a string. Prompts live in /prompts/*.md with
// YAML frontmatter and are versioned per file.

import type { ModelCapability } from "@/config/models";

export type PromptTemplate = {
  id: string;
  version: number;
  capability: ModelCapability;
  description: string;
  variables: string[];
  json: boolean;
  system: string;
  user: string;
};

export type RenderedPrompt = {
  id: string;
  version: number;
  capability: ModelCapability;
  json: boolean;
  system: string;
  user: string;
};

export interface PromptLibrary {
  get(id: string): Promise<PromptTemplate | null>;
  list(): Promise<PromptTemplate[]>;
  render(id: string, variables: Record<string, unknown>): Promise<RenderedPrompt>;
}
