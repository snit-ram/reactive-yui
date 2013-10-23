YUI.add("reactive", function (Y) {
    "use strict";

    function ReactiveExtension() {}
    ReactiveExtension.NAME = 'ReactiveExtension';
    ReactiveExtension.prototype.initializer = function () {
        this._deps = {};
        this._reactiveComputations = [];
        Y.Do.before(this._trackAttribute, this, "get", this);
    };

    ReactiveExtension.prototype.destructor = function () {
        this._reactiveComputations.forEach(function(computation){
            computation.stop();
        });
        Y.Do.before(this._trackAttribute, this, "get", this);
    };

    ReactiveExtension.prototype._trackAttribute = function (attribute) {
        if (_.contains(["initialized", "destroyed"], attribute)) {
            return;
        }

        if (!_.has(this._deps, attribute)) {
            this._deps[attribute] = new Y.Deps.Dependency();

            this.after(attribute + 'Change', function () {
                this._deps[attribute].changed();
            }, this);
        }
        this._deps[attribute].depend();
    };

    Y.Reactive = ReactiveExtension;
}, "@VERSION@", {
    requires: [
        "deps"
    ]
});
