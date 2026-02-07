import type { MoveTaskArgs } from "@doist/todoist-api-typescript";

export type Project = { id: string; name: string };
export type Section = { id: string; name: string; projectId: string };

export type ResolveMoveTargetInput = {
  projectName?: string;
  sectionName?: string;
  parentId?: string;
};

export type ResolveMoveTargetResult =
  | { ok: true; args: MoveTaskArgs; resolved: { projectId?: string; sectionId?: string; parentId?: string } }
  | { ok: false; error: string };

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function findBestNameMatch<T extends { name: string }>(
  items: T[],
  query: string
): T | undefined {
  const q = normalize(query);
  const exact = items.find((i) => normalize(i.name) === q);
  if (exact) return exact;
  return items.find((i) => normalize(i.name).includes(q));
}

export function resolveMoveTarget(
  input: ResolveMoveTargetInput,
  projects: Project[],
  sections: Section[]
): ResolveMoveTargetResult {
  const { projectName, sectionName, parentId } = input;

  if (!projectName && !sectionName && !parentId) {
    return { ok: false, error: "Must specify --project, --section, or --parent" };
  }

  if (parentId) {
    return { ok: true, args: { parentId }, resolved: { parentId } };
  }

  let projectId: string | undefined;
  if (projectName) {
    const project = findBestNameMatch(projects, projectName);
    if (!project) {
      return { ok: false, error: `Project not found: ${projectName}` };
    }
    projectId = project.id;
  }

  if (sectionName) {
    const candidateSections = projectId
      ? sections.filter((s) => s.projectId === projectId)
      : sections;

    const matches = candidateSections.filter(
      (s) => normalize(s.name) === normalize(sectionName)
    );

    if (!projectId && matches.length > 1) {
      return {
        ok: false,
        error: `Multiple sections named '${sectionName}'. Pass --project to disambiguate.`,
      };
    }

    const section =
      matches[0] ?? findBestNameMatch(candidateSections, sectionName);

    if (!section) {
      return { ok: false, error: `Section not found: ${sectionName}` };
    }

    return {
      ok: true,
      args: { sectionId: section.id },
      resolved: { projectId, sectionId: section.id },
    };
  }

  if (projectId) {
    return { ok: true, args: { projectId }, resolved: { projectId } };
  }

  return { ok: false, error: "Must specify --project, --section, or --parent" };
}
