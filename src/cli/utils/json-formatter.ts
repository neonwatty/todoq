import chalk from 'chalk';

/**
 * Format tool input JSON for better readability in verbose output
 */
export function formatToolInput(toolName: string, input: any): string {
  try {
    // Handle null/undefined
    if (input === null) return 'null';
    if (input === undefined) return 'undefined';
    
    switch (toolName) {
      case 'TodoWrite':
        return formatTodoWrite(input);
      case 'Read':
        return formatRead(input);
      case 'Bash':
        return formatBash(input);
      case 'Edit':
      case 'MultiEdit':
        return formatEdit(input);
      case 'Write':
        return formatWrite(input);
      case 'Grep':
        return formatGrep(input);
      case 'Glob':
        return formatGlob(input);
      case 'WebFetch':
      case 'WebSearch':
        return formatWeb(input);
      default:
        return formatGeneric(input);
    }
  } catch (error) {
    // Handle circular references and other JSON.stringify errors
    try {
      // Try with a replacer to handle circular refs
      const seen = new WeakSet();
      return JSON.stringify(input, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      }, 2);
    } catch {
      // Last resort fallback
      return String(input);
    }
  }
}

/**
 * Format TodoWrite tool input as a readable task list
 */
function formatTodoWrite(input: any): string {
  const lines: string[] = [];
  
  if (input.todos && Array.isArray(input.todos)) {
    const todos = input.todos;
    lines.push(chalk.cyan(`\n  📝 Todos (${todos.length} items):`));
    
    todos.forEach((todo: any) => {
      const statusIcon = getStatusIcon(todo.status);
      const statusColor = getStatusColor(todo.status);
      const taskText = todo.activeForm || todo.content;
      lines.push(chalk[statusColor](`    ${statusIcon} ${taskText}`));
    });
  } else {
    lines.push(formatGeneric(input));
  }
  
  return lines.join('\n');
}

/**
 * Format Read tool input
 */
function formatRead(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.file_path) {
    lines.push(chalk.blue(`  📁 File: ${input.file_path}`));
  }
  if (input.limit) {
    lines.push(chalk.gray(`  📏 Limit: ${input.limit} lines`));
  }
  if (input.offset) {
    lines.push(chalk.gray(`  📍 Offset: line ${input.offset}`));
  }
  
  return lines.join('\n');
}

/**
 * Format Bash tool input
 */
function formatBash(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.command) {
    const truncatedCommand = truncateString(input.command, 100);
    lines.push(chalk.yellow(`  💻 Command: ${truncatedCommand}`));
  }
  if (input.description) {
    lines.push(chalk.gray(`  📝 ${input.description}`));
  }
  if (input.timeout) {
    lines.push(chalk.gray(`  ⏱️  Timeout: ${input.timeout}ms`));
  }
  if (input.run_in_background) {
    lines.push(chalk.magenta(`  🔄 Running in background`));
  }
  
  return lines.join('\n');
}

/**
 * Format Edit/MultiEdit tool input
 */
function formatEdit(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.file_path) {
    lines.push(chalk.blue(`  📁 File: ${input.file_path}`));
  }
  
  if (input.edits && Array.isArray(input.edits)) {
    // MultiEdit
    lines.push(chalk.cyan(`  ✏️  ${input.edits.length} edits to apply`));
    input.edits.forEach((edit: any, index: number) => {
      const oldPreview = truncateString(edit.old_string, 30);
      const newPreview = truncateString(edit.new_string, 30);
      lines.push(chalk.gray(`    ${index + 1}. "${oldPreview}" → "${newPreview}"`));
      if (edit.replace_all) {
        lines.push(chalk.yellow(`       (replace all occurrences)`));
      }
    });
  } else {
    // Single Edit
    if (input.old_string) {
      lines.push(chalk.red(`  ➖ Old: ${truncateString(input.old_string, 50)}`));
    }
    if (input.new_string) {
      lines.push(chalk.green(`  ➕ New: ${truncateString(input.new_string, 50)}`));
    }
    if (input.replace_all) {
      lines.push(chalk.yellow(`  🔁 Replace all occurrences`));
    }
  }
  
  return lines.join('\n');
}

