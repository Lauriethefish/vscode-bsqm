import * as cp from "child_process";
import * as fs from "fs-extra";
import * as nunjucks from "nunjucks";
import * as path from "path";
import * as vscode from "vscode";
import { directoryIsEmpty, downlaodAndUnzip } from "./utils";

interface ModInfo {
    id: string;
    name: string;
    author: string;
    category: string;
    description: string[];
    gameVersion: string;
    libil2cpp: string;
    ndkpath: string;
    out: string;
}

interface GitSubmodule {
    path: string;
    url: string;
    branch?: string;
    commit?: string;
}

interface ModTemplate {
    toFill: string[];
    toDelete: string[];
    submodules: GitSubmodule[];
}

enum FileOpenType {
    Project,
    libil2cpp,
    NDK,
}

function getNonce(): string {
    let text = "";
    const possible =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function openFolder(type: FileOpenType): Promise<string | undefined> {
    let validPath = false;
    let selectedPath: string | undefined = undefined;
    let retry = true;
    do {
        if (type == FileOpenType.Project) {
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
                selectedPath = installPath[0].fsPath;
            } else if (installPath === undefined) {
                retry = false;
            } else {
                vscode.window.showErrorMessage("Folder must be empty.");
            }
        } else {
            const path:
                | vscode.Uri[]
                | undefined = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: "Select " + FileOpenType[type] + " directory",
            });
            validPath = path !== undefined;
            if (path !== undefined) {
                selectedPath = path[0].fsPath;
            } else {
                retry = false;
            }
        }
    } while (!validPath && retry);
    return selectedPath;
}

async function setupTemplate(projectPath: string): Promise<void> {
    // Get parent path and download path
    const parentPath: string = path.dirname(projectPath);
    const downloadPath: string = path.join(
        parentPath,
        "bmbf-mod-template-master"
    );

    // Download and unzip template
    await downlaodAndUnzip(
        "https://github.com/raftario/bmbf-mod-template/archive/master.zip",
        parentPath
    );

    // Move downloaded template to project dir
    await fs.copy(downloadPath, projectPath);
    await fs.remove(downloadPath);
}

async function fillTemplate(
    projectPath: string,
    projectInfo: ModInfo
): Promise<ModTemplate> {
    // Parse template file
    const templatePath = path.join(projectPath, "template.json");
    const template: ModTemplate = await fs.readJSON(templatePath);
    await fs.remove(templatePath);

    // Remove unused template files
    for (const file of template.toDelete) {
        if (projectPath !== undefined) {
            await fs.remove(path.join(projectPath, file));
        }
    }

    // Fill in template
    for (const file of template.toFill) {
        if (projectPath !== undefined) {
            const filePath: string = path.join(projectPath, file);
            const contents: string = await fs.readFile(filePath, {
                encoding: "utf8",
            });
            let newContents: string = nunjucks.renderString(contents, {
                mod: projectInfo,
            });

            // Remove extra newlines and commas in JSON files
            if (filePath.endsWith(".json")) {
                newContents = newContents.replace(/,(\s*)([\]}])/g, "$1$2");
                newContents = newContents.replace(/\n{2,}/g, "\n");
            }
            // Remove extra newlines in Markdown files
            if (filePath.endsWith(".md")) {
                newContents = newContents.replace(/\n{3,}/g, "\n\n");
            }

            await fs.writeFile(filePath, newContents, {
                encoding: "utf8",
            });
        }
    }

    return template;
}

