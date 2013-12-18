YUI.add("reactive-model-list", function (Y) {
    "use strict";

    function arrayDiff(a, b) {
        return a.filter(function (item) {
            return b.indexOf(item) === -1;
        }).concat(b.filter(function (item) {
            return a.indexOf(item) === -1;
        }));
    }

    Y.ReactiveModelList = Y.Base.create("ReactiveModelList", Y.ModelList, [Y.Reactive], {
        initializer: function () {
            this._reactivePendingChanges = [];
            this._idDeps = {};
            this._clientIdDeps = {};
            Y.Do.before(this._trackList, this, "item", this);
            Y.Do.before(this._trackList, this, "each", this);
            Y.Do.before(this._trackList, this, "size", this);
            Y.Do.before(this._trackList, this, "some", this);
            Y.Do.before(this._trackList, this, "filter", this);
            Y.Do.before(this._trackList, this, "toArray", this);

            this._trackGetById('id');
            this._trackGetById('clientId');
        },

        _trackGetById: function (idPropertyName) {
            var depsPropertyName = '_' + idPropertyName + 'Deps';

            this.after(['add', 'remove'], function (e) {
                var id = e.model.get(idPropertyName);
                if (this[depsPropertyName][id]) {
                    this[depsPropertyName][id].changed();
                }
            }, this);

            this.on('reset', function (e) {
                var oldIds = this.get(idPropertyName),
                    newIds = Y.Array.map(e.models, function (model) {
                        return model.get(idPropertyName);
                    }, this);

                arrayDiff(oldIds, newIds).forEach(function (id) {
                    if (this[depsPropertyName][id]) {
                        this[depsPropertyName][id].changed();
                    }
                }, this);
            }, this);
        },

        _trackList: function () {
            var self = this;
            if (!this._deps._YUIModelListDependency) {
                this._deps._YUIModelListDependency = new Y.Deps.Dependency();

                this.after(['add', 'remove', 'reset'], function (e) {
                    self._reactivePendingChanges.push(e);
                    self._deps._YUIModelListDependency.changed();
                });
            }

            this._deps._YUIModelListDependency.depend();
        }
    });
}, "@VERSION@", {
    requires: [
        "model-list",
        "deps",
        "reactive"
    ]
});
