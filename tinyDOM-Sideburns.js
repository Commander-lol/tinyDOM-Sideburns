/*globals console, mu */
(function () {
    "use strict";

    if (!window.mu) {
        throw new Error("tinyDOM-Sideburns requires tinyDOM to be in use on the page");
    }

    mu.templates = {};

    mu.render = function (path, data, options) {
        if (mu.templates.hasOwnProperty(path)) {
            return mu.templates[path](data, options);
        } else {
            return window.sideburns(path, data, options);
        }
    };


    mu.fn.render = function (path, data, options) {
        var rendered = mu.render(path, data, options),
            opts = options || {useHtml: true};
        if (typeof opts.useHtml === "undefined") {
            opts.useHtml = true;
        }

        this.each(function (i, e) {
            if (opts.useHtml) {
                e.innerHTML = rendered;
            } else {
                e.textContent = rendered;
            }
        });
    };

    mu.ready(function () {
        mu("[type='x-template/sideburns']").each(function (i, e) {
            var name = e.getAttribute("data-name");
            mu.templates[name] = window.sideburns.partial(e.textContent);
        });
    });

}());
