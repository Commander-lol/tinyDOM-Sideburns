if (!window.mu) {
    throw new Error("tinyDOM-Sideburns requires tinyDOM to be in use on the page");
}

mu.render = function (path, data, options) {
    if (render.includes.hasOwnProperty(path)) {
        return render.includes[path](data, options);
    } else {
        return render(path, data, options);
    }
};

mu.include = function (path, template) {
    render.addInclude(path, template);
};

mu.partial = render.partial;

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
        render.addInclude(name, e.textContent);
    });
});
