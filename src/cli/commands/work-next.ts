import { Command } from 'commander';
import chalk from 'chalk';
import { getClaudeService } from '../../services/claude/index.js';
import type { TodoqConfig } from '../../core/types.js';

export function registerWorkNextCommands(program: Command): void {
  program
    .command('work-next')
    .description('Work on next task using Claude')
    .argument('[directory]', 'project directory', process.cwd())
    .option('--test-timeout <ms>', 'execution timeout in milliseconds (900000-3600000)')
    .option('--max-iterations <num>', 'maximum Claude iterations (1-50)')
    .option('--max-turns <num>', 'maximum conversation turns (1-100)')
    .option('--model <model>', 'Claude model (sonnet|opus|opusplan|haiku)')
    .option('--output-format <format>', 'output format (text|json|stream-json)')
    .option('--permission-mode <mode>', 'permission handling (acceptEdits|bypassPermissions|default|plan)')
    .option('--dangerously-skip-permissions', 'skip permission prompts (dev mode)')
    .option('--continue-session', 'resume most recent conversation')
    .option('--skip-claude-check', 'skip Claude availability check')
    .action(async (directory, options, command) => {
      // Declare isVerbose at the outer scope so it's available in catch block
      let isVerbose = false;
      
      try {
        // Get configuration from command context
        const config = options._config as TodoqConfig;
        
        // Deep copy the config to avoid mutations
        const claudeConfigOverride = JSON.parse(JSON.stringify(config));
        
        // Ensure claude config exists with defaults from file config
        if (!claudeConfigOverride.claude) {
          claudeConfigOverride.claude = {};
        }

        // Apply command-line options only if they were explicitly provided
        // Commander sets undefined for options that weren't specified
        if (options.testTimeout !== undefined) {
          claudeConfigOverride.claude.testTimeout = parseInt(options.testTimeout);
        }
        if (options.maxIterations !== undefined) {
          claudeConfigOverride.claude.maxIterations = parseInt(options.maxIterations);
        }
        if (options.maxTurns !== undefined) {
          claudeConfigOverride.claude.maxTurns = parseInt(options.maxTurns);
        }
        if (options.model !== undefined) {
          claudeConfigOverride.claude.model = options.model;
        }
        if (options.outputFormat !== undefined) {
          claudeConfigOverride.claude.outputFormat = options.outputFormat;
        }
        if (options.permissionMode !== undefined) {
          claudeConfigOverride.claude.permissionMode = options.permissionMode;
        }
        
        // Check for verbose flag from either local or parent command
        const rootOptions = command.parent?.opts() || {};
        // Only override verbose if explicitly set via command line
        if (options.verbose === true || rootOptions.verbose === true) {
          claudeConfigOverride.claude.verbose = true;
        }
        
        // Boolean flags only override if explicitly set (will be true when flag is used)
        if (options.dangerouslySkipPermissions) {
          claudeConfigOverride.claude.dangerouslySkipPermissions = true;
        }
        if (options.continueSession) {
          claudeConfigOverride.claude.continueSession = true;
        }
        
        // Get Claude service instance with configuration
        const claudeService = getClaudeService(undefined, undefined, claudeConfigOverride);
        
        // Get the final verbose setting from the ClaudeService (after defaults are applied)
        isVerbose = claudeService.isVerbose();
        
        // Check Claude availability unless skipped
        if (!options.skipClaudeCheck) {
          if (isVerbose) {
            console.log(chalk.blue('Checking Claude availability...'));
          }
          
          const isAvailable = await claudeService.isAvailable();
          if (!isAvailable) {
            console.error(chalk.red('✗ Claude Code not available'));
            console.error(chalk.yellow('Please ensure Claude is installed and available in PATH'));
            console.error(chalk.yellow('Use --skip-claude-check to bypass this check'));
            process.exit(1);
          }
          
          if (isVerbose) {
            console.log(chalk.green('✓ Claude Code is available'));
          }
        }

        // Execute steps 1-3: Get next task
        if (isVerbose) {
          console.log(chalk.blue('Executing steps 1-3: Getting next task...'));
        }
        
        const context = await claudeService.executeTodoqGetNext(directory);
        
        console.log(chalk.green(`Working on task: ${context.taskJson.taskNumber} - ${context.taskJson.name}`));
        if (context.taskJson.description) {
          console.log(chalk.gray(`Description: ${context.taskJson.description}`));
        }
        console.log(chalk.blue(`Remaining tasks: ${context.remainingCount}`));
        console.log('');

        // Execute steps 4-8: Work on task with Claude
        if (isVerbose) {
          console.log(chalk.blue('Executing steps 4-8: Working on task with Claude...'));
        }
        
        const result = await claudeService.executeTodoqNextPrompt(context);
        
        if (result.success) {
          console.log(chalk.green('✓ Task work completed successfully'));
          console.log(chalk.gray(`Duration: ${Math.round(result.duration / 1000)}s`));
          
          if (result.taskNumber && result.taskName) {
            console.log(chalk.green(`✓ Completed: ${result.taskNumber} - ${result.taskName}`));
          }
          
          if (isVerbose && result.output) {
            console.log(chalk.gray('\n--- Claude Output ---'));
            console.log(result.output);
          }
        } else {
          console.error(chalk.red('✗ Task work failed'));
          
          // Check if this is a Claude-specific error
          if (result.error?.includes('exit code 143') || result.error?.includes('SIGTERM')) {
            console.error(chalk.yellow('\n⚠️  Claude Code Timeout (Exit Code 143)'));
            console.error(chalk.yellow('Claude was terminated, likely due to exceeding the timeout limit.'));
            console.error(chalk.gray('\nThis can happen when:'));
            console.error(chalk.gray('• The task is very complex or requires analyzing many files'));
            console.error(chalk.gray('• The system is under heavy load'));
            console.error(chalk.gray('• The timeout setting is too low for this task'));
            console.error(chalk.gray('\nPossible solutions:'));
            console.error(chalk.gray('• Increase timeout: todoq work-next --test-timeout 600000 (10 minutes)'));
            console.error(chalk.gray('• Break the task into smaller subtasks'));
            console.error(chalk.gray('• Run with --verbose to see where Claude gets stuck'));
            console.error(chalk.gray('• Check system resources with: free -h'));
          } else if (result.error?.includes('Claude Code exited with code')) {
            console.error(chalk.yellow('\n⚠️  Claude Code Error'));
            console.error(chalk.yellow(result.error));
            console.error(chalk.gray('\nThis indicates Claude encountered an issue during task execution.'));
            console.error(chalk.gray('Common causes: syntax errors, API limits, or task complexity.'));
            console.error(chalk.gray('Try running with --verbose for more details.'));
          } else {
            console.error(chalk.red(`Error: ${result.error}`));
          }
          
          console.error(chalk.gray(`\nDuration: ${Math.round(result.duration / 1000)}s`));
          
          if (isVerbose && result.output) {
            console.error(chalk.gray('\n--- Claude Output ---'));
            console.error(result.output);
          }
          
          process.exit(1);
        }
        
      } catch (error) {
        const err = error as Error;
        console.error(chalk.red('✗ Unexpected error:'), err.message);
        
        if (isVerbose && err.stack) {
          console.error(chalk.gray('\n--- Stack Trace ---'));
          console.error(err.stack);
        }
        
        process.exit(1);
      }
    });
}