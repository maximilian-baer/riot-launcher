// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as shell from 'shelljs';
import * as util from 'util';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	async function readBundledBoards(): Promise<string[]> {
		const text : string = await fs.promises.readFile('./Uni/IOT/riot-launcher/resources/boards.txt', 'utf8');
		return text.split('\n').filter(line => line.length > 0);
	}

	let boards : string[] = await readBundledBoards().catch<string[]>( (_err) => ['adafruit-feather-nrf52840-sense'] );
	var selectedBoard : string;

	const riotDropDownBoard = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left, 101
	);

    
	context.subscriptions.push(riotDropDownBoard);


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "riot-launcher" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json

	const config = vscode.workspace.getConfiguration('riot-launcher');
	var riotBasePath : string = config.get<string>('riotPath') || '';

  	const provider = new CmdProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('riotView', provider));


	const setRiotPathDisposable = vscode.commands.registerCommand('riot-launcher.setRiotPath', async () => {
		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select RIOT Base Folder'
		});

		if (result && result.length > 0) {
			riotBasePath = result[0].fsPath;
			await config.update('riotPath', riotBasePath, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Set RIOT Path to: ${riotBasePath}`);
		}
		loadBoards().then( (loadedBoards : string[]) => boards = loadedBoards);
	});


const execAsync = util.promisify(exec);

async function loadBoards(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `cd "${riotBasePath}" && make info-boards`
    );

    const boards: string[] = stdout
      .toString()
      .trim()
      .split(/\s+/)       // besser als nur ' '
      .filter(Boolean);
    
	  vscode.window.showInformationMessage(`Loaded ${boards.length} boards from RIOT Path.`);
	  return boards.length > 0
      ? boards
      : ['adafruit-feather-nrf52840-sense'];
  	} catch (error) {
    	vscode.window.showErrorMessage(
     	'Error loading boards from RIOT Path. Using default board.'
    	);
    	return ['adafruit-feather-nrf52840-sense'];
  	}	
}

	let exampleFolderPath: string | undefined;

	const selectExampleFolderDisposable = vscode.commands.registerCommand('riot-launcher.selectExampleFolder', async () => {
		if (!riotBasePath) {
			vscode.window.showErrorMessage('RIOT Path is not set. Please set it first.');
			return;
		}

		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			defaultUri: vscode.Uri.file(riotBasePath),
			openLabel: 'Select Example Folder'
		});

		if (result && result.length > 0) {
			exampleFolderPath = result[0].fsPath;
			vscode.window.showInformationMessage(`Selected Example Folder: ${exampleFolderPath}`);
		}
	});

	const selectBoardDisposable = vscode.commands.registerCommand('riot-launcher.selectBoard', async () => {
	 	const pick : string | undefined = await vscode.window.showQuickPick(readBundledBoards());
		if(pick) {
			riotDropDownBoard.text = `$(chefron-down) ${pick}`;
			selectedBoard = pick;
		}
	});

	const flashDisposable = vscode.commands.registerCommand('riot-launcher.riotFlash', () => {
		const terminal : vscode.Terminal = vscode.window.createTerminal("Riot Launcher");
		// flash(terminal);
		receiveFlashTask().then( (flashTask : vscode.Task) => {
			vscode.tasks.executeTask(flashTask);
		});
	});

	const termDisposable = vscode.commands.registerCommand('riot-launcher.riotTerm', () => {
		const terminal : vscode.Terminal = vscode.window.createTerminal("Riot Launcher");
		receiveTermTask().then( (termTask : vscode.Task) => {
			vscode.tasks.executeTask(termTask);
		});
	});

	context.subscriptions.push(flashDisposable);

	context.subscriptions.push(termDisposable);

	async function receiveFlashTask() {
		var type : string 	= "riotTaskProvider";
		const board : string = selectedBoard ?? 'adafruit-feather-nrf52840-sense';
		const cDir : string = "cd " + exampleFolderPath;
		const cCompile : string = "make compile-commands BOARD=" + board;		
		const cCommand : string = "make flash BOARD=" + board;

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCompile + "&&" + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Build", "Flash Task", execution);
		return flash;
	}

	async function receiveTermTask() {
		var type : string 	= "riotTaskProvider";
		const board : string = selectedBoard ?? 'adafruit-feather-nrf52840-sense';
		const cDir : string = "cd " + exampleFolderPath;
		const cCompile : string = "make compile-commands";
		const cCommand : string = "make term BOARD=" + board;

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Build", "Flash Task", execution);
		return flash;
	}

	
	// Function runs via VS-Code Terminal (rather dirty way)
	async function flash(terminal: vscode.Terminal) {
		terminal.show(true);
		const cDir : string = "cd ~/Uni/IOT/RIOT/examples/basic/blinky";
		const cCommand : string = "make flash BOARD=adafruit-feather-nrf52840-sense";
		terminal.sendText(cDir + " && " + cCommand);
	}
}


// This method is called when your extension is deactivated
export function deactivate() {}

/* Items shown in TreeView */ 
class CmdItem extends vscode.TreeItem {
	constructor(label : string, commandId: any, icon: any) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.command = { command : commandId, title: label };
		if(typeof icon === 'string') {
			this.iconPath = new vscode.ThemeIcon(icon);
		} else if(icon) {
			this.iconPath = icon;
		}
	} 
}

class CmdProvider {
	entries: { label: string; cmd: string; icon: string; }[];
	constructor() {
		this.entries = [
			{
				label : 'Set RIOT Path',
				cmd: 'riot-launcher.setRiotPath',
				icon: 'file-directory'
			},
			{
				label : 'Select Example Folder',
				cmd: 'riot-launcher.selectExampleFolder',
				icon: 'folder'
			},
			{
				label : 'Select Board',
				cmd: 'riot-launcher.selectBoard',
				icon: 'keybindings-record-keys'
			},
			{
				label : 'Flash',
				cmd: 'riot-launcher.riotFlash',
				icon: 'zap'
			},
			{
				label : 'Term',
				cmd: 'riot-launcher.riotTerm',
				icon: 'terminal-powershell'
			}
		];			
	}
	getTreeItem(e: vscode.TreeItem) { return e; }
	getChildren() {
    	return Promise.resolve(this.entries.map(e => new CmdItem(e.label, e.cmd, e.icon)));
  	}

}
	