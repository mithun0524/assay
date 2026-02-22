/**
 * Agent router - Determines which agent to use based on context
 */

import { AgentRole, AgentContext } from './types';

/**
 * Route to appropriate agent based on user message and context
 */
export function routeToAgent(userMessage: string, context: AgentContext): AgentRole {
  const lower = userMessage.toLowerCase();

  // Error patterns → debugger
  const errorPatterns = [
    /error/i,
    /fix/i,
    /bug/i,
    /broken/i,
    /doesn't work/i,
    /not working/i,
    /issue/i,
    /problem/i,
    /crash/i,
    /failed/i,
  ];

  if (errorPatterns.some((pattern) => pattern.test(lower)) || context.hasErrors) {
    return 'debugger';
  }

  // Design patterns → designer
  const designPatterns = [
    /style/i,
    /design/i,
    /look/i,
    /ui/i,
    /color/i,
    /layout/i,
    /beautiful/i,
    /modern/i,
    /responsive/i,
    /animation/i,
    /prettier/i,
    /better looking/i,
  ];

  if (designPatterns.some((pattern) => pattern.test(lower)) || context.hasImages) {
    return 'designer';
  }

  // Testing patterns → tester
  const testPatterns = [
    /test/i,
    /spec/i,
    /coverage/i,
    /quality/i,
    /verify/i,
  ];

  if (testPatterns.some((pattern) => pattern.test(lower))) {
    return 'tester';
  }

  // Planning patterns or initial project → architect
  const planningPatterns = [
    /plan/i,
    /structure/i,
    /architecture/i,
    /organize/i,
    /scaffold/i,
    /design pattern/i,
    /should I/i,
    /how to/i,
    /best way/i,
  ];

  // Check for simple greetings or non-code messages
  const greetingPatterns = [
    /^(hi|hey|hello|hola|greetings?|good\s*(morning|afternoon|evening))$/i,
    /^(het|test|testing)$/i,
    /^how are you/i,
    /^what's up/i,
  ];

  // If it's just a greeting and we have a project, use coder to modify it
  if (greetingPatterns.some((pattern) => pattern.test(lower.trim()))) {
    // If no project exists, still need architect to create something
    if (!context.hasProject || context.fileCount === 0) {
      return 'architect';
    }
    // If project exists, treat as a potential code modification
    return 'coder';
  }

  // Use architect for initial projects (no files yet)
  if (!context.hasProject || context.fileCount === 0) {
    return 'architect';
  }

  if (planningPatterns.some((pattern) => pattern.test(lower))) {
    return 'architect';
  }

  // Default → coder (for most implementation tasks)
  return 'coder';
}

/**
 * Get agent reasoning (why this agent was chosen)
 */
export function getAgentReasoning(role: AgentRole, context: AgentContext): string {
  switch (role) {
    case 'architect':
      if (!context.hasProject) {
        return 'Planning new project structure';
      }
      return 'Analyzing architecture and design patterns';

    case 'coder':
      return 'Implementing features and writing code';

    case 'debugger':
      return 'Analyzing and fixing errors';

    case 'designer':
      if (context.hasImages) {
        return 'Converting design to code';
      }
      return 'Improving UI and user experience';

    case 'tester':
      return 'Writing tests and ensuring quality';

    default:
      return 'Processing request';
  }
}
