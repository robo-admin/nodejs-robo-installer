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

function ModuleInstaller($) {

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
                    modules.push(definition);
                }
                modules = modules.concat(discoverModules(modulePath, moduleName));
            }
        });
        return modules;
    }

    var installSingle = function (module) {
        if (undefined !== module.meta.install) {
            module.meta.install($, module.name, module.path);
        } else {
            var binding = $.bind(module.name).to(require(module.payload));
            if (undefined !== module.meta.use) {
                binding = binding.use.apply(binding, module.meta.use);
            }
            if (undefined !== module.meta.set) {
                binding = binding.set(module.meta.set);
            }
            if (module.meta.singleton) {
                binding = binding.asSingleton();
            }
        }
    }

    this.install = function (path) {
        var modules = discoverModules(path);
        modules.forEach(function (module) {
            installSingle(module);
        });
    };
}

module.exports = (container) => new ModuleInstaller(container);