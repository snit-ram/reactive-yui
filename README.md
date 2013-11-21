# Reactive YUI

Reactive YUI is a set of YUI modules that brings reactive programming and data-binding support for YUI projects.


### Configuring

In order to start uing Reactive YUI, all you need to do is download the project and import the files in your HTML or configure YUI loader to know where are the files.


#### Adding javascript files to the page:

```html
<script src="http://yui.yahooapis.com/3.13.0/build/yui/yui-min.js"></script>
<script src="reactive-yui/src/reactive-handlebars.js"></script>
<script src="reactive-yui/src/deps.js"></script>
<script src="reactive-yui/src/reactive.js"></script>
<script src="reactive-yui/src/reactive-model.js"></script>
<script src="reactive-yui/src/reactive-model-list.js"></script>
```


#### Configuring YUI loader:

```js
YUI({
    modules: {
        'reactive-handlebars': {
            fullpath: 'reactive-yui/src/reactive-handlebars.js'
        },
        'deps': {
            fullpath: 'reactive-yui/src/deps.js'
        },
        'reactive-model-list': {
            fullpath: 'reactive-yui/src/reactive-model-list.js'
        },
        'reactive-model': {
            fullpath: 'reactive-yui/src/reactive-model.js'
        },
        'reactive-view': {
            fullpath: 'reactive-yui/src/reactive-view.js'
        },
        'reactive': {
            fullpath: 'reactive-yui/src/reactive.js'
        }
    }
}).use('reactive-handlebars', funtion(){
   // just use the modules
});
```


## Reactive Handlebars

Reactive Handlebars, is a modified version of handlebars with support for rendering instances of YUI Attributes derivatives. It also integrates with the other reactive structures provided by Reactive YUI in order to auto-update values in the rendered template.

Let's suppose the following template:

```html
<script id="template" type="text/handlebars">
    <ul>
        <li>
            <strong>First Name:</strong>
            <span>{{firstName}}</span>
        </li>
        <li>
            <strong>Last Name:</strong>
            <span>{{lastName}}</span>
        </li>
        <li>
            <strong>Full Name:</strong>
            <span>{{fullName}}</span>
        </li>
    </ul>
</script>
```


You can use `Y.one` to grab the template contents, and use `Y.ReactiveHandlebars.compile` to create a template just like you would do with `Y.Handlebars.compile`. They have the same API

```js
YUI().use('reactive-handlebars', 'reactive-model', 'node-base', function (Y) {
    var person = new Y.ReactiveModel({
        firstName: 'Anakin',
        lastName: 'Skywalker',
    })

    var template = Y.ReactiveHandlebars.compile(Y.one('#template').getHTML());
    Y.one('#container').setContent(template(person));
});
```

### YUI Attributes integration

`ReactiveHandlebars` is fully integration with YUI `Attribute` module, wich means you can render instances of any class that derives on `Attribute` without needing to serialize them.


#### Y.Handlebars needs models to be serialized

```js
var template = Y.Handlebars.compile(Y.one('#template').getHTML());
Y.one('#container').setContent(template(person.toJSON()));
```

#### Y.ReactiveHandlebars renders models correctly

```js
var template = Y.ReactiveHandlebars.compile(Y.one('#template').getHTML());
Y.one('#container').setContent(template(person));
```


### Automatic updates

Wherever you update an attribute of a reactive structure used in your templates, the values on the template gets updated.

ReactiveHandlebars also knows how to update only the DOM parts that really needs to be updated. Don't ever get your entire template to get re-rendered again.

```js
// this line will cause the rendered template to get updated.
person.set('lastName', 'Vader');
```


> **Note:** ReactiveHandlebars inserts empty `<script>` tags in your rendered templates in order to identify the DOM elements that needs to be updated. This means you may need to replace `:first-child` and `:last-child` css selectors by `:first-of-type()` and `:last-of-type()`.


