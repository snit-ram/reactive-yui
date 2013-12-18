YUI.add("reactive-handlebars", function (Y) {
    "use strict";

    var lowLevelHelpers = {};

    Y.ReactiveHandlebars = Y.merge(Y.Handlebars);

    function ReactiveHandlebarsCompiler() {}

    Y.ReactiveHandlebars.registerLowLevelHelper = function (name, fn) {
        lowLevelHelpers[name] = true;
        return Y.ReactiveHandlebars.registerHelper(name, fn);
    };

    Y.ReactiveHandlebars.Compiler = Y.extend(ReactiveHandlebarsCompiler, Y.Handlebars.Compiler, {
        compiler: ReactiveHandlebarsCompiler,
        mustache: function (mustache) {
            var hash = getCompilerHash(mustache),
                id = new Y.Handlebars.AST.IdNode([{
                    part: '_attributeMustache'
                }]);

            mustache = new Y.Handlebars.AST.MustacheNode([id], hash, !mustache.escaped);

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

    function _resolveAttributeValue(attributeName, initialContext, additionalContexts) {
        var returnValue = initialContext;

        attributeName.split('.').forEach(function (id, identifierPathIndex) {
            if (returnValue === null || returnValue === undefined) {
                return returnValue;
            }

            var contexts = [returnValue],
                reversedContexts = [returnValue];

            if (identifierPathIndex === 0) {
                contexts = contexts.concat(additionalContexts || []);
                reversedContexts = reversedContexts.concat(additionalContexts || []).reverse();
            }

            // when accessing this, we don't need to change the context
            if (id !== 'this') {
                var firstMethod = Y.Array.find(reversedContexts, function (context) {
                    return Y.Lang.isFunction(context[id]);
                });

                if (firstMethod) {
                    return returnValue = firstMethod[id](returnValue);
                }

                Y.Array.some(contexts, function (context) {
                    if (context._ATTR_E_FACADE) {
                        // We should skip this context if the ModelList does not have the desired attribute
                        // otherwise ModelList.get would return values from its items
                        if (context._isYUIModelList && !Y.Object.hasKey(context._attrs, id)) {
                            returnValue = undefined;
                            return false;
                        }

                        returnValue = context.get(id);
                        return Y.Object.hasKey(context._state.data, id);
                    }

                    if (Y.Object.hasKey(context, id)) {
                        returnValue = context[id];
                        return true;
                    }

                    returnValue = undefined;
                    return false;
                });
            }
        });

        return returnValue;
    }

    function getResolvedAttributeValuesFromParams(optionsHash, context, additionalContexts) {
        var params = [],
            paramsIDs = !optionsHash._params ? [] : optionsHash._params.split(','),
            paramTypes = !optionsHash._types ? [] : optionsHash._types.split(',');

        Y.Array.each(paramTypes, function (type, index) {
            var id = paramsIDs[index],
                value;

            if (type === 'ID') {
                value = _resolveAttributeValue(id, context, additionalContexts);
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

        insertAfter(node, value);
    }

    Y.ReactiveHandlebars.getExecutionInfo = function (_options, context) {
        var options = Y.merge(_options),
            helperName = options.hash._helper,
            helper = Y.Handlebars.helpers[helperName],
            hashIDs = !options.hash._hashIDs ? [] : options.hash._hashIDs.split(','),
            escaped = options.hash._escaped,
            params = getResolvedAttributeValuesFromParams(options.hash, context, options.data._depths);

        var hash = Y.merge(options.hash);
        delete hash._params;
        delete hash._types;
        delete hash._helper;
        delete hash._hashIDs;
        delete hash._escaped;

        options.hash = {};
        Y.Object.each(hash, function (value, key) {
            if (hashIDs.indexOf(value) !== -1) {
                options.hash[key] = _resolveAttributeValue(value, context, options.data._depths);
            } else {
                options.hash[key] = value;
            }
        });

        params.push(options);

        return {
            isHelper: !! helperName,
            params: params,
            helper: helper,
            escaped: escaped
        };
    };

    function resolveClasses(text, context, additionalContexts) {
        var classNames = text.split(' ').map(function (bindPart) {
            //static classes are writen in the form :className
            if (bindPart[0] === ':') {
                return bindPart.slice(1);
            }

            var parts = bindPart.split(':'),
                contextAttribute = parts[0];

            if (_resolveAttributeValue(contextAttribute, context, additionalContexts)) {
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

        var returnValue;

        options.context._reactiveComputations.push(Y.Deps.autorun(function () {
            var value = options.value.call(options.context);

            if (!this.firstRun) {
                options.update.call(options.context, value);
                return;
            }

            returnValue = options.decorate.call(options.context, value);
        }));

        return returnValue;
    };

    function isLowLevelHelper(options) {
        return options.hash._helper && lowLevelHelpers[options.hash._helper];
    }

    Y.Handlebars.registerHelper('_attributeBlockHelper', function (options) {
        options.data._depths = options.data._depths || [];
        if (options.data._depths.indexOf(this) === -1) {
            options.data._depths.push(this);
        }

        if (isLowLevelHelper(options)) {
            return Y.Handlebars.helpers[options.hash._helper].call(this, options);
        }

        var id = Y.guid();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = Y.ReactiveHandlebars.getExecutionInfo(options, this),
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

    Y.ReactiveHandlebars.registerLowLevelHelper('bindAttr', function (_options) {
        var id = Y.guid();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var self = this,
                    returnObject = {};

                var options = Y.ReactiveHandlebars.getExecutionInfo(_options, self).params[0];

                Y.Object.each(options.hash, function (value, key) {
                    if (key === 'class') {
                        value = resolveClasses(value, self, options.data._depths);
                    } else {
                        value = _resolveAttributeValue(value, self, options.data._depths);
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

                if (!node) {
                    return;
                }

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


    Y.ReactiveHandlebars.registerLowLevelHelper('if', function (options) {
        var id = Y.guid();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = Y.ReactiveHandlebars.getExecutionInfo(options, this),
                    value = executionInfo.params[0];

                if (value) {
                    if (value._isYUIModelList && value.size() === 0) {
                        return options.inverse(this, options.data);
                    }

                    return options.fn(this, options.data);
                }

                return options.inverse(this, options.data);
            },
            decorate: function (value) {
                return new Y.ReactiveHandlebars.SafeString('<script id="_reactive_handlebars_' + id + '"></script>' + value + '<script id="_reactive_handlebars_' + id + '_end"></script>');
            },
            update: function (value) {
                replaceContent(id, value);
            }
        });
    });

    Y.ReactiveHandlebars.registerLowLevelHelper('unless', function (options) {
        var fn = options.fn;

        options.fn = options.inverse;
        options.inverse = fn;

        return Y.ReactiveHandlebars.helpers['if'].call(this, options);
    });

    function insertAfter(targetNode, value) {
        if (!targetNode) {
            return;
        }

        var identifiers = value.match(/_reactive_handlebars[^"]+/g),
            cleanHTML,
            tmpNode;

        cleanHTML = value.replace(/<\/tr>((\r|\n|\t|\s)*<script (id|class)="_reactive_handlebars_.*?><\/script>)+/gi, function (x) {
            return x.replace(/script/g, 'tr');
        });
        cleanHTML = cleanHTML.replace(/<script (id|class)="_reactive_handlebars_.*?><\/script>(\r|\n|\t|\s)*<tr[\s>]/gi, function (x) {
            return x.replace(/script/g, 'tr');
        });
        tmpNode = Y.Node.create(cleanHTML);

        Y.Array.forEach(identifiers, function (id) {
            var nonScriptNode = tmpNode.one('#' + id + ':not(script), .' + id + ':not(script)'),
                scriptNode;

            if (nonScriptNode) {
                scriptNode = Y.Node.create('<script></script>');
                scriptNode.setAttrs(nonScriptNode.getAttrs(['className', 'id']));
                nonScriptNode.replace(scriptNode);
            }
        });

        targetNode.insert(tmpNode, 'after');
    }

    Y.ReactiveHandlebars.registerLowLevelHelper('each', function (options) {
        var id = Y.guid(),
            self = this;

        function getListContents(value, listId) {
            return Y.Deps.nonreactive(function () {
                var listContents = '';

                if (!value) {
                    return options.inverse(self, options.data);
                }

                if (value._isYUIModelList) {
                    if (value.size() === 0) {
                        return options.inverse(self, options.data);
                    }

                    value.each(function (item) {
                        var id = listId + '_list_item';
                        listContents += '<script class="_reactive_handlebars_' + id + '"></script>' + options.fn(item, options.data) + '<script class="_reactive_handlebars_' + id + '_end"></script>';
                    });
                } else {
                    if (value.length === 0) {
                        return options.inverse(self, options.data);
                    }
                    Y.Array.each(value, function (item) {
                        var id = listId + '_list_item',
                            itemHTML = options.fn(item, options.data);

                        listContents += '<script class="_reactive_handlebars_' + id + '"></script>' + itemHTML + '<script class="_reactive_handlebars_' + id + '_end"></script>';
                    });
                }
                return listContents;
            });
        }

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = Y.ReactiveHandlebars.getExecutionInfo(options, this);

                return executionInfo.params[0];
            },
            decorate: function (value) {
                value && value.size && value.size();
                var x = new Y.ReactiveHandlebars.SafeString('<script id="_reactive_handlebars_' + id + '"></script>' + getListContents(value, id) + '<script id="_reactive_handlebars_' + id + '_end"></script>');
                return x;
            },
            update: function (value) {
                if (value && !value._isYUIModelList) {
                    return replaceContent(id, getListContents(value, id));
                }

                value.size();
                return Y.Deps.nonreactive(function () {
                    var pendingChanges = value._reactivePendingChanges || [],
                        pendingChange;

                    while (pendingChanges.length) {

                        pendingChange = pendingChanges.shift();
                        var itemId = id + '_list_item',
                            node;

                        if (/:add$/.test(pendingChange.type)) {
                            var renderedItem = '<script class="_reactive_handlebars_' + itemId + '"></script>' + options.fn(pendingChange.model, options.data) + '<script class="_reactive_handlebars_' + itemId + '_end"></script>';

                            if (pendingChange.index === 0) {
                                if (value.size() === 1) {
                                    replaceContent(id, renderedItem);
                                } else {
                                    insertAfter(Y.one('#_reactive_handlebars_' + id), renderedItem);
                                }
                            } else {
                                node = insertAfter(Y.all('._reactive_handlebars_' + itemId + '_end').item(pendingChange.index - 1), renderedItem);
                            }

                        } else if (/:remove$/.test(pendingChange.type)) {
                            node = Y.all('._reactive_handlebars_' + itemId).item(pendingChange.index);
                            var nextNode;

                            while (!node.hasClass('_reactive_handlebars_' + itemId + '_end')) {
                                nextNode = Y.one(node.getDOMNode().nextSibling);
                                node.remove();
                                node = nextNode;
                            }
                            node.remove();

                            if (value.size() === 0) {
                                replaceContent(id, getListContents([], id));
                            }
                        } else {
                            replaceContent(id, getListContents(pendingChange.models, id));
                        }
                    }
                });
            }
        });
    });


    Y.Handlebars.registerHelper('_attributeMustache', function (options) {
        if (isLowLevelHelper(options)) {
            return Y.Handlebars.helpers[options.hash._helper].call(this, options);
        }

        var id = Y.guid();

        return Y.ReactiveHandlebars.runReactive({
            context: this,
            value: function () {
                var executionInfo = Y.ReactiveHandlebars.getExecutionInfo(options, this),
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
        'array-extras',
        "handlebars",
        "oop",
        "node",
        "deps"
    ]
});
