import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";
import { downlaodAndUnzip } from "./utils";

interface ICrossString {
    windows: string;
    macos: string;
    linux: string;
}

// Select string based on OS
function selectCrossString(crossString: ICrossString): string {
    switch (process.platform) {
        case "win32":
            return crossString.windows;
        case "darwin":
            return crossString.macos;
        default:
            return crossString.linux;
    }
}

function printSuccessMessage(toolDisplayName: string, toolPath: string) {
    vscode.window.showInformationMessage(`Found ${toolDisplayName}: ${toolPath}`);
}

function printErrorMessage(toolDisplayName: string) {
    vscode.window.showErrorMessage(`No ${toolDisplayName}. Some features won't be available.`);
}

// Check for tool in PATH
async function checkTool(toolName: ICrossString, toolDisplayName: string): Promise<string | null> {
    try {
        // Search for the tool in PATH
        // Throw if not found
        const toolPath: string = which.sync(selectCrossString(toolName));
        printSuccessMessage(toolDisplayName, toolPath);
        return toolPath;
    } catch (error) {
        printErrorMessage(toolDisplayName);
        return null;
    }
}

// Check for tool in PATH and ask for it or download it if not found
async function checkOrDownloadTool(
    toolName: ICrossString,
    toolDisplayName: string,
    toolUrl: ICrossString,
    zipSubfolder: string,
): Promise<string | null> {
    const osToolName: string = selectCrossString(toolName);
    const osToolUrl: string = selectCrossString(toolUrl);

    try {
        // Search for the tool PATH
        // Throw if not found
        const toolPath: string = which.sync(osToolName);
        printSuccessMessage(toolDisplayName, toolPath);
        return toolPath;
    } catch (error) {
        // Ask if installed
        const findTool: boolean = await vscode.window.showWarningMessage(
            `Couldn't find ${toolDisplayName}. Is it installed?`,
            "Yes",
            "No",
        ) === "Yes";

        if (findTool) {
            let validPath: boolean = false;
            let toolPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open file dialog to find tool
                const selectedPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: `Select ${toolDisplayName}`,
                });

                // Check if path is valid
                validPath = selectedPath !== undefined && path.basename(selectedPath[0].fsPath) === osToolName;
                if (validPath) {
                    // Set tool path
                    // @ts-ignore
                    toolPath = selectedPath[0].fsPath;
                } else {
                    // Ask for retry
                    retry = await vscode.window.showErrorMessage(
                        "Invalid file. Do you wish to try again?",
                        "Yes",
                        "No",
                    ) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                // @ts-ignore
                printSuccessMessage(toolDisplayName, toolPath);
                // @ts-ignore
                return toolPath;
            }
        }

        // Ask for download
        const downloadTool: boolean = await vscode.window.showWarningMessage(
            `Do you wish to install ${toolDisplayName}?`,
            "Yes",
            "No",
        ) === "Yes";

        if (downloadTool) {
            let validPath: boolean = false;
            let toolPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open folder dialog to select install location
                const installPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: `Select ${toolDisplayName} installation folder`,
                });

                // Check if path is valid
                validPath = installPath !== undefined;
                if (validPath) {
                    // Set installation path
                    // @ts-ignore
                    toolPath = installPath[0].fsPath;
                } else {
                    // Ask for retry
                    retry = await vscode.window.showErrorMessage(
                        "Invalid folder. Do you wish to try again?",
                        "Yes",
                        "No",
                    ) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                // Download and unzip tool
                // @ts-ignore
                await downlaodAndUnzip(osToolUrl, toolPath);

                // Set to tool path
                // @ts-ignore
                toolPath = path.join(toolPath, zipSubfolder, osToolName);
                printSuccessMessage(toolDisplayName, toolPath);
                return toolPath;
            }
        }

        printErrorMessage(toolDisplayName);
        return null;
    }
}

// Check for Git binary
async function checkGit(): Promise<string | null> {
    const gitName: ICrossString = {
        windows: "git.exe",
        macos: "git",
        linux: "git",
    };

    const gitPath: string | null = await checkTool(gitName, "Git binary");
    return gitPath;
}

// Check for adb binary
async function checkAdb(): Promise<string | null> {
    const adbName: ICrossString = {
        windows: "adb.exe",
        macos: "adb",
        linux: "adb",
    };
    const adbUrl: ICrossString = {
        windows: "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
        macos: "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
        linux: "https://dl.google.com/android/repository/platform-tools-latest-linux.zip",
    };

    const adbPath: string | null = await checkOrDownloadTool(adbName, "adb binary", adbUrl, "platform-tools");
    return adbPath;
}

// Check for Android NDK build script
async function checkNdk(): Promise<string | null> {
    const ndkName: ICrossString = {
        windows: "ndk-build.cmd",
        macos: "ndk-build",
        linux: "ndk-build",
    };
    const ndkVer: string = "r20";
    const ndkUrl: ICrossString = {
        windows: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-windows-x86_64.zip`,
        macos: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-darwin-x86_64.zip`,
        linux: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-linux-x86_64.zip`,
    };

    const ndkPath: string | null = await checkOrDownloadTool(ndkName, "Android NDK build script", ndkUrl, `android-ndk-${ndkVer}`);
    return ndkPath;
}

export default async function configure() {
    try {
        const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

        const git: string | null = await checkGit();
        await config.update("bsqm.tools.git", git, vscode.ConfigurationTarget.Global);
        const adb: string | null = await checkAdb();
        await config.update("bsqm.tools.adb", adb, vscode.ConfigurationTarget.Global);
        const ndk: string | null = await checkNdk();
        await config.update("bsqm.tools.ndk", ndk, vscode.ConfigurationTarget.Global);
    } catch (error) {
        vscode.window.showErrorMessage(error);
    }
}
