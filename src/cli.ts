#!/usr/bin/env node

/**
 * Todoist CLI - Built on the official @doist/todoist-api-typescript SDK
 */

import { Command } from "commander";
import { TodoistApi } from "@doist/todoist-api-typescript";
import {
  requireToken,
  saveToken,
  getToken,
  getConfigPath,
  clearToken,
  ExitCode,
} from "./config.js";
import { setNoColor, printError, printSuccess, style } from "./output.js";
import { moveTaskToTop } from "./task-ordering.js";

const VERSION = "0.1.0";

const program = new Command();

program
  .name("todoist")
  .description("Unofficial CLI for Todoist (using official TypeScript SDK)")
  .version(VERSION, "-V, --version", "Show version number")
  .option("--no-color", "Disable colored output")
  .configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str),
    outputError: (str, write) => write(str),
  })
  .exitOverride((err) => {
    if (
      err.code === "commander.missingArgument" ||
      err.code === "commander.unknownOption" ||
      err.code === "commander.invalidArgument" ||
      err.code === "commander.missingMandatoryOptionValue"
    ) {
      process.exit(ExitCode.InvalidUsage);
    }
    process.exit(err.exitCode);
  })
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts() as { color?: boolean };
    if (opts.color === false) {
      setNoColor(true);
    }
  });

// Helper to get API client
function getClient(): TodoistApi {
  return new TodoistApi(requireToken());
}

// Helper to format due
function formatDue(
  due: { string: string; date: string; isRecurring: boolean } | null
): string {
  if (!due) return "";
  if (due.isRecurring) {
    return `(${due.string})`;
  }
  return `(${due.string || due.date})`;
}

function resolveAddOrder(
  options: { top?: boolean; order?: string }
): "top" | undefined {
  const normalizedOrder = options.order?.trim().toLowerCase();
  if (options.top && normalizedOrder && normalizedOrder !== "top") {
    printError('Use either "--top" or "--order top".');
    process.exit(ExitCode.InvalidUsage);
  }

  const order = normalizedOrder ?? (options.top ? "top" : undefined);
  if (!order) return undefined;

  if (order !== "top") {
    printError(`Unsupported order: ${order}. Use "top".`);
    process.exit(ExitCode.InvalidUsage);
  }

  return "top";
}

// ============================================
// Auth Commands
// ============================================

program
  .command("auth [token]")
  .description("Authenticate with Todoist API")
  .action((token?: string) => {
    if (token) {
      saveToken(token);
      printSuccess(`Token saved to ${getConfigPath()}`);
    } else {
      const existing = getToken();
      if (existing) {
        printSuccess("Already authenticated");
        console.log(style.dim(`Config: ${getConfigPath()}`));
      } else {
        console.log("Not authenticated.");
        console.log("");
        console.log("Usage: todoist auth <your-api-token>");
        console.log(
          `Get token at: ${style.cyan("https://todoist.com/app/settings/integrations/developer")}`
        );
      }
    }
  });

program
  .command("logout")
  .description("Clear stored credentials")
  .action(() => {
    clearToken();
    printSuccess("Credentials cleared.");
  });

// ============================================
// Task Commands
// ============================================

