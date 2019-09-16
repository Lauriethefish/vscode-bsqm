import * as cp from "child_process";
import * as vscode from "vscode";

export async function build() {
    try {
        if (vscode.workspace.workspaceFolders === undefined) {
            throw new Error("Missing project directory.");
        }
        const ndk: string =
            vscode.workspace
                .getConfiguration("bsqm.tools")
                .get<string>("ndk") || "ndk-build";
        const workdir: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await vscode.window.withProgress(
            {
                title: "Building project",
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: "Building..." });
                const ec = cp.spawnSync(
                    ndk,
                    [
                        "NDK_PROJECT_PATH=.",
                        "APP_BUILD_SCRIPT=./Android.mk",
                        "NDK_APPLICATION_MK=./Application.mk",
                    ],
                    { cwd: workdir }
                ).status;
                if (ec !== 0) {
                    throw new Error("Build failed.");
                }
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(error);
    }
}
