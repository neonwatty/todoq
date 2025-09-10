import { describe, it, expect } from 'vitest';
import { formatToolInput } from '../../../../src/cli/utils/json-formatter.js';

describe('JSON Formatter', () => {
  describe('formatToolInput', () => {
    describe('TodoWrite formatting', () => {
      it('should format TodoWrite with multiple todos', () => {
        const input = {
          todos: [
            { content: 'Task 1', activeForm: 'Working on task 1', status: 'completed' },
            { content: 'Task 2', activeForm: 'Working on task 2', status: 'in_progress' },
            { content: 'Task 3', activeForm: 'Working on task 3', status: 'pending' },
            { content: 'Task 4', activeForm: 'Working on task 4', status: 'cancelled' }
          ]
        };
        
        const result = formatToolInput('TodoWrite', input);
        
        expect(result).toContain('📝 Todos (4 items)');
        expect(result).toContain('✅ Working on task 1');
        expect(result).toContain('🔄 Working on task 2');
        expect(result).toContain('⏳ Working on task 3');
        expect(result).toContain('❌ Working on task 4');
      });

      it('should use content when activeForm is missing', () => {
        const input = {
          todos: [
            { content: 'Task without activeForm', status: 'pending' }
          ]
        };
        
        const result = formatToolInput('TodoWrite', input);
        
        expect(result).toContain('⏳ Task without activeForm');
      });

      it('should handle empty todos array', () => {
        const input = { todos: [] };
        
        const result = formatToolInput('TodoWrite', input);
        
        expect(result).toContain('📝 Todos (0 items)');
      });

      it('should handle malformed TodoWrite input', () => {
        const input = { notTodos: 'invalid' };
        
        const result = formatToolInput('TodoWrite', input);
        
        // Should fall back to generic formatting
        expect(result).toContain('"notTodos"');
        expect(result).toContain('"invalid"');
      });
    });

    describe('Read formatting', () => {
      it('should format Read with all parameters', () => {
        const input = {
          file_path: '/path/to/file.ts',
          limit: 100,
          offset: 50
        };
        
        const result = formatToolInput('Read', input);
        
        expect(result).toContain('📁 File: /path/to/file.ts');
        expect(result).toContain('📏 Limit: 100 lines');
        expect(result).toContain('📍 Offset: line 50');
      });

      it('should format Read with only file path', () => {
        const input = {
          file_path: '/path/to/file.ts'
        };
        
        const result = formatToolInput('Read', input);
        
        expect(result).toContain('📁 File: /path/to/file.ts');
        expect(result).not.toContain('Limit');
        expect(result).not.toContain('Offset');
      });
    });

    describe('Bash formatting', () => {
      it('should format Bash with all parameters', () => {
        const input = {
          command: 'ls -la',
          description: 'List all files',
          timeout: 5000,
          run_in_background: true
        };
        
        const result = formatToolInput('Bash', input);
        
        expect(result).toContain('💻 Command: ls -la');
        expect(result).toContain('📝 List all files');
        expect(result).toContain('⏱️  Timeout: 5000ms');
        expect(result).toContain('🔄 Running in background');
      });

      it('should truncate long commands', () => {
        const longCommand = 'a'.repeat(150);
        const input = {
          command: longCommand,
          description: 'Long command test'
        };
        
        const result = formatToolInput('Bash', input);
        
        expect(result).toContain('💻 Command: ' + 'a'.repeat(97) + '...');
      });
    });

    describe('Edit formatting', () => {
      it('should format single Edit', () => {
        const input = {
          file_path: '/path/to/file.ts',
          old_string: 'const old = 1;',
          new_string: 'const new = 2;',
          replace_all: true
        };
        
        const result = formatToolInput('Edit', input);
        
        expect(result).toContain('📁 File: /path/to/file.ts');
        expect(result).toContain('➖ Old: const old = 1;');
        expect(result).toContain('➕ New: const new = 2;');
        expect(result).toContain('🔁 Replace all occurrences');
      });

      it('should truncate long strings in Edit', () => {
        const longString = 'x'.repeat(100);
        const input = {
          file_path: '/path/to/file.ts',
          old_string: longString,
          new_string: 'short'
        };
        
        const result = formatToolInput('Edit', input);
        
        expect(result).toContain('➖ Old: ' + 'x'.repeat(47) + '...');
        expect(result).toContain('➕ New: short');
      });
    });

    describe('MultiEdit formatting', () => {
      it('should format MultiEdit with multiple edits', () => {
        const input = {
          file_path: '/path/to/file.ts',
          edits: [
            { old_string: 'old1', new_string: 'new1', replace_all: false },
            { old_string: 'old2', new_string: 'new2', replace_all: true }
          ]
        };
        
        const result = formatToolInput('MultiEdit', input);
        
        expect(result).toContain('📁 File: /path/to/file.ts');
        expect(result).toContain('✏️  2 edits to apply');
        expect(result).toContain('1. "old1" → "new1"');
        expect(result).toContain('2. "old2" → "new2"');
        expect(result).toContain('(replace all occurrences)');
      });
    });

    describe('Write formatting', () => {
      it('should format Write with content preview', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const input = {
          file_path: '/path/to/file.ts',
          content: content
        };
        
        const result = formatToolInput('Write', input);
        
        expect(result).toContain('📁 File: /path/to/file.ts');
        expect(result).toContain('📝 Content: 3 lines');
        expect(result).toContain('Preview: Line 1\\nLine 2\\nLine 3');
      });

      it('should truncate long content preview', () => {
        const content = 'a'.repeat(200);
        const input = {
          file_path: '/path/to/file.ts',
          content: content
        };
        
        const result = formatToolInput('Write', input);
        
        expect(result).toContain('Preview: ' + 'a'.repeat(97) + '...');
      });
    });

    describe('Grep formatting', () => {
      it('should format Grep with all parameters', () => {
        const input = {
          pattern: 'search.*pattern',
          path: '/search/path',
          glob: '*.ts',
          type: 'typescript',
          output_mode: 'files_with_matches',
          '-i': true,
          '-n': true,
          multiline: true
        };
        
        const result = formatToolInput('Grep', input);
        
        expect(result).toContain('🔍 Pattern: search.*pattern');
        expect(result).toContain('📂 Path: /search/path');
        expect(result).toContain('🎯 Glob: *.ts');
        expect(result).toContain('📄 Type: typescript');
        expect(result).toContain('📊 Mode: files_with_matches');
        expect(result).toContain('🚩 Flags: case-insensitive, line-numbers, multiline');
      });
    });

    describe('Glob formatting', () => {
      it('should format Glob parameters', () => {
        const input = {
          pattern: '**/*.ts',
          path: '/src'
        };
        
        const result = formatToolInput('Glob', input);
        
        expect(result).toContain('🎯 Pattern: **/*.ts');
        expect(result).toContain('📂 Path: /src');
      });
    });

    describe('Web tools formatting', () => {
      it('should format WebFetch', () => {
        const input = {
          url: 'https://example.com/very/long/url/path/that/should/be/truncated',
          prompt: 'Extract information about...'
        };
        
        const result = formatToolInput('WebFetch', input);
        
        expect(result).toContain('🌐 URL: https://example.com/very/long/url/path/that/should/be/truncated');
        expect(result).toContain('💭 Prompt: Extract information about...');
      });

      it('should format WebSearch', () => {
        const input = {
          query: 'search query',
          allowed_domains: ['github.com', 'docs.com'],
          blocked_domains: ['spam.com']
        };
        
        const result = formatToolInput('WebSearch', input);
        
        expect(result).toContain('🔍 Query: search query');
        expect(result).toContain('✅ Allowed: github.com, docs.com');
        expect(result).toContain('❌ Blocked: spam.com');
      });
    });

    describe('Generic formatting', () => {
      it('should format unknown tools as pretty JSON', () => {
        const input = {
          someField: 'value',
          nested: {
            field: 123
          }
        };
        
        const result = formatToolInput('UnknownTool', input);
        
        expect(result).toContain('"someField": "value"');
        expect(result).toContain('"nested": {');
        expect(result).toContain('"field": 123');
        // Should be indented
        expect(result).toMatch(/  {/);
      });
    });

    describe('Error handling', () => {
      it('should handle null input gracefully', () => {
        const result = formatToolInput('SomeTool', null);
        
        expect(result).toBe('null');
      });

      it('should handle undefined input gracefully', () => {
        const result = formatToolInput('SomeTool', undefined);
        
        expect(result).toBeDefined();
      });

      it('should handle circular references', () => {
        const circular: any = { a: 1 };
        circular.self = circular;
        
        // Should not throw, falls back to simple stringify
        expect(() => formatToolInput('SomeTool', circular)).not.toThrow();
      });

      it('should handle string truncation with special characters', () => {
        const input = {
          command: 'command\nwith\nnewlines\rand\rcarriage\rreturns'
        };
        
        const result = formatToolInput('Bash', input);
        
        expect(result).toContain('\\n');
        expect(result).toContain('\\r');
        // The result will have a newline at the start for formatting
        const lines = result.split('\n');
        // Check that the command line itself doesn't have raw newlines
        const commandLine = lines.find(l => l.includes('Command:'));
        expect(commandLine).toBeDefined();
        expect(commandLine).not.toMatch(/Command:.*\n.*$/);
      });
    });
  });
});