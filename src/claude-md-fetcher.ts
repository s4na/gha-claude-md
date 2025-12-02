import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { ActionConfig, ActionVersion, ClaudeMdContent } from './types';

export async function fetchClaudeMd(
  octokit: Octokit,
  actionVersion: ActionVersion
): Promise<ClaudeMdContent | null> {
  const { action, latestTag } = actionVersion;

  try {
    const { data } = await octokit.repos.getContent({
      owner: action.owner,
      repo: action.repo,
      path: action.claudeMdPath,
      ref: latestTag,
    });

    if (Array.isArray(data)) {
      core.warning(
        `${action.claudeMdPath} is a directory in ${action.owner}/${action.repo}`
      );
      return null;
    }

    if (data.type !== 'file') {
      core.warning(
        `${action.claudeMdPath} is not a file in ${action.owner}/${action.repo}`
      );
      return null;
    }

    // Content is base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return {
      action,
      version: latestTag,
      content,
    };
  } catch (error: unknown) {
    if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
      core.info(
        `CLAUDE.md not found in ${action.owner}/${action.repo}@${latestTag}`
      );
    } else {
      core.warning(
        `Failed to fetch CLAUDE.md from ${action.owner}/${action.repo}@${latestTag}: ${error}`
      );
    }
    return null;
  }
}

export function mergeClaudeMdContent(
  existingContent: string | null,
  updates: ClaudeMdContent[]
): string {
  const START_MARKER = '<!-- gha-claude-md:start -->';
  const END_MARKER = '<!-- gha-claude-md:end -->';

  let userContent = '';

  if (existingContent) {
    const startIndex = existingContent.indexOf(START_MARKER);
    const endIndex = existingContent.indexOf(END_MARKER);

    if (startIndex !== -1 && endIndex !== -1) {
      // Extract user content (before the managed section)
      userContent = existingContent.substring(0, startIndex).trim();
    } else {
      // No managed section yet, all content is user content
      userContent = existingContent.trim();
    }
  }

  // Build new managed content
  const managedSections: string[] = [];

  for (const update of updates) {
    const actionName = `${update.action.owner}/${update.action.repo}`;
    const sectionMarker = `<!-- gha-claude-md:action:${actionName} -->`;
    const sectionEndMarker = `<!-- gha-claude-md:action:${actionName}:end -->`;

    const section = `
${sectionMarker}
## From ${actionName}@${update.version}

${update.content.trim()}

${sectionEndMarker}`;

    managedSections.push(section);
  }

  // Combine everything
  const parts: string[] = [];

  if (userContent) {
    parts.push(userContent);
  }

  if (managedSections.length > 0) {
    if (parts.length > 0) {
      parts.push('\n---\n');
    }
    parts.push(START_MARKER);
    parts.push(managedSections.join('\n'));
    parts.push(`\n${END_MARKER}`);
  }

  return parts.join('\n');
}

export function extractExistingSections(
  content: string
): Map<string, { version: string; content: string }> {
  const sections = new Map<string, { version: string; content: string }>();
  const START_MARKER = '<!-- gha-claude-md:start -->';
  const END_MARKER = '<!-- gha-claude-md:end -->';

  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    return sections;
  }

  const managedContent = content.substring(
    startIndex + START_MARKER.length,
    endIndex
  );

  // Parse individual action sections
  const actionSectionRegex =
    /<!-- gha-claude-md:action:([^>]+) -->\n## From ([^@]+)@([^\n]+)\n([\s\S]*?)<!-- gha-claude-md:action:\1:end -->/g;

  let match;
  while ((match = actionSectionRegex.exec(managedContent)) !== null) {
    const actionName = match[1];
    const version = match[3].trim();
    const sectionContent = match[4].trim();

    sections.set(actionName, { version, content: sectionContent });
  }

  return sections;
}
