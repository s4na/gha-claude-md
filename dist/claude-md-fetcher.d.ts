import { Octokit } from '@octokit/rest';
import { ActionVersion, ClaudeMdContent } from './types';
export declare function fetchClaudeMd(octokit: Octokit, actionVersion: ActionVersion): Promise<ClaudeMdContent | null>;
export declare function mergeClaudeMdContent(existingContent: string | null, updates: ClaudeMdContent[]): string;
export declare function extractExistingSections(content: string): Map<string, {
    version: string;
    content: string;
}>;