program
  .command("today", { isDefault: true })
  .description("Show today's tasks")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const api = getClient();
    try {
      const response = await api.getTasksByFilter({ query: "today | overdue" });
      const tasks = response.results;

      if (options.json) {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (tasks.length === 0) {
        console.log("No tasks for today! 🎉");
        return;
      }

      for (const task of tasks) {
        const due = formatDue(task.due);
        const indent = task.parentId ? "  " : "";
        console.log(
          `${indent}${style.dim(task.id)}  ${task.content} ${style.dim(due)}`
        );
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("tasks")
  .description("List tasks")
  .option("-p, --project <name>", "Filter by project name")
  .option(
    "-f, --filter <query>",
    "Filter query (e.g., 'p1', 'overdue', 'today')"
  )
  .option("--all", "Show all tasks")
  .option("--json", "Output as JSON")
  .action(
    async (options: {
      project?: string;
      filter?: string;
      all?: boolean;
      json?: boolean;
    }) => {
      const api = getClient();
      try {
        let tasks;

        if (options.filter) {
          const response = await api.getTasksByFilter({ query: options.filter });
          tasks = response.results;
        } else if (options.project) {
          const projectsResponse = await api.getProjects();
          const project = projectsResponse.results.find((p) =>
            p.name.toLowerCase().includes(options.project!.toLowerCase())
          );
          if (!project) {
            printError(`Project not found: ${options.project}`);
            process.exit(ExitCode.Failure);
          }
          const response = await api.getTasks({ projectId: project.id });
          tasks = response.results;
        } else if (options.all) {
          const response = await api.getTasks();
          tasks = response.results;
        } else {
          const response = await api.getTasksByFilter({
            query: "today | overdue",
          });
          tasks = response.results;
        }

        if (options.json) {
          console.log(JSON.stringify(tasks, null, 2));
          return;
        }

        if (tasks.length === 0) {
          console.log("No tasks found.");
          return;
        }

        for (const task of tasks) {
          const due = formatDue(task.due);
          const indent = task.parentId ? "  " : "";
          console.log(
            `${indent}${style.dim(task.id)}  ${task.content} ${style.dim(due)}`
          );
        }
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(ExitCode.Failure);
      }
    }
  );

program
  .command("add <content...>")
  .description("Add a new task")
  .option("-d, --due <date>", "Due date (e.g., 'tomorrow', 'next monday')")
  .option("-p, --project <name>", "Project name")
  .option("-P, --priority <n>", "Priority 1-4 (1=highest)", parseInt)
  .option(
    "-l, --label <name>",
    "Add label (can repeat)",
    (val, prev: string[]) => [...prev, val],
    []
  )
  .option("--top", "Insert task at the top of its project/section")
  .option("--order <position>", "Insert task at a specific position (top)")
  .option("--parent <id>", "Parent task ID (creates sub-task)")
  .option("--description <text>", "Task description")
  .option("--json", "Output as JSON")
  .action(async (content: string[], options) => {
    const token = requireToken();
    const api = new TodoistApi(token);
    try {
      const taskContent = content.join(" ");
      const order = resolveAddOrder(options);

      const args: Parameters<typeof api.addTask>[0] = {
        content: taskContent,
      };

      if (options.due) args.dueString = options.due;
      if (options.description) args.description = options.description;
      if (options.priority) args.priority = 5 - options.priority;
      if (options.label && options.label.length > 0) args.labels = options.label;
      if (options.parent) args.parentId = options.parent;

      if (options.project) {
        const projectsResponse = await api.getProjects();
        const project = projectsResponse.results.find((p) =>
          p.name.toLowerCase().includes(options.project.toLowerCase())
        );
        if (!project) {
          printError(`Project not found: ${options.project}`);
          process.exit(ExitCode.Failure);
        }
        args.projectId = project.id;
      }

      const task = await api.addTask(args);
      if (order === "top") {
        await moveTaskToTop(api, token, task);
      }

      if (options.json) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      printSuccess(`Added: ${task.content}`);
      console.log(style.dim(`  ID: ${task.id}`));
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("done <taskId>")
  .alias("complete")
  .description("Complete a task")
  .action(async (taskId: string) => {
    const api = getClient();
    try {
      await api.closeTask(taskId);
      printSuccess("Task completed");
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("reopen <taskId>")
  .description("Reopen a completed task")
  .action(async (taskId: string) => {
    const api = getClient();
    try {
      await api.reopenTask(taskId);
      printSuccess("Task reopened");
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("view <taskId>")
  .description("View task details")
  .option("--json", "Output as JSON")
  .action(async (taskId: string, options: { json?: boolean }) => {
    const api = getClient();
    try {
      const task = await api.getTask(taskId);

      if (options.json) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      console.log(`${style.bold("ID:")}       ${task.id}`);
      console.log(`${style.bold("Content:")}  ${task.content}`);
      if (task.description)
        console.log(`${style.bold("Desc:")}     ${task.description}`);
      if (task.due)
        console.log(`${style.bold("Due:")}      ${task.due.string || task.due.date}`);
      if (task.priority > 1)
        console.log(`${style.bold("Priority:")} p${5 - task.priority}`);
      if (task.labels.length > 0)
        console.log(`${style.bold("Labels:")}   ${task.labels.join(", ")}`);
      if (task.parentId)
        console.log(`${style.bold("Parent:")}   ${task.parentId}`);
      console.log(`${style.bold("URL:")}      ${task.url}`);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("update <taskId>")
  .description("Update a task")
  .option("--content <text>", "New content")
  .option("-d, --due <date>", "New due date")
  .option("-P, --priority <n>", "New priority 1-4", parseInt)
  .option("--description <text>", "New description")
  .option("--json", "Output as JSON")
  .action(async (taskId: string, options) => {
    const api = getClient();
    try {
      const args: Parameters<typeof api.updateTask>[1] = {};

      if (options.content) args.content = options.content;
      if (options.due) args.dueString = options.due;
      if (options.description) args.description = options.description;
      if (options.priority) args.priority = 5 - options.priority;

      const task = await api.updateTask(taskId, args);

      if (options.json) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      printSuccess(`Updated: ${task.content}`);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("move <taskId>")
  .description("Move task to different project/section/parent")
  .option("-p, --project <name>", "Target project name")
  .option("-s, --section <name>", "Target section name")
  .option("--parent <id>", "Target parent task ID (make sub-task)")
  .action(async (taskId: string, options) => {
    const api = getClient();
    try {
      let projectId: string | undefined;
      let sectionId: string | undefined;
      let parentId: string | undefined;

      if (options.project) {
        const projectsResponse = await api.getProjects();
        const project = projectsResponse.results.find((p) =>
          p.name.toLowerCase().includes(options.project.toLowerCase())
        );
        if (!project) {
          printError(`Project not found: ${options.project}`);
          process.exit(ExitCode.Failure);
        }
        projectId = project.id;
      }

      if (options.section) {
        const sectionsResponse = await api.getSections();
        const section = sectionsResponse.results.find((s) =>
          s.name.toLowerCase().includes(options.section.toLowerCase())
        );
        if (!section) {
          printError(`Section not found: ${options.section}`);
          process.exit(ExitCode.Failure);
        }
        sectionId = section.id;
      }

      if (options.parent) {
        parentId = options.parent;
      }

      if (!projectId && !sectionId && !parentId) {
        printError("Must specify --project, --section, or --parent");
        process.exit(ExitCode.InvalidUsage);
      }

      let task;
      if (projectId) {
        task = await api.moveTask(taskId, { projectId });
      } else if (sectionId) {
        task = await api.moveTask(taskId, { sectionId });
      } else if (parentId) {
        task = await api.moveTask(taskId, { parentId });
      }

      printSuccess(`Moved: ${task!.content}`);
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("delete <taskId>")
  .description("Delete a task")
  .option("-f, --force", "Skip confirmation")
  .action(async (taskId: string, options: { force?: boolean }) => {
    const api = getClient();
    try {
      const task = await api.getTask(taskId);

      if (!options.force) {
        console.log(`Deleting: ${task.content}`);
      }

      await api.deleteTask(taskId);
      printSuccess("Deleted");
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("search <query...>")
  .description("Search tasks")
  .option("--json", "Output as JSON")
  .action(async (query: string[], options: { json?: boolean }) => {
    const api = getClient();
    try {
      const response = await api.getTasksByFilter({
        query: `search: ${query.join(" ")}`,
      });
      const tasks = response.results;

      if (options.json) {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (tasks.length === 0) {
        console.log("No tasks found.");
        return;
      }

      for (const task of tasks) {
        const due = formatDue(task.due);
        console.log(
          `${style.dim(task.id)}  ${task.content} ${style.dim(due)}`
        );
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

// ============================================
// Project Commands
// ============================================

program
  .command("projects")
  .description("List projects")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const api = getClient();
    try {
      const response = await api.getProjects();
      const projects = response.results;

      if (options.json) {
        console.log(JSON.stringify(projects, null, 2));
        return;
      }

      for (const project of projects) {
        const inbox =
          "inboxProject" in project && project.inboxProject
            ? style.dim(" (Inbox)")
            : "";
        console.log(`${style.dim(project.id)}  ${project.name}${inbox}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("project-add <name>")
  .description("Create a new project")
  .option("--color <color>", "Project color")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { color?: string; json?: boolean }) => {
    const api = getClient();
    try {
      const args: Parameters<typeof api.addProject>[0] = { name };
      if (options.color)
        args.color = options.color as Parameters<
          typeof api.addProject
        >[0]["color"];

      const project = await api.addProject(args);

      if (options.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }

      printSuccess(`Created project: ${project.name}`);
      console.log(style.dim(`  ID: ${project.id}`));
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

// ============================================
// Section Commands
// ============================================

program
  .command("sections")
  .description("List sections")
  .option("-p, --project <name>", "Filter by project")
  .option("--json", "Output as JSON")
  .action(async (options: { project?: string; json?: boolean }) => {
    const api = getClient();
    try {
      const args: Parameters<typeof api.getSections>[0] = {};

      if (options.project) {
        const projectsResponse = await api.getProjects();
        const project = projectsResponse.results.find((p) =>
          p.name.toLowerCase().includes(options.project!.toLowerCase())
        );
        if (!project) {
          printError(`Project not found: ${options.project}`);
          process.exit(ExitCode.Failure);
        }
        args.projectId = project.id;
      }

      const response = await api.getSections(args);
      const sections = response.results;

      if (options.json) {
        console.log(JSON.stringify(sections, null, 2));
        return;
      }

      if (sections.length === 0) {
        console.log("No sections found.");
        return;
      }

      for (const section of sections) {
        console.log(`${style.dim(section.id)}  ${section.name}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("section-add <name>")
  .description("Create a new section")
  .requiredOption("-p, --project <name>", "Project name")
  .option("--json", "Output as JSON")
  .action(
    async (name: string, options: { project: string; json?: boolean }) => {
      const api = getClient();
      try {
        const projectsResponse = await api.getProjects();
        const project = projectsResponse.results.find((p) =>
          p.name.toLowerCase().includes(options.project.toLowerCase())
        );
        if (!project) {
          printError(`Project not found: ${options.project}`);
          process.exit(ExitCode.Failure);
        }

        const section = await api.addSection({ name, projectId: project.id });

        if (options.json) {
          console.log(JSON.stringify(section, null, 2));
          return;
        }

        printSuccess(`Created section: ${section.name}`);
        console.log(style.dim(`  ID: ${section.id}`));
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(ExitCode.Failure);
      }
    }
  );

// ============================================
// Label Commands
// ============================================

program
  .command("labels")
  .description("List labels")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const api = getClient();
    try {
      const response = await api.getLabels();
      const labels = response.results;

      if (options.json) {
        console.log(JSON.stringify(labels, null, 2));
        return;
      }

      if (labels.length === 0) {
        console.log("No labels found.");
        return;
      }

      for (const label of labels) {
        console.log(`${style.dim(label.id)}  ${label.name}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("label-add <name>")
  .description("Create a new label")
  .option("--color <color>", "Label color")
  .option("--json", "Output as JSON")
  .action(async (name: string, options: { color?: string; json?: boolean }) => {
    const api = getClient();
    try {
      const args: Parameters<typeof api.addLabel>[0] = { name };
      if (options.color)
        args.color = options.color as Parameters<typeof api.addLabel>[0]["color"];

      const label = await api.addLabel(args);

      if (options.json) {
        console.log(JSON.stringify(label, null, 2));
        return;
      }

      printSuccess(`Created label: ${label.name}`);
      console.log(style.dim(`  ID: ${label.id}`));
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

// ============================================
// Comment Commands
// ============================================

program
  .command("comments <taskId>")
  .description("List comments on a task")
  .option("--json", "Output as JSON")
  .action(async (taskId: string, options: { json?: boolean }) => {
    const api = getClient();
    try {
      const response = await api.getComments({ taskId });
      const comments = response.results;

      if (options.json) {
        console.log(JSON.stringify(comments, null, 2));
        return;
      }

      if (comments.length === 0) {
        console.log("No comments.");
        return;
      }

      for (const comment of comments) {
        console.log(`${style.dim(comment.id)}  ${comment.content}`);
      }
    } catch (error) {
      printError(error instanceof Error ? error.message : String(error));
      process.exit(ExitCode.Failure);
    }
  });

program
  .command("comment <taskId> <content...>")
  .description("Add a comment to a task")
  .option("--json", "Output as JSON")
  .action(
    async (
      taskId: string,
      content: string[],
      options: { json?: boolean }
    ) => {
      const api = getClient();
      try {
        const comment = await api.addComment({
          taskId,
          content: content.join(" "),
        });

        if (options.json) {
          console.log(JSON.stringify(comment, null, 2));
          return;
        }

        printSuccess("Comment added");
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(ExitCode.Failure);
      }
    }
  );

program.parse();
