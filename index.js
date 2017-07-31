'use strict';

function ModuleError(message) {
    Error.call(this, message);
}
ModuleError.prototype = Object.create(Error.prototype);
ModuleError.prototype.constructor = ModuleError;

function ModuleDefinition(name, path, meta) {
    this.name = name;
    this.path = path;
    if (!meta) throw new ModuleError('meta');
    this.meta = meta;
    this.payload = undefined;
}

function Module(definition) {

    var isInstalled = false;

    var shouldInstall = function ($, verbose) {
        if (undefined === definition.meta.on || typeof definition.meta.on.installing !== 'function') {
            if (verbose)
                console.log(`Pre-installation Check NOT FOUND. Module will be installed.`)
            return true;
        } else {
            if (verbose)
                console.log(`Pre-installation Check FOUND.`)
            var shouldBeInstalled = definition.meta.on.installing($, definition.name, definition.path);
            if (verbose) {
                if (shouldBeInstalled) {
                    console.log('Pre-installation Check PASSED.')
                } else {
                    console.log('Pre-installation Check FAILED. Module will NOT be installed.');
                }
            }
            return shouldBeInstalled;
        }
    };

    var doInstall = function ($, verbose) {
        if (undefined !== definition.meta.install) {
            if (verbose)
                console.log(`Custom Installation found. Installing module using CUSTOM INSTALLATION.`)
            definition.meta.install($, definition.name, definition.path);
        } else {
            if (verbose)
                console.log('Installing module.')
            var binding = $.bind(definition.name).to(require(definition.payload));
            if (undefined !== definition.meta.use) {
                binding = binding.use.apply(binding, definition.meta.use);
            }
            if (undefined !== definition.meta.set) {
                binding = binding.set(definition.meta.set);
            }
            if (definition.meta.singleton) {
                binding = binding.asSingleton();
            }
        }
        if (verbose)
            console.log(`Module installed.`);
    };

    var onPostInstall = function ($, verbose) {
        if (undefined === definition.meta.on || typeof definition.meta.on.installed !== 'function') {
            if (verbose)
                console.log('Post-installation Check NOT FOUND. Checking skipped.')
            return;
        }
        if (verbose)
            console.log('Post-installation Check FOUND.')
        definition.meta.on.installed($, definition.name, definition.path);
        if (verbose)
            console.log('Post-installation Check COMPLETED.')
    };

    this.onAllInstalled = function ($, verbose) {
        if (!isInstalled) return;
        if (undefined === definition.meta.on || typeof definition.meta.on.allInstalled !== 'function') return;
        if (verbose)
            console.log(`Found Final Check for [${definition.name}].`);
        definition.meta.on.allInstalled($, definition.name, definition.path);
        if (verbose)
            console.log(`Final Check PASSED.`);
    };

    this.install = function ($, verbose) {
        if (verbose) {
            console.log('--------------------------------')
            console.log(`Installing Module: [${definition.name}] at '${definition.path}'`);
        }
        if (!shouldInstall($, verbose)) return;
        doInstall($, verbose);
        onPostInstall($, verbose);
        isInstalled = true;
    }
}

module.exports = (container) => new(function ($) {

    var discoverModules = function (rootPath, parent) {
        var modules = [];
        var fs = require('fs'),
            path = require('path');
        fs.readdirSync(rootPath).forEach((name) => {
            var modulePath = path.join(rootPath, name);
            var stat = fs.statSync(modulePath);
            var moduleName = parent ? `${parent}.${name}` : name;
            if (stat.isDirectory()) {
                var moduleMetaPath = path.join(modulePath, 'meta.js');
                if (fs.existsSync(moduleMetaPath) && fs.statSync(moduleMetaPath).isFile()) {
                    var definition = new ModuleDefinition(moduleName, modulePath, require(moduleMetaPath));
                    var modulePayloadPath = path.join(modulePath, 'payload.js');
                    fs.existsSync(modulePayloadPath) && fs.statSync(modulePayloadPath).isFile()
                    definition.payload = modulePayloadPath;
                    modules.push(new Module(definition));
                }
                modules = modules.concat(discoverModules(modulePath, moduleName));
            }
        });
        return modules;
    }

    var onAllInstalled = function (modules, verbose) {
        modules.forEach(module => {
            module.onAllInstalled($, verbose);
        })
    }

    this.install = function (path, verbose) {
        if (verbose)
            console.log(`DISCOVERING MODULES`);
        var modules = discoverModules(path);
        if (verbose) {
            console.log(`Found ${modules.length} modules under '${path}'`);
        }
        modules.forEach(module => {
            module.install($, verbose);
        });
        if (verbose) {
            console.log('--------------------------------')
            console.log(`All modules installed.`);
        }
        onAllInstalled(modules, verbose);
        if (verbose) {
            console.log('--------------------------------')
            console.log(`INSTALLATION COMPLETED`);
        }
    };
})(container);