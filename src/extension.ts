import * as vscode from 'vscode';
import {LessDefinitionProvider} from './lessdefinitionprovider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'less', scheme: 'file' },
      new LessDefinitionProvider()
    )
  );
}

export function deactivate() {}
