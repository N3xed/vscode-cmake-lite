import * as vscode from "vscode";
import * as fs from "fs";
import * as npath from "path";

import { LoggingChannel, createLogger } from "./logging";
import { CMakeProject } from "./cmake";
import { CppToolsLink } from "./cpptools";
import { ProjectPicker, PickerItem } from "./projectPicker";
import { Settings } from "./settings";

const log = createLogger("extension");


export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(LoggingChannel.createInstance("CMake Lite"));
    log.info("Activation of the extension");
    context.subscriptions.push(new Extension(() => { }, context));
}

export async function deactivate() {
    log.info("Deactivatation of the extension");
}

export class Extension extends vscode.Disposable {
    public readonly settings: Settings;
    private readonly _context: vscode.ExtensionContext;
    private readonly _picker: ProjectPicker;
    private readonly _link: CppToolsLink;
    private _project?: CMakeProject;

    constructor(callOnDispose: Function, context: vscode.ExtensionContext) {
        super(callOnDispose);
        this.settings = new Settings();
        this._context = context;
        this._project = undefined;
        this._picker = new ProjectPicker(() => { }, this);
        this._link = new CppToolsLink(() => { }, this);

        this._context.subscriptions.push(vscode.commands.registerCommand("vscode-cmake-lite.selectActiveProject",
            () => { this.askUserToSelectProject(); }
        ));
        this._context.subscriptions.push(vscode.commands.registerCommand("vscode-cmake-lite.activateProject",
            (uri) => { this.activateProject(uri); }
        ));
        this._context.subscriptions.push(vscode.commands.registerCommand("vscode-cmake-lite.activateLastProject",
            () => { this.activateLastProject(); }
        ));

        vscode.commands.executeCommand("vscode-cmake-lite.activateLastProject");
    }

    get project(): CMakeProject | undefined {
        return this._project;
    }

    get link(): CppToolsLink {
        return this._link;
    }

    async dispose(): Promise<void> {
        this._project?.dispose();
        this._link.dispose();
        super.dispose();
    }

    private async askUserToSelectProject(): Promise<void> {
        await this._picker.askUserToSelectProject();
    }

    async activateProject(uri: vscode.Uri | undefined): Promise<void> {
        if (uri) {
            if (!this._project || this._project.uri.fsPath !== uri.fsPath) {
                this._project?.dispose();
                this._project = new CMakeProject(() => { }, this, uri);
            }
        } else {
            this._project?.dispose();
            this._project = undefined;
            this._link.notify();
        }
        this._picker.activateProject(uri);
    }

    async activateLastProject(): Promise<void> {
        const uris = await this._picker.searchForProjects();
        if (uris.length === 0) { return; }
        const results = await Promise.all(uris.map(async u => {
            try {
                const reply = CMakeProject.getReplyDirectory(u).fsPath;
                const lastDates = fs.readdirSync(reply)
                    .map(d =>
                        fs.statSync(npath.join(reply, d)).mtime
                    )
                    .sort((a, b) => b.getTime() - a.getTime());
                const tuple: [Date, vscode.Uri] = [lastDates[0], u];
                return tuple;
            } catch (e) {
                if (e.code !== "ENOENT") {
                    throw e;
                }
            }
        }));

        const stats = results.filter(x => x && x[0]) as Array<[Date, vscode.Uri]>;
        if (stats.length === 0) {
            log.error("Could not activate the last project: No last project found.");
            return;
        }

        const lastStat = stats
            .sort((a, b) => b[0].getTime() - a[0].getTime())[0];
        if (lastStat) this.activateProject(lastStat[1]);
    }
}
