import vscode from "vscode";
import { AbstractRiotTask } from "./AbstractRiotTask";

export abstract class VsCodeAbstractRiotTask extends AbstractRiotTask{

    constructor(
        applicationPath: string,
        board: string,
        port: string
    ) {
        super(applicationPath, board, port);
    }

    protected internalCreateTask(): vscode.Task {
        const cDir = `cd ${this.applicationPath}`;
        const command = this.getStringShellCommand();
        var shellCommand = new vscode.ShellExecution(
            `cd ${this.applicationPath} 
            && ${command}`
        );
        return new vscode.Task(
            { type: 'riotTaskProvider' },
            vscode.TaskScope.Workspace,
            `Riot: Flash`,
            'riot-launcher',
            shellCommand
        );
    }

    /* Template method returns command to execute in application folder*/ 
    protected abstract getStringShellCommand(): string;

}
