/*jslint node: true */
'use strict';
var globalOptions = {
        ignoreUndefined: false,
        escape: "general",
        escapeSets: {
            xml: {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            },
            general: {
                "\"": "\\\"",
                "\'": "\\\'"
            }
        }
    },
    deepMergeJson = function (obja, objb) {
        var prop;
        for (prop in objb) {
            if (objb.hasOwnProperty(prop)) {
                if (typeof (obja[prop]) === 'object' && typeof (objb[prop]) === 'object') {
                    obja[prop] = deepMergeJson(obja[prop], objb[prop]);
                } else {
                    obja[prop] = objb[prop];
                }
            }
        }
        return obja;
    },
    setDeepProperty = function (ident, value, obj, makepath) {
        var list,
            recurse = function (propList, value, obj) {
                var id;
                if (propList.length > 1) {
                    id = list.shift();
                    if (!obj.hasOwnProperty(id)) {
                        if (makepath) {
                            obj[id] = {};
                        } else {
                            throw new Error("No internal property " + id + " at depth N - " + (list.length));
                        }
                    }
                    recurse(propList, value, obj[id]);
                } else {
                    obj[propList[0]] = value;
                }
            };

        if (!ident.push && !ident.map) {
            list = ident.split(".").map(function (e) {return e.trim(); });
        } else {
            list = ident;
        }

        recurse(list, value, obj);
        return obj;
    },
    getDeepProperty = function (ident, obj) {
        var ret = null,
            list,
            recurse = function (propList, obj) {
                var curident;
                if (propList.length > 1) {
                    if (obj.hasOwnProperty(propList[0])) {
                        recurse(propList, obj[list.shift()]);
                    } else {
                        curident = propList.reduce(function (a, b, i) {
                            return a + (i > 0 ? "." : "") + b;
                        });
                        throw new Error("Invalid proprty, missing expected data \"" + curident + "\" (IDENT: " + ident + ") from data " + JSON.stringify(obj));
                    }
                } else {
                    if (obj.hasOwnProperty(propList[0])) {
                        ret = obj[propList[0]];
                    } else {
                        throw new Error("Invalid proprty, missing expected data \"" + propList[0] + "\" (IDENT: " + ident + ") from data " + JSON.stringify(obj));
                    }
                }
            };

        if (!ident.push && !ident.map) {
            list = ident.split(".").map(function (e) {return e.trim(); });
        } else {
            list = ident;
        }

        recurse(list, obj);
        return ret;
    },
    /**
     * Uses getDeepProperty to retrieve a property from an
     * object but emulates normal object value retrieval by
     * returning undefined if a property doesn't exist instead
     * of throwing an error
     * @param   {String} ident The full 'path' of the property
     *                       to retrieve, where dots denote
     *                       sub objects and the last portion
     *                       is the property in the deepest level
     * @param   {Object} obj   The [JSON] object that you are
     *                       trying to retrieve a value from
     * @returns {*}      The data stored under the specified deep
     *                   identifier, or undefined if the identifier
     *                   does not resolve
     */
    getDeepPropertyOrUndef = function (ident, obj) {
        var res;
        try {
            res = getDeepProperty(ident, obj);
        } catch (e) {
            res = undefined;
        }
        return res;
    },
    /**
     * Perform a deep merge that will not modify either of the original objects. Also checks
     * that both parameters are strictly objects.
     * @param   {Object} obja The object that forms the base of the return value. All
     *                      properties in this object will be present in the return
     *                      object, but may be overwritten with new values. The passed
     *                      object instance will not be modified.
     * @param   {Object} objb The object that offers the values to be copied into the
     *                      first object. All properties in this object will exist in the
     *                      return object with the values specified. The return object may
     *                      have other properties if they are defined in obja but not this
     *                      parameter.
     * @returns {Object} An object that contains all of the properties of obja and objb, with
     *                   the values from objb taking precedence if the property is defined in
     *                   both (The key set is {keys(obja) ∪ keys(objb)}).
     */
    safeDeepMergeJson = function (obja, objb) {
        if (typeof (obja) !== 'object') {
            throw new TypeError("Cannot deep merge with an " + typeof (obja) + ": [Param 1]");
        }
        if (typeof (objb) !== 'object') {
            throw new TypeError("Cannot deep merge with an " + typeof (objb) + ": [Param 2]");
        }

        return deepMergeJson(deepMergeJson({}, obja), objb);
    },
    escapeRegex = function (reg) {
        return reg.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    },
    escapeData = function (datum, escapes) {
        var prop;
        for (prop in escapes) {
            if (escapes.hasOwnProperty(prop)) {
                datum = String(datum).split(prop).join(escapes[prop]);
            }
        }
        return datum;
    },
    /**
     * Using this Regex
     * This regular expression will match and split all valid tags for Sideburns, and provides
     * all data needed to appropriately lex each tag
     *
     * Result indexes (from re.exec()):
     * [0] The whole tag that has been matched
     * [1, 9] These are the opening and closing double square brackets, respectively. Always present
     * [2] The Tag modifier. This will either be '/' for a closing tag, '#' for a pre-process directive
     *     or undefined for all other tags. Processing should branch here depending on whether or not this
     *     token is a hash ('#'). Indexes for one branch will be undefined in case of the other branch.
     *
     * == In case of Directive ==
     * [3] The identifier of the directive to set. Always present
     * [4] The value to set the directive. Always present
     *
     * == In case of other tag ==
     * [5] The Block modifier. Will be '*' for arrays, '&' for context and undefined for simple tags
     * [6] The Data modifier. Will be '!' for an escape with the global set, '!([7])' for an escape with a
     *     specified set or undefined for unescaped data
     * [7] If a set has been specified, this will be the name of the set on its own, seperate from the data
     *     modifier. It will otherwise be undefined
     * [8] The identifier for the data or block that the tag represents. Always present
     **/
    captureTags = /(\[\[)(\#|\/)?\s*(?:([a-zA-Z]+[a-zA-Z0-9]*)\s*\:\s*([a-zA-Z]+[a-zA-Z0-9]*)|([\*\&\>\?]?)\s*((?:\!(?:\(([a-zA-Z]+[a-zA-Z0-9]*)\))?)?)\s*([a-zA-Z](?:[a-zA-Z0-9]*(?:\.(?=[a-zA-Z]))?)+))\s*(\]\])/,
    /**
     * A Node represents a sub-group inside a Sideburns
     * template and typically contains a list of other
     * Nodes and Tokens
     * @param   {String} type    A value that identifies the
     *                         specific type of this Node
     * @param   {*}    val     The exact value this Node represents
     * @param   {Array}  content A list of other nodes and tokens
     * @returns {Node}   The complete node, representing a sub-tree in a
     *                   Sideburns template
     */
    Node = function (type, val, content) {
        this.ident = type || "N_NULL";
        this.val = val || null;
        this.content = content || {};
        return this;
    },
    /**
     * A Token represents an atomic unit in a Sideburns template
     * @param   {String} ident A value that identifies the specific
     *                       type of this token
     * @param   {*}    val   The exact value that this token represents
     * @param   {Object} info  Additional details that further describe this
     *                       token
     * @returns {Token}  The complete token, representing an element in a
     *                   Sideburns template
     */
    Token = function (ident, val, info) {
        this.ident = ident || "T_NULL";
        this.val = val || null;
        this.info = info || {};
        return this;
    },
    /**
     * Takes a Sideburns template and splits it into constituant tokens.
     * Output is guarenteed to consist of Tokens only, as the template is
     * not collapsed at this stage.
     * @param   {String} src The sideburns template that will be split
     *                     into tokens
     * @returns {Array}  A list of Tokens that represent all elements of the
     *                   template
     */
    tokenise = function (src) {
        var tokens = [],
            last = 0,
            i = 0,
            match = null,
            matcher,
            chunk,
            tok;

        // Possibly hacky, matcher both sets match and returns whether it
        // has been set to null
        matcher = function () {
            return ((match = captureTags.exec(chunk)) !== null);
        };
        while (i < src.length) {
            chunk = src.substr(i);
            if (matcher()) {
                if (match.index > 0) {
                    tokens.push(new Token("STRING", match.input.substr(0, match.index)));
                }
                tok = new Token("T_NULL", null, {close: false, escape: false, escapeType: null});
                if (match[2] === '#') {
                    tok.ident = "T_DIRECTIVE";
                    tok.val = {
                        key: match[3],
                        value: match[4]
                    };
                } else {
                    if (match[2] === '/') {
                        tok.info.close = true;
                    }

                    switch (match[5]) {
                    case "*":
                        tok.ident = "T_LOOP";
                        break;
                    case "&":
                        tok.ident = "T_BLOCK";
                        break;
                    case ">":
                        tok.ident = "T_IMPORT";
                        break;
                    case "?":
                        tok.ident = "T_CONDITION";
                        break;
                    default:
                        tok.ident = "T_DATA";
                    }

                    if (typeof (match[6]) !== 'undefined' && match[6].charAt(0) === "!") {
                        tok.info.escape = true;
                        if (typeof (match[7]) !== 'undefined') {
                            tok.info.escapeType = match[7];
                        }
                    }
                    tok.val = match[8];
                }
                tokens.push(tok);
                i += match.index + match[0].length;
            } else {
                tokens.push(new Token("STRING", chunk));
                i += chunk.length;
            }
        }
        tokens.push(new Token("EOD"));
        return tokens;
    },
    /**
     * Takes an Array of tokens and collapses positional grouping tokens
     * into Nodes
     * @param   {Array} tokens A tokenised template. Should consist entirely
     *                       of Tokens.
     * @returns {Array} A list of nodes and tokens that represent blocks and inline
     *                  elements in the template respectively
     */
    collapseParse = function (tokens) {
        var tokenList,
            i = 0,
            j,
            targetToken,
            targetNode,
            nodeName;

        while (i < tokens.length) {
            if (tokens[i].info && tokens[i].info.close) {
                tokenList = [];
                targetToken = tokens[i];
                j = i - 1;

                while (!(tokens[j].ident === targetToken.ident && tokens[j].val === targetToken.val)) {
                    tokenList.push(tokens[j]);
                    j -= 1;
                    if (j < 0) {
                        throw new Error("Unmatched Closing Tag " + targetNode + " at index " + i);
                    }
                }

                switch (targetToken.ident) {
                case "T_LOOP":
                case "T_BLOCK":
                case "T_CONDITION":
                    nodeName = "N" + targetToken.ident.slice(1);
                    break;
                default:
                    throw new Error("Invalid block element " + targetToken.ident + " at index " + i);
                }

                targetNode = new Node(nodeName, targetToken.val, tokenList.slice().reverse());

                tokens.splice(j, (i - j) + 1, targetNode);
                i = 0;
            } else {
                i += 1;
            }
        }
        return tokens;

    },
    /**
     * This is an Array/Reduce function.
     * Takes an element from the array and evaluates it in
     * the data context that has been added to the array.
     * Tokens will be evaluated in place, but Nodes will be
     * "unwound"; this function is recursively applied to Nodes but
     * contains no reference counting, so care should be taken to
     * avoid (the unlikely scenario of) circular references
     * @param   {String}     output          The result of previously evaluated
     *                                     nodes. Essentially the 'running total'
     *                                     of the template so far.
     * @param   {Token|Node} node            The element to be evaluated
     * @param   {Number}     index           The position in the current array.
     *                                     Laregely unused, but needed for access to
     *                                     arr parameter
     * @param   {Array}      arr             The array being reduced; should be enhanced with
     *                                     'data', 'loopTag' and 'i' properties
     * @param   {Object}     arr.data        The data context used when evaluting data tokens
     * @param   {?String}    arr.loopTag     The tag of the current loop being evaluated. Will be null
     *                                     if no loop block is being evaluated
     * @param   {?Number}    arr.i           The position of the iteration through the current
     *                                     loop tag. This is distinct from index in that it refers
     *                                     to the position within a data array, not withing the reduce
     *                                     function.
     * @returns {String}     The result of evaluating the current node, appended to the
     *                                       previous output provided as the first parameter
     */
    unwindNode = function (output, node, index, arr) {
        var innerArr, dataArr, content, i, dataVal, datum, escapeType, ifresult, iff;
        switch (node.ident) {
        case "STRING":
            return output + node.val;

        case "T_DIRECTIVE":
            setDeepProperty(node.val.key, node.val.value, arr.opts, true);
            return output;

        case "T_DATA":
            dataVal = node.val;
            if (arr.loopTag) {
                if (node.val === arr.loopTag.slice(0, -1)) {
                    dataVal = arr.loopTag + "." + (arr.i).toString();
                }
            }
            datum  = getDeepProperty(dataVal, arr.data);
            if (node.info.escape) {
                if (node.info.escapeType) {
                    escapeType = node.info.escapeType;
                } else {
                    escapeType = arr.opts.escape;
                }
                datum = escapeData(datum, arr.opts.escapeSets[escapeType]);
            }
            return output + datum;

        case "T_IMPORT":
            content = arr.includes[node.val];
            if (typeof content !== "undefined" && content !== null) {
                datum = content(arr.data, arr.opts);
            } else {
                if (arr.opts.ignoreUndefined) {
                    datum = "";
                } else {
                    throw new Error("Cannot get include " + node.val);
                }
            }
            return output + datum;
        case "N_LOOP":
            content = "";

            innerArr = node.content;
            innerArr.data = arr.data;
            innerArr.loopTag = node.val;
            innerArr.includes = arr.includes;
            innerArr.opts = deepMergeJson({}, arr.opts);

            dataArr = getDeepProperty(node.val, arr.data);

            for (i = 0; i < dataArr.length; i += 1) {
                innerArr.i = i;
                content += innerArr.reduce(unwindNode, "");
            }

            return output + content;

        case "N_BLOCK":
            innerArr = node.content;
            innerArr.data = getDeepProperty(node.val, arr.data);
            innerArr.loopTag = null;
            innerArr.includes = arr.includes;
            innerArr.opts = deepMergeJson({}, arr.opts);
            return output + innerArr.reduce(unwindNode, "");

        case "N_CONDITION":
            iff = getDeepPropertyOrUndef(node.val, arr.opts);
            if (iff) {
                innerArr = node.content;
                innerArr.data = arr.data;
                innerArr.loopTag = null;
                innerArr.includes = arr.includes;
                innerArr.opts = deepMergeJson({}, arr.opts);

                ifresult = innerArr.reduce(unwindNode, "");
            } else {
                ifresult = "";
            }

            return output + ifresult;

        default:
            return output;
        }
    },
    /**
     * Links the various stages of the Sideburns compiler together
     * and returns the end result
     * @param   {!String} src     The Sideburns template to be rendered
     * @param   {!Object} data    Contains all of the data that will be
     *                         referenced inside the Sideburns template
     * @param   {?Object} options A set of options that will be merged with
     *                         the global options, but can be overriden
     *                         inside the template with directives
     * @returns {String} The rendered template, with data inserted. All
     *                   whitespace is currently left intact, but this may
     *                   change in a future version.
     */
    render = function (src, data, options) {
        var nodes = collapseParse(tokenise(src));
        nodes.data = data;
        nodes.loopTag = null;
        nodes.i = null;
        nodes.includes = render.includes;
        nodes.opts = safeDeepMergeJson(globalOptions, options);
        return nodes.reduce(unwindNode, "");
    };

/**
 * Partially applies the rendering process, compiling a node list but not
 * unwinding it, allowing pre-processing of large templates on initialisation
 * and reducing the need to compile a template on every render.
 * @param   {String}   src The Sideburns template to be rendered
 * @returns {Function} A function that takes a data and options parameter, identical
 *                     to those required by the basic render function.
 */
render.partial = function (src) {
    return function (tokens, data, options) {
        tokens.data = data;
        tokens.loopTag = null;
        tokens.i = null;
        tokens.includes = render.includes;
        tokens.opts = safeDeepMergeJson(globalOptions, options);
        return tokens.reduce(unwindNode, "");
    }.bind(null, collapseParse(tokenise(src)));
};

render.includes = {};
render.addInclude = function (name, template) {
    if (template.split) {
        this.includes[name] = render.partial(template);
    } else {
        this.includes[name] = template;
    }
};
