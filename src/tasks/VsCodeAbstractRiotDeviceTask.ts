import vscode from "vscode";
import { VsCodeAbstractRiotTask } from "./VsCodeAbstractRiotTask";
import { Device } from "../device";

export abstract class VsCodeAbstractRiotDeviceTask extends VsCodeAbstractRiotTask{

    constructor(
        applicationPath: string,
        device: Device,
        taskName : string
    ) {
        super(applicationPath, device, taskName);
    }

    protected getStringShellCommand(): string {
        const cDir = `cd ${this.applicationPath}`;
        const makeCommand = this.getStringShellCommand();
        var shellCommand = 
            `cd ${this.applicationPath} 
            && ${makeCommand} 
            BOARD=${this.device.boardName ?? ''} 
            PORT=${this.device.portPath ?? ''}`;
        return shellCommand;
    }

    protected abstract getStringMakeCommand() : string;
}
