YUI.add("reactive-handlebars", function (Y) {
    "use strict";

    var reactiveHelpers = {
        bindAttr: true
    };

    Y.ReactiveHandlebars = Y.merge(Y.Handlebars);

    function ReactiveHandlebarsCompiler() {}
    Y.ReactiveHandlebars.Compiler = Y.extend(ReactiveHandlebarsCompiler, Y.Handlebars.Compiler, {
        compiler: ReactiveHandlebarsCompiler,
        mustache: function (mustache) {
            var hash = getCompilerHash(mustache),
                id = new Y.Handlebars.AST.IdNode([{
                    part: '_attributeMustache'
                }]);

            if (!reactiveHelpers[mustache.id.original]) {
                mustache = new Y.Handlebars.AST.MustacheNode([id], hash, !mustache.escaped);
            }

            return Y.Handlebars.Compiler.prototype.mustache.call(this, mustache);
        },

        block: function (block) {
            var hash = getCompilerHash(block.mustache),
                id = new Y.Handlebars.AST.IdNode([{
                    part: '_attributeBlockHelper'
                }]),
                mustache = new Y.Handlebars.AST.MustacheNode([id], hash);

            block = new Y.Handlebars.AST.BlockNode(mustache, block.program, block.inverse, id);

            return Y.Handlebars.Compiler.prototype.block.call(this, block);
        }
    });

    Y.ReactiveHandlebars.compile = function (input, options) {
        if (input == null || (typeof input !== 'string' && input.constructor !== Y.Handlebars.AST.ProgramNode)) {
            throw new Y.Handlebars.Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
        }

        options = options || {};
        if (!('data' in options)) {
            options.data = true;
        }
        var compiled;

        function compile() {
            var ast = Y.Handlebars.parse(input);
            var environment = new Y.ReactiveHandlebars.Compiler().compile(ast, options);
            var templateSpec = new Y.Handlebars.JavaScriptCompiler().compile(environment, options, undefined, true);
            return Y.Handlebars.template(templateSpec);
        }

        // Template is only compiled on first use and cached after that point.
        return function (context, options) {
            if (!compiled) {
                compiled = compile();
            }
            return compiled.call(this, context, options);
        };
    };

    function getCompilerHash(mustache) {
        var hash = new Y.Handlebars.AST.HashNode([]),
            hashIDs = [],
            types = [],
            paramsIDs = [];

        if (mustache.hash) {
            mustache.hash.pairs.forEach(function (pair) {
                if (pair[1].type === 'ID') {
                    hash.pairs.push([pair[0], new Y.Handlebars.AST.StringNode(pair[1].original)]);
                    hashIDs.push(pair[1].original);
                } else {
                    hash.pairs.push(pair);
                }
            });
        }

        if (mustache.isHelper) {
            hash.pairs.push(["_helper", new Y.Handlebars.AST.StringNode(mustache.id.original)]);
        } else {
            paramsIDs.push(mustache.id.original);
            types.push('ID');
        }

        (mustache.params || []).map(function (param) {
            paramsIDs.push(param.stringModeValue);
            types.push(param.type);

            if (param.type === 'ID') {
                return new Y.Handlebars.AST.StringNode(param.original);
            }

            return param;
        });

        hash.pairs.push(["_params", new Y.Handlebars.AST.StringNode(paramsIDs.join(','))]);
        hash.pairs.push(["_types", new Y.Handlebars.AST.StringNode(types.join(','))]);
        hash.pairs.push(["_hashIDs", new Y.Handlebars.AST.StringNode(hashIDs.join(','))]);
        hash.pairs.push(["_escaped", new Y.Handlebars.AST.BooleanNode(mustache.escaped)]);

        return hash;
    }

    function _resolveAttributeValue(attributeName, context) {
        attributeName.split('.').forEach(function (id) {
            if (context === null || context === undefined) {
                return;
            }

            // when accessing this, we don't need to change the context
            if (id !== 'this') {
                if (context._ATTR_E_FACADE) {
                    context = context.get(id);
                } else {
                    context = context[id];
                }
            }
        });

        return context;
    }

    function getResolvedAttributeValuesFromParams(optionsHash, context) {
        var params = [],
            paramsIDs = _.isEmpty(optionsHash._params) ? [] : optionsHash._params.split(','),
            paramTypes = _.isEmpty(optionsHash._types) ? [] : optionsHash._types.split(',');

        _.each(paramTypes, function (type, index) {
            var id = paramsIDs[index],
                value;

            if (type === 'ID') {
                value = _resolveAttributeValue(id, context);

                if (value && value._isYUIModelList) {
                    value = value.toArray();
                }
            } else if (type === 'BOOLEAN') {
                value = id === "true";
            } else {
                value = id;
            }
            params.push(value);
        });

        return params;
    }

    function replaceContent(id, value) {
        var node = Y.one('#_reactive_handlebars_' + id);

        if (!node) {
            return;
        }

        var nodeToRemove = Y.one(node.getDOMNode().nextSibling),
            nextNode;

        while (nodeToRemove && nodeToRemove.getAttribute('id') !== '_reactive_handlebars_' + id + '_end') {
            nextNode = Y.one(node.getDOMNode().nextSibling);
            nodeToRemove.remove();
            nodeToRemove = nextNode;
        }

        node.insert(value, "after");
    }

    function getExecutionInfo(_options, context) {
        var options = Y.merge(_options),
            helperName = options.hash._helper,
            helper = Y.Handlebars.helpers[helperName],
            hashIDs = _.isEmpty(options.hash._hashIDs) ? [] : options.hash._hashIDs.split(','),
            escaped = options.hash._escaped,
            params = getResolvedAttributeValuesFromParams(options.hash, context);

        options.hash = _(options.hash)
            .omit(['_params', '_types', '_helper', '_hashIDs', '_escaped'])
            .transform(function (result, value, key) {
                if (_.contains(hashIDs, value)) {
                    result[key] = _resolveAttributeValue(value, context);
                } else {
                    result[key] = value;
                }
            }).value();

        params.push(options);

        return {
            isHelper: !! helperName,
            params: params,
            helper: helper,
            escaped: escaped
        };
    }

    function resolveClasses(text, context) {
        var classNames = text.split(' ').map(function (bindPart) {
            //static classes are writen in the form :className
            if (bindPart[0] === ':') {
                return bindPart.slice(1);
            }

            var parts = bindPart.split(':'),
                contextAttribute = parts[0];

            if (_resolveAttributeValue(contextAttribute, context)) {
                return parts[1].replace(",", " ");
            }


            return parts[2] && parts[2].replace(",", " ");
        });

        return classNames.join(' ');
    }

    Y.ReactiveHandlebars.runReactive = function (options) {
        if (!options.context._reactiveComputations) {
            options.context._reactiveComputations = [];
        }

        options.decorate = options.decorate || function (value) {
            return value;
        };

        var firstRun = true,
            returnValue;

        options.context._reactiveComputations.push(Y.Deps.autorun(function () {
            var value = options.value.call(options.context);

            if (!firstRun) {
                options.update.call(options.context, value);
                return;
            }
            firstRun = false;

            returnValue = options.decorate.call(options.context, value);
        }));

        return returnValue;
    };

    Y.Handlebars.registerHelper('_attributeBlockHelper', function (options) {
        var id = _.uniqueId();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = getExecutionInfo(options, this),
                    value = executionInfo.helper.apply(this, executionInfo.params);

                if (value === null || value === undefined) {
                    value = "";
                }

                return value;
            },
            decorate: function (value) {
                return new Y.ReactiveHandlebars.SafeString('<script id="_reactive_handlebars_' + id + '"></script>' + value + '<script id="_reactive_handlebars_' + id + '_end"></script>');
            },
            update: function (value) {
                replaceContent(id, value);
            }
        });
    });

    Y.Handlebars.registerHelper('bindAttr', function (options) {
        var id = _.uniqueId();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var self = this,
                    returnObject = {};

                Y.Object.each(options.hash, function (value, key) {
                    if (key === 'class') {
                        value = resolveClasses(value, self);
                    } else {
                        value = _resolveAttributeValue(value, self);
                    }

                    returnObject[key] = value;
                });

                return returnObject;
            },
            decorate: function (_value) {
                var values = [];
                Y.Object.each(_value, function (value, key) {
                    if (value !== undefined && value !== null && value !== false) {
                        values.push(key + '="' + Y.ReactiveHandlebars.Utils.escapeExpression(value) + '"');
                    }
                });

                return new Y.ReactiveHandlebars.SafeString('data-reactive-handlebars-id="' + id + '" ' + values.join(' '));
            },
            update: function (_value) {
                var node = Y.one('[data-reactive-handlebars-id="' + id + '"]');
                Y.Object.each(_value, function (value, key) {
                    if (value !== undefined && value !== null && value !== false) {
                        node.setAttribute(key, value);
                    } else {
                        node.removeAttribute(key);
                    }
                });
            }
        });
    });

    Y.Handlebars.registerHelper('_attributeMustache', function (options) {
        var id = _.uniqueId();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = getExecutionInfo(options, this),
                    value;

                if (executionInfo.isHelper) {
                    value = executionInfo.helper.apply(this, executionInfo.params);
                } else {
                    value = executionInfo.params[0];
                }

                if (executionInfo.escaped) {
                    value = Y.ReactiveHandlebars.Utils.escapeExpression(value);
                }

                return value;
            },
            decorate: function (value) {
                return new Y.ReactiveHandlebars.SafeString('<script id="_reactive_handlebars_' + id + '"></script>' + value + '<script id="_reactive_handlebars_' + id + '_end"></script>');
            },
            update: function (value) {
                replaceContent(id, value);
            }
        });
    });
}, "@VERSION@", {
    requires: [
        "handlebars",
        "oop",
        "node",
        "deps"
    ]
});
