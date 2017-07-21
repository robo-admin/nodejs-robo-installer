'use strict';

function ModuleDefinition(name, path, info) {
    this.name = name;
    this.path = path;
    this.info = info;
    this.file = undefined;
}

function ModuleInstaller($) {

    var discoverModules = function (rootPath, parent) {
        var modules = [];
        var fs = require('fs'),
            path = require('path');
        fs.readdirSync(rootPath).forEach((name) => {
            var sub = path.join(rootPath, name);
            var stat = fs.statSync(sub);
            var moduleName = parent ? `${parent}.${name}` : name;
            if (stat.isDirectory()) {
                var moduleMetaPath = path.join(sub, 'meta.js');
                if (fs.existsSync(moduleMetaPath) && fs.statSync(moduleMetaPath).isFile()) {
                    var definition = new ModuleDefinition(moduleName, sub, require(moduleMetaPath));
                    var moduleFilePath = path.join(sub, 'payload.js');
                    fs.existsSync(moduleFilePath) && fs.statSync(moduleFilePath).isFile()
                    definition.file = moduleFilePath;
                    modules.push(definition);
                }
                modules = modules.concat(discoverModules(sub, moduleName));
            }
        });
        return modules;
    }

    var installModule = function (module) {
        if (undefined !== module.info.install) {
            module.info.install($, module.name, module.path);
        } else {
            var binding = $.bind(module.name).to(require(module.file));
            if (undefined !== module.info.use) {
                binding = binding.use.apply(binding, module.info.use);
            }
            if (undefined !== module.info.set) {
                binding = binding.set(module.info.set);
            }
            if (module.info.singleton) {
                binding = binding.asSingleton();
            }
        }
    }

    this.install = function (path) {
        var modules = discoverModules(path);
        modules.forEach(function (module) {
            installModule(module);
        });
    };
}

module.exports = (container) => new ModuleInstaller(container);