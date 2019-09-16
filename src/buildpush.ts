import * as cp from "child_process";
import * as vscode from "vscode";

export async function build() {
    try {
        if (vscode.workspace.workspaceFolders === undefined) {
            throw new Error("Missing project directory.");
        }
        const ndk: string = vscode.workspace
            .getConfiguration("bsqm.tools")
            .get("ndk", "ndk-build");
        const workdir: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
        await vscode.window.withProgress(
            {
                title: "Building project",
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
            },
            async (progress) => {
                progress.report({ message: "Building..." });
                const buildResult = cp.spawnSync(
                    ndk,
                    [
                        "NDK_PROJECT_PATH=.",
                        "APP_BUILD_SCRIPT=./Android.mk",
                        "NDK_APPLICATION_MK=./Application.mk",
                    ],
                    { cwd: workdir }
                );
                const buildChannel = vscode.window.createOutputChannel(
                    "BSQM Build"
                );
                buildChannel.show();
                buildChannel.appendLine(buildResult.stdout.toString());
                buildChannel.appendLine(buildResult.stderr.toString());
                if (buildResult.status !== 0) {
                    throw new Error("Build failed.");
                }
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(error.message);
    }
}
