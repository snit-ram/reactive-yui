YUI.add("reactive-model", function (Y) {
    "use strict";

    Y.ReactiveModel = Y.Base.create("ReactiveModel", Y.Model, [Y.Reactive], {});
}, "@VERSION@", {
    requires: [
        "model",
        "reactive"
    ]
});
