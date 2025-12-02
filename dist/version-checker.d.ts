import { Octokit } from '@octokit/rest';
import { ActionConfig, ActionVersion } from './types';
export declare function getLatestVersion(octokit: Octokit, action: ActionConfig): Promise<ActionVersion | null>;
export declare function parseActions(input: string): ActionConfig[];
