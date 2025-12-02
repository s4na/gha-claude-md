export interface ActionConfig {
    owner: string;
    repo: string;
    claudeMdPath: string;
}
export interface ActionVersion {
    action: ActionConfig;
    latestVersion: string;
    latestTag: string;
}
export interface ClaudeMdContent {
    action: ActionConfig;
    version: string;
    content: string;
}
export interface ActionUpdate {
    action: ActionConfig;
    version: string;
    oldContent: string | null;
    newContent: string;
}
export interface Inputs {
    actions: string;
    claudeMdPath: string;
    githubToken: string;
    prBranchPrefix: string;
    prTitleTemplate: string;
}
export interface Outputs {
    prUrl: string | string[];
    updatedActions: string[];
}
