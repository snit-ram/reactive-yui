YUI.add("reactive", function (Y) {
    "use strict";

    var ignoredAttributes = ["initialized", "destroyed"];

    function ReactiveExtension() {}
    ReactiveExtension.NAME = 'ReactiveExtension';
    ReactiveExtension.prototype.initializer = function () {
        this._deps = {};
        this._reactiveComputations = [];
        Y.Do.before(this._trackAttribute, this, "get", this);
    };

    ReactiveExtension.prototype.destructor = function () {
        Y.Array.invoke(this._reactiveComputations, "stop");
        this._reactiveComputations = [];
        this._deps = {};
    };

    ReactiveExtension.prototype._trackAttribute = function (attribute) {
        if (ignoredAttributes.indexOf(attribute) !== -1) {
            return;
        }

        if (!Y.Object.hasKey(this._deps, attribute)) {
            this._deps[attribute] = new Y.Deps.Dependency();

            this.after(attribute + 'Change', function (event) {
                if (event.newVal !== event.prevVal) {
                    this._deps[attribute].changed();
                }
            }, this);
        }
        this._deps[attribute].depend();
    };

    ReactiveExtension.mix = function (object) {
        if (!object._deps) {
            Y.augment(object, Y.Reactive);
            Y.Reactive.prototype.initializer.call(object);
        }

        return object;
    }

    Y.Reactive = ReactiveExtension;
}, "@VERSION@", {
    requires: [
        "array-invoke",
        "deps",
    ]
});
