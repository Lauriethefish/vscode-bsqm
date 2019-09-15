import * as io from "@actions/io";
import * as path from "path";
import * as vscode from "vscode";
import { directoryIsEmpty, downlaodAndUnzip } from "./utils";

interface ITool {
    available: boolean;
    path?: string;
}

// Check for Git binary
async function checkGit(): Promise<ITool> {
    try {
        // Search for the binary in PATH
        // Throw if not found
        const gitPath: string = await io.which("git", true);
        vscode.window.showInformationMessage(`Found Git binary: ${gitPath}`);

        return {
            available: true,
            path: gitPath,
        };
    } catch (error) {
        vscode.window.showErrorMessage("Couldn't find Git binary. Some features won't be available.");
        return {
            available: false,
        };
    }
}

// Check for Android NDK build script
async function checkNdk(): Promise<ITool> {
    // Filename is platform specific
    const windows: boolean = process.platform === "win32";
    const ndkName: string = windows ? "ndk-build.cmd" : "ndk-build";
    const ndkLink: string = (() => {
        switch (process.platform) {
            case "win32":
                return "https://dl.google.com/android/repository/android-ndk-r20-windows-x86_64.zip";
            case "darwin":
                return "https://dl.google.com/android/repository/android-ndk-r20-darwin-x86_64.zip";
            default:
                return "https://dl.google.com/android/repository/android-ndk-r20-linux-x86_64.zip";
        }
    })();

    try {
        // Search for the build script in PATH
        // Throw if not found
        const ndkPath: string = await io.which(ndkName, true);
        vscode.window.showInformationMessage(`Found Android NDK build script: ${ndkPath}`);

        return {
            available: true,
            path: ndkPath,
        };
    } catch (error) {
        // Ask if installed
        const findNdk: boolean = await vscode.window.showErrorMessage(
            "Couldn't find Android NDK build script. Is it installed?",
            "Yes",
            "No",
        ) === "Yes";

        if (findNdk) {
            let validPath: boolean = false;
            let ndkPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open file dialog to find build script
                const filters: {[name: string]: string[]} = windows
                    ? {"Android NDK build script": ["cmd"]}
                    : {};
                const scriptPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: "Select build script",
                    filters,
                });

                // Check if path is valid
                validPath = scriptPath !== undefined && path.basename(scriptPath[0].fsPath) === ndkName;
                if (validPath) {
                    // Set build script path
                    // @ts-ignore
                    ndkPath = scriptPath[0].fsPath;
                } else {
                    // Ask for retry
                    retry = await vscode.window.showErrorMessage(
                        "Invlid file. Do you wish to try again?",
                        "Yes",
                        "No",
                    ) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                return {
                    available: true,
                    path: ndkPath,
                };
            }
        }

        // Ask for download
        const installNdk: boolean = await vscode.window.showErrorMessage(
            "Do you wish to install the Android NDK?",
            "Yes",
            "No",
        ) === "Yes";

        if (installNdk) {
            let validPath: boolean = false;
            let ndkPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open folder dialog to select install location
                const installPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: "Select NDK installation folder",
                });

                // Check if path is valid
                validPath = installPath !== undefined && await directoryIsEmpty(installPath[0].fsPath);
                if (validPath) {
                    // Set installation path
                    // @ts-ignore
                    ndkPath = scriptPath[0].fsPath;
                } else {
                    // Ask for retry
                    retry = await vscode.window.showErrorMessage(
                        "Folder must be empty. Do you wish to try again?",
                        "Yes",
                        "No",
                    ) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                // Download and unzip NDK
                // @ts-ignore
                await downlaodAndUnzip(ndkLink, ndkPath);

                // Set to build script path
                // @ts-ignore
                ndkPath = path.join(ndkPath, ndkName);
                return {
                    available: true,
                    path: ndkPath,
                };
            }
        }

        vscode.window.showErrorMessage("No Android NDK build script. Some features won't be available.");
        return {
            available: false,
        };
    }
}

export default async function configure() {
    const git: ITool = await checkGit();
    const ndk: ITool = await checkNdk();

    console.log(git, ndk);
}
