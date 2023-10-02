/* eslint-disable no-console */

/**
 * Represents a minimalistic logging interface that HyTTS uses to report server-side errors. By
 * default, all output is logged to the console.
 */
export const log = {
    error: (error: string) => console.error(error),
    warn: (warning: string) => console.warn(warning),
    info: (message: string) => console.log(message),
};
