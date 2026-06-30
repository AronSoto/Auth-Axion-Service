import { createHash } from 'crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';

// zxcvbn scores 0–4; require "safely unguessable" or better.
const MIN_SCORE = 3;
const HIBP_TIMEOUT_MS = 2500;

/**
 * Rejects weak or breached passwords. Used on register and password reset.
 * The breach check uses HaveIBeenPwned's k-anonymity API — only the first 5
 * chars of the SHA-1 hash ever leave the server — and fails open if HIBP is down.
 */
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);
  private readonly zxcvbn = new ZxcvbnFactory({
    dictionary: { ...zxcvbnCommon.dictionary },
    graphs: zxcvbnCommon.adjacencyGraphs,
  });

  async assertAcceptable(
    password: string,
    userInputs: string[] = [],
  ): Promise<void> {
    const { score, feedback } = this.zxcvbn.check(password, userInputs);
    if (score < MIN_SCORE) {
      const hint =
        feedback.warning ||
        feedback.suggestions[0] ||
        'Choose a longer, less predictable password.';
      throw new BadRequestException(`Password is too weak. ${hint}`);
    }

    if (await this.isBreached(password)) {
      throw new BadRequestException(
        'This password has appeared in a known data breach. Choose a different one.',
      );
    }
  }

  private async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const res = await fetch(
        `https://api.pwnedpasswords.com/range/${prefix}`,
        {
          signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
          headers: { 'Add-Padding': 'true' },
        },
      );
      if (!res.ok) return false;
      const body = await res.text();
      return body
        .split('\n')
        .some((line) => line.split(':')[0]?.trim() === suffix);
    } catch (err) {
      // Fail open: never block a user because HIBP is unreachable.
      this.logger.warn(
        `HIBP breach check skipped: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return false;
    }
  }
}
