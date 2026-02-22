/**
 * Multi-agent system - Specialized AI agents for different tasks
 */

import { Agent, AgentRole } from './types';
import { ARCHITECT_PROMPT } from './prompts/architect';
import { CODER_PROMPT } from './prompts/coder';
import { DEBUGGER_PROMPT } from './prompts/debugger';
import { DESIGNER_PROMPT } from './prompts/designer';
import { TESTER_PROMPT } from './prompts/tester';

/**
 * All available agents with their configurations
 */
export const AGENTS: Record<AgentRole, Agent> = {
  architect: {
    role: 'architect',
    name: 'Architect',
    description: 'Plans structure and design patterns',
    systemPrompt: ARCHITECT_PROMPT,
    model: 'stepfun/step-3.5-flash:free', // Reliable fallback model
    temperature: 0.1,
    icon: 'architect',
    color: 'text-blue-400',
  },
  coder: {
    role: 'coder',
    name: 'Coder',
    description: 'Fast code generation',
    systemPrompt: CODER_PROMPT,
    model: 'stepfun/step-3.5-flash:free', // Reliable fallback model
    temperature: 0.2,
    icon: 'coder',
    color: 'text-green-400',
  },
  debugger: {
    role: 'debugger',
    name: 'Debugger',
    description: 'Error analysis and fixes',
    systemPrompt: DEBUGGER_PROMPT,
    model: 'stepfun/step-3.5-flash:free', // Reliable fallback model
    temperature: 0.1,
    icon: 'debugger',
    color: 'text-red-400',
  },
  designer: {
    role: 'designer',
    name: 'Designer',
    description: 'UI/UX focused implementation',
    systemPrompt: DESIGNER_PROMPT,
    model: 'stepfun/step-3.5-flash:free', // Reliable fallback model
    temperature: 0.3,
    icon: 'designer',
    color: 'text-purple-400',
  },
  tester: {
    role: 'tester',
    name: 'Tester',
    description: 'Test generation and QA',
    systemPrompt: TESTER_PROMPT,
    model: 'stepfun/step-3.5-flash:free', // Reliable fallback model
    temperature: 0.2,
    icon: 'tester',
    color: 'text-amber-400',
  },
};

/**
 * Get agent by role
 */
export function getAgent(role: AgentRole): Agent {
  return AGENTS[role];
}

/**
 * Get all agent roles
 */
export function getAllAgentRoles(): AgentRole[] {
  return Object.keys(AGENTS) as AgentRole[];
}

export * from './types';
export * from './router';
