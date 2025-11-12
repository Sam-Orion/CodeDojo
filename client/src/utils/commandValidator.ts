interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

class CommandValidator {
  private maxLength = 10000;
  private blockedPatterns = [
    /rm\s+-rf\s+\/(?!tmp|home)/,
    /mkfs/,
    /dd\s+if=/,
    /:\(\)\{\s*:\|:&\s*\};:/,
    /fork\s*\(\s*\)/,
    /eval\s*\(/,
    /exec\s*\(/,
  ];

  validate(command: string): ValidationResult {
    if (!command || !command.trim()) {
      return {
        valid: false,
        error: 'Command cannot be empty',
      };
    }

    if (command.length > this.maxLength) {
      return {
        valid: false,
        error: `Command exceeds maximum length of ${this.maxLength} characters`,
      };
    }

    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          valid: false,
          error: 'Command contains restricted operations',
        };
      }
    }

    const warnings = this.getWarnings(command);

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private getWarnings(command: string): string[] {
    const warnings: string[] = [];

    if (command.includes('&&') && command.split('&&').length > 5) {
      warnings.push('Command chain is very long; consider breaking it up');
    }

    if (command.toLowerCase().includes('sudo')) {
      warnings.push('This command uses sudo; ensure you have the necessary permissions');
    }

    if (command.match(/>\s*\/dev\/null/)) {
      warnings.push('Output is being redirected to /dev/null; you may miss important errors');
    }

    return warnings;
  }
}

export default new CommandValidator();
