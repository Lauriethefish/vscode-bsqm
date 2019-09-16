import * as vscode from "vscode";
import configure from "./configure";
import create from "./create";

export function activate(context: vscode.ExtensionContext) {
    const commands: { [name: string]: vscode.Disposable } = {};

    commands.activate = vscode.commands.registerCommand("bsqm.activate", () => {
        // Do nothing, just activate extension
    });
    commands.configure = vscode.commands.registerCommand(
        "bsqm.configure",
        configure
    );
    commands.create = vscode.commands.registerCommand("bsqm.create", create);

    Object.keys(commands).forEach((command) => {
        context.subscriptions.push(commands[command]);
    });

    vscode.window.showInformationMessage("BSQM extension activated.");
}
