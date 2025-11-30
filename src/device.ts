import vscode from "vscode";


export class Device extends vscode.TreeItem {
    protected constructor(
        public readonly portPath : string,

        public readonly boardName   : string,

        public readonly description : string,
    
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(boardName, collapsibleState);

        this.description = description;
        this.tooltip = `${boardName} at ${portPath}`; 
        
        // this.contextValue = 'riot-device';
        
        this.iconPath = new vscode.ThemeIcon('circuit-board');
    }
}
