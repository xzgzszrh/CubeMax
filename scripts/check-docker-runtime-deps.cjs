const fs = require("fs");
const path = require("path");
const Module = require("module");

const appRoot = process.cwd();
const builtins = new Set(Module.builtinModules.flatMap((name) => [name, name.replace(/^node:/, "")]));
const importPattern = /(?:require\(|import\()\s*['"]([^'"]+)['"]\s*\)/g;

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
    let match;

    while ((match = importPattern.exec(source))) {
        const specifier = match[1];

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
