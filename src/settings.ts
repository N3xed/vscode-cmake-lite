import * as vscode from "vscode";
import { createLogger } from "./logging";
import { resolveVariables, isString } from "./common";

const log = createLogger("settings");

export interface OverrideSettings {
    intelliSenseMode: "msvc-x86" | "msvc-x64" | "gcc-x86" | "gcc-x64" | "clang-x86" | "clang-x64" | null;
    cppStandard: "c++98" | "c++03" | "c++11" | "c++14" | "c++17" | "c++20" | null;
    cStandard: "c89" | "c99" | "c11" | null;
    compilerPath: string | null;
    filterCompilerArgs: RegExp | null;
}

export class Settings implements vscode.Disposable {
    _override: OverrideSettings;
    _onChange: vscode.EventEmitter<Settings>;
    _onDidChangeConfiguration: vscode.Disposable;


    public get override(): OverrideSettings {
        return this._override;
    }

    public get onChange(): vscode.Event<Settings> {
        return this._onChange.event;
    }

    constructor() {
        this._override = {
            intelliSenseMode: null,
            cppStandard: null,
            cStandard: null,
            compilerPath: null,
            filterCompilerArgs: null
        };
        this._onChange = new vscode.EventEmitter<Settings>();
        this._onDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration(this.onDidChangeConfigurationHandler, this);

        this.update();
    }
    dispose() {
        this._onChange.dispose();
        this._onDidChangeConfiguration.dispose();
    }

    update(): void {
        const cfg = vscode.workspace.getConfiguration("CMakeLite.override");

        log.info("Updating settings");
        this._override.intelliSenseMode = cfg.get("intelliSenseMode") ?? null;
        this._override.cppStandard = cfg.get("cppStandard") ?? null;
        this._override.cStandard = cfg.get("cStandard") ?? null;
        this._override.compilerPath = resolveVariables(cfg.get("compilerPath")) ?? null;

        const filterCompilerArgs: string | null = cfg.get("filterCompilerArgs") ?? null;
        this._override.filterCompilerArgs = isString(filterCompilerArgs) ? new RegExp(filterCompilerArgs) : null;

        log.info(JSON.stringify(this, undefined, 4));
        this._onChange.fire(this);
    }

    private onDidChangeConfigurationHandler(evt: vscode.ConfigurationChangeEvent): any {
        if (evt.affectsConfiguration("CMakeLite")) {
            this.update();
        }
    }
}