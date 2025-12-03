// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as util from 'util';
import { realpathSync } from 'fs';
import * as path from 'path';
import { BoardRecognizer } from './boards/BoardRecognizer';
import { PortDiscovery } from './boards/PortDiscoverer';
import { DeviceProvider } from './DeviceProvider';
import { Device } from './device';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const FOLDER_BOARD_CACHE_KEY = 'riot-launcher.folderBoardMap';
	const ACTIVE_FOLDER_KEY = 'riot-launcher.activeFolder';


	const storedMap = context.workspaceState.get<Record<string, string>>(FOLDER_BOARD_CACHE_KEY, {});
	let folderBoardMap = new Map<string, string>(Object.entries(storedMap));
	
	let activeFolderPath: string | undefined = context.workspaceState.get<string>(ACTIVE_FOLDER_KEY);

	let selectedBoard: string | undefined;

	const decorationProvider = new RiotFileDecorationProvider();

	refreshWorkspaceFolderLabels();
	decorationProvider.updateState(activeFolderPath, folderBoardMap);

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider)
	);


	async function readBundledBoards(): Promise<string[]> {
		const text : string = await fs.promises.readFile('./Uni/IOT/riot-launcher/resources/boards.txt', 'utf8');
		return text.split('\n').filter(line => line.length > 0);
	}

	let boards : string[] = await readBundledBoards().catch<string[]>( (_err) => ['adafruit-feather-nrf52840-sense'] );

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

	const deviceProvider : DeviceProvider = new DeviceProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('deviceView', deviceProvider));

	const addDeviceDisposable = vscode.commands.registerCommand('riot-launcher.addDevice', async (device : Device) => {
		deviceProvider.addDevice(new Device());
	});

	const setBoardDeviceDisposable = vscode.commands.registerCommand('riot-launcher.changeBoardDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
		}
		const pick : string | undefined = await vscode.window.showQuickPick(boards, {
			title: 'Device configuration',
			placeHolder: 'Select new board for device'
		});
		if(pick) {
			device.setBoard(pick);
			vscode.window.showInformationMessage(`Changed board of device to: ${pick}`);
			deviceProvider.refresh();
		}
	});

	const setPortDeviceDisposable = vscode.commands.registerCommand('riot-launcher.changePortDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
		}
		const newPort : string | undefined = await vscode.window.showInputBox({
			title: 'Device configuration',
			prompt: 'Enter new port path',
			value: device.portPath
		});	
		if(newPort) {
			device.setPortPath(newPort);
			vscode.window.showInformationMessage(`Changed port of device to: ${newPort}`);
			deviceProvider.refresh();
		}
	});
	
	const removeDeviceDisposable = vscode.commands.registerCommand('riot-launcher.removeDevice', async (device: Device) => {
		if(!device) {
			vscode.window.showErrorMessage('No device selected.');
			return;
		}
		deviceProvider.removeDevice(device);
		vscode.window.showInformationMessage(`Removed device at port: ${device.portPath}`);
	});

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
		loadBoards().then( (loadedBoards : string[]) => boards = loadedBoards).catch( (_err) => {
			vscode.window.showErrorMessage("Error loading boards from RIOT Path, using offline boards as fallback.");
		});
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
		.split(/\s+/)       //Escape characters for SPACE
		.filter(Boolean);
		
		vscode.window.showInformationMessage(`Loaded ${boards.length} boards from RIOT Path.`);
		if(boards.length > 0) {
			return boards;
		}else {
			throw new Error('No boards found in RIOT Path.');
		}
	} catch (error) {
		throw new Error('Error loading boards from RIOT Path.');
	}	
}


	const selectExampleFolderDisposable = vscode.commands.registerCommand('riot-launcher.selectExampleFolder', async () => {
		if (!riotBasePath) {
			vscode.window.showErrorMessage('RIOT Path is not set. Please set it first.');
			return;
		}

		const result = await vscode.window.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: 'Select Example Folder'
		});

		if (result && result.length > 0) {
			activeFolderPath = result[0].fsPath;
			context.workspaceState.update(ACTIVE_FOLDER_KEY, activeFolderPath);
			vscode.window.showInformationMessage(`Selected Example Folder: ${activeFolderPath}`);
			try {
				const { stdout } = await execAsync(
					'cd ' + activeFolderPath + ' && make info-debug-variable-RIOTBASE'
				);
				riotBasePath = stdout.toString().trim();
				vscode.window.showInformationMessage(`Determined RIOT Base Path: ${riotBasePath}`);
				loadBoards().then( (loadedBoards : string[]) => boards = loadedBoards);

				if(selectedBoard) {
					folderBoardMap.set(activeFolderPath, selectedBoard);
					await context.workspaceState.update(
						FOLDER_BOARD_CACHE_KEY,
						Object.fromEntries(folderBoardMap)
					);
					vscode.window.showInformationMessage(`Associated Board "${selectedBoard}" with Folder "${activeFolderPath}".`);
					receiveCompileCommandsTask().then( (compileTask : vscode.Task) => {
						vscode.tasks.executeTask(compileTask);
						vscode.window.showInformationMessage(`Successfully compiled commands.`);
					});
				}
				const currentFolders = vscode.workspace.workspaceFolders || [];					
				// vscode.workspace.updateWorkspaceFolders(
				// 	currentFolders.length,
				// 	0,
				// 	{ 
				// 		// TODO: Discuss whether opening the RIOT Base Path is desired
				// 		// uri: isSubDirecttory(riotBasePath, activeFolderPath) ? 
				// 		// vscode.Uri.file(riotBasePath) : vscode.Uri.file(activeFolderPath) 
				// 		uri: vscode.Uri.file(activeFolderPath),
				// 		name: path.basename(activeFolderPath + ' (Active)')
				// 	}
				// );
				refreshWorkspaceFolderLabels(); 
				decorationProvider.updateState(activeFolderPath, folderBoardMap);
			}catch (error) {
				vscode.window.showErrorMessage(
					'Error determining RIOT Base Path from Makefile.'
				);
			}
		}
	});

	async function refreshWorkspaceFolderLabels() {
		const currentFolders = vscode.workspace.workspaceFolders || [];
		const entries : {uri: vscode.Uri; name? : string}[] = [];

		for (const f of currentFolders) {
			const fPath = f.uri.fsPath;

			const name = path.normalize(activeFolderPath ?? '') === path.normalize(fPath) ? 
				path.basename(fPath) + ' (Active)' : path.basename(fPath); 
			entries.push({uri: f.uri, name});
		}
		if(activeFolderPath){
			const alreadyPresent = entries.some( e => path.normalize(e.uri.fsPath) === path.normalize(activeFolderPath ?? ''));
			if(!alreadyPresent) {
				entries.push({
					uri: vscode.Uri.file(activeFolderPath),
					name: path.basename(activeFolderPath) + ' (Active)'
				});
			}
			const exampleUri = vscode.Uri.file(activeFolderPath);
			await vscode.commands.executeCommand('revealInExplorer', exampleUri);
		}
		vscode.workspace.updateWorkspaceFolders(0, currentFolders.length, ...entries);
	}

	const setActiveExampleFolderDisposable = vscode.commands.registerCommand('riot-launcher.setActiveExampleFolder', async (uri: vscode.Uri) => {
		activeFolderPath = uri.fsPath;
		selectedBoard = folderBoardMap.get(activeFolderPath);
		if(selectedBoard) {
			receiveCompileCommandsTask().then( (compileTask : vscode.Task) => {
				vscode.tasks.executeTask(compileTask);
				vscode.window.showInformationMessage(`Successfully compiled commands.`);
			});
		}
		vscode.window.showInformationMessage(`Set Active Example Folder to: ${activeFolderPath}` + ' with Board: ' + (selectedBoard ?? 'None'));
		context.workspaceState.update(ACTIVE_FOLDER_KEY, activeFolderPath);
		refreshWorkspaceFolderLabels();
		decorationProvider.updateState(activeFolderPath, folderBoardMap);
	});

	const selectBoardDisposable = vscode.commands.registerCommand('riot-launcher.selectBoard', async () => {
	 	const pick : string | undefined = await vscode.window.showQuickPick(boards);
		if(pick) {
			riotDropDownBoard.text = `$(chefron-down) ${pick}`;
			selectedBoard = pick;

			vscode.window.showInformationMessage(`Selected Board: ${selectedBoard}`);
			if(activeFolderPath) {
				folderBoardMap.set(activeFolderPath ?? '', selectedBoard);
				await context.workspaceState.update(
					FOLDER_BOARD_CACHE_KEY,
					Object.fromEntries(folderBoardMap)
				);

				vscode.window.showInformationMessage(`Associated Board "${selectedBoard}" with Folder "${activeFolderPath}".`);
				receiveCompileCommandsTask().then( (compileTask : vscode.Task) => {
					vscode.tasks.executeTask(compileTask);
					vscode.window.showInformationMessage(`Successfully compiled commands.`);
				});
				decorationProvider.updateState(activeFolderPath, folderBoardMap);
			}
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

	const searchPortsDisposable = vscode.commands.registerCommand('riot-launcher.detectPorts', async () => {
		const boardRegonizer = new BoardRecognizer (context, boards);
		const portDiscoverer = new PortDiscovery(boardRegonizer);
		const foundDevices = await portDiscoverer.discoverPorts();
		deviceProvider.refresh(foundDevices);

	});

	context.subscriptions.push(flashDisposable);

	context.subscriptions.push(termDisposable);

	async function receiveFlashTask() {
		var type : string 	= "riotTaskProvider";
		const board : string = selectedBoard ?? 'adafruit-feather-nrf52840-sense';
		if(!activeFolderPath) {
			vscode.window.showErrorMessage('Example Folder is not set correctly.');
		}
		const cDir : string = "cd " + activeFolderPath;
		const cCommand : string = "make flash BOARD=" + board;

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Flash", "riot-launcher", execution);
		return flash;
	}

	async function receiveTermTask() {
		var type : string 	= "riotTaskProvider";
		const board : string = selectedBoard ?? 'adafruit-feather-nrf52840-sense';
		if(activeFolderPath) {
			vscode.window.showErrorMessage('Example Folder is not set correctly.');
		}
		const cDir : string = "cd " + activeFolderPath;
		const cCompile : string = "make compile-commands";
		const cCommand : string = "make term BOARD=" + board;

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Term", "riot-launcher", execution);
		return flash;
	}

	async function receiveCompileCommandsTask() {
		var type : string 	= "riotTaskProvider";
		const board : string = selectedBoard ?? 'adafruit-feather-nrf52840-sense';
		if(!activeFolderPath) {
			vscode.window.showErrorMessage('Example Folder is not set correctly.');
		}
		const cDir : string = "cd " + activeFolderPath;
		const cCompile : string = "make compile-commands BOARD=" + board;		

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCompile);
		var task : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
					"Compile Commands", "riot-launcher", execution);
		return task;
	}

	async function receiveRiotBasePath() {
		var type : string 	= "riotTaskProvider";
		const cDir : string = "cd " + activeFolderPath;
		const cDetermineRiot : string = "make info-debug-variable-RIOTBASE";

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cDetermineRiot);
		var task : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Set Path", "riot-launcher", execution);
		return task;
	}
	
	// Function runs via VS-Code Terminal (rather dirty way)
	async function flash(terminal: vscode.Terminal) {
		terminal.show(true);
		const cDir : string = "cd ~/Uni/IOT/RIOT/examples/basic/blinky";
		const cCommand : string = "make flash BOARD=adafruit-feather-nrf52840-sense";
		terminal.sendText(cDir + " && " + cCommand);
	}

	function isSubDirecttory(parent: string, dir : string) : boolean {
		const parentReal = realpathSync(parent);
		const dirReal = realpathSync(dir);
		const relative = path.relative(parentReal, dirReal);
		return (
			relative !== '' &&
			!relative.startsWith('..') &&
			!path.isAbsolute(relative)
		);
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
				label : 'Select Example Folder',
				cmd: 'riot-launcher.selectExampleFolder',
				icon: 'file-directory'
			},
			{
				label : 'Detect Ports',
				cmd: 'riot-launcher.detectPorts',
				icon: 'compass'
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
	
class RiotFileDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

	private activeFolderPath: string | undefined;
	private folderBoardMap = new Map<string, string>();
	
	constructor(){}

	public updateState(activePath: string | undefined, folderBoardMap: Map<string, string>) {
		this.activeFolderPath = activePath;
		this.folderBoardMap = folderBoardMap;
		this._onDidChangeFileDecorations.fire(undefined);
	}

	provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.FileDecoration | undefined{
		const fsPath = uri.fsPath;

		const normalizedUriPath = path.normalize(fsPath);
		const normalizeActivePath = this.activeFolderPath ? path.normalize(this.activeFolderPath) : undefined;

		const isActive = normalizeActivePath === normalizedUriPath;
		const assignedBoard = this.folderBoardMap.get(normalizedUriPath);

		if(isActive) {
			return {
				badge: 'A',
				tooltip: `Active RIOT Folder ${assignedBoard ? `- Board: ${assignedBoard}` : ''}`,
				color: new vscode.ThemeColor('charts.blue'),
				propagate: false
			};
		}
	
		if(assignedBoard) {
			return {
				badge: 'B',
				tooltip: `Assigned Board: ${assignedBoard}`,
			};
		}

		return undefined;
	}
}

