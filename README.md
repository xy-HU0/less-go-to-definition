# less-go-to-definition README

Adds "Go to Definition" support for Less mixins and variables in VS Code, allowing you to instantly jump from a symbol's usage to its source.

## Features

* **Go to Definition for Mixins**: `Ctrl+Click` or press `F12` on a mixin call (e.g., `.my-mixin();`) to jump directly to its definition.

* **Go to Definition for Variables**: `Ctrl+Click` or press `F12` on a variable usage (e.g., `color: @my-variable;`) to jump to its definition.

## Extension Settings

This extension contributes the following setting:

* `less-go-to-definition.includePaths`: An array of absolute paths that the extension should use as search directories for non-relative `@import` statements. This is essential for projects where shared Less files are located in a central directory.

**Example `.vscode/settings.json`:**

```json
{
  "less-go-to-definition.includePaths": [
    "/path/to/your/project/shared/styles",
  ]
}
```

## Release Notes

### 0.0.3

Added support for recursive search.

### 0.0.1

Initial release of the Less Go To Definition extension.

---

