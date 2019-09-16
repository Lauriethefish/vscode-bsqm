import * as cp from "child_process";
import * as fs from "fs-extra";
import * as nunjucks from "nunjucks";
import * as path from "path";
import * as vscode from "vscode";
import { directoryIsEmpty, downlaodAndUnzip } from "./utils";

interface IModInfo {
    id: string;
    name: string;
    author: string;
    category: string;
    description: string[];
    url: string;
    out: string;
}

interface IGitSubmodule {
    path: string;
    url: string;
    branch?: string;
    commit?: string;
}

interface IModTemplate {
    toFill: string[];
    toDelete: string[];
    submodules: IGitSubmodule[];
}

export default async function create() {
    try {
        let validPath: boolean = false;
        let projectPath: string | undefined;
        let retry: boolean = true;
        do {
            // Open folder dialog to select project location
            const installPath:
                | vscode.Uri[]
                | undefined = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: "Select empty project folder",
            });

            // Check if path is valid
            validPath =
                installPath !== undefined &&
                (await directoryIsEmpty(installPath[0].fsPath));
            if (validPath && installPath !== undefined) {
                // Set project path
                projectPath = installPath[0].fsPath;
            } else if (installPath === undefined) {
                retry = false;
            } else {
                vscode.window.showErrorMessage("Folder must be empty.");
            }
        } while (!validPath && retry);

        if (validPath && projectPath !== undefined) {
            // Get parent path and download path
            const parentPath: string = path.dirname(projectPath);
            const downloadPath: string = path.join(
                parentPath,
                "beaton-mod-template-master"
            );

            // Download and unzip template
            await downlaodAndUnzip(
                "https://github.com/raftario/beaton-mod-template/archive/master.zip",
                parentPath
            );

            // Move downloaded template to project dir
            await fs.copy(downloadPath, projectPath);
            await fs.remove(downloadPath);

            // Parse template file
            const templatePath = path.join(projectPath, "template.json");
            const template: IModTemplate = await fs.readJSON(templatePath);
            await fs.remove(templatePath);

            // Remove unused template files
            template.toDelete.forEach(async (file) => {
                if (projectPath !== undefined) {
                    await fs.remove(path.join(projectPath, file));
                }
            });

            // Get mod info
            const projectInfo: IModInfo = {
                id: "ExampleMod",
                name: "Example Mod",
                author: "Raphaël Thériault",
                category: "Other",
                description: ["A mod that does things."],
                url: "https://github.com/raftario/beaton-mod-template",
                out: "examplemod",
            };
            projectInfo.id =
                (await vscode.window.showInputBox({
                    prompt: "Mod ID",
                    placeHolder: projectInfo.id,
                    validateInput: (input) =>
                        /[a-zA-Z0-9\-]+/g.test(input)
                            ? null
                            : "Should be unique and only contain letters, numbers and hyphens.",
                })) || projectInfo.id;
            projectInfo.name =
                (await vscode.window.showInputBox({
                    prompt: "Mod name",
                    placeHolder: projectInfo.name,
                    validateInput: (input) =>
                        /[^\n\t]+/g.test(input)
                            ? null
                            : "Should fit on a single line.",
                })) || projectInfo.name;
            projectInfo.author =
                (await vscode.window.showInputBox({
                    prompt: "Mod author",
                    placeHolder: projectInfo.author,
                    validateInput: (input) =>
                        /[^\n\t]+/g.test(input)
                            ? null
                            : "Should fit on a single line.",
                })) || projectInfo.author;
            projectInfo.category =
                (await vscode.window.showInputBox({
                    prompt: "Mod category",
                    placeHolder: projectInfo.category,
                    validateInput: (input) =>
                        /(Gameplay|Other|Saber)/g.test(input)
                            ? null
                            : "Should be one of Gameplay, Saber or Other.",
                })) || projectInfo.category;
            projectInfo.description = (
                (await vscode.window.showInputBox({
                    prompt: "Mod description",
                    placeHolder: projectInfo.description.join("\n"),
                })) || projectInfo.description.join("\n")
            ).split("\n");
            projectInfo.url =
                (await vscode.window.showInputBox({
                    prompt: "Mod URL",
                    placeHolder: projectInfo.url,
                    validateInput: (input) =>
                        /https?:\/\/(\S+\/?)+/g.test(input)
                            ? null
                            : "Should be a valid url.",
                })) || projectInfo.url;
            projectInfo.out =
                (await vscode.window.showInputBox({
                    prompt: "Mod output file",
                    placeHolder: projectInfo.out,
                    validateInput: (input) =>
                        /[a-z]+/g.test(input)
                            ? null
                            : "Should only contain lowercase letters.",
                })) || projectInfo.out;

            // Fill in template
            template.toFill.forEach(async (file) => {
                if (projectPath !== undefined) {
                    const filePath: string = path.join(projectPath, file);
                    const contents: string = fs.readFileSync(filePath, {
                        encoding: "utf8",
                    });
                    let newContents: string = nunjucks.renderString(contents, {
                        mod: projectInfo,
                    });
                    if (filePath.endsWith(".json")) {
                        newContents = newContents.replace(
                            /,(\s*)([\]}])/g,
                            "$1$2"
                        );
                    }
                    fs.writeFileSync(filePath, newContents, {
                        encoding: "utf8",
                    });
                }
            });

            // Initialise repository and submodules
            const git: string =
                vscode.workspace
                    .getConfiguration("bsqm.tools")
                    .get<string>("git") || "git";
            await vscode.window.withProgress(
                {
                    title: "Setting up project",
                    location: vscode.ProgressLocation.Notification,
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: "Initialising git repository...",
                    });
                    cp.spawnSync(git, ["init"], { cwd: projectPath });

                    progress.report({
                        message: "Initialising git submodules...",
                    });
                    // Create submodules path
                    const submodulesPath: string =
                        projectPath !== undefined
                            ? path.join(projectPath, "extern")
                            : "extern";
                    await fs.mkdirp(submodulesPath);
                    // Loop over submodules
                    template.submodules.forEach((submodule) => {
                        // Add submodule
                        let submoduleArgs: string[] = ["submodule", "add"];
                        if (submodule.branch !== undefined) {
                            submoduleArgs = submoduleArgs.concat([
                                "-b",
                                submodule.branch,
                            ]);
                        }
                        submoduleArgs = submoduleArgs.concat([
                            submodule.url,
                            `extern/${submodule.path}`,
                        ]);
                        cp.spawnSync(git, submoduleArgs, { cwd: projectPath });

                        // Checkout submodule
                        if (
                            submodule.commit !== undefined &&
                            projectPath !== undefined
                        ) {
                            cp.spawnSync(git, ["checkout", submodule.commit], {
                                cwd: path.join(submodulesPath, submodule.path),
                            });
                        }
                    });
                }
            );

            // Set workspace to new project
            vscode.workspace.updateWorkspaceFolders(
                (vscode.workspace.workspaceFolders || []).length,
                0,
                { uri: vscode.Uri.file(projectPath) }
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(error);
    }
}
