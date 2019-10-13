import * as fs from "fs-extra";
import * as unzipper from "unzipper";
import * as vscode from "vscode";
import fetch, { Response } from "node-fetch";

export async function downlaodAndUnzip(
    url: string,
    path: string
): Promise<void> {
    await vscode.window.withProgress(
        {
            title: `Downloading ${url}`,
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: "Downloading..." });
            const res: Response = await fetch(url);
            progress.report({ message: "Extracting..." });
            await res.body.pipe(unzipper.Extract({ path })).promise();
        }
    );
}

export async function directoryIsEmpty(path: string): Promise<boolean> {
    const contents: string[] = await fs.readdir(path);
    return contents.length === 0;
}
