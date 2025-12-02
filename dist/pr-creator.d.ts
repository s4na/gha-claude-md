import * as github from '@actions/github';
import { ClaudeMdContent } from './types';
type GitHubClient = ReturnType<typeof github.getOctokit>;
export interface PRCreateOptions {
    branchPrefix: string;
    titleTemplate: string;
    claudeMdPath: string;
    newContent: string;
    updates: ClaudeMdContent[];
}
export interface PRCreateResult {
    prUrl: string;
    branchName: string;
}
export declare function createPullRequest(octokit: GitHubClient, options: PRCreateOptions): Promise<PRCreateResult | null>;
export declare function checkExistingPR(octokit: GitHubClient, branchPrefix: string): Promise<string | null>;
export {};
