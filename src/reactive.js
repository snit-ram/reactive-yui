YUI.add("reactive", function (Y) {
    "use strict";

    var ignoredAttributes = {
        "initialized": true,
        "destroyed": true
    };

    function ReactiveExtension() {}
    ReactiveExtension.NAME = 'ReactiveExtension';
    ReactiveExtension.prototype.initializer = function () {
        this._deps = {};
        this._reactiveComputations = [];
        Y.Do.before(this._trackAttribute, this, "get", this);
    };

    ReactiveExtension.prototype.destructor = function () {
        this._reactiveComputations.forEach(function (computation) {
            computation.stop();
        });
        this._reactiveComputations = [];
    };

    ReactiveExtension.prototype._trackAttribute = function (attribute) {
        if (ignoredAttributes[attribute]) {
            return;
        }

        if (!Y.Object.hasKey(this._deps, attribute)) {
            this._deps[attribute] = new Y.Deps.Dependency();

            this.after(attribute + 'Change', function () {
                this._deps[attribute].changed();
            }, this);
        }
        this._deps[attribute].depend();
    };

    ReactiveExtension.wrap = function (object) {
        if (!object._deps) {
            Y.augment(object, Y.Reactive);
            Y.Reactive.prototype.initializer.call(object);
        }

        return object;
    }

    Y.Reactive = ReactiveExtension;
}, "@VERSION@", {
    requires: [
        "deps"
    ]
});
