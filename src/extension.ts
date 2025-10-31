// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { deprecate } from 'util';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    var type = "riotTaskProvider";
    vscode.tasks.registerTaskProvider(type, {
        provideTasks(token?: vscode.CancellationToken) {
            var execution = new vscode.ShellExecution("echo \"Hello World\"");
            var problemMatchers = ["$myProblemMatcher"];
            return [
                new vscode.Task({type: type}, vscode.TaskScope.Workspace,
                    "Build", "myExtension", execution, problemMatchers)
            ];
        },
        resolveTask(task: vscode.Task, token?: vscode.CancellationToken) {
            return task;
        }
    });
// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "riot-launcher" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
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

	// Function runs via VS-Code Terminal (rather dirty way)
	async function flash(terminal: vscode.Terminal) {
		terminal.show(true);
		const cDir : string = "cd ~/Uni/IOT/RIOT/examples/basic/blinky";
		const cCommand : string = "make flash BOARD=adafruit-feather-nrf52840-sense";
		terminal.sendText(cDir + " && " + cCommand);
	}

	async function receiveFlashTask() {
		var type : string 	= "riotTaskProvider";
		const cDir : string = "cd ~/Uni/IOT/RIOT/examples/basic/leds_shell";
		const cCommand : string = "make flash BOARD=adafruit-feather-nrf52840-sense";

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Build", "Flash Task", execution);
		return flash;
	}

	async function receiveTermTask() {
		var type : string 	= "riotTaskProvider";
		const cDir : string = "cd ~/Uni/IOT/RIOT/examples/basic/leds_shell";
		const cCommand : string = "make term BOARD=adafruit-feather-nrf52840-sense";

		var execution : vscode.ShellExecution = new vscode.ShellExecution(cDir + " && " + cCommand);
		var flash : vscode.Task = new vscode.Task({type: type} , vscode.TaskScope.Workspace,
                    "Build", "Flash Task", execution);
		return flash;
	}

	const riotFlashStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left, 100
    );
	
    riotFlashStatusBarItem.text = "$(zap)Flash";
    riotFlashStatusBarItem.command = 'riot-launcher.riotFlash';
    riotFlashStatusBarItem.tooltip = 'Flash RIOT application onto connected board';
    riotFlashStatusBarItem.show();

	const riotTermStatusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left, 99
	);

	riotTermStatusBarItem.text = "$(play-circle)Term";
    riotTermStatusBarItem.command = 'riot-launcher.riotTerm';
    riotTermStatusBarItem.tooltip = 'Enter RIOT terminal for connected board';
    riotTermStatusBarItem.show();
    
    context.subscriptions.push(riotFlashStatusBarItem);
	context.subscriptions.push(riotTermStatusBarItem);


}


// This method is called when your extension is deactivated
export function deactivate() {}
