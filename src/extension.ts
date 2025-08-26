import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const GLOBAL_NIX_PROFILE = '/etc/profile.d/nix.sh';

interface Flake {
    name: string;
    path: string;
}

let flakes: Flake[] = [];

const taskSource = 'nix-devcontainer';

function getFileFromTemplate(context: vscode.ExtensionContext, ...paths: string[]): string {
    console.log(`getFileFromTemplate(${paths.join('/')}): Getting template file path`);
    try {
        const templatePath = path.join(context.extensionPath, 'templates', ...paths);
        if (fs.existsSync(templatePath)) {
            return templatePath;
        }
    } catch (error) {
        throw new Error(`Failed to get template file ${paths.join('/')}`);
    }
    throw new Error(`Template file ${paths.join('/')} not found`);
}


function read_file(file_path: string): Promise<string> {
    console.log(`read_file(${file_path}): Reading file contents`);
    return new Promise((resolve, reject) => {
        fs.readFile(file_path, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function updateNixProfile(context: vscode.ExtensionContext, flake: Flake): Promise<void> {
    const profile_path = `/etc/profile.d/nix-devcontainer-${flake.name}.sh`;
    console.log(`updateNixProfile(${flake.path}, ${profile_path}): Starting profile update`);
    const flake_nix_path = path.join(flake.path, "flake.nix");
    if (!fs.existsSync(flake_nix_path)) {
        console.log(`updateNixProfile(${flake_nix_path}): flake.nix does not exist`);
        vscode.window.showErrorMessage(`flake.nix not found in ${flake.path}\n${flake_nix_path} does not exist`);
        return;
    } else {
        console.log(`updateNixProfile(${flake_nix_path}): flake.nix exists`);
    }
    let profile_contents = '';
    try {
        profile_contents = await read_file(profile_path);
        console.log(`updateNixProfile(${profile_path}): Profile contents read, length: ${profile_contents.length}`);
    } catch {
        profile_contents = '';
        console.log(`updateNixProfile(${profile_path}): Profile read failed, set to empty string`);
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Updating Nix profile: ${profile_path}`,
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Running nix print-dev-env...' });
        return new Promise<void>((resolve) => {
            console.log(`updateNixProfile(${flake.path}): Starting shell task`);
            const taskDefinition = { type: 'shell' };
            const taskName = `DevShell ${flake.path}`;
            const shellExecution = new vscode.ShellExecution(
                'bash',
                ['-c', `
                    set -euo pipefail
                    nix print-dev-env ${flake.path} | grep -v -F 'LINENO' | sudo tee ${profile_path} > /dev/null
                    `]
            );
            const task = new vscode.Task(
                taskDefinition,
                vscode.TaskScope.Workspace,
                taskName,
                taskSource,
                shellExecution
            );
            console.log(`updateNixProfile(${taskName}): Executing task to update profile`);
            vscode.tasks.executeTask(task);
            const disposable = vscode.tasks.onDidEndTaskProcess(async (e) => {
                console.log(`updateNixProfile(${e.execution.task.name}, exitCode: ${e.exitCode}): Task process ended`);
                if (e.execution.task.name === taskName) {
                    const new_profile_contents = await read_file(profile_path);
                    console.log(`updateNixProfile(${profile_path}): New profile contents length: ${new_profile_contents.length}`);
                    if (e.exitCode === 0) {
                        // Remove the task's terminal
                        vscode.window.terminals.forEach(terminal => {
                            if (terminal.name === taskName) {
                                console.log(`updateNixProfile(${terminal.name}): Disposing terminal`);
                                terminal.dispose();
                            }
                        });
                        if (new_profile_contents === profile_contents) {
                            console.log(`updateNixProfile(${profile_path}): Profile is unchanged`);
                            vscode.window.showInformationMessage(`DevShell ${flake.name}: unchanged`);
                        } else {
                            console.log(`updateNixProfile(${profile_path}): Profile updated successfully`);
                            vscode.window.showInformationMessage(`DevShell ${flake.name}: updated\nPlease reload the window to apply changes.`, 'Reload Window').then((action) => {
                                if (action === 'Reload Window') {
                                    console.log('updateNixProfile(Reload Window): User selected reload window');
                                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                                }
                            });
                        }
                    } else {
                        console.error(`updateNixProfile(${flake.name}): Failed to build DevShell`);
                        vscode.window.showErrorMessage(`DevShell ${flake.name}: failed to build`);
                    }
                    disposable.dispose();
                    console.log(`updateNixProfile(${flake.path}): Disposable disposed, resolving promise`);
                    resolve();
                }
            });
        });
    });
}

async function findFlakes(context: vscode.ExtensionContext): Promise<void> {
    console.log('findFlakes(): Finding Nix flakes');

    flakes = [{
        name: 'default',
        path: getFileFromTemplate(context, "flake")
    }];

    // find flake.nix in workspace folders
    vscode.workspace.workspaceFolders?.forEach(folder => {
        const flake_path = path.join(folder.uri.fsPath, "flake.nix");
        if (fs.existsSync(flake_path)) {
            console.log(`findFlakes(${folder.uri.fsPath}): flake.nix found in workspace folder`);
            flakes.push({
                name: path.basename(folder.uri.fsPath),
                path: folder.uri.fsPath
            });
        }
    });

    const flakeNames = flakes.map(f => f.name).join(', ');
    vscode.window.showInformationMessage(`Found ${flakes.length} flake(s): ${flakeNames}`);
}

async function update_flakes(context: vscode.ExtensionContext): Promise<void> {
    console.log('update_flakes(): Updating Nix flakes');
    if (flakes.length === 0) {
        vscode.window.showWarningMessage('No flakes found. Run "Find Flakes" first.');
        return;
    }
    for (const flake of flakes) {
        updateNixProfile(context, flake);
    }
}

async function update_flake(context: vscode.ExtensionContext): Promise<void> {
    // Show quick pick list of available flakes
    const flakeOptions = flakes.map(flake => ({
        label: flake.name,
        description: flake.path
    }));

    if (flakeOptions.length === 0) {
        vscode.window.showErrorMessage('No flakes found. Run "Find Flakes" first.');
        return;
    }

    const selectedFlake = await vscode.window.showQuickPick(flakeOptions, {
        placeHolder: 'Select a flake to update',
        matchOnDescription: true
    });

    if (!selectedFlake) {
        console.log('update_flake(): No flake selected');
        return;
    }

    const flake = flakes.find(f => f.name === selectedFlake.label);
    if (!flake) {
        console.log(`update_flake(): Flake not found`);
        vscode.window.showErrorMessage('Flake not found');
        return;
    }
    console.log(`update_flake(${flake.name}): Updating flake`);
    await updateNixProfile(context, flake);
}


async function find_and_update_all_flakes(context: vscode.ExtensionContext): Promise<void> {
    console.log('find_and_update_all_flakes(): Finding and updating all Nix flakes');
    await findFlakes(context);
    await update_flakes(context);
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('activate(): Extension activation started');
    console.log('activate(): Nix Devcontainer extension is now active!');

    let find_flakes_command = vscode.commands.registerCommand('nix-devcontainer.find-flakes', async () => {
        await findFlakes(context);
    });

    let update_flake_command = vscode.commands.registerCommand('nix-devcontainer.update-flake', async () => {
        await update_flake(context);
    });

    let update_all_flakes_command = vscode.commands.registerCommand('nix-devcontainer.update-all-flakes', async () => {
        await update_flakes(context);
    });

    let find_and_update_all_flakes_command = vscode.commands.registerCommand('nix-devcontainer.find-and-update-all-flakes', async () => {
        await find_and_update_all_flakes(context);
    });

    context.subscriptions.push(find_flakes_command, update_flake_command, update_all_flakes_command, find_and_update_all_flakes_command);

    // Auto-activate: Find and update flakes after a short delay to allow workspace to fully load
    //setTimeout(async () => {
    //    try {
    //        console.log('activate(): Auto-running find and update all flakes');
    //        find_and_update_all_flakes(context);
    //    } catch (error) {
    //        console.error('activate(): Error during auto-activation:', error);
    //        vscode.window.showErrorMessage(`Nix DevContainer auto-activation failed: ${error}`);
    //    }
    //}, 2000); // 2 second delay to ensure workspace is ready

    find_and_update_all_flakes(context);
}

export function deactivate() { }