async function initRepo(
    projectPath: string,
    template: ModTemplate
): Promise<void> {
    const git: string = vscode.workspace
        .getConfiguration("bsqm.tools")
        .get("git", "git");
    await vscode.window.withProgress(
        {
            title: "Setting up project",
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
        },
        async (progress) => {
            const initChannel = vscode.window.createOutputChannel(
                "BSQM Project Initialisation"
            );
            initChannel.show();

            // Init git repository
            progress.report({
                message: "Initialising git repository...",
            });
            const initResult = cp.spawnSync(git, ["init"], {
                cwd: projectPath,
            });
            initChannel.appendLine(initResult.stdout.toString());
            initChannel.appendLine(initResult.stderr.toString());
            if (initResult.status !== 0) {
                throw new Error("Git repository initialisation failed.");
            }

            // Init git submodules
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
            for (const submodule of template.submodules) {
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
                const subResult = cp.spawnSync(git, submoduleArgs, {
                    cwd: projectPath,
                });
                initChannel.appendLine(subResult.stdout.toString());
                initChannel.appendLine(subResult.stderr.toString());
                if (subResult.status !== 0) {
                    throw new Error("Git submodule initialisation failed.");
                }

                // Checkout submodule
                if (
                    submodule.commit !== undefined &&
                    projectPath !== undefined
                ) {
                    const subCheckResult = cp.spawnSync(
                        git,
                        ["checkout", submodule.commit],
                        {
                            cwd: path.join(submodulesPath, submodule.path),
                        }
                    );
                    initChannel.appendLine(subCheckResult.stdout.toString());
                    initChannel.appendLine(subCheckResult.stderr.toString());
                    if (subCheckResult.status !== 0) {
                        throw new Error("Git subbodule checkout failed.");
                    }
                }
            }

            // Update all submodules
            progress.report({
                message: "Updating git submodules...",
            });
            const subUpdateResult = cp.spawnSync(
                git,
                ["submodule", "update", "--init", "--recursive"],
                {
                    cwd: submodulesPath,
                }
            );
            initChannel.appendLine(subUpdateResult.stdout.toString());
            initChannel.appendLine(subUpdateResult.stderr.toString());
            if (subUpdateResult.status !== 0) {
                throw new Error("Git submodule update failed.");
            }
        }
    );
}

async function addIl2cpp(projectPath: string): Promise<void> {
    // Download libil2cpp
    const libil2cppPath: string = path.join(
        projectPath,
        "extern",
        "beatsaber-hook",
        "shared"
    );
    // TODO: Add mini-libil2cpp, not full libil2cpp
    await downlaodAndUnzip(
        "https://srv-file5.gofile.io/download/SOlwlz/libil2cpp.zip",
        // "https://files.raphaeltheriault.com/libil2cpp.zip",
        libil2cppPath
    );
}

async function create(extensionPath: string): Promise<void> {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
        "bsqmCreate",
        "Create a new Beat Saber Quest mod",
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionPath, "media")),
            ],
        }
    );

    // Fill webview HTML
    const nonce = getNonce();
    const jsPath = path.join(extensionPath, "media", "create.js");
    const cssPath = path.join(extensionPath, "media", "create.css");
    const htmlPath = path.join(extensionPath, "media", "create.html");
    const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(jsPath));
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(cssPath));
    const htmlContents = (await fs.readFile(htmlPath, "UTF-8"))
        .replace("{{ jsUri }}", jsUri.toString())
        .replace("{{ cssUri }}", cssUri.toString())
        .replace(/{{ nonce }}/g, nonce);
    /* eslint-disable require-atomic-updates */
    panel.webview.html = htmlContents;
    /* eslint-enable require-atomic-updates */

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === "browse") {
            // Select project folder
            const projectPath = await openFolder(FileOpenType.Project);
            await panel.webview.postMessage({
                type: "browse",
                payload: projectPath,
            });
        } else if (message.type === "libil2cpp") {
            // Select libil2cpp folder
            const libil2cpp = await openFolder(FileOpenType.libil2cpp);
            await panel.webview.postMessage({
                type: "libil2cpp",
                payload: libil2cpp,
            });
        } else if (message.type === "ndkbundle") {
            // Select ndk-bundle folder
            const ndkbundle = await openFolder(FileOpenType.NDK);
            await panel.webview.postMessage({
                type: "ndkbundle",
                payload: ndkbundle,
            });
        } else if (message.type === "submit") {
            panel.dispose();
            // Create project
            const projectPath = message.payload.projectFolder;
            fs.writeFile(
                path.join(projectPath, "ndkpath.txt"),
                message.payload.ndkbundle.replace(/\\/g, "/")
            );
            await setupTemplate(projectPath);
            const projectInfo: ModInfo = {
                id: message.payload.id,
                name: message.payload.name,
                author: message.payload.author,
                category: message.payload.category,
                description: message.payload.description,
                out: message.payload.id.toLowerCase(),
                gameVersion: message.payload.gameVersion,
                ndkpath: message.payload.ndkbundle.replace(/\\/g, "/"),
                libil2cpp: message.payload.libil2cpp.replace(/\\/g, "/"),
            };
            const template = await fillTemplate(projectPath, projectInfo);
            await initRepo(projectPath, template);
            await addIl2cpp(projectPath);
            // Set workspace to new project
            vscode.workspace.updateWorkspaceFolders(0, 0, {
                uri: vscode.Uri.file(projectPath),
            });
        }
    });
}

export default async function c(extensionPath: string): Promise<void> {
    try {
        await create(extensionPath);
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}
