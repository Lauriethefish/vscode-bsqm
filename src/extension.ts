import * as vscode from "vscode";
import configure from "./configure";

export function activate(context: vscode.ExtensionContext) {
    const commands: {[name: string]: vscode.Disposable} = {};

    commands.configure = vscode.commands.registerCommand("bsqm.configure", async () => {
        await configure();
    });

    Object.keys(commands).forEach((command) => {
        context.subscriptions.push(commands[command]);
    });
}
