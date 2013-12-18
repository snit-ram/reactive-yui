YUI.add("reactive-model-list", function (Y) {
    "use strict";

    Y.ReactiveModelList = Y.Base.create("ReactiveModelList", Y.ModelList, [Y.Reactive], {
        initializer: function () {
            this._reactivePendingChanges = [];
            Y.Do.before(this._trackList, this, "getById", this);
            Y.Do.before(this._trackList, this, "getByClientId", this);
            Y.Do.before(this._trackList, this, "item", this);
            Y.Do.before(this._trackList, this, "each", this);
            Y.Do.before(this._trackList, this, "size", this);
            Y.Do.before(this._trackList, this, "some", this);
            Y.Do.before(this._trackList, this, "filter", this);
            Y.Do.before(this._trackList, this, "toArray", this);
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
