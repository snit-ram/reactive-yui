YUI.add("reactive-view", function (Y) {
    "use strict";

    Y.ReactiveView = Y.Base.create("ReactiveView", Y.View, [Y.Reactive], {
        initializer: function () {
            var self = this;

            self.rendered = new Y.Promise(function (resolver) {
                self._renderPromiseResolver = resolver;
            });
        },

        beforeRender: function () {},
        afterRender: function () {},

        destructor: function () {},

        render: function () {
            var self = this;

            if (self.get('parentView')) {
                self.get('parentView').on('destroy', function () {
                    self.destroy();
                });
            }

            var contents = self.template(self);

            if (self.beforeRender() === false) {
                return this; //abort rendering
            }

            self.get('container').setContent(contents);

            self._renderPromiseResolver();

            self.afterRender();

            return this;
        },
    });
}, "@VERSION@", {
    requires: [
        "deps",
        "view",
        "reactive",
        "promise"
    ]
});
