import vscode from "vscode";


export abstract class AbstractRiotTask {
    protected task : vscode.Task | undefined = undefined;

    constructor(
        public readonly applicationPath: string,

        public readonly board : string,
        
        public readonly port  : string
    ) {
        this.task = this.internalCreateTask();
    }

    protected abstract internalCreateTask() : vscode.Task;

    public getVscodeTask() : vscode.Task | undefined {
        return this.task;
    }
}