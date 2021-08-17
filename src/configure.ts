import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";
import { downloadAndUnzip } from "./utils";

interface CrossString {
    windows: string;
    macos: string;
    linux: string;
}

// Select string based on OS
function selectCrossString(crossString: CrossString): string {
    switch (process.platform) {
        case "win32":
            return crossString.windows;
        case "darwin":
            return crossString.macos;
        default:
            return crossString.linux;
    }
}

function printSuccessMessage(toolDisplayName: string, toolPath: string): void {
    vscode.window.showInformationMessage(
        `Found ${toolDisplayName}: ${toolPath}`
    );
}

function printErrorMessage(toolDisplayName: string): void {
    vscode.window.showErrorMessage(
        `No ${toolDisplayName}. Some features won't be available.`
    );
}

// Check for tool in PATH
async function checkTool(
    toolName: CrossString,
    toolDisplayName: string
): Promise<string | null> {
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
    toolName: CrossString,
    toolDisplayName: string,
    toolUrl: CrossString,
    zipSubfolder: string
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
        const findTool: boolean =
            (await vscode.window.showWarningMessage(
                `Couldn't find ${toolDisplayName}. Is it installed?`,
                "Yes",
                "No"
            )) === "Yes";

        if (findTool) {
            let validPath = false;
            let toolPath: string | undefined;
            let retry = false;
            do {
                // Open file dialog to find tool
                const selectedPath:
                    | vscode.Uri[]
                    | undefined = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: `Select ${toolDisplayName}`,
                });

                // Check if path is valid
                validPath =
                    selectedPath !== undefined &&
                    path.basename(selectedPath[0].fsPath) === osToolName;
                if (validPath) {
                    // Set tool path
                    toolPath = selectedPath![0].fsPath;
                } else {
                    // Ask for retry
                    retry =
                        (await vscode.window.showErrorMessage(
                            "Invalid file. Do you wish to try again?",
                            "Yes",
                            "No"
                        )) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                printSuccessMessage(toolDisplayName, toolPath!);
                return toolPath!;
            }
        }

        // Ask for download
        const downloadTool: boolean =
            (await vscode.window.showWarningMessage(
                `Do you wish to install ${toolDisplayName}?`,
                "Yes",
                "No"
            )) === "Yes";

        if (downloadTool) {
            let validPath = false;
            let toolPath: string | undefined;
            let retry = false;
            do {
                // Open folder dialog to select install location
                const installPath:
                    | vscode.Uri[]
                    | undefined = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: `Select ${toolDisplayName} installation folder`,
                });

                // Check if path is valid
                validPath = installPath !== undefined;
                if (validPath) {
                    // Set installation path
                    toolPath = installPath![0].fsPath;
                } else {
                    // Ask for retry
                    retry =
                        (await vscode.window.showErrorMessage(
                            "Invalid folder. Do you wish to try again?",
                            "Yes",
                            "No"
                        )) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                // Download and unzip tool
                await downloadAndUnzip(osToolUrl, toolPath!);

                // Set to tool path
                toolPath = path.join(toolPath!, zipSubfolder, osToolName);
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
    const gitName: CrossString = {
        windows: "git.exe",
        macos: "git",
        linux: "git",
    };

    const gitPath: string | null = await checkTool(gitName, "Git binary");
    return gitPath;
}

// Check for adb binary
async function checkAdb(): Promise<string | null> {
    const adbName: CrossString = {
        windows: "adb.exe",
        macos: "adb",
        linux: "adb",
    };
    const adbUrl: CrossString = {
        windows:
            "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
        macos:
            "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
        linux:
            "https://dl.google.com/android/repository/platform-tools-latest-linux.zip",
    };

    const adbPath: string | null = await checkOrDownloadTool(
        adbName,
        "adb binary",
        adbUrl,
        "platform-tools"
    );
    return adbPath;
}

// Check for Android NDK build script
async function checkNdk(): Promise<string | null> {
    const ndkName: CrossString = {
        windows: "ndk-build.cmd",
        macos: "ndk-build",
        linux: "ndk-build",
    };
    const ndkVer = "r23";
    const ndkUrl: CrossString = {
        
        windows: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-windows.zip`,
        macos: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-darwin.zip`,
        linux: `https://dl.google.com/android/repository/android-ndk-${ndkVer}-linux.zip`,
    };

    const ndkPath: string | null = await checkOrDownloadTool(
        ndkName,
        "Android NDK build script",
        ndkUrl,
        `android-ndk-${ndkVer}`
    );
    return ndkPath;
}

async function configure(): Promise<void> {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const git: string | null = await checkGit();
    await config.update(
        "bsqm.tools.git",
        git,
        vscode.ConfigurationTarget.Global
    );
    const adb: string | null = await checkAdb();
    await config.update(
        "bsqm.tools.adb",
        adb,
        vscode.ConfigurationTarget.Global
    );
    const ndk: string | null = await checkNdk();
    await config.update(
        "bsqm.tools.ndk",
        ndk,
        vscode.ConfigurationTarget.Global
    );

    // Update C/C++ config
    const cppConfig = vscode.workspace.getConfiguration("C_Cpp");
    if (ndk !== null) {
        let ndkDir = path.dirname(ndk);
        if (!ndkDir.endsWith(path.sep)) {
            ndkDir += path.sep;
        }
        ndkDir += "**";

        // NDK path must be with forward slashes
        ndkDir = ndkDir.replace("\\", "/");

        let includePath: string[] | undefined = cppConfig.get("default.includePath");
        if(includePath === null || includePath === undefined) {
            includePath = [];
        }

        if (!includePath.includes(ndkDir)) {
            includePath.push(ndkDir);
        }

        await cppConfig.update(
            "default.includePath",
            includePath,
            vscode.ConfigurationTarget.Global
        );
    }

    vscode.window.showInformationMessage("BSQM setup complete");
}

export default async function c(): Promise<void> {
    try {
        await configure();
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}
