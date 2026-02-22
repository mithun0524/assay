/**
 * Multi-agent architecture types
 */

export type AgentRole = 'architect' | 'coder' | 'debugger' | 'designer' | 'tester';

export interface Agent {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  icon: string;
  color: string;
}

export interface AgentContext {
  hasProject: boolean;
  fileCount: number;
  hasErrors: boolean;
  lastMessage: string;
  hasImages: boolean;
}
