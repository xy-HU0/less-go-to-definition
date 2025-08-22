import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class LessDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | undefined> {
    // Check for a mixin first
    const mixin = this.getMixinAtPosition(document, position);
    if (mixin) {
      return this.findDefinition(document.uri, mixin);
    }

    // If not a mixin, check for a variable
    const variable = this.getVariableAtPosition(document, position);
    if (variable) {
      return this.findDefinition(document.uri, variable);
    }

    return undefined;
  }

  private getVariableAtPosition(document: vscode.TextDocument, position: vscode.Position): RegExp | undefined {
    const line = document.lineAt(position.line);
    const lineText = line.text;
     // First, check if the line is an @import statement. If so, ignore it.
    if (lineText.trim().startsWith('@import')) {
        return undefined;
    }

    // This regex finds both @variable and @{variable}
    const variableRegex = /@\{?([\w-]+)\}?/g;
    let match;
    while ((match = variableRegex.exec(lineText)) !== null) {
      const variableName = match[1];
      const startChar = match.index;
      const endChar = startChar + match[0].length;

      if (position.character >= startChar && position.character <= endChar) {
        // Example: Matches "@my-variable:"
        return new RegExp(`^\\s*@(${variableName})\\s*:`);
      }
    }
    
    return undefined;
  }

  private getMixinAtPosition(document: vscode.TextDocument, position: vscode.Position): RegExp | undefined {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Regex to find patterns like ".mixin-name()" or ".mixin-name(parameter)"
    // It looks for a dot, a name, and parentheses.
    const mixinRegex = /\.([\w-]+)\s*\(.*?\)/;

    const mixinMatch = mixinRegex.exec(lineText);

    // If a match is found, check if the cursor is within its bounds.
    if (mixinMatch) {
      const start = mixinMatch.index;
      const end = start + mixinMatch[0].length;
      const mixinName = mixinMatch[1];

      // Check if the cursor is inside the parentheses.
      const openParenIndex = mixinMatch[0].indexOf('(');
      if (position.character >= start + openParenIndex + 1) {
        return undefined;
      }

      if (position.character >= start && position.character <= end && mixinName) {
        // Example: Matches ".my-mixin(...) {"
        return new RegExp(`^\\s*\\.(${mixinName})\\(.*\\)\\s*\\{`)
      }
    }

    return undefined;
  }

  private findDefinitionInFile(fileContent: string, definitionRegex: RegExp, fileUri: vscode.Uri): vscode.Location | undefined {
    const lines = fileContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = definitionRegex.exec(line);
      if (match) {
        const position = new vscode.Position(i, match.index);
        return new vscode.Location(fileUri, position);
      }
       // If this line starts any other block that is not our target, skip past it.
      if (line.includes('{')) {
        let openBraces = 1;

        for (let j = i + 1; j < lines.length; j++) {
          const innerLine = lines[j];
          if (innerLine.includes('{')) openBraces++;
          if (innerLine.includes('}')) openBraces--;
          
          if (openBraces === 0) {
            // We found the end of the block.
            i = j;
            break; 
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Tries to find an imported file by checking relative paths and configured include paths.
   */
  private async resolveImportPath(importPath: string, currentFileUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const currentDir = path.dirname(currentFileUri.fsPath);


    // 1. First, check the configured include paths.
    const config = vscode.workspace.getConfiguration('less-go-to-definition');
    const includePaths = config.get<string[]>('includePaths', []);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';

    for (const includePath of includePaths) {
       // Resolve placeholders like ${workspaceFolder}
      const resolvedIncludePath = includePath.replace('${workspaceFolder}', workspaceRoot);
      const potentialUri = vscode.Uri.file(path.resolve(resolvedIncludePath, importPath));
      try {
        await vscode.workspace.fs.stat(potentialUri);
        return potentialUri; 
      } catch {
      }
    }

    // 2.  If not found, try to resolve relative to the current file.
    const relativeUri = vscode.Uri.file(path.resolve(currentDir, importPath));
    try {
      await vscode.workspace.fs.stat(relativeUri);
      return relativeUri; 
    } catch {
    }
  }

  /**
   * Searches for a symbol's definition using a Breadth-First Search (BFS) algorithm.
   */
  private async findDefinition(
    startFileUri: vscode.Uri,
    definitionRegex: RegExp,
  ): Promise<vscode.Location | undefined> {
    const queue: vscode.Uri[] = [startFileUri];
    const visitedFiles = new Set<string>();

    while (queue.length > 0) {
      const fileUri = queue.shift();
      if (!fileUri || visitedFiles.has(fileUri.fsPath)) {
        continue;
      }
      visitedFiles.add(fileUri.fsPath);
      try {
        const fileContentBytes = await vscode.workspace.fs.readFile(fileUri);
        const fileContent = Buffer.from(fileContentBytes).toString('utf8');

        // 1. Search for the definition in the current file.
        const locationInFile = this.findDefinitionInFile(fileContent, definitionRegex, fileUri);
        if (locationInFile) {
          return locationInFile;
        }

        // 2. If not found, search in imported files.
        const lines = fileContent.split('\n');
        for (const line of lines) {
          const importMatch = line.match(/@import\s+(?:\(reference\)\s+)?["'](.+?)["'];/);
          if (importMatch && importMatch[1]) {
            let importPath = importMatch[1];
            if (!importPath.endsWith('.less')) {
              importPath += '.less';
            }
            
            const importedFileUri = await this.resolveImportPath(importPath, fileUri);
            if (importedFileUri) {
              queue.push(importedFileUri);
            }
          } else if (line.trim() !== '' && !line.trim().startsWith('//')) {
            // If we find a non-empty, non-comment line that isn't an import,
            // and all imports are at the top, we can stop searching for more imports in this file.
            break;
          }
        }
      } catch (error) {
        // Could not read file, just continue.
      }
    }

    

    return undefined;
  }
}
