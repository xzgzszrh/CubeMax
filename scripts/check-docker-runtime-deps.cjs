const fs = require("fs");
const path = require("path");
const Module = require("module");

const appRoot = path.resolve(__dirname, "..");
const builtins = new Set(Module.builtinModules.flatMap((name) => [name, name.replace(/^node:/, "")]));

function skipQuotedLiteral(source, start, quote) {
    for (let index = start + 1; index < source.length; index += 1) {
        if (source[index] === "\\") {
            index += 1;
        } else if (source[index] === quote) {
            return index + 1;
        }
    }

    return source.length;
}

function skipComment(source, start) {
    if (source[start + 1] === "/") {
        const lineEnd = source.indexOf("\n", start + 2);
        return lineEnd === -1 ? source.length : lineEnd + 1;
    }

    const blockEnd = source.indexOf("*/", start + 2);
    return blockEnd === -1 ? source.length : blockEnd + 2;
}

function isIdentifierCharacter(character) {
    return Boolean(character) && /[A-Za-z0-9_$]/.test(character);
}

function readImportSpecifiers(source) {
    const specifiers = [];

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        // Import-like text in prompts, comments, and other string literals is not a dependency.
        if (character === "\"" || character === "'") {
            index = skipQuotedLiteral(source, index, character) - 1;
            continue;
        }
        if (character === "`" || (character === "/" && (source[index + 1] === "/" || source[index + 1] === "*"))) {
            index = character === "`" ? skipQuotedLiteral(source, index, "`") - 1 : skipComment(source, index) - 1;
            continue;
        }
        if (!/[A-Za-z_$]/.test(character)) {
            continue;
        }

        let end = index + 1;
        while (isIdentifierCharacter(source[end])) {
            end += 1;
        }
        const identifier = source.slice(index, end);
        if (identifier !== "require" && identifier !== "import") {
            index = end - 1;
            continue;
        }

        let cursor = end;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        if (source[cursor] !== "(") {
            index = end - 1;
            continue;
        }
        cursor += 1;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        const quote = source[cursor];
        if (quote !== "\"" && quote !== "'") {
            index = end - 1;
            continue;
        }

        const literalEnd = skipQuotedLiteral(source, cursor, quote);
        const specifier = source.slice(cursor + 1, literalEnd - 1);
        cursor = literalEnd;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        if (source[cursor] === ")") {
            specifiers.push(specifier);
            index = cursor;
        } else {
            index = end - 1;
        }
    }

    return specifiers;
}

function walk(dir, files = []) {
    if (!fs.existsSync(dir)) {
        return files;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.name === "node_modules" || entry.name === ".turbo") {
            continue;
        }

        if (fullPath.startsWith(path.join(appRoot, "packages/client/dist"))) {
            continue;
        }

        if (fullPath.startsWith(path.join(appRoot, "public/web"))) {
            continue;
        }

        if (entry.isDirectory()) {
            walk(fullPath, files);
        } else if (fullPath.endsWith(".js") && fullPath.includes(`${path.sep}dist${path.sep}`)) {
            files.push(fullPath);
        }
    }

    return files;
}

function isExternalSpecifier(specifier) {
    if (
        !specifier ||
        specifier.startsWith(".") ||
        specifier.startsWith("/") ||
        specifier.startsWith("#") ||
        specifier.startsWith("node:")
    ) {
        return false;
    }

    const firstSegment = specifier.split("/")[0];
    return !builtins.has(firstSegment) && !builtins.has(specifier);
}

const scanRoots = ["packages", "mcp-server"]
    .map((dir) => path.join(appRoot, dir))
    .filter((dir) => fs.existsSync(dir));

const missing = new Map();
const checked = new Set();
const files = scanRoots.flatMap((dir) => walk(dir));

for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of readImportSpecifiers(source)) {
        if (!isExternalSpecifier(specifier)) {
            continue;
        }

        const key = `${file}\0${specifier}`;
        if (checked.has(key)) {
            continue;
        }
        checked.add(key);

        try {
            require.resolve(specifier, { paths: [path.dirname(file)] });
        } catch (error) {
            if (error && error.code === "MODULE_NOT_FOUND") {
                if (!missing.has(specifier)) {
                    missing.set(specifier, new Set());
                }
                missing.get(specifier).add(path.relative(appRoot, file));
            } else {
                throw error;
            }
        }
    }
}

if (missing.size > 0) {
    console.error("Missing production runtime dependencies detected:");
    for (const [specifier, usedBy] of [...missing.entries()].sort()) {
        console.error(`- ${specifier}`);
        for (const file of [...usedBy].slice(0, 12)) {
            console.error(`  ${file}`);
        }
    }
    process.exit(1);
}

console.log(
    `Docker runtime dependency check passed: ${files.length} server dist files, ${checked.size} external references.`,
);
