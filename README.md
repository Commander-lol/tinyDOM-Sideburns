# tinyDOM-Sideburns
A tinyDOM plugin that integrates Sideburns into batch selector.

tinyDOM-Sideburns adds two new items to the mu global and one new function to the batch selector.

## Additions to mu
mu has been given the property "templates", which holds pre-compiled templates (A version of the 
sideburns render function, pre-seeded with a node list containing the template) that were defined
on page load. Any of these templates can be invoked as a function, with only the `data` and `options`
parameters required. See [the sideburns repo](https://github.com/BuyPro/Sideburns) for more information
about those parameters.

tinyDOM-Sideburns also adds the `mu.render(template, data[, options])` function. The `template` parameter
should be one of two things - either the name of a pre-compiled template (defined by the `data-name` attribute
on the template script tag) or a string containing a template. The string will first be compared to the keys
in the `mu.templates` object. If a match is found, that template will be used with the provided data and
options - otherwise, the `template` parameter will be interpreted as a template itself. In both cases, this
function works in the same way as the `sideburns.render(template, data[, options])` function in the aforementioned
sideburns repo, and will return a string.

## Additions to mu/batch
tinyDOM-Sideburns adds a `render(template, data[, options])` function to the mu batch object (obtained by using
`mu("ident")`). It is identical to the `mu.render(template, data[, options])` function, but will automatically
set the inner content of each matched element to the rendered template instead of returning a string.

By default the batch method will set the `innerHTML` of the elements, but setting the `useHtml` property of 
`options` to `false` will cause the function to set the `textContent` instead (mitigating a potential xss vector
if you don't trust the content being rendered). textContent is supported in IE >= 9.
