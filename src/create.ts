import * as cp from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { directoryIsEmpty, downloadAndUnzip } from "./utils";

interface ModInfo {
    id: string;
    name: string;
    author: string;
    description: string;
    ndkPath: string;
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
    // Download and unzip template
    await downloadAndUnzip(
        "https://github.com/Lauriethefish/quest-mod-template/releases/latest/download/quest-mod-template.zip",
        projectPath
    );
}

async function fillFile(filePath: string, modInfo: ModInfo): Promise<void> {
    // TODO: Make this more efficient, replacing this many times has got to be very slow, although it isn't a problem with so few files in the template.
    let content: string = await (await fs.readFile(filePath)).toString();
    content = content.replace(/#{id}/g, modInfo.id);
    content = content.replace(/#{description}/g, modInfo.description);
    content = content.replace(/#{author}/g, modInfo.author);
    content = content.replace(/#{name}/g, modInfo.name);
    content = content.replace(/#{ndkpath}/g, modInfo.ndkPath);

    await fs.writeFile(filePath, content);
}

async function fillTemplate(
    projectPath: string,
    modInfo: ModInfo
): Promise<void> {
    const files = [
        ".vscode/c_cpp_properties.json",
        "Android.mk",
        "buildQMOD.ps1",
        "copy.ps1",
        "mod.json",
        "qpm.json",
        "README.md",
        "ndkpath.txt",
    ];

    for (const file of files) {
        await fillFile(path.join(projectPath, file), modInfo);
    }
}

async function initRepo(projectPath: string): Promise<void> {
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
        }
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
    panel.webview.html = htmlContents;

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.type === "browse") {
            // Select project folder
            const projectPath = await openFolder(FileOpenType.Project);
            await panel.webview.postMessage({
                type: "browse",
                payload: projectPath,
            });
        } else if (message.type === "submit") {
            panel.dispose();
            // Create project
            const projectPath = message.payload.projectFolder;
            const config = vscode.workspace.getConfiguration();
            const buildScriptPath = config.get("bsqm.tools.ndk") as string;
            const ndkPath = path.dirname(buildScriptPath).replace(/\\/g, "/");

            await setupTemplate(projectPath);
            const projectInfo: ModInfo = {
                id: message.payload.id,
                name: message.payload.name,
                author: message.payload.author,
                description: message.payload.description,
                ndkPath: ndkPath,
            };

            await fillTemplate(projectPath, projectInfo);

            await initRepo(projectPath);
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
