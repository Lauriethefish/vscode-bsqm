import { promises as fs } from "fs";
import fetch, { Response } from "node-fetch";
import * as unzipper from "unzipper";
import * as vscode from "vscode";

export async function downlaodAndUnzip(url: string, path: string) {
    await vscode.window.withProgress(
        {
            title: `Downloading ${url}...`,
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
        },
        async (progress) => {
                const res: Response = await fetch(url);
                progress.report({message: "Extracting..."});
                res.body.pipe(unzipper.Extract({path}));
        },
    );
}

export async function directoryIsEmpty(path: string): Promise<boolean> {
    const contents: string[] = await fs.readdir(path);
    return contents.length === 0;
}