/**
 * Format Write tool input
 */
function formatWrite(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.file_path) {
    lines.push(chalk.blue(`  📁 File: ${input.file_path}`));
  }
  if (input.content) {
    const lineCount = input.content.split('\n').length;
    const preview = truncateString(input.content, 100);
    lines.push(chalk.gray(`  📝 Content: ${lineCount} lines`));
    lines.push(chalk.dim(`     Preview: ${preview}`));
  }
  
  return lines.join('\n');
}

/**
 * Format Grep tool input
 */
function formatGrep(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.pattern) {
    lines.push(chalk.yellow(`  🔍 Pattern: ${truncateString(input.pattern, 50)}`));
  }
  if (input.path) {
    lines.push(chalk.blue(`  📂 Path: ${input.path}`));
  }
  if (input.glob) {
    lines.push(chalk.gray(`  🎯 Glob: ${input.glob}`));
  }
  if (input.type) {
    lines.push(chalk.gray(`  📄 Type: ${input.type}`));
  }
  if (input.output_mode) {
    lines.push(chalk.gray(`  📊 Mode: ${input.output_mode}`));
  }
  
  const flags: string[] = [];
  if (input['-i']) flags.push('case-insensitive');
  if (input['-n']) flags.push('line-numbers');
  if (input.multiline) flags.push('multiline');
  if (flags.length > 0) {
    lines.push(chalk.gray(`  🚩 Flags: ${flags.join(', ')}`));
  }
  
  return lines.join('\n');
}

/**
 * Format Glob tool input
 */
function formatGlob(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.pattern) {
    lines.push(chalk.yellow(`  🎯 Pattern: ${input.pattern}`));
  }
  if (input.path) {
    lines.push(chalk.blue(`  📂 Path: ${input.path}`));
  }
  
  return lines.join('\n');
}

/**
 * Format WebFetch/WebSearch tool input
 */
function formatWeb(input: any): string {
  const lines: string[] = [];
  lines.push('');
  
  if (input.url) {
    lines.push(chalk.blue(`  🌐 URL: ${truncateString(input.url, 80)}`));
  }
  if (input.query) {
    lines.push(chalk.yellow(`  🔍 Query: ${truncateString(input.query, 60)}`));
  }
  if (input.prompt) {
    lines.push(chalk.gray(`  💭 Prompt: ${truncateString(input.prompt, 100)}`));
  }
  if (input.allowed_domains && input.allowed_domains.length > 0) {
    lines.push(chalk.green(`  ✅ Allowed: ${input.allowed_domains.join(', ')}`));
  }
  if (input.blocked_domains && input.blocked_domains.length > 0) {
    lines.push(chalk.red(`  ❌ Blocked: ${input.blocked_domains.join(', ')}`));
  }
  
  return lines.join('\n');
}

/**
 * Format generic tool input as pretty JSON
 */
function formatGeneric(input: any): string {
  const formatted = JSON.stringify(input, null, 2);
  const lines = formatted.split('\n');
  return `\n${lines.map(line => `  ${line}`).join('\n')}`;
}

/**
 * Get status icon for todo items
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✅';
    case 'in_progress':
      return '🔄';
    case 'pending':
      return '⏳';
    case 'cancelled':
      return '❌';
    default:
      return '•';
  }
}

/**
 * Get chalk color for status
 */
function getStatusColor(status: string): 'green' | 'yellow' | 'gray' | 'red' {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in_progress':
      return 'yellow';
    case 'pending':
      return 'gray';
    case 'cancelled':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Truncate string with ellipsis
 */
function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  const cleaned = str.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.substring(0, maxLength - 3)}...`;
}