YUI.add("reactive-view", function (Y) {
    "use strict";

    Y.ReactiveView = Y.Base.create("ReactiveView", Y.View, [Y.Reactive], {
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

            self.get('container').setContent(contents);
            self.afterRender();

            return this;
        },
    });
}, "@VERSION@", {
    requires: [
        "deps",
        "view",
        "reactive"
    ]
});
