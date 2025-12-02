import * as core from '@actions/core';
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

export async function createPullRequest(
  octokit: GitHubClient,
  options: PRCreateOptions
): Promise<PRCreateResult | null> {
  const { owner, repo } = github.context.repo;

  // Generate branch name based on updates
  const actionNames = options.updates
    .map((u) => `${u.action.owner}-${u.action.repo}`)
    .join('-');
  const timestamp = Date.now();
  const branchName = `${options.branchPrefix}${actionNames}-${timestamp}`;

  try {
    // Get the default branch
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // Get the SHA of the default branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.object.sha;

    // Create a new branch
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
      core.info(`Created branch: ${branchName}`);
    } catch (error: unknown) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 422) {
        core.warning(`Branch ${branchName} already exists, skipping...`);
        return null;
      }
      throw error;
    }

    // Get the current file SHA if it exists
    let fileSha: string | undefined;
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: options.claudeMdPath,
        ref: defaultBranch,
      });
      if (!Array.isArray(fileData) && fileData.type === 'file') {
        fileSha = fileData.sha;
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && 'status' in error && (error as { status: number }).status === 404)) {
        throw error;
      }
      // File doesn't exist, that's fine
    }

    // Create or update the file
    const updateMessage = options.updates
      .map((u) => `${u.action.owner}/${u.action.repo}@${u.version}`)
      .join(', ');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: options.claudeMdPath,
      message: `Update CLAUDE.md from ${updateMessage}`,
      content: Buffer.from(options.newContent).toString('base64'),
      branch: branchName,
      sha: fileSha,
    });

    core.info(`Updated ${options.claudeMdPath} on branch ${branchName}`);

    // Generate PR title
    const prTitle = generatePRTitle(options.titleTemplate, options.updates);

    // Generate PR body
    const prBody = generatePRBody(options.updates);

    // Create the pull request
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: prBody,
      head: branchName,
      base: defaultBranch,
    });

    core.info(`Created PR: ${pr.html_url}`);

    return {
      prUrl: pr.html_url,
      branchName,
    };
  } catch (error) {
    core.error(`Failed to create PR: ${error}`);
    throw error;
  }
}

function generatePRTitle(template: string, updates: ClaudeMdContent[]): string {
  if (updates.length === 1) {
    const update = updates[0];
    return template
      .replace('{action}', `${update.action.owner}/${update.action.repo}`)
      .replace('{version}', update.version);
  }

  // Multiple updates
  const actionList = updates
    .map((u) => `${u.action.owner}/${u.action.repo}`)
    .join(', ');
  return `Update CLAUDE.md from multiple actions: ${actionList}`;
}

function generatePRBody(updates: ClaudeMdContent[]): string {
  const lines: string[] = [
    '## Summary',
    '',
    'This PR updates CLAUDE.md with the latest content from the following GitHub Actions:',
    '',
  ];

  for (const update of updates) {
    lines.push(
      `- **${update.action.owner}/${update.action.repo}** @ \`${update.version}\``
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    'This PR was automatically created by [gha-claude-md](https://github.com/s4na/gha-claude-md).'
  );

  return lines.join('\n');
}

export async function checkExistingPR(
  octokit: GitHubClient,
  branchPrefix: string
): Promise<string | null> {
  const { owner, repo } = github.context.repo;

  try {
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: 'open',
      per_page: 100,
    });

    const existingPR = prs.find((pr) => pr.head.ref.startsWith(branchPrefix));

    if (existingPR) {
      return existingPR.html_url;
    }

    return null;
  } catch (error) {
    core.warning(`Failed to check existing PRs: ${error}`);
    return null;
  }
}
