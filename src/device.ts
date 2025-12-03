import { privateDecrypt } from "crypto";
import vscode from "vscode";


export class Device extends vscode.TreeItem {
    public constructor(
        public portPath? : string,

        public boardName? : string,

        public description? : string,
    
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(boardName ?? "New Device", collapsibleState);

        this.contextValue = 'riot-device';
        this.portPath = portPath;
        this.description = description;
        this.tooltip = `${boardName ?? 'Board not set'} at ${portPath ?? 'Port not set'}`; 
        
        this.iconPath = new vscode.ThemeIcon('circuit-board');
    }

    public setPortPath(newPort : string) {
        this.portPath = newPort;
        this.updateToolTip();
    }

    public setBoard(newBoard : string) {
        this.boardName = newBoard;
        this.label = this.boardName ?? newBoard;  
        this.updateToolTip();
    }

    private updateToolTip() {
        this.tooltip = `${this.boardName ?? 'Board not set'} at ${this.portPath ?? 'Port not set'}`; 
    }
}
