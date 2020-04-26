import * as vscode from "vscode";
import * as assert from "assert";

/**
 * Checks wether `input` is a `vscode.Uri`.
 * @param input The object to test.
 */
export function isUri(input: any): input is vscode.Uri {
    return input && input instanceof vscode.Uri;
}

/**
 * Checks wether `input` is a `string`.
 * @param input The object to test.
 */
export function isString(input: any): input is string {
    return typeof (input) === "string";
}

/**
 * Checks wether `input` is a `number`.
 * @param input The object to test.
 */
export function isNumber(input: any): input is number {
    return typeof (input) === "number";
}

/**
 * Checks wether `input` is a `boolean`.
 * @param input The object to test.
 */
export function isBoolean(input: any): input is boolean {
    return typeof (input) === "boolean";
}

/**
 * Checks wether `input` is an array.
 * @param input The object to test.
 */
export function isArray(input: any): input is any[] {
    return input instanceof Array;
}

/**
 * Checks wether `input` is either a `string` or `undefined`.
 * @param input The object to test.
 */
export function isOptionalString(input: any): input is string | undefined {
    return input === undefined || isString(input);
}

/**
 * Checks wether `input` is an `array` and all elements are `string`s.
 * @param input The object to test.
 */
export function isArrayOfString(input: any): input is string[] {
    return isArray(input) && input.every(isString);
}

/**
 * Checks wether `input` is an `array` of `string` or `undefined`.
 * Credit: https://github.com/microsoft/vscode-cpptools/blob/9ea6727743e5adb103243d98f79d3f3337763e23/Extension/src/common.ts
 * @param input The object to test.
 */
export function isOptionalArrayOfString(input: any): input is string[] | undefined {
    return input === undefined || isArrayOfString(input);
}

/**
 * Implements variable substitution logic for configuration strings.
 * 
 * Credit: https://github.com/microsoft/vscode-cpptools/blob/9ea6727743e5adb103243d98f79d3f3337763e23/Extension/src/common.ts
 * @param input The configuration string value to resolve.
 * @param additionalEnvironment Additional environment strings that have precendence over `process.env[]`.
 */
export function resolveVariables(input: string | undefined, additionalEnvironment?: { [key: string]: string | string[] }): string | null {
    if (!input) {
        if (isString(input)) return input;
        return null;
    }

    // Replace environment and configuration variables.
    let regexp: () => RegExp = () => /\$\{(env|config|workspaceFolder)?(\.|:)?(.*?)\}/g;
    let ret: string = input;
    const cycleCache: Set<string> = new Set();
    while (!cycleCache.has(ret)) {
        cycleCache.add(ret);
        ret = ret.replace(regexp(), (match: string, varType: string, ignored2: string, name: string) => {
            // Historically, if the variable didn't have anything before the "." or ":"
            // it was assumed to be an environment variable
            if (!varType) {
                varType = "env";
            }
            let newValue: string | undefined;
            switch (varType) {
                case "env": {
                    if (additionalEnvironment) {
                        const v: string | string[] | undefined = additionalEnvironment[name];
                        if (isString(v)) {
                            newValue = v;
                        } else if (input === match && isArrayOfString(v)) {
                            newValue = v.join(";");
                        }
                        if (newValue === undefined) {
                            newValue = process.env[name];
                        }
                    }
                    break;
                }
                case "config": {
                    const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
                    if (config) {
                        newValue = config.get<string>(name);
                    }
                    break;
                }
                case "workspaceFolder": {
                    if (name && vscode.workspace && vscode.workspace.workspaceFolders) {
                        const folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders.find(folder => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
                        if (folder) {
                            newValue = folder.uri.fsPath;
                        }
                    }
                    else {
                        const folder = vscode.workspace.workspaceFolders?.[0];
                        if (folder) {
                            newValue = folder.uri.fsPath;
                        }
                    }
                    break;
                }
                default: { assert.fail("unknown varType matched"); }
            }
            return newValue !== undefined ? newValue : match;
        });
    }

    // Resolve '~' at the start of the path.
    regexp = () => /^~/g;
    ret = ret.replace(regexp(), (match: string, name: string) => {
        const newValue: string | undefined = (process.platform === "win32") ? process.env.USERPROFILE : process.env.HOME;
        return newValue ? newValue : match;
    });

    return ret;
}