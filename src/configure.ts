import * as io from "@actions/io";
import * as path from "path";
import * as vscode from "vscode";
import { downlaodAndUnzip } from "./utils";

// Check for Git binary
async function checkGit(): Promise<string | null> {
    try {
        // Search for the binary in PATH
        // Throw if not found
        const gitPath: string = await io.which("git", true);

        vscode.window.showInformationMessage(`Found Git binary: ${gitPath}`);
        return gitPath;
    } catch (error) {
        vscode.window.showErrorMessage("Couldn't find Git binary. Some features won't be available.");
        return null;
    }
}

// TODO: Merge duplicate code

// Check for adb binary
async function checkAdb(): Promise<string | null> {
    // Filename is platform specific
    const windows: boolean = process.platform === "win32";
    const adbName: string = windows ? "adb.exe" : "adb";
    const adbLink: string = (() => {
        switch (process.platform) {
            case "win32":
                return `https://dl.google.com/android/repository/platform-tools-latest-windows.zip`;
            case "darwin":
                return `https://dl.google.com/android/repository/platform-tools-latest-darwin.zip`;
            default:
                return `https://dl.google.com/android/repository/platform-tools-latest-linux.zip`;
        }
    })();

    try {
        // Search for the build script in PATH
        // Throw if not found
        const adbPath: string = await io.which(adbName, true);

        vscode.window.showInformationMessage(`Found adb binary: ${adbPath}`);
        return adbPath;
    } catch (error) {
        // Ask if installed
        const findAdb: boolean = await vscode.window.showWarningMessage(
            "Couldn't find adb binary. Is it installed?",
            "Yes",
            "No",
        ) === "Yes";

        if (findAdb) {
            let validPath: boolean = false;
            let adbPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open file dialog to find build script
                const filters: {[name: string]: string[]} = windows
                    ? {adb: ["exe"]}
                    : {};
                const binPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel: "Select adb binary",
                    filters,
                });

                // Check if path is valid
                validPath = binPath !== undefined && path.basename(binPath[0].fsPath) === adbName;
                if (validPath) {
                    // Set build script path
                    // @ts-ignore
                    adbPath = binPath[0].fsPath;
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
                vscode.window.showInformationMessage(`Found adb binary: ${adbPath}`);
                // @ts-ignore
                return adbPath;
            }
        }

        // Ask for download
        const installAdb: boolean = await vscode.window.showWarningMessage(
            "Do you wish to install adb?",
            "Yes",
            "No",
        ) === "Yes";

        if (installAdb) {
            let validPath: boolean = false;
            let adbPath: string | undefined;
            let retry: boolean = false;
            do {
                // Open folder dialog to select install location
                const installPath: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false,
                    openLabel: "Select adb installation folder",
                });

                // Check if path is valid
                validPath = installPath !== undefined;
                if (validPath) {
                    // Set installation path
                    // @ts-ignore
                    adbPath = installPath[0].fsPath;
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
                // Download and unzip NDK
                // @ts-ignore
                await downlaodAndUnzip(adbLink, adbPath);

                // Set to build script path
                // @ts-ignore
                adbPath = path.join(adbPath, "platform-tools", adbName);
                vscode.window.showInformationMessage(`Found adb binary: ${adbPath}`);
                return adbPath;
            }
        }

        vscode.window.showErrorMessage("No adb binary. Some features won't be available.");
        return null;
    }
}

// Check for Android NDK build script
async function checkNdk(): Promise<string | null> {
    // Filename is platform specific
    const windows: boolean = process.platform === "win32";
    const ndkName: string = windows ? "ndk-build.cmd" : "ndk-build";
    // NDK version to install if not installed
    const ndkVer: string = "r20";
    const ndkLink: string = (() => {
        switch (process.platform) {
            case "win32":
                return `https://dl.google.com/android/repository/android-ndk-${ndkVer}-windows-x86_64.zip`;
            case "darwin":
                return `https://dl.google.com/android/repository/android-ndk-${ndkVer}-darwin-x86_64.zip`;
            default:
                return `https://dl.google.com/android/repository/android-ndk-${ndkVer}-linux-x86_64.zip`;
        }
    })();

    try {
        // Search for the build script in PATH
        // Throw if not found
        const ndkPath: string = await io.which(ndkName, true);

        vscode.window.showInformationMessage(`Found Android NDK build script: ${ndkPath}`);
        return ndkPath;
    } catch (error) {
        // Ask if installed
        const findNdk: boolean = await vscode.window.showWarningMessage(
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
                        "Invalid file. Do you wish to try again?",
                        "Yes",
                        "No",
                    ) === "Yes";
                }
            } while (!validPath && retry);

            if (validPath) {
                vscode.window.showInformationMessage(`Found Android NDK build script: ${ndkPath}`);
                // @ts-ignore
                return ndkPath;
            }
        }

        // Ask for download
        const installNdk: boolean = await vscode.window.showWarningMessage(
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
                validPath = installPath !== undefined;
                if (validPath) {
                    // Set installation path
                    // @ts-ignore
                    ndkPath = installPath[0].fsPath;
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
                // Download and unzip NDK
                // @ts-ignore
                await downlaodAndUnzip(ndkLink, ndkPath);

                // Set to build script path
                // @ts-ignore
                ndkPath = path.join(ndkPath, `android-ndk-${ndkVer}`, ndkName);
                vscode.window.showInformationMessage(`Found Android NDK build script: ${ndkPath}`);
                return ndkPath;
            }
        }

        vscode.window.showErrorMessage("No Android NDK build script. Some features won't be available.");
        return null;
    }
}

export default async function configure() {
    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();

    const git: string | null = await checkGit();
    await config.update("bsqm.tools.git", git, vscode.ConfigurationTarget.Global);
    const adb: string | null = await checkAdb();
    await config.update("bsqm.tools.adb", adb, vscode.ConfigurationTarget.Global);
    const ndk: string | null = await checkNdk();
    await config.update("bsqm.tools.ndk", ndk, vscode.ConfigurationTarget.Global);
}
